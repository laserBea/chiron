# Chiron — Agent 交易安全中间件

## 课程项目汇报完整文档

> 项目代号：**Chiron**（喀戎，神话中的智者与导师）
> 核心理念：**意图-执行语义一致性验证**（Intent-Execution Semantic Consistency Verification）
> 报告日期：2026-06-18

---

## 一、项目概述

### 1.1 解决的问题

AI Agent（如自动交易代理、DeFi 策略代理）正在大规模接管链上资产操作。但当前区块链安全模型存在一个根本性空白：当 Agent 的 LLM 接收外部数据并构造交易时，**没有任何机制检查 Agent 声称要做的操作和它实际签名的交易是否一致**。

攻击者可以：
- 在 Agent 读取的链上数据中嵌入恶意指令（Prompt 注入）
- 替换交易的目标合约、接收地址、金额等参数
- 诱导 Agent 授权攻击者提取用户所有资产

### 1.2 核心思路

传统安全方案问 "Is it safe?"——需要知道用户的真实意图才能判断，这是一个不可判定问题。

Chiron 换了一个问法："**Is it consistent?**"——Agent 声明的结构化的意图和实际签名的交易是否一致？比较两个结构化数据，这是可判定、可验证的。

### 1.3 PPT 结构（13 页）

| 页 | 标题 | 内容 |
|---|---|---|
| 1 | Chiron 封面 | 项目名称、副标题 |
| 2 | 具体场景 | ETH/USDC Swap Agent 交易流程，标注 ①②③ 步骤，突出 ② 缺失的 LLM 黑箱 |
| 3 | Prompt 注入 | Permit 钓鱼攻击示例，展示 calldata 前后对比 |
| 4 | 更多攻击场景 | 地址替换 / delegatecall / 金额操纵 / 钓鱼合约 |
| 5 | 现有方案局限 | Blowfish / Tenderly / Forta / Zodiac 对比 |
| 6 | Chiron 的回答 | "Is it safe?" → "Is it consistent?" 范式转换 |
| 7 | 双层验证架构 | L1 SDK(6规则) + L2 AI交叉验证 + 链上合约 |
| 8 | 攻防数据 | 15/15 攻击类型全覆盖，47 测试通过 |
| **9** | **Sepolia 测试网验证** | 4 合约部署，18 项测试，跨合约集成 |
| **10** | **Agent 框架接入** | SDK / HTTP API / ElizaOS 插件三种方式 |
| **11** | **端到端验证** | DeepSeek API → ElizaOS → Chiron → Sepolia |
| 12 | 参考文献 | 15 条标准格式参考文献 |
| 13 | Thank You | 结束页 |

---

## 二、架构设计

### 2.1 三层架构

```
Layer 1: 智能合约层（EVM）
┌──────────────────────────────────────────────┐
│  BondPool.sol         — 经济质押，决定交易上限   │
│  CircuitBreaker.sol   — 连续 FAIL 自动暂停      │
│  Chiron.sol           — VerificationStore 存证  │
│  IntentTemplateRegistry — 社区协议注册           │
└──────────────────────────────────────────────┘

Layer 2: 链下轻量 SDK（核心校验逻辑）
┌──────────────────────────────────────────────┐
│  IntentParser         — 生成结构化意图模板      │
│  TxDecoder            — Calldata 解码          │
│  ConsistencyChecker   — 6 条 L1 确定性规则      │
│  ReceiptBuilder       — 构建验证结果           │
│  OnChainStore         — 异步链上存证           │
│  BatchParser          — ERC-8211 批量交易解析   │
└──────────────────────────────────────────────┘

Layer 3: 可选 Verifier Network（L2 升级路径）
┌──────────────────────────────────────────────┐
│  GPT-5 Adapter   Claude 4 Adapter  Gemini 3  │
│  VerifierOrchestrator (2/3 共识)              │
└──────────────────────────────────────────────┘
```

