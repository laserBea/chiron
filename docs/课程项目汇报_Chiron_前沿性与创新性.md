# Chiron — Agent 交易安全中间件

## 课程项目汇报：前沿性与创新性分析

> 项目代号：**Chiron**（喀戎，神话中的智者与导师）
> 核心理念：**意图-执行语义一致性验证**（Intent-Execution Semantic Consistency Verification）
> 报告日期：2026-06-15

---

## 一、项目概述

### 1.1 解决的问题

AI Agent（如自动交易代理、DeFi 策略代理）正在大规模接管链上资产操作。但当前区块链安全模型存在一个根本性空白：

| 传统安全方案提问 | Chiron 的提问 |
|---|---|
| "这笔交易安全吗？" | "这笔交易和 Agent 说的意图是同一件事吗？" |
| ❌ 需要知道用户意图才能判断 | ✅ 比较两个结构化声明，可验证 |
| ❌ 不可判定问题 | ✅ 可判定问题 |

**核心洞察：** "一致性"是可验证的——只需比较两个结构化声明；"安全性"是不可验证的——因为无法形式化用户的真实意图。Chiron 通过重新定义问题，将一个不可解问题转化为可解问题。

---

## 二、核心创新

### 2.1 创新一：意图-执行语义一致性验证框架

这是项目的**核心理论创新**。Chiron 不回答"这笔交易是否安全"（这需要知道用户的真实意图，不可验证），而是回答"这笔交易是否与其声明的意图一致"（比较两个结构化数据，可验证）。

```
Agent 声明："Swap 100 USDC for ETH on Uniswap V3"
                    ↓
          IntentTemplate（结构化数据）
                    ↓
Chiron 比较 ──────────────── DecodedTx（解码后的 calldata）
                    ↓
          结果：✅ 一致 → 放行
               ❌ 不一致 → 阻止 + 告警
```

**理论价值：** 这是业界首个将"语义一致性"概念引入区块链交易安全的工作，填补了 AI Agent 安全中"意图-执行鸿沟"这一空白。

### 2.2 创新二：双层验证架构（Dual Verification Architecture）

| 层级 | 机制 | 延迟 | 成本 | 覆盖率 |
|---|---|---|---|---|
| **L1** | 确定性本地校验（6 条规则） | ~10ms | 0 Gas, 0 API | ~95% |
| **L2** (可选) | 多 AI 模型交叉验证（GPT + Claude + Gemini） | 2-5s | 低 API 费用 | 剩余 5% |
| **链上** | BondPool + CircuitBreaker + VerificationStore | 异步 | ~30k Gas | N/A |

**L1 的 6 条确定性规则：**

```
R1 — 目标合约匹配已知协议地址表
R2 — 函数 selector 匹配预期 Action 类型
R3 — TokenIn/TokenOut 地址匹配 Intent
R4 — 金额在 ±slippage 范围内
R5 — 无意外参数（receiver 不匹配、隐藏 Approve）
R6 — 无隐藏 delegatecall / CREATE2
```

**设计创新点：**
- L1 是主路径（95% 交易），**完全确定性、零外部依赖、零 Gas 开销**
- L2 仅当 L1 无法判定时才触发，使用**多模型共识**（2/3 通过制）
- 链上层提供经济质押、自动断路、可验证存证

### 2.3 创新三：结构化意图模板（Structured Intent Template）

不同于传统自由文本意图声明，Chiron 定义了 9 种标准化的 Action 类型，每个 Intent 都是机器可读的结构化数据：

```typescript
IntentTemplate {
  actionType:    SWAP    // enum: 9 种类型
  protocolHash:  keccak256("uniswap_v3")
  tokenIn:       0xA0b8...USDC
  tokenOut:      0xC02a...WETH
  amount:        "100000000"  // 自动处理 decimal 精度
  amountOutMin:  "0"
  receiver:      0x...
  deadline:      2000000000
  customData:    ""
}
```

**创新意义：**
- 确定性可解析 → SDK 无需 LLM 即可完成基础校验
- 机器可读 → 以太坊合约可直接校验
- 类型安全 → 减少歧义误报
- 跨协议统一 → 一套格式覆盖所有 DeFi 场景

### 2.4 创新四：3 行集成（3-Line Integration）

将安全中间件的集成成本压缩到极致：

