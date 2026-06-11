# ERC-8xxx 系列协议及 ERC-83xx 预测

> 调查时间：2026-06-11
> 视角：Agent 交易安全

---

## 一、ERC-8xxx 系列全景

ERC-8xxx 是 Ethereum 上专注于 **Agent 经济、跨链互操作、意图交易、账户抽象执行** 的新兴标准序列。

### 1.1 完整标准列表

截至 2026 年中，涉及 Agent 和交易的 ERC-8xxx 提案共 6 个：

| EIP | 标题 | 创建时间 | 作者/推动者 | 核心定位 | 状态 |
|---|---|---|---|---|---|
| **ERC-7683** | Cross Chain Intents | 2024-04 | Uniswap + Across | Solver 跨链意图标准 | Draft |
| **ERC-7828** | Interoperable Names | 2024-11 | DeFi Wonderland | 人类可读跨链地址名 | Draft |
| **ERC-7930** | Interoperable Addresses | 2025-02 | DeFi Wonderland | (chain, address) 二进制格式 | Draft |
| **ERC-8004** | Trustless Agents | 2025-08 | MetaMask / Coinbase | Agent 身份、声誉、验证注册表 | Draft |
| **ERC-8183** | Agentic Commerce | 2026-02 | Virtuals Protocol | Agent 间工作托管协议 | Draft |
| **ERC-8211** | Smart Batching | 2026-02 | Biconomy + EF | 运行时参数注入 + 谓词门控批量交易 | Draft |

---

### 1.2 ERC-8004：Trustless Agents（无信任代理）

**提出方：** MetaMask / Coinbase / Ethereum Foundation

**核心定位：** 在无需预先信任的前提下发现、选择、与跨组织的 Agent 交互。

**三个注册表体系：**

```
IdentityRegistry（身份注册表——ERC-721 + URIStorage）
  ├─ 每个 Agent 一个链上 handle
  ├─ 解析至 Agent 的注册文件（capabilities、pricing、endpoint）
  └─ 便携、抗审查

ReputationRegistry（声誉注册表）
  ├─ 标准接口发布和获取客户端反馈信号
  ├─ 链上聚合（可组合）+ 链下评分（灵活算法）
  └─ 生态支持专业评分、审计网络、保险池

ValidationRegistry（验证注册表）
  ├─ 请求和记录独立验证者的检查结果
  ├─ 可选验证模式：Staker 重跑任务 / zkML 证明 / TEE 预言机
  └─ 安全级别与风险价值成正比
```

**安全考量：**
- 信任模型可插拔、分层设计，从小额（订披萨）到大额（医疗诊断）
- 支付正交设计——可接入 x402 支付等标准
- 依赖 EIP-1271（合约签名验证）、EIP-712（结构化签名）

---

### 1.3 ERC-8183：Agentic Commerce（代理商务协议）

**提出方：** Virtuals Protocol

**核心定位：** Agent 间工作托管——Client 锁仓资金 → Provider 提交工作 → Evaluator 验证付款。

**六状态机：**

```
Open → Funded → Submitted → Completed
  │         │          │
  └→Rejected └→Rejected └→Rejected
                 各阶段可 → Expired（超时退款）
```

**核心角色：**
- **Client（客户）：** 创建工作并锁定预算
- **Provider（提供者）：** 提交交付物
- **Evaluator（评估者）：** 唯一有权标记完成或拒绝的实体

**安全考量：**
- Evaluator 可以是 Client 自己（无需第三方仲裁）
- 可选 Attestation Reason（如 hash）用于审计
- 原生兼容 ERC-8004 声誉系统（ERC-8183 原文明确提及）
- 超时退款机制防止资金永久锁定

---

### 1.4 各标准的关系图谱

```
ERC-7930 (Interoperable Addresses)
    └── 依赖 ──→ ERC-7683 (Cross Chain Intents)
                    ↓
              ERC-8211 (Smart Batching) ←── 原生兼容 ──→ ERC-7683
                    ↓
         AI 代理生成 ERC-8211 batch → 用户签署 Merkle root

ERC-7828 (Interoperable Names)
    └── 人类友好层 ──→ ERC-7930

ERC-8004 (Trustless Agents)
    ├── IdentityRegistry → Agent 身份 + 能力声明
    ├── ReputationRegistry → 声誉（参考 ERC-8183 的完成记录）
    └── ValidationRegistry → 验证（可用于 Solver 验证）

ERC-8183 (Agentic Commerce)
    ├── 工作托管 + 资金托管
    ├── 参考 ERC-8004 做声誉聚合
    └── 面向 Agent-to-Agent 商务场景
```