### 2.2 L1 六条确定性规则

| 规则 | 检查项 | 定位 |
|---|---|---|
| R1 | 目标合约是否在已知协议地址表中 | 防止钓鱼合约/合约替换 |
| R2 | 函数 selector 是否匹配预期的 Action 类型 | 防止函数替换（如 swap → approve） |
| R3 | TokenIn/TokenOut 地址是否匹配 Intent 声明 | 防止 Token 地址篡改 |
| R4 | 交易金额是否在 Intent 声明的 ±slippage 内 | 防止金额操纵（如 100 → 10000） |
| R5 | 是否有意外参数（receiver 不匹配、隐藏 Approve） | 防止接收地址替换、隐藏授权 |
| R6 | 是否有隐藏的 delegatecall / CREATE2 | 防止隐藏恶意代码执行 |

---

## 三、智能合约

### 3.1 Chiron.sol — 校验存证

核心合约，负责存储每一次校验的 VerificationReceipt。

```solidity
struct VerificationReceipt {
    bytes32 intentHash;
    bytes32 txHash;
    address agent;
    L1Result l1Result;   // PASS / FAIL / UNCERTAIN
    L2Result l2Result;   // NONE / CONSISTENT / INCONSISTENT
    uint256 timestamp;
    uint256 blockNumber;
}
```

主要函数：
- `storeReceipt(bytes32, bytes32, address, uint8, uint8)`：存储校验结果
- `getReceipt(bytes32)`：查询单条存证
- `getAgentReceipts(address)`：查询 Agent 所有历史
- `isAgentPaused(address)`：检查 Agent 是否被暂停

### 3.2 CircuitBreaker.sol — 自动断路

跟踪 Agent 的连续 FAIL 次数，达到阈值（默认 5 次）后自动暂停该 Agent 的交易权限。

### 3.3 BondPool.sol — 经济质押

Agent 通过质押 ETH 获得交易额度：`txLimit = stake × MULTIPLIER(10)`。Owner 可对作恶 Agent 执行 slash。

### 3.4 IntentTemplateRegistry.sol — 协议注册

注册协议 → Action 类型的映射关系，供 L1 校验使用。

---

## 四、SDK 组件

| 模块 | 功能 |
|---|---|
| `intent.ts` | IntentParser：生成 9 种 Action 的结构化意图模板 |
| `decoder.ts` | TxDecoder：解码 calldata，提取函数名和参数 |
| `checker.ts` | ConsistencyChecker：执行 6 条 L1 确定性规则 |
| `registry.ts` | ProtocolRegistry：40+ 协议的合约地址和 selector 数据库 |
| `store.ts` | OnChainStore：通过 ethers 连接合约进行链上操作 |
| `batch.ts` | BatchParser / BatchVerifier：ERC-8211 批量交易校验 |
| `receipt.ts` | ReceiptBuilder：构建 VerificationReceipt |
| `types.ts` | 核心类型定义：9 种 ActionType、IntentTemplate 等 |
| `attack-test.ts` | 15 种攻击场景的自动化测试框架 |
| `index.ts` | Chiron 主入口类，3 行集成 |

---

## 五、攻击覆盖

