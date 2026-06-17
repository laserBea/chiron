# Chiron Agent 集成指南

## 一句话

**任何链上 Agent，只需在发送交易前调用一次 `chiron.verify(intent, tx)`，即可获得 L1 一致性校验保护。**

## 集成方式对比

| 方式 | 适用场景 | 代码量 | 依赖 |
|---|---|---|---|
| **SDK 直接集成** | Node.js/TypeScript Agent | 3 行 | `@chiron/sdk` |
| **HTTP API** | 任何语言/框架的 Agent | 1 个 curl | 无 |
| **ElizaOS 插件** | ElizaOS Agent | 配置注册 | `plugin-chiron` |

## 核心流程

```
┌─────────────────────────────────────────────────────┐
│                 你的 Agent                           │
│  1. 解析用户输入 → 2. 生成 Intent                  │
│  3. 构造交易 → 4. 调用 chiron.verify()             │
└─────────────────────────────────────────────────────┘
                            │
                            ▼
                   PASS     │     FAIL
                     │      │      │
                     ▼      ▼      ▼
                 放行交易    阻断交易 → 告警→CB
                 链上存证
```

## Agent 端到端流程（真实场景）

```
用户："帮我把 100 USDC 换成 ETH，走 Uniswap"
   │
   ▼
① Agent (LLM) 理解自然语言 → "用户要 Swap 100 USDC → WETH"
   │
   ▼
② Agent 声明 IntentTemplate
   │ → { actionType: SWAP, protocol: uniswap_v3, amount: "100", ... }
   │
   ▼
③ Agent 构造交易 Transaction
   │ → { to: UniswapRouter, data: exactInputSingle(...), value: "0" }
   │
   ▼
④ Chiron L1 校验 (6 条规则)
   │ ├─ R1: 目标合约 → Uniswap V3 Router ✅
   │ ├─ R2: 函数选择器 → exactInputSingle ✅
   │ ├─ R3: Token 地址匹配 ✅
   │ ├─ R4: 金额 ±slippage ✅
   │ ├─ R5: 接收地址一致 ✅
   │ └─ R6: 无隐藏 delegatecall ✅
   │
   ▼
⑤ 校验通过 (PASS) → 放行 → 链上存证
   │
   ▼
⑥ 用户可在 Etherscan 验证 Agent 的每一次操作
```

## 已验证的集成

Sepolia 测试链：
- 链上存证: https://sepolia.etherscan.io/tx/0x1de83e690168c1900a92fd82ca1ae9866e67a884e9a204efe247742831e5e13a
- Chiron 合约: 0xD21BCB2868e44e7644B52E21838Eb7c1431EA838
