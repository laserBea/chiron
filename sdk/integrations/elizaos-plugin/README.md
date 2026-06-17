# plugin-chiron — Agent 交易一致性验证 (ElizaOS 插件)

## 安装

```json
{
  "dependencies": {
    "plugin-chiron": "file:./integrations/elizaos-plugin",
    "@chiron/sdk": "file:../.."
  }
}
```

## 使用方法

### 注册插件到 ElizaOS Agent

```typescript
import { createChironPlugin } from "plugin-chiron";

const agent = {
  plugins: [
    createChironPlugin({
      chainId: 11155111,          // Sepolia
      rpcUrl: process.env.RPC_URL,
      chironContract: "0xD21BCB2868e44e7644B52E21838Eb7c1431EA838",
      privateKey: process.env.AGENT_PK,
      mode: "enforce",             // "enforce" | "alert" | "off"
    }),
  ],
};
```

### 插件生命周期

```
Agent 决策执行某操作
   │
   ▼
ChironPlugin.beforeTransaction()
   ├── 提取 Agent 声明的 Intent
   ├── 与即将执行的 Transaction 对比校验
   │
   ├─ 一致 (PASS)  →  放行 → 链上存证
   └─ 不一致 (FAIL) →  阻断 → CircuitBreaker 记录
```

### 三种模式

| 模式 | 行为 |
|---|---|
| `enforce` | FAIL 时阻止交易执行 |
| `alert` | FAIL 时发出警报，不阻止 |
| `off` | 跳过验证 |