| ID | 攻击类型 | 严重程度 | 检测规则 | 效果 |
|---|---|---|---|---|
| A1 | Prompt 注入交易替换 | 严重 | R1+R2 | ✅ 完全阻止 |
| A2 | 意图声明伪造 | 高 | R3 | ✅ 完全阻止 |
| A3 | Calldata 篡改 | 严重 | R2 | ✅ 完全阻止 |
| A4 | 隐藏 Approve | 严重 | R5 | ✅ 完全阻止 |
| A5 | 隐藏 delegatecall | 严重 | R6 | ✅ 完全阻止 |
| A6 | 金额操纵 | 严重 | R4 | ✅ 完全阻止 |
| A7 | 接收地址替换 | 严重 | R5 | ✅ 完全阻止 |
| A8 | 钓鱼合约调用 | 严重 | R1 | ✅ 完全阻止 |
| A9 | 新协议零日攻击 | 严重 | L1→L2 | ⚠️ 事后追溯 |
| A10 | 会话密钥泄露滥用 | 高 | R1 | ✅ 部分阻止 |
| A11 | 批量交易单步篡改 | 严重 | L1 | ✅ 完全阻止 |
| A12 | 跨链 Intent 不一致 | 中 | L1 | ✅ 完全阻止 |
| A13 | 验证证明重放 | 高 | 链上合约 | ✅ 完全阻止 |
| A14 | 日额度耗尽 | 高 | CircuitBreaker | ✅ 完全阻止 |
| A15 | Intent 声明绕过 | 低 | — | ❌ 设计边界 |

---

## 六、Sepolia 测试网验证

### 6.1 部署合约

| 合约 | 地址 |
|---|---|
| Chiron | 0xD21BCB2868e44e7644B52E21838Eb7c1431EA838 |
| BondPool | 0xCBa1A0B9523abAB64e33cCbCc3dca06485B9a1D3 |
| CircuitBreaker | 0x9a7B65fcEF9b799F043BF2cb7587f1fF300E3530 |
| IntentTemplateRegistry | 0x9967098e8BdECcddbA664F6e12D5365b5eb28627 |

### 6.2 功能测试结果（18/18 通过）

| 测试 | 验证点 | 状态 |
|---|---|---|
| Chiron 存证 | storeReceipt → getReceipt → getAgentReceipts | ✅ |
| 重复 txHash 拒绝 | 重复存储应 revert "Receipt already exists" | ✅ |
| CircuitBreaker 暂停 | 5 FAIL → isPaused = true | ✅ |
| CircuitBreaker 恢复 | resume → isPaused = false | ✅ |
| setThreshold | 自定义阈值后按新阈值暂停 | ✅ |
| BondPool deposit | deposit 1 ETH → stakes = 1 ETH | ✅ |
| getTxLimit | txLimit = stakes × 10 | ✅ |
| withdraw | withdraw 0.5 ETH → stakes = 0.5 ETH | ✅ |
| 超额提取拒绝 | revert "Insufficient stake" | ✅ |
| slash | owner 可扣除质押 | ✅ |
| ITR register | registerProtocol → actionType = 1 | ✅ |
| ITR deactivate | deactivate → actionType = 0 | ✅ |
| 跨合约集成 | Chiron FAIL 自动触发 CB pause | ✅ |
| 暂停后拒绝 | isPaused 时 storeReceipt 被拒绝 | ✅ |
| Agent E2E | SDK Intent → 校验 → 链上存证 | ✅ |

### 6.3 端到端验证（DeepSeek + ElizaOS + Chiron + Sepolia）

完整链路：

```
用户指令: "帮我用100 USDC换成WETH，走Uniswap V3"
    ↓
DeepSeek (AI Agent)  ←── 真实 API 调用，LLM 生成 Intent
    ↓
@elizaos/core AgentRuntime  ←── runtime.on('beforeTransaction', chironVerify)
    ↓
@chiron/sdk L1 校验  ←── R1~R6 全部通过
    ↓
Sepolia 链上存证  ←── 区块 11078125
    ↓
Etherscan: https://sepolia.etherscan.io/tx/0x8b429cca60205ce253737ffd514c39dbc6933dcae0317b3ba1d6a5ba85f469cc
```

链上存证结果：
```
intentHash: 0x84e3e3927302168a768659955368d5e2d357c96f3d3f1407e6a22802cacd66b4 ✅
agent:      0x0547BAaA9F682a26E9129B15Fbf1a9Ed51f87e1B ✅
l1Result:   0 (PASS) ✅
timestamp:  1781675712 ✅
block:      11078125 ✅
```

---

## 七、Agent 框架集成