---

## 二、ERC-8xxx 系列的安全缺口分析

从 Agent 交易安全视角审查已有标准的覆盖情况：

### 2.1 已覆盖的安全领域

| 安全领域 | 覆盖标准 | 覆盖程度 |
|---|---|---|
| Agent 身份 | ERC-8004 IdentityRegistry | ✅ 完整（ERC-721 标准） |
| Agent 声誉 | ERC-8004 ReputationRegistry | ✅ 完整（可插拔评分） |
| Agent 工作验证 | ERC-8004 ValidationRegistry + ERC-8183 Evaluator | ✅ 完整 |
| 跨链地址解析 | ERC-7930 + ERC-7828 | ✅ 完整 |
| 跨链意图格式 | ERC-7683 | ✅ 完整 |
| 批量交易参数解析 | ERC-8211 | ✅ 完整 |
| Agent 间资金托管 | ERC-8183 | ✅ 完整 |

### 2.2 仍存在的安全缺口

| 安全领域 | 缺少标准 | 风险级别 |
|---|---|---|
| **Agent 交易策略授权** | 无标准定义 "代理能签什么交易、不能签什么" | 高 |
| **Solver 身份/声誉/验证** | ERC-7683 无配套的 Solver 验证标准 | 高 |
| **意图隐私** | 公开 intent mempool，无加密标准 | 中-高 |
| **跨链结算证明** | 跨链填充的最终性证明无标准格式 | 高 |
| **Agent 交易审计** | 代理决策过程无标准日志格式 | 中-高 |
| **代理权限分层** | 会话级 vs 多签级 vs 策略级无标准 | 高 |

### 2.3 关键缺口详解

**缺口 1：Agent 交易策略授权**

ERC-8004 定义了 Agent 的身份和声誉，ERC-8183 定义了工作托管——但两者都未定义 **Agent 签署链上交易时的权限范围**。

问题场景：
- AI 交易代理持有会话密钥，但没有标准格式声明"这个密钥只能用于 Uniswap V3 上的 ETH/USDC 交易，单笔不超过 1000 USDC"
- 钱包无法区分"代理签署的 Swap 交易"和"攻击者通过 Prompt 注入诱导的恶意 Approve"
- 各协议自行实现策略检查，无法跨钱包/跨应用互操作

**缺口 2：Solver 验证系统**

ERC-7683 假设 Solver 自行通过 `eth_call` 验证 Intent 的安全性。这种设计将信任成本完全转移给 Solver，且未标准化：
- Solver 身份的验证方式
- Solver 填充完成率的追踪
- Solver 违约的处罚机制
- Solver 间共谋的检测

流动性枯竭攻击（arXiv 2602.17805）成功的关键前提之一是：可以低成本批量创建 Solver 身份并提交假 Intent。

**缺口 3：Intent Mempool 隐私保护**

所有已发布的 ERC-8xxx 标准都假设 Intent 的广播是公开的。这意味着：
- Solver 和 MEV 机器人可以监控待填充的 Intent
- Intent 参数（方向、金额、滑点容忍度）可被利用
- 用户的交易策略可被推断

ERC-8004 的 ValidationRegistry 虽然提供了验证机制，但验证发生在执行后而非执行前，无法防止 Intent 抢跑。

---

## 三、ERC-83xx 预测（修正版）

在完整了解 ERC-8004 和 ERC-8183 后，对之前的预测进行修正和补充：

### 3.1 ERC-8301：Agent Transaction Policy（代理交易策略标准）

**预估提出时间：** 2026 Q4 – 2027 Q1

**背景：** ERC-8004 定义了 Agent 的**身份和声誉**，ERC-8183 定义了 Agent 间**工作托管**。下一个自然延伸是：Agent 代表用户签署链上交易时，需要一种标准化的**策略声明格式**来告诉钱包和合约"这个 Agent 可以签什么、不可以签什么"。

**与现有标准的关系：**
- ERC-8004 的 IdentityRegistry → Agent 是谁
- ERC-8004 的 ReputationRegistry → Agent 可信吗
- **ERC-8301（预测）→ Agent 可以做什么交易**

**可能包含的结构：**

```
struct AgentPolicy {
    address agent;              // 代理地址
    address principal;          // 委托方地址
    uint256 validFrom;
    uint256 validUntil;
    PolicyRule[] rules;         // 策略规则
    uint256 maxValuePerTx;      // 单笔上限
    uint256 maxValuePerDay;     // 日累计上限
    address[] allowedContracts; // 允许调用的合约白名单
    bytes32 policyHash;         // 策略哈希
    bytes principalSignature;   // 委托方签名
}

struct PolicyRule {
    address targetContract;
    bytes4 selector;            // 方法选择器
    ParameterConstraint[] constraints;  // 参数约束
}

struct ParameterConstraint {
    uint256 paramIndex;
    uint256 minValue;
    uint256 maxValue;
}
```

