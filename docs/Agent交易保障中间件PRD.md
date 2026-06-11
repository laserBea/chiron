# Agent 交易保障中间件 PRD

> 项目代号：**Chiron**
> 版本：v2.0（实用修订版）
> 日期：2026-06-11
> 核心创新：意图-执行语义一致性验证（Intent-Execution Semantic Consistency Verification）

---

## 一、选型分析

### 1.1 为什么传统方案不适合

| 方案 | 已有实现 | 为什么不适合中间件 |
|---|---|---|
| **Agent Policy（白名单/黑名单）** | ERC-8004、OpenZeppelin Defender、Zodiac、ERC-6900 | 规则静态，Agent 行为动态，规则永远追不上行为空间；且已被大量实现 |
| **Solver Attestation** | ERC-8004 ValidationRegistry、LayerRisk | 面向 Solver 而非通用 Agent |
| **Intent Privacy** | SUAVE、MEV-Share、Shutter | 依赖 ZK/阈值加密，基础设施未成熟 |
| **Audit Log** | The Graph、Dune、Forta | 纯监控，不阻止攻击 |
| **Transaction Simulation** | Blowfish、Tenderly、Fire | 只展示交易结果，**不比较与实际意图的一致性** |

### 1.2 真正的空白

现有方案都在回答 **"这个交易安全吗？"** ——这是一个无法验证的问题（需要知道用户意图才能判断安全）。

Chiron 回答的是另一个问题： **"这个交易和 Agent 说的意图是同一件事吗？"** ——这是一个可验证的问题。

**核心区别：不需要知道"什么是对的"，只需要知道"是否一致"。**

---

## 二、执行摘要

### 2.1 产品定位

Chiron 是一个 EVM 中间件，通过 **结构化意图模板 + 确定性本地校验 + 可选多模型交叉验证**，确保 AI Agent 的每笔交易与它的声明意图在语义上一致。

**它不是：**
- ❌ 一个需要依赖 LLM API 才能运行的中间件
- ❌ 一个需要用户配置策略规则的防火墙
- ❌ 一个只做日志不做阻止的监控工具

**它是：**
- ✅ 一个 Agent 侧 SDK，提交交易前自动做意图-执行一致性检查
- ✅ 一个链上合约层，提供经济质押、自动断路、可验证存证
- ✅ 一个可选 Verifier 网络，处理确定性检查无法判定的边界情况

### 2.2 一句话

> Agent 说它要 Swap 100 USDC 换 ETH，Chiron 检查它实际签署的 calldata 是不是真的在做这件事——并且这笔检查在 10ms 内完成，0 Gas 开销。

---

## 三、核心创新：双重验证架构

### 3.1 结构化意图模板

Agent 生成交易前，先以标准格式声明意图。这不是自由文本，而是结构化的模板：

```
IntentTemplate {
  action:     "swap"                    // 动作类型
  protocol:   "uniswap_v3"              // 协议
  tokenIn:    "0xA0b8...USDC"          // 输入代币
  tokenOut:   "0xC02a...WETH"          // 输出代币
  amount:     "100"                     // 输入数量
  slippage:   "0.5"                     // 滑点容忍度（%）
  timestamp:  "2026-06-11T12:00:00Z"  // 意图生成时间
}
```

**为什么是结构化模板而非自然语言：**
- 确定性可解析 → SDK 无需调用 LLM 即可完成基础校验
- 机器可读 → 以太坊合约可直接校验
- 类型安全 → 减少歧义导致的误报
- 可扩展 → 通过 `action` 字段覆盖所有 DeFi 场景

**支持的 Action 类型（MVP）：**

| Action | 适用场景 | 协议参数字段 |
|---|---|---|
| `swap` | Uniswap、Curve、Balancer 等 | tokenIn, tokenOut, amount, slippage |
| `approve` | ERC-20 授权 | token, spender, amount |
| `bridge` | 跨链桥接 | token, amount, sourceChain, targetChain, receiver |
| `deposit` | Aave、Compound 等借贷协议 | token, amount, protocol |
| `withdraw` | 从借贷协议提取 | token, amount, protocol |
| `stake` | Lido、RocketPool 等质押 | token, amount, protocol |
| `vote` | DAO 治理 | proposalId, support |
| `permit` | 离线授权签名 | token, owner, spender, value, deadline |
| `custom` | 其他操作 | customSignature: 函数签名模式 |

### 3.2 L1: 确定性本地校验（Primary Path，覆盖 95% 场景）

