
# Chiron — Agent Transaction Security Middleware

**语义一致性验证 | Semantic Consistency Verification**

Chiron 是一个 EVM 中间件，通过 **结构化意图模板 + 确定性本地校验 + 可选 AI 交叉验证**，确保 AI Agent 的每笔交易与其声明意图在语义上一致。

```
Agent 说："Swap 100 USDC for ETH on Uniswap V3"
Chiron 检查：实际 calldata 真的是在 Swap 100 USDC 吗？
结果：✅ 一致 → 放行  |  ❌ 不一致 → 阻止 + 告警
```

---

## 核心创新

### 意图-执行语义一致性验证（Intent-Execution Semantic Consistency Verification）

传统安全方案回答 **"这个交易安全吗？"**（需要知道用户意图才能判断，不可验证）。

Chiron 回答不同的问法：**"这个交易和 Agent 说的意图是同一件事吗？"**（比较两个结构化声明，可验证）。

### 双重验证架构

| 层级 | 机制 | 覆盖 | 延迟 | 成本 |
|---|---|---|---|---|
| L1 | 确定性本地校验（结构化 IntentTemplate vs DecodedTx） | ~95% | ~10ms | 0 Gas, 0 API |
| L2 (可选) | 多 AI 模型交叉验证（GPT + Claude + Gemini） | 剩余 5% | 2-5s（Strict） | 低 API 费用（仅触发时）|
| 链上 | BondPool + CircuitBreaker + VerificationStore | N/A | 异步 | ~30k Gas/次 |

---

## 防范的攻击类型

| 攻击 | 描述 | Chiron 防御 |
|---|---|---|
| Prompt 注入交易替换 | 注入使 Agent 生成意图不符的交易 | ✅ L1: selector 不匹配 |
| 隐藏 Approve | 声称 Swap 实际 Approve | ✅ L1: 函数签名不匹配 |
| 隐藏 delegatecall | 调用中嵌套恶意代理调用 | ✅ L1: 检测嵌套 delegatecall |
| 金额操纵 | 篡改交易金额 | ✅ L1: ±slippage 范围检查 |
| 接收地址替换 | 输出地址改为攻击者地址 | ✅ L1: 参数比较 |
| 会话密钥泄露 | 私钥泄露后被滥用 | ✅ L1: 意图一致性二次防线 |
| 验证证明重放 | 重用已通过的验证结果 | ✅ 链上: 绑定 txHash |

[完整 15 种攻击类型 →](docs/Agent交易保障中间件PRD.md#61-攻击类型全覆盖矩阵)

---

## 解决的问题

| 问题 | 传统方案空白 | Chiron 方案 |
|---|---|---|
| 意图-执行鸿沟 | 假设"代码即意图" | IntentTemplate vs DecodedTx 比较 |
| Prompt 注入防护 | 白名单无法拦截语义错误 | 检测函数签名和参数类型的根本性变化 |
| Agent 自治信任边界 | 要么全信要么全手动 | 自动执行 + 意图一致性保证 |
| 会话密钥单点失效 | 无第二道防线 | L1 校验：有私钥也要匹配意图 |
| Agent 行为可审计性 | 无标准化决策记录 | VerificationReceipt 链上存证 |

---

## 快速开始

```bash
npm install @chiron/sdk
```

```typescript
import { Chiron } from "@chiron/sdk";

const chiron = new Chiron({ chainId: 1, agentKey: privateKey });

const intent = chiron.intent("swap", {
  protocol: "uniswap_v3",
  tokenIn: "USDC",
  tokenOut: "WETH",
  amount: "100",
});

const receipt = await chiron.verify(intent, tx);
if (!receipt.allowed) throw new Error("Blocked: " + receipt.reason);

// 签名并广播
await wallet.sendTransaction(tx);

// 异步存证（非阻塞）
chiron.storeReceipt(receipt);
```

---

## 项目结构

```
chiron/
├── sdk/            # JavaScript SDK (@chiron/sdk)
│   ├── src/        # 源码
│   └── package.json
├── contracts/      # Solidity 合约
│   ├── src/        # 合约源码
│   └── foundry.toml
├── docs/           # 文档
│   ├── 区块链交易代理现状及漏洞调查.md
│   ├── ERC8xxx系列协议及ERC83xx预测.md
│   └── Agent交易保障中间件PRD.md
├── README.md
└── .gitignore
```

---

## 文档

- [PRD 文档](docs/Agent交易保障中间件PRD.md) — 完整产品需求文档
- [ERC-8xxx 系列分析](docs/ERC8xxx系列协议及ERC83xx预测.md) — 标准生态扫描
- [交易漏洞调查](docs/区块链交易代理现状及漏洞调查.md) — Agent 交易安全现状

---

## 兼容标准

| 标准 | 兼容方式 |
|---|---|
| ERC-8004 (Trustless Agents) | VerificationStore → ReputationRegistry |
| ERC-8211 (Smart Batching) | 对 batch 中每步独立校验 |
| ERC-7683 (Cross Chain Intents) | 跨链意图一致性校验 |
| ERC-4337 (Account Abstraction) | validateUserOp 阶段插入校验 |
| EIP-1271 (Contract Signature) | 验证证明包装为补充签名 |
