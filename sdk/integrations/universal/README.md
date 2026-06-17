# Chiron Universal Middleware

> 一个通用的验证中间件，任何 Agent（无论框架）在发送交易前调用。

## HTTP API（零代码集成）

启动验证服务：

```bash
bun run serve.ts
# Listening on :3841
```

Agent 调用：

```bash
curl -X POST http://localhost:3841/verify \
  -H "Content-Type: application/json" \
  -d '{
    "intent": {
      "actionType": 1,
      "protocol": "uniswap_v3",
      "tokenIn": "USDC",
      "tokenOut": "WETH",
      "amount": "100"
    },
    "tx": {
      "to": "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      "data": "0x414bf389...",
      "value": "0"
    }
  }'
```

返回：

```json
{
  "allowed": true,
  "l1Result": "PASS",
  "details": [
    {"ruleId": "R1", "passed": true, "ruleName": "目标协议检查"},
    {"ruleId": "R2", "passed": true, "ruleName": "函数选择器检查"},
    {"ruleId": "R3", "passed": true, "ruleName": "Token 地址匹配"},
    {"ruleId": "R4", "passed": true, "ruleName": "金额范围检查"},
    {"ruleId": "R5", "passed": true, "ruleName": "意外参数检查"},
    {"ruleId": "R6", "passed": true, "ruleName": "隐藏调用检测"}
  ]
}
```

## SDK 直接集成（3 行代码）

```typescript
import { Chiron } from "@chiron/sdk";

const chiron = new Chiron({ chainId: 1 });
const receipt = await chiron.verify(intent, tx);

if (receipt.l1Result !== "PASS") {
  throw new Error(`Chiron 拦截: ${receipt.reason}`);
}
// 放行交易
```