```
Agent → IntentTemplate → SDK 本地解码 calldata
                        → SDK 比较 intent 与 decoded tx
                        → 匹配 → 允许签名（~10ms，0 成本）
                        → 不匹配 → 进入 L2
```

**校验规则（可穷举）：**

| 校验项 | 比较方式 | 误报风险 |
|---|---|---|
| 目标合约是否匹配 Action 类型？ | `intent.protocol → 已知合约地址表` | 低 |
| 调用的函数是否匹配 Action？ | `selector → (swap → exactInputSingle/exactInput)` | 低 |
| TokenIn/Out 地址是否匹配？ | `decodedTx.param[tokenIn] == intent.tokenIn` | 低 |
| 输入金额是否匹配？ | `decodedTx.param[amount] ≈ intent.amount (±slippage)` | 低 |
| 是否有异常参数？ | `存在非预期参数（如 receiver ≠ intent.receiver）` | 低 |
| 是否存在隐藏调用？ | `calldata 中嵌套的 delegatecall/create2` | 中 |

**已知合约地址表：** SDK 内置常见协议地址（Uniswap V2/V3、Curve、Balancer、Aave、Compound、Lido 等），定期更新 + 社区贡献。

```
示例：swap 操作的 L1 校验逻辑

Input:
  IntentTemplate: { action: "swap", protocol: "uniswap_v3", tokenIn: USDC, amount: "100" }
  Transaction: target=0xE5...Router, data=0x3593564c...

本地解码:
  target = 0xE5...Router → 匹配 uniswap_v3 合约地址
  selector = 0x3593564c → exactInputSingle → swap 操作
  param[tokenIn] = USDC → 匹配
  param[amountIn] = 100000000 (18 decimals) → 匹配 100 USDC
  param[amountOutMin] = 0.05 ETH → 匹配滑点

结果: PASS → 允许签名 ✅
```

### 3.3 L2: 可选多重 AI Verifier（Escalation Path，覆盖剩余 5%）

当 L1 无法判定时（如自定义合约、复杂嵌套调用、新协议），才进入 L2：

```
L1 判定 UNCERTAIN → 可选升级至 L2
                  → Verifier 集合交叉验证（GPT-5 + Claude 4 + Gemini 3）
                  → N/M 通过 → 允许
                  → 不通过 → 阻止 + 记录链上
```

**触发 L2 的场景：**
- 目标合约不在内置地址表中
- 函数签名未匹配到已知 Action
- 参数中包含复杂的嵌套结构（如 multicall + swap + approve）
- 交易 value 与意图金额显著不匹配

**为什么 L2 是可选的非阻塞路径：**
- 默认：L1 判定通过 → 直接允许（无需等 LLM）
- 可选：L1 通过后异步触发 L2 验证（不阻塞交易）→ 结果仅用于链上存证
- 仅 L1 判定失败且用户选择严格模式 → 同步等待 L2 结果

---

## 四、架构设计

### 4.1 分层架构