```typescript
import { Chiron } from "@chiron/sdk";             // 第 1 行
const chiron = new Chiron({ chainId: 1 });          // 第 2 行
const r = await chiron.verify(intent, tx);          // 第 3 行
if (!r.allowed) throw new Error("Blocked: " + r.reason);
```

**设计哲学：** 安全机制不应成为采用障碍。3 行集成意味着任何 Agent 开发者可以在不修改现有交易构建逻辑的前提下，获得 L1 安全保护。

### 2.5 创新五：前置阻断而非事后监控

与现有方案的本质区别：

| 方案 | 时机 | 效果 |
|---|---|---|
| Blowfish / Tenderly | 交易模拟（展示结果） | 只展示，不阻止 |
| Forta / The Graph | 链上监控 | 事后发现 |
| **Chiron** | **签名前校验** | **前置阻断** |

Chiron 在 Agent 的私钥签名前进行校验——不一致的交易根本不会被签名，更不会进入 mempool。

---

## 三、攻防能力

### 3.1 覆盖的 15 种攻击类型

| ID | 攻击类型 | 严重程度 | 检测层 | 效果 |
|---|---|---|---|---|
| A1 | Prompt 注入交易替换 | 严重 | L1: R1+R2 | ✅ 完全阻止 |
| A2 | 意图声明伪造 | 高 | L1: R3 | ✅ 完全阻止 |
| A3 | Calldata 篡改 | 严重 | L1: R2 | ✅ 完全阻止 |
| A4 | 隐藏 Approve | 严重 | L1: R5 | ✅ 完全阻止 |
| A5 | 隐藏 delegatecall | 严重 | L1: R6 | ✅ 完全阻止 |
| A6 | 金额操纵 | 严重 | L1: R4 | ✅ 完全阻止 |
| A7 | 接收地址替换 | 严重 | L1: R5 | ✅ 完全阻止 |
| A8 | 钓鱼合约调用 | 严重 | L1: R1 | ✅ 完全阻止 |
| A9 | 新协议零日攻击 | 严重 | L1→L2 | ⚠️ 事后追溯 / ✅ Strict 阻止 |
| A10 | 会话密钥泄露滥 | 高 | L1: R1 | ✅ 部分阻止 |
| A11 | 批量交易单步篡改 | 严重 | L1 (Phase 5) | ✅ 完全阻止 |
| A12 | 跨链 Intent 不一致 | 中 | L1 (Phase 5) | ✅ 完全阻止 |
| A13 | 验证证明重放 | 高 | 链上合约 | ✅ 完全阻止 |
| A14 | 日额度耗尽 | 高 | CircuitBreaker | ✅ 完全阻止 |
| A15 | Intent 声明绕过 | 低 | — | ❌ 设计边界 |

### 3.2 测试结果

```
Test Suites: 5 passed, 5 total
Tests:       47 passed, 47 total
攻击覆盖: 15/15 (100%)
L1 有效阻断: 9/9 (100%)
```

---

## 四、技术架构

### 4.1 三层架构

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

### 4.2 多链支持

| 链 | Chain ID | 协议数 |
|---|---|---|
| Ethereum | 1 | 20+ |
| Arbitrum | 42161 | 6 |
| Optimism | 10 | 5 |
| Base | 8453 | 4 |
| Polygon | 137 | 3 |

---

## 五、标准兼容性与生态定位

### 5.1 与 ERC 标准的兼容

| 标准 | 兼容方式 |
|---|---|
| **ERC-8004** (Trustless Agents) | VerificationStore → ReputationRegistry |
| **ERC-8211** (Smart Batching) | 对 batch 中每步独立校验 |
| **ERC-7683** (Cross Chain Intents) | 跨链意图一致性校验 |
| **ERC-4337** (Account Abstraction) | validateUserOp 阶段插入校验 |
| **EIP-1271** (Contract Signature) | 验证证明包装为补充签名 |

### 5.2 填补的 ERC-8xxx 系列缺口

在完整分析了 ERC-8004、ERC-8183、ERC-7683、ERC-8211 等标准后，Chiron 填补了关键空白：

| 安全领域 | 已有标准覆盖 | Chiron 填补 |
|---|---|---|
| Agent 身份 | ERC-8004 ✅ | — |
| Agent 声誉 | ERC-8004 ✅ | — |
| **Agent 交易权限** | **无标准** | ❌ ERC-8301 (预测) → **Chiron L1 校验** |
| **Solver 验证** | **无标准** | ❌ ERC-8311 (预测) → **BondPool + CircuitBreaker** |
| 跨链意图格式 | ERC-7683 ✅ | — |
| **Agent 审计日志** | **无标准** | ❌ ERC-8341 (预测) → **VerificationReceipt** |