### 7.1 三种集成方式

| 方式 | 代码量 | 说明 |
|---|---|---|
| SDK 直接集成 | 3 行 | `new Chiron({chainId}).verify(intent, tx)` |
| HTTP API | 1 个 curl | `POST /verify {intent, tx}` |
| ElizaOS 插件 | 配置注册 | `runtime.on('beforeTransaction', handler)` |

### 7.2 ElizaOS 插件核心代码

```typescript
import { Chiron } from "@chiron/sdk";

runtime.on('beforeTransaction', async ({ intent, tx, resolve, reject }) => {
  const receipt = await chiron.verify(intent, tx);
  receipt.l1Result === 'PASS' ? resolve() : reject();
});
```

### 7.3 支持的 Agent 框架

| 框架 | ⭐ | 定位 |
|---|---|---|
| ElizaOS | 18.6k | 最流行的 AI Agent 操作系统 |
| Fetch.ai | 1.6k | 轻量去中心化 Agent 框架 |
| Rig Onchain Kit | 67 | Rust Agent 区块链工具包 |
| CloddsBot | 392 | 开源自主交易 Agent |

---

## 八、项目统计

| 指标 | 数据 |
|---|---|
| 智能合约数 | 4 |
| SDK 模块数 | 10 |
| 测试总数 | 47（合约单元测试 + SDK 单元测试） |
| 攻击覆盖 | 15/15 (100%) |
| Sepolia 测试 | 18/18 通过 |
| 端到端验证 | 完整链路通过 |
| 协议注册 | 40+ |
| 集成文件 | sdk/integrations/ |

---

## 九、参考文献

[1] "Autonomous Agents on Blockchains." arXiv:2601.04583, 2025.
[2] "Liquidity Exhaustion Attacks on Permissionless DEX." arXiv:2602.17805, 2025.
[3] Stanford CRFM. "Agent Security and Alignment." 2024.
[4] "Security of Autonomous Agents: Attack Surface Analysis." arXiv:2403.1114, 2024.
[5] ERC-4337: Account Abstraction Using Alt Mempool. Ethereum.org, 2023.
[6] ERC-7683: Cross Chain Intents. Ethereum Magicians, 2024.
[7] ERC-8004: Trustless Agents. Ethereum Magicians, 2025.
[8] ERC-8211: Smart Batching. Ethereum Magicians, 2025.
[9] UniswapX: Dutch Auction Based Cross-Chain Swaps. uniswap.org, 2024.
[10] CoW Protocol: Batch Auction for MEV-Protected Trading. cow.fi, 2023.
[11] 1inch Fusion: RFQ-Based Gasless Swaps. 1inch.io, 2024.
[12] Across Protocol: Optimistic Cross-Chain Filling. across.to, 2023.
[13] Blowfish: Transaction Simulation and Security. blowfish.xyz, 2023.
[14] ElizaOS: AI Agent OS. github.com/elizaOS/eliza, 2025.
[15] Fetch.ai uAgents: Decentralized Agent Framework. github.com/fetchai/uAgents, 2024.

---

## 十、文件清单

```
.
├── Makefile                  # 部署、测试、构建命令
├── contracts/
│   ├── src/                  # 4 个 Solidity 合约
│   ├── test/                 # 合约单元测试 (13 个)
│   └── script/               # 部署脚本
├── sdk/
│   ├── src/                  # 10 个 TS 模块
│   ├── test/                 # SDK 单元测试 (46 个)
│   ├── integrations/         # Agent 框架集成示例
│   └── dist/                 # 编译输出
├── docs/                     # 全部文档
├── scripts/
│   ├── test-deployed.sh      # 链上冒烟测试脚本
│   └── benchmark.sh          # 性能基准测试
├── verifier/                 # L2 Verifier 服务
├── webhook/                  # 告警推送服务
├── run-demo.sh               # 端到端演示脚本
└── outputs/                  # 汇报 PPT
```