```
Layer 1: 智能合约层（EVM）
┌──────────────────────────────────────────────────────────────┐
│  BondPool.sol                                                │
│  ├─ Agent 质押 ERC-20 代币                                    │
│  ├─ 质押锁定周期（如 7 天）                                     │
│  ├─ 持续违规 → 质押罚没（部分退还用户）                           │
│  └─ 质押量决定 Agent 的单笔交易上限（简单公式：stake * 10）       │
│                                                              │
│  CircuitBreaker.sol                                          │
│  ├─ Agent 所有者注册的中断规则                                   │
│  ├─ 连续 N 次 L1 FAIL → 自动暂停                               │
│  ├─ 超过日交易金额阈值 → 自动暂停                               │
│  ├─ 紧急恢复：所有者签署新策略后恢复                              │
│  └─ 全局开关：DAO Governance 可关闭所有 Agent（极端情况）         │
│                                                              │
│  VerificationStore.sol                                       │
│  ├─ 每笔交易的验证结果哈希上链存证                               │
│  ├─ 包含 IntentTemplate 哈希 + DecodedTx 哈希 + 裁决结果         │
│  ├─ 支持链上查询：某 Agent 的验证通过率                          │
│  └─ 支持挑战期：任何人可对历史验证结果发起挑战                     │
│                                                              │
│  IntentTemplateRegistry.sol                                   │
│  ├─ 注册标准 Action 类型的 IntentTemplate 格式                  │
│  ├─ 注册已知协议合约地址 → Action 映射                          │
│  └─ 社区可提交新 Action 类型 + 新协议映射（需审核）               │
└──────────────────────────────────────────────────────────────┘

Layer 2: 链下轻量 SDK（核心校验逻辑）
┌──────────────────────────────────────────────────────────────┐
│  @chiron/sdk                                                  │
│                                                              │
│  IntentParser：                                              │
│  ├─ Agent 逻辑层调用 → 生成 IntentTemplate                    │
│  ├─ 模板字段自动填充（token 地址自动查找、金额精度转换）          │
│  └─ IntentTemplate → 序列化为 bytes32 hash                    │
│                                                              │
│  TxDecoder：                                                 │
│  ├─ 接收 target + calldata                                   │
│  ├─ 通过 4byte.directory / Etherscan API / 本地缓存 解码      │
│  ├─ 支持已知合约的批量 ABI 缓存（Uniswap、Aave 等预置）          │
│  └─ DecodedTx → 结构化的交易参数                              │
│                                                              │
│  ConsistencyChecker：                                        │
│  ├─ 接收 IntentTemplate + DecodedTx                          │
│  ├─ 执行 6 项确定性校验规则（见 3.2 节）                       │
│  ├─ 输出 PASS / FAIL / UNCERTAIN                             │
│  └─ UNCERTAIN → 可选升级到 L2 (Verifier Network)             │
│                                                              │
│  ReceiptBuilder：                                            │
│  ├─ 验证结果 → 构建 VerificationReceipt                       │
│  ├─ Receipt 签名（用 Agent 的会话密钥）                        │
│  └─ 异步上链存证（不阻塞交易）                                  │
└──────────────────────────────────────────────────────────────┘

Layer 3: 可选 Verifier Network（仅当 L1 UNCERTAIN 时）
┌──────────────────────────────────────────────────────────────┐
│  Verifier Orchestrator                                       │
│  ├─ 接收 L1 UNCERTAIN 请求                                    │
│  ├─ 选择 Verifier 集合（默认 GPT + Claude + Gemini）           │
│  ├─ 并行发送解码后的交易摘要给各 Verifier                       │
│  ├─ 聚合结果（2/3 通过即可）                                   │
│  └─ 返回 VerificationReceipt                                 │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 核心工作流

```
=== 正常路径（~95% 的交易）===

Agent: 生成 IntentTemplate { action: "swap", protocol: "uniswap_v3", ... }
Agent: 构建 calldata
Agent: 调用 SDK.verify(intentTemplate, tx)
  SDK: L1 校验 → PASS → 立即返回
Agent: 签名交易
Agent: 广播交易（附带 VerificationReceipt hash）
Agent: 异步上链存证（不阻塞）

延迟: ~10ms (L1 本地校验)
Gas: 0（L1 无链上交互）
外部依赖: 无

=== L2 升级路径（~4.5% 的交易，新协议/新合约）===

Agent: IntentTemplate + tx
SDK: L1 校验 → UNCERTAIN（合约不在已知地址表中）
  → 根据安全等级决定
  → Standard: 允许交易 + 异步 L2 验证（仅存证）
  → Strict: 等待 L2 同步验证结果

延迟: Standard ≈ 10ms + 异步 / Strict ≈ 2-5s
Gas: 0（L2 异步）/ ~30k（L2 同步存证）
外部依赖: LLM API（仅 Strict 模式需要）

=== 被阻止路径（~0.5% 的交易，潜在攻击）===

Agent: 被 Prompt 注入 → IntentTemplate 声明 swap
Agent: (被操纵) → 实际构建了一个 approve 给攻击者的交易
SDK: L1 校验
  → selector 是 approve（非 swap）
  → target 非白名单合约
  → FAIL → 拒绝签名
Agent: 不广播
用户: 收到告警：Agent 试图执行与意图不一致的操作

延迟: ~10ms
Gas: 0
外部依赖: 无
```

### 4.3 数据结构

```
// 结构化意图模板
struct IntentTemplate {
    uint8 actionType;        // enum: SWAP=1, APPROVE=2, BRIDGE=3, DEPOSIT=4, WITHDRAW=5, STAKE=6, VOTE=7, PERMIT=8, CUSTOM=9
    bytes32 protocolHash;    // 协议标识（如 keccak256("uniswap_v3")）
    bytes32 tokenIn;         // 输入代币地址（bytes20 左对齐填充）
    bytes32 tokenOut;        // 输出代币地址
    uint256 amount;          // 输入金额（以最小单位表示）
    uint256 amountOutMin;    // 最小输出金额
    bytes32 receiver;        // 接收地址
    uint256 deadline;        // 意图过期时间
    bytes32 customData;      // 自定义数据（CUSTOM action 时使用）
}