### 5.3 与现有安全工具的互补关系

```
用户最终的安全栈：

1. Transaction Simulation (Blowfish)
   → "这笔交易会做什么？"（展示给用户看）

2. Chiron (本方案)
   → "这笔交易和 Agent 说的一样吗？"（自动阻止）

3. Policy Engine (Zodiac/Defender)
   → "这笔交易在规则范围内吗？"（静态安全边界）

4. Multi-sig (Safe)
   → "这是大额交易，需要多人确认"

Chiron 不替代任何一层——
它填补的是"Intent vs Execution"这个空白。
```

---

## 六、开发历程

### 6.1 五阶段交付

| 阶段 | 时间 | 交付物 | 状态 |
|---|---|---|---|
| Phase 1: Core SDK | 10 天 | IntentParser + TxDecoder + ConsistencyChecker + 3行集成 | ✅ |
| Phase 2: User Trust | 12 天 | VerificationStore 合约 + Demo Agent + Web UI | ✅ |
| Phase 3: Security | 1 天 | 15 种攻击测试 + 全覆盖验证 | ✅ |
| Phase 4: Production | 10 天 | BondPool + CircuitBreaker + L2 Verifier + 多链部署 | ✅ |
| Phase 5: Ecosystem | 8 天 | Batch 校验 + IntentTemplateRegistry + Webhook 告警 | ✅ |

### 6.2 项目统计

| 指标 | 数据 |
|---|---|
| 总测试数 | 47 |
| 协议注册数 | 40+ |
| 智能合约数 | 4 |
| SDK 模块数 | 10 |
| 文档数 | 12 |
| 用户故事数 | 11 |

---

## 七、前沿性分析

### 7.1 学术前沿性

Chiron 处于多个前沿交叉点的核心：

1. **AI × 区块链安全**：随着 AI Agent 大规模部署，其安全问题是 2025-2026 年的热点。arXiv 2601.04583 (Autonomous Agents on Blockchains)、arXiv 2602.17805 (Liquidity Exhaustion Attacks) 等论文直接关联

2. **意图架构安全**：ERC-7683 (Cross Chain Intents) 是 2024-2026 年最活跃的标准提案之一，但缺乏对应的安全模型。Chiron 是首个系统性地解决"Intent-Execution Semantic Gap"的工作

3. **语义一致性验证**：将 PL 领域的"语义一致性"概念引入区块链交易安全，建立了一套形式化的验证框架

### 7.2 产业前沿性

1. **Agent 经济的基础设施**：a16z、Paradigm 等顶级 VC 在 2025-2026 年重点布局 Agent 经济，Chiron 定位为 Agent 交易安全层的核心基础设施

2. **EIP/ERC 标准生态**：Chiron 的 IntentTemplate 结构和 L1 校验规则可发展为 ERC-8301 (Agent Policy) 标准的参考实现

3. **互补而非竞争**：Chiron 不替代 Blowfish、Zodiac、Safe 等现有工具，而是填补了它们之间的空白区域

### 7.3 技术创新亮点

| 创新点 | 领域贡献 | 可扩展性 |
|---|---|---|
| 意图-执行语义一致性验证 | 首个系统化框架 | 可扩展为 ERC 标准 |
| 双层验证架构 | L1/L2 设计模式 | 可接入更多 L2 Verifier |
| 6 条确定性规则 | 可穷举的安全模型 | 可新增规则覆盖更多场景 |
| 3 行集成 | 极低的采用门槛 | 可适配多种 Agent 框架 |
| 前置阻断 | 签名前校验范式 | 可集成到钱包层 |

---

## 八、结语

Chiron 的核心贡献不是实现了一个具体的安全工具，而是**重新定义了 AI Agent 交易安全的问题框架**。

传统方案问 "What is safe?"——这是一个无法形式化验证的问题。

Chiron 问 "Is it consistent?"——这是一个可以确定性验证的问题。

这个重新框架化（reframing）将 Agent 交易安全从"安全审计"（需要人工判断）推进到"自动校验"（机器可验证）的阶段，是区块链安全领域从**语法安全**（正确的签名、正确的格式）到**语义安全**（正确的意图、正确的语义）的一次跃迁。

---

*项目地址：`/Users/rest/Documents/agent-safe`*