**解决的关键漏洞：** Prompt 注入交易、代理签名滥用、私钥泄露后的损失控制

---

### 3.2 ERC-8311：Solver Attestation（Solver 验证标准）

**预估提出时间：** 2026 Q4

**背景：** ERC-7683 定义了 Solver 接口但未标准化 Solver 身份验证。ERC-8004 的 ValidationRegistry 提供了通用的验证框架，但未针对 Solver（跨链 Intent 填充者）这一特定角色优化。需要专门的 Solver 验证和声誉标准。

**与现有标准的关系：**
- ERC-7683 → Solver 做什么
- ERC-8004 ValidationRegistry → 通用验证框架
- **ERC-8311（预测）→ Solver 特定的身份 + 声誉 + 罚则**

**Solv er 与普通 Agent 的区别——为什么需要专用标准：**

| 维度 | 普通 Agent（ERC-8004） | Solver（Intent 填充者） |
|---|---|---|
| 操作性质 | 代表用户工作 | 垫付流动性 + 提交链上交易 |
| 风险类型 | 工作质量风险 | 流动性风险 + 交易失败风险 |
| 验证方式 | 工作结果评估 | 填充成功率 + 按时结算率 |
| 罚则 | 声誉下降 | 质押罚没 |

**可能包含的结构：**

```
struct SolverProfile {
    address solver;
    uint256 bondedStake;        // 质押金额
    uint256 totalFills;
    uint256 successfulFills;
    uint256 failedFills;
    uint256 avgFillTime;        // 平均填充时间
    bytes32[] supportedProtocols;
    uint256 lastActivity;
}

struct FillAttestation {
    bytes32 orderId;
    address solver;
    uint256 timestamp;
    FillStatus status;          // SUCCESS / FAILED / DISPUTED
    bytes32 fillHash;
    address verifier;           // 关联 ERC-8004 ValidationRegistry
}
```

**解决的关键漏洞：** 流动性枯竭攻击（通过提高 Sybil Solver 成本）、Solver 虚假报价、Solver 违约

---

### 3.3 ERC-8321：Intent Privacy（意图隐私标准）

**预估提出时间：** 2027

**背景：** 所有已发布标准均假设 Intent 公开可见。ERC-8211 的 Storage Context 提供了跨步骤数据隔离，但未覆盖跨参与方隐私保护。

**可能的方案：**
- **加密 Intent 信封：** 使用阈值加密，仅在拍卖结束后揭示
- **承诺-揭示机制：** 先提交 Intent 哈希，揭示阶段再暴露具体参数
- **ZK Intent 验证：** Solver 验证意图约束的有效性而不查看具体参数

---

### 3.4 ERC-8331：Cross-Chain Settlement Proof（跨链结算证明标准）

**预估提出时间：** 2026 Q4 – 2027 Q1

**背景：** ERC-7683 定义了跨链 Intent 格式，ERC-7930 定义了跨链地址格式，但两者都未标准化跨链填充的最终性证明格式。

**重要性：** 流动性枯竭攻击和 CCSC 攻击都利用了跨链结算的最终性窗口。

**可能定义：**

```
struct SettlementProof {
    uint256 sourceChain;
    uint256 destinationChain;
    bytes32 orderId;
    bytes32 fillTxHash;
    uint256 fillBlockNumber;
    uint256 requiredConfirmations;
    ProofType proofType;        // MERKLE / ZK / OPTIMISTIC
    bytes proofData;
}

interface ISettlementVerifier {
    function verify(bytes32 orderId, SettlementProof calldata proof) external returns (bool);
    function getFinalityDelay(uint256 chainId) external view returns (uint256);
}
```

---

### 3.5 ERC-8341：Agent Transaction Audit Log（代理交易审计标准）

**预估提出时间：** 2027

**背景：** ERC-8004 的 ReputationRegistry 记录了 Agent 的声誉信号，但这些信号是聚合后的评分，缺乏对具体交易决策过程的可审计记录。ERC-8183 记录工作完成情况，但未覆盖**为什么** Agent 决定执行某个具体交易。

**可能定义：**