// 解码后的交易
struct DecodedTx {
    address target;
    uint256 value;
    bytes4 selector;
    string functionName;     // 辅助信息，不上链
    bytes[] params;          // ABIDecode 后的参数列表
    ParamsSummary summary;   // 结构化摘要（供 Verifier 使用）
}

// 验证结果存证（链上）
struct VerificationReceipt {
    bytes32 intentHash;      // keccak256(IntentTemplate)
    bytes32 txHash;          // keccak256(target + data + value + chainId)
    address agent;
    L1Result l1Result;       // PASS / FAIL / UNCERTAIN
    L2Result l2Result;       // NONE / CONSISTENT / INCONSISTENT（可选）
    uint256 timestamp;
    uint256 blockNumber;
}

enum L1Result { PASS, FAIL, UNCERTAIN }
enum L2Result { NONE, CONSISTENT, INCONSISTENT }
```

### 4.4 SDK 接口设计

```
npm install @chiron/sdk

// 使用示例：Agent 集成只需 3 行额外代码

import { Chiron } from "@chiron/sdk";

// 初始化（session 级别的，只需一次）
const chiron = new Chiron({
  chainId: 1,
  agentKey: privateKey,  // Agent 的会话密钥
  securityLevel: "standard",  // standard | strict
});

// 生成意图 + 构建交易
const intent = chiron.intent("swap", {
  protocol: "uniswap_v3",
  tokenIn: "USDC",
  tokenOut: "WETH",
  amount: "100",
  slippage: 0.5,
});

// 构建交易（Agent 已有的逻辑）
const tx = {
  to: "0xE5...Router",
  data: "0x3593564c...",
  value: "0",
};

// 检查一致性 —— 只有这一行是新增的
const receipt = await chiron.verify(intent, tx);
if (!receipt.allowed) {
  console.error("Blocked:", receipt.reason);
  // 可选：上报事件、暂停 Agent、通知用户
  return;
}

// 签名并广播
const signedTx = await wallet.signTransaction(tx);
await provider.sendTransaction(signedTx);

// 异步存证（非阻塞）
chiron.storeReceipt(receipt).catch(console.warn);
```

---

## 五、实用性分析

### 5.1 为什么这个方案是实用的

| 维度 | 本方案 | 替代方案 |
|---|---|---|
| **交易延迟** | ~10ms（纯本地校验）| LLM 方案：1-5s |
| **每笔交易成本** | 0 Gas + 0 API 费用 | LLM 方案：$0.01-0.05/次 |
| **外部依赖** | 无（L1 不依赖任何外部 API）| 策略方案：依赖链上合约查询 |
| **Agent 集成成本** | +3 行代码 | 策略方案：+20-50 行策略声明 |
| **首次部署** | npm install 即可运行 | 策略方案：需先部署策略合约 |
| **覆盖率** | 95% 交易 L1 覆盖 | LLM 方案：覆盖所有但需等 |
| **误报率** | 低（确定性规则） | LLM 方案：中-高（语义歧义）|

### 5.2 边界情况处理

| 边界情况 | 处理方式 |
|---|---|
| **新协议、新合约** | L1 返回 UNCERTAIN → Standard 模式允许交易 + 异步 L2 验证存证；Strict 模式等待 L2 结果 |
| **已知协议的升级合约** | SDK 内置合约地址表定期更新；社区 PR 机制 | 
| **自定义/非标准交易** | 用户使用 `action: custom` + 提供函数签名模式；L1 仅做基本检查 |
| **Agent 生成错误的 Intent** | Agent 端生成 Intent 的逻辑本身也可能出错。但 Intent 错误 ≠ 交易不安全（只是声明不准确）；L1/L2 仅检查一致性，不判断 Intent 的对错 |
| **Intent 被篡改** | IntentTemplate 在 Agent 内部生成，不经过外部输入→被篡改的路径与交易被篡改的路径相同。L1/L2 比较的是 Intent 与 DecodedTx——两者都需要同时被篡改才能绕过 |
| **高频交易（HFT Agent）** | L1 校验耗时 ~10ms，不影响高频交易节奏。L2 只在 UNCERTAIN 时触发，HFT 场景下几乎不会触发（Agent 通常使用已知协议）|
| **多签要求** | 大额交易：L1 通过后仍要求用户多签确认（CircuitBreaker 规则）|

### 5.3 已知局限性

- L1 不能覆盖 100% 场景（~5% 的 UNCERTAIN 率不可避免）
- L2 依赖 LLM API 时需要联网和 API key
- 内置合约地址表需要维护更新
- 无法检测 Intent 本身的恶意性（只检测 Intent 与 Tx 的一致性）

### 5.4 与现有安全工具的互补关系

```
用户最终的安全栈：

┌─────────────────────────────────────────────┐
│  1. Transaction Simulation (Blowfish)        │
│    → "这笔交易会做什么？"（展示给用户看）       │
├─────────────────────────────────────────────┤
│  2. Chiron (本方案)                         │
│    → "这笔交易和 Agent 说的一样吗？"（自动阻止） │
├─────────────────────────────────────────────┤
│  3. Policy Engine (Zodiac/Defender)         │
│    → "这笔交易在规则范围内吗？"（静态安全边界）  │
├─────────────────────────────────────────────┤
│  4. Multi-sig (Safe)                        │
│    → "这是大额交易，需要多人确认"              │
└─────────────────────────────────────────────┘

Chiron 不替代任何一层——它填补的是"Intent vs Execution"这个空白。
```

---


---

## 六、防范的攻击类型与解决的安全问题

### 6.1 攻击类型全覆盖矩阵

| # | 攻击类型 | 攻击描述 | Chiron 检测机制 | 检测层 | 阻止效果 |
|---|---|---|---|---|---|
| A1 | **Prompt 注入交易替换** | 攻击者向 Agent 系统注入恶意 prompt，使 Agent 生成与原本意图完全不同的交易（如 "Swap USDC" → approve 给攻击者） | L1: selector 不匹配 + 目标合约不匹配 | L1 | ✅ 完全阻止 |
| A2 | **意图声明伪造** | 攻击者篡改 Agent 的 IntentTemplate（如将 tokenOut 从 ETH 改为攻击者代币），让用户以为交易安全 | IntentTemplate 在 Agent 内部生成，不经过外部输入。篡改 Intent 与篡改交易需要同时发生才能绕过 → 攻击难度翻倍 | L1 | ✅ 高度防御 |
| A3 | **Calldata 篡改** | 攻击者拦截 Agent 已签名的交易，替换 calldata | L1: VerificationReceipt 绑定 txHash + target + data，链上存证可验证原始 calldata 是否匹配 | L1 + 链上 | ✅ 完全阻止 |
| A4 | **隐藏 Approve 攻击** | Agent 声称执行 Swap，实际交易中嵌入了对攻击者合约的无限额 Approve | L1: 检测到 selector=approve（非 swap）且 spender≠白名单 → FAIL | L1 | ✅ 完全阻止 |
| A5 | **隐藏 delegatecall** | 交易表面调用正常合约，但通过 delegatecall 在代理上下文中执行恶意代码 | L1: 解析 calldata 中发现嵌套 delegatecall/create2 → FAIL | L1 | ✅ 完全阻止 |
| A6 | **金额操纵攻击** | 攻击者修改 Agent 的发币数量（如 100 USDC → 10,000 USDC 或全部余额） | L1: amount 比较（±slippage）+ 定期限检查 → 超出范围即 FAIL | L1 | ✅ 完全阻止 |
| A7 | **接收地址替换** | 攻击者将交易输出地址改为自己的地址 | L1: params[recipient/to] 与 IntentTemplate.receiver 比较 → 不匹配即 FAIL | L1 | ✅ 完全阻止 |
| A8 | **钓鱼合约调用** | Agent 声称使用 Uniswap，实际目标合约是部署在相似地址的恶意合约 | L1: 目标合约地址匹配已知协议地址表 → 不在表中且 Strict 模式 → 阻止 | L1 + L2 | ✅ 完全阻止（Strict）|
| A9 | **新协议零日攻击** | 新部署的 DEX/桥协议存在漏洞，Agent 是首批受害者 | L1: 新合约不在已知地址表 → UNCERTAIN → Standard 模式允许但异步存证 → 链上验证记录可追溯 | L1 → L2 | ⚠️ Standard: 事后追溯 / ✅ Strict: 阻止 |
| A10 | **会话密钥泄露后滥用** | 攻击者获取 Agent 的会话私钥，试图签署任意交易 | 即使持有私钥，交易仍需通过 IntentTemplate 一致性校验 → 攻击者的交易若不匹配当前 Intent 则被阻止 | L1 | ✅ 部分阻止（拦截与当前 Intent 不一致的交易）|
| A11 | **批量交易单步篡改** | 在 ERC-8211 批量交易中，攻击者篡改了其中一步（如第 2 步的 approve） | L1: 对 batch 中每一步独立校验 → 被篡改的步骤不匹配 Intent → FAIL | L1 | ✅ 完全阻止 |
| A12 | **跨链 Intent 不一致** | Agent 声称桥接到 Arbitrum，实际桥接到攻击者控制的链 | L1 (V2): chainId 比较 → IntentTemplate.targetChain ≠ 实际 targetChain → FAIL | L1 + ERC-7683 | ✅ 完全阻止 |
| A13 | **验证证明重放** | 攻击者截取一个通过的 VerificationReceipt，附加到另一笔恶意交易上 | Receipt 绑定 txHash：链上 storeReceipt(txHash, receiptHash) → 重放交易 txHash 不同 → 验证失败 | 链上合约 | ✅ 完全阻止 |
| A14 | **Agent 日额度耗尽** | 攻击者利用 Agent 持续发起小额交易，耗尽日交易预算 | CircuitBreaker: 日交易金额累计超过阈值 → 自动暂停 Agent | L1 + 链上 | ✅ 完全阻止 |
| A15 | **Intent 声明绕过（高级攻击）** | 攻击者构造一笔交易，语法上确实在 Swap，但通过精心构造的参数利用已知合约漏洞（如操纵预言机） | L1 检查语义一致性（"是否在做同一件事"），不检查交易安全性（"是否会赔钱"）。漏洞利用交易与 Intent 一致时 → 通过 | L1 | ❌ 不阻止（已知局限）|

### 6.2 按严重程度分类

| 严重程度 | 攻击编号 | 攻击数 |
|---|---|---|
| **极高**（直接资金损失，无需用户交互） | A1, A3, A4, A5, A6, A7, A8, A9, A11, A13, A14 | 11 |
| **高**（需间接条件，如私钥已泄露） | A10, A12 | 2 |
| **中**（非 Chiron 可解决的攻击类型） | A2, A15 | 2 |

### 6.3 解决的安全问题

| # | 安全问题 | 描述 | 现有方案的空白 | Chiron 的解决方式 |
|---|---|---|---|---|
| S1 | **意图-执行鸿沟** | AI Agent 动态生成交易意图，但没有任何机制确保实际执行的交易与意图一致 | 传统方案假设 Agent 的代码是可信的（"代码即意图"），但 AI Agent 的意图由 LLM 生成，非确定性代码路径 | L1 校验：结构化 IntentTemplate vs DecodedTx 比较 |
| S2 | **Prompt 注入防护缺失** | Agent 系统的 Prompt 注入攻击可利用 Agent 的签名权签署有害交易 | 策略方案（白名单）只能拦截"越界"操作，无法拦截"语义错误"（如 Swap 换成 Approve 同一个代币）| L1 校验：检测函数签名和参数类型的根本性变化 |
| S3 | **Agent 自治的信任边界** | 用户被迫在"完全信任 Agent"和"每笔手动确认"之间选择 | 无中间状态——要么给私钥，要么牺牲自动化 | Chiron 提供可信自治：自动执行但保证意图一致性 |
| S4 | **会话密钥单点失效** | Agent 私钥泄露 → 攻击者可任意提款 | 多签可解决但牺牲自动化 | L1 校验作为第二道防线：有私钥也不等于能随意交易 |
| S5 | **跨协议安全孤岛** | 每个 DeFi 协议有自己的安全检查，但 Agent 跨协议操作时安全上下文不连续 | 无跨协议安全标准 | Chiron 在 Agent 侧建立统一的意图校验层，不依赖各协议的安全实现 |
| S6 | **Agent 行为可审计性** | Agent 出错时无法区分"恶意攻击"、"代码 bug"、"策略调整" | 无标准化的决策记录格式 | VerificationReceipt 链上存证：intentHash + txHash + 裁决结果 → 可追溯 |
| S7 | **AI 代理的"语义盲区"** | AI 可以生成语法正确的交易（正确编码、正确签名），但语义错误（做的事和说的不同）| 语法检查工具（ABI 验证、类型检查）无法检测语义错误 | L1 校验：语义层面比较（"Swap USDC for ETH" vs 实际交易参数）|
| S8 | **经济安全缺少上限** | Agent 被攻破后可在单笔交易中转移所有资产 | 策略方案可设置金额上限但需提前配置 | BondPool: 质押量决定交易上限（越信任的 Agent 质押越少，但上限越低）|

### 6.4 不解决的安全问题（已知边界）

坦诚说明 Chiron **不**做什么——这些是其他安全层的职责：

| 不解决的问题 | 原因 | 应由谁解决 |
|---|---|---|
| **Intent 本身的恶意性** | Chiron 只检查"Intent vs Tx 是否一致"，不判断 Intent 好坏——Agent 说"转账给攻击者"，Chiron 会放行（因为 Intent 和 Tx 一致）| Agent 开发者（安全对齐训练）、用户（选择可信 Agent）|
| **合约层面的漏洞** | Chiron 不执行安全审计——如果 Agent 正确调用了有漏洞的合约，Chiron 不会阻止 | 安全审计工具（Slither、Mythril）、协议开发方 |
| **MEV/三明治攻击** | Chiron 不参与交易排序——Agent 的 Swap 被夹击是 MEV 问题，不是一致性校验问题 | MEV 保护方案（MEV-Share、CoW Protocol）|
| **私钥托管安全** | Chiron 不存储私钥——Agent 的会话密钥由 Agent 方自行管理 | 密钥管理方案（MPC、HSM、TEE）|
| **数据隐私** | Chiron 验证过程需要 IntentTemplate 和交易详情，这些对 Verifier（L2）可见 | 隐私方案（ZK、TEE、可信执行环境）|
| **拒绝服务攻击** | Chiron 无法阻止攻击者对 Agent 系统的 DoS 攻击（如耗尽 API 配额） | Agent 运维方 |

### 6.5 安全模型总结

```
Chiron 安全模型：一致性 > 正确性