```
struct AgentAction {
    address agent;
    bytes32 sessionId;
    uint256 timestamp;
    ActionType actionType;      // SWAP / BRIDGE / APPROVE / etc.
    bytes32 triggerHash;        // 触发源（Prompt / 链上事件 / 定时任务）
    TriggerSource triggerKind;  // PROMPT / ONCHAIN_EVENT / SCHEDULED / API
    bytes32 policyHash;         // 执行时生效的策略
    bytes signedCalldata;       // 实际签署的调用数据
    ActionResult result;        // SUCCESS / FAIL / REVERT
    bytes failureData;
}
```

**解决的关键漏洞：** Prompt 注入取证（追溯至触发源）、代理行为异常检测、合规审计

---

### 3.6 更新时间线

```
2024 Q2 ─ ERC-7683 Cross Chain Intents
2024 Q4 ─ ERC-7828 Interoperable Names
2025 Q1 ─ ERC-7930 Interoperable Addresses
2025 Q3 ─ ERC-8004 Trustless Agents           ← 新增
2026 Q1 ─ ERC-8183 Agentic Commerce           ← 新增
2026 Q1 ─ ERC-8211 Smart Batching
         │
2026 Q4 ── ERC-8311 Solver Attestation        ← 流动性枯竭攻击推动
          ERC-8301 Agent Policy               ← AI 代理大规模采用推动
         │
2027 Q1 ── ERC-8331 Cross-Chain Settlement Proof
          ERC-8321 Intent Privacy
         │
2027 Qn ── ERC-8341 Agent Audit Log
```

### 3.7 各标准之间的完整依赖关系

```
ERC-7828 (Names) → ERC-7930 (Addresses) → ERC-7683 (Intents)
                                                  │
                  ERC-8004 (Agent Identity/Reputation)
                    ├── IdentityRegistry → Agent 身份
                    ├── ReputationRegistry → Agent 声誉（聚合 ERC-8183 完成记录）
                    └── ValidationRegistry → Agent 工作验证
                              │
                    ERC-8183 (Agentic Commerce) ←── 依赖 ERC-8004 声誉
                              │
          ┌──────────────────┘
          ↓
    ERC-8301 (预测) → Agent Policy → 签名权限 → ??? 已有 ERC-8004 身份 + ERC-8211 执行
          ↓
    ERC-8341 (预测) → Agent Audit → 审计追溯
          
ERC-7683 (Intents) ←── ERC-8211 (Smart Batching) 原生兼容
    │
    ├── 缺少 → ERC-8311 (预测) Solver Attestation
    ├── 缺少 → ERC-8321 (预测) Intent Privacy
    └── 缺少 → ERC-8331 (预测) Settlement Proof
```

---

## 四、更新后的漏洞映射

| 预测标准 | 解决的关键漏洞 | 与现有标准的关系 |
|---|---|---|
| ERC-8301 Agent Policy | AI Prompt 注入交易、代理签名滥用 | 补充 ERC-8004（身份 + 策略）|
| ERC-8311 Solver Attestation | 流动性枯竭攻击、虚假报价 | 补充 ERC-7683（Solver 验证）|
| ERC-8321 Intent Privacy | Intent 抢跑、AI-MEV | 补充 ERC-7683 + ERC-8211 |
| ERC-8331 Settlement Proof | 最终性欺诈、重组攻击、CCSC | 补充 ERC-7683（跨链验证）|
| ERC-8341 Agent Audit Log | 异常交易取证、合规审计 | 补充 ERC-8004 + ERC-8183 |

---

## 五、参考资料

| 类型 | 标题 | 来源 |
|---|---|---|
| EIP | ERC-7683: Cross Chain Intents | eips.ethereum.org/EIPS/eip-7683 |
| EIP | ERC-7828: Interoperable Names | eips.ethereum.org |
| EIP | ERC-7930: Interoperable Addresses | eips.ethereum.org/EIPS/eip-7930 |
| EIP | **ERC-8004: Trustless Agents** | eips.ethereum.org/EIPS/eip-8004 |
| EIP | **ERC-8183: Agentic Commerce** | eips.ethereum.org/EIPS/eip-8183 |
| EIP | ERC-8211: Smart Batching | eips.ethereum.org (PR #1638) |
| 论文 | Exploiting Liquidity Exhaustion Attacks in Intent-Based Bridges | arXiv 2602.17805 |
| 论文 | Autonomous Agents on Blockchains | arXiv 2601.04583 |
| 文章 | What Is ERC-8211? Smart Batching Standard Explained 2026 | Eco.com |
| 文章 | Weiroll vs Smart Batching (ERC 8211) - A Deeper Comparison | Biconomy Blog |
| 标准 | ERC-7930 / ERC-7828 Universal Address Formats | interopaddress.com |
| 会议 | L2 Interop Working Group | notes.ethereum.org |