"一致性" = 交易执行的内容 = 声明要做的事
"正确性" = 交易做的事情是安全的/理性的

Chiron 保证一致性，不保证正确性。
一致性是可验证的（比较两个结构化的声明）。
正确性是不可验证的（需要知道用户的真正意图）。

因此 Chiron 的威胁模型边界是：
  ✅ 防御：Intent ≠ Tx 的各类攻击（注入、篡改、替换、重放）
  ❌ 不防御：Intent = Tx 但 Intent 本身恶意的攻击

这是有意为之的设计选择——确保 Chiron 的验证结论是确定性的。
```

## 七、功能清单

### 7.1 MVP（P0）

| ID | 模块 | 功能 | 实现方式 |
|---|---|---|---|
| F-001 | SDK | IntentTemplate 生成 | Agent 调用生成标准意图模板 |
| F-002 | SDK | Calldata 解码 | 内置 ABI 缓存 + 在线回退 |
| F-003 | SDK | L1 一致性校验 | 6 项确定性规则（合约/函数/参数/金额/异常/嵌套）|
| F-004 | SDK | 校验结果返回 | 通过/拒绝/不确定 + 人类可读原因 |
| F-005 | SDK | 异步存证 | 验证结果哈希上链（非阻塞）|
| F-006 | SDK | 内置协议地址表 | Uniswap V2/V3, Curve, Balancer, Aave, Compound, Lido, 1inch |
| F-007 | 合约 | VerificationStore | 验证结果上链存证 |
| F-008 | 合约 | BondPool | Agent 质押代币，质押量决定交易上限 |
| F-009 | 合约 | SimpleCircuitBreaker | Agent 所有者可设置自动停止规则 |

### 7.2 V2

| ID | 模块 | 功能 |
|---|---|---|
| F-010 | SDK | L2 Verifier 升级路径（GPT + Claude + Gemini）|
| F-011 | 合约 | IntentTemplateRegistry（社区提交 Action 映射）|
| F-012 | 合约 | 挑战期：对历史验证结果发起争议 |
| F-013 | SDK | 钱包插件（MetaMask Snap）：交易发送前展示验证结果 |
| F-014 | SDK | 更多的 Action 类型（跨链、借贷、质押）|

### 7.3 V3

| ID | 模块 | 功能 |
|---|---|---|
| F-015 | SDK | 本地轻量 EVM 语义模型替代 L2 LLM（消除 API 依赖）|
| F-016 | 合约 | 质押罚没机制：持续违规 → 部分质押分配给受害者 |
| F-017 | SDK | 批量交易（ERC-8211）支持：对 batch 中每一步独立校验 |

---

## 八、成功指标

### 8.1 北极星指标

> **Chiron 用户 Agent 的"意图-执行不一致"导致的有效资产损失 = 0**

### 8.2 过程指标

| 指标 | 目标（6 个月）| 测量方式 |
|---|---|---|
| L1 校验覆盖率 | ≥ 95% 的请求在 L1 完成 | SDK 统计 |
| L1 校验延迟 | ≤ 15ms（p95）| SDK 统计 |
| L1 准确率 | ≥ 99%（人工抽检）| 人工审计 |
| UNCERTAIN 率 | ≤ 5%（新/未知协议交易）| SDK 统计 |
| 集成 Agent 数 | ≥ 100 | 链上 VerificationStore 统计 |
| 3 行集成成功率 | ≥ 90% 的开发者可在 30 分钟内完成 | 开发者体验测试 |
| 误报率 | ≤ 1%（用户确认的交易被阻止）| 用户反馈 |

---

## 九、与现有 ERC 标准的兼容性

| 标准 | 兼容方式 |
|---|---|
| **ERC-8004 (Trustless Agents)** | VerificationStore 记录可回写至 ReputationRegistry |
| **ERC-8211 (Smart Batching)** | 对 batch 中每步独立做 L1/L2 校验 |
| **ERC-7683 (Cross Chain Intents)** | IntentTemplate + 填充交易的跨链一致性校验 |
| **ERC-4337 (Account Abstraction)** | 在 validateUserOp 阶段插入 Chiron 校验 |
| **EIP-1271 (Contract Signature)** | VerificationReceipt 可包装为补充签名 |

---

## 十、开发路线图

| 阶段 | 时间 | 交付物 |
|---|---|---|
| **P0: 核心 SDK** | Week 1–3 | IntentParser + TxDecoder + ConsistencyChecker + 6 项校验规则 + 内置协议表 |
| **P1: 最小合约** | Week 3–4 | VerificationStore + SimpleBondPool（测试网）|
| **P2: 完整校验** | Week 4–6 | 所有 Action 类型的校验模板 + 测试用例 |
| **P3: Demo Agent** | Week 6–7 | 集成 Chiron 的 Swap Agent Demo（ETH/USDC 自动交易）|
| **P4: 安全测试** | Week 7–9 | 对抗性测试（20+ 攻击场景：注入、重放、编码混淆、嵌套调用）|
| **P5: 多链部署** | Week 9–11 | Ethereum, Arbitrum, Optimism, Base, Polygon |
| **P6: V2 功能** | Week 12+ | L2 Verifier + 钱包插件 |

---

## 十一、附录：攻击场景端到端测试矩阵

| 攻击场景 | Chiron 检测方式 | 阻断层 | 结果 |
|---|---|---|---|
| **A1: Swap 声明 → Approve 执行** | L1: selector=approve ≠ swap → FAIL | L1 | ✅ 阻止 |
| **A2: Swap 100 USDC → 实际 Swap 10,000** | L1: amount 超出 ±slippage → FAIL | L1 | ✅ 阻止 |
| **A3: Swap 声明 → 调用恶意合约** | L1: target ≠ 已知协议合约 → UNCERTAIN → Strict: L2 阻止 | L1+L2 | ✅ 阻止(Strict) |
| **A4: Swap → 输出地址为攻击者** | L1: params[recipient] ≠ intent.receiver → FAIL | L1 | ✅ 阻止 |
| **A5: 正常 Swap + 隐藏 delegatecall** | L1: calldata 中检测到嵌套 delegatecall → FAIL | L1 | ✅ 阻止 |
| **A6: 正常 Swap，正常滑点** | L1: amountOut 在 ±slippage 范围内 → PASS | L1 | ✅ 允许 |
| **A7: 新 DEX 合约的正常 Swap** | L1: 合约不在已知表 → UNCERTAIN → Standard: PASS（异步 L2） | L1→L2 | ✅ 允许(Standard) |
| **A8: 会话密钥泄露后签署恶意交易** | L1: 即使持有私钥，交易仍不匹配当前 Intent → FAIL | L1 | ✅ 阻止 |
| **A9: 批处理中单步被替换** | L1: batch 中某步不匹配该步 Intent → FAIL | L1 | ✅ 阻止 |
| **A10: 验证证明重放** | 链上: storeReceipt(txHash, hash) → 重放 txHash 不同 → 验证不通过 | 链上合约 | ✅ 阻止 |
| **A11: 跨链桥接目标链篡改** | L1(V2): IntentTemplate.targetChain ≠ 实际链 → FAIL | L1 | ✅ 阻止 |
| **A12: Agent 日额度耗尽** | CircuitBreaker: 日累计超阈值 → 暂停 Agent | L1+链上 | ✅ 阻止 |
| **A13: 意图本身恶意（如"转账给攻击合约"）** | L1: Intent 和 Tx 一致 → PASS | — | ⚠️ 不阻止（有意识行为）|
| **A14: 合约漏洞利用（如重入攻击）** | L1: 交易与 Intent 一致 → PASS | — | ⚠️ 不阻止（合约安全问题）|
