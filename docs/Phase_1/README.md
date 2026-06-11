# Chiron Phase 1 — Core SDK

> 周期：10 个工作日
> 交付用户故事：US-01（结构化意图声明）+ US-02（极简集成）
> 交付版本：v0.1.0-alpha
> 里程碑：M1 — L1 校验可跑通

---

## 一、Phase Scope

### 1.1 包含范围

| 组件 | 包含 | 不包含 |
|---|---|---|
| IntentTemplate | 9 种 Action 类型定义、IntentParser、hash 序列化 | Intent 自然语言解析 |
| TxDecoder | 4byte selector 解码、ABI 参数解析、已知合约 ABI 缓存 | 不支持的事件日志解码 |
| ConsistencyChecker | 6 条确定性校验规则（合约/函数/参数/金额/异常/嵌套）| AI 辅助校验（L2）|
| Protocol Registry | ≥ 20 个主流 DeFi 合约地址 → Action 映射 | 社区提交注册 |
| SDK API | intent(), verify(), storeReceipt() 骨架 | 链上存证实装 |

### 1.2 依赖关系

| 依赖 | 类型 | 用途 |
|---|---|---|
| ethers.js ^6.0 | 外部 npm | ABI 解码、链上交互 |
| TypeScript ^5.0 | 开发工具 | 类型系统 |
| Jest ^29.0 | 测试框架 | 单元测试 |
| 4byte.directory | 外部 API | 未知 selector 回退查找 |

---

## 二、PRD — 需求规格

### 2.1 US-01: 结构化意图声明

**功能规格 F-INT-01: IntentTemplate 定义**

```typescript
interface IntentTemplate {
  actionType: ActionType;     // enum: SWAP=1, APPROVE=2, ..., CUSTOM=9
  protocolHash: string;       // keccak256("uniswap_v3")
  tokenIn: string;            // checksummed address
  tokenOut: string;           // checksummed address
  amount: string;             // decimal string (human-readable, e.g. "100")
  amountOutMin: string;       // decimal string
  receiver: string;           // checksummed address
  deadline: number;           // unix timestamp
  customData: string;         // JSON string (CUSTOM type only)
}

type ActionType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
const ACTION_NAMES = {
  1: "swap", 2: "approve", 3: "bridge", 4: "deposit",
  5: "withdraw", 6: "stake", 7: "vote", 8: "permit", 9: "custom",
} as const;
```

**功能规格 F-INT-02: IntentParser API**

```typescript
class IntentParser {
  constructor(chainId: number, tokenResolver?: TokenResolver);
  
  // 主入口：创建意图
  create(actionName: string, params: IntentParams): IntentTemplate;
  
  // 序列化：IntentTemplate → bytes32
  hash(intent: IntentTemplate): string;  // keccak256(abi.encode(intent))
  
  // 格式校验：验证字段完整性
  validate(intent: IntentTemplate): ValidationResult;
}
```

**验收标准：**
- [ ] 所有 9 种 Action 类型可生成正确的 IntentTemplate
- [ ] token symbol → address 自动解析（需 TokenResolver）
- [ ] amount 自动处理 decimal 精度（USDC 6 → wei, ETH 18 → wei）
- [ ] 相同输入始终产生相同的 hash（确定性）
- [ ] 非法 Action 名称抛出 `UnknownActionError`
- [ ] 缺少必填字段抛出 `ValidationError`

---

### 2.2 US-02: 极简集成

**功能规格 F-SDK-01: Chiron 主入口**

```typescript
class Chiron {
  constructor(config: ChironConfig);
  
  // 创建意图
  intent(action: string, params: IntentParams): IntentTemplate;
  
  // L1 校验
  async verify(intent: IntentTemplate, tx: TxCandidate): Promise<VerificationReceipt>;
  
  // 异步存证（骨架，Phase 2 实装）
  async storeReceipt(receipt: VerificationReceipt): Promise<void>;
}

interface ChironConfig {
  chainId: number;               // 链 ID
  agentKey?: string;             // Agent 私钥（可选，用于签名）
  securityLevel?: 'standard' | 'strict';  // 默认 standard
  tokenResolver?: TokenResolver; // 代币地址解析器（可选）
}
```

**功能规格 F-SDK-02: 3 行集成约束**

```typescript
// ┌─────────────────────────────────────┐
// │ Agent 已有代码                       │
// └─────────────────────────────────────┘
const tx = agent.buildTransaction(params);

// ┌─────────────────────────────────────┐
// │ 新增第 1 行：import                  │
// └─────────────────────────────────────┘
import { Chiron } from "@chiron/sdk";

// ┌─────────────────────────────────────┐
// │ 新增第 2 行：初始化（session 级）    │
// └─────────────────────────────────────┘
const chiron = new Chiron({ chainId: 1 });
const intent = chiron.intent("swap", { protocol: "uniswap_v3", tokenIn: "USDC", tokenOut: "WETH", amount: "100" });

// ┌─────────────────────────────────────┐
// │ 新增第 3 行：校验 + 阻断             │
// └─────────────────────────────────────┘
const r = await chiron.verify(intent, tx);
if (!r.allowed) throw new Error(`Chiron blocked: ${r.reason}`);

// ┌─────────────────────────────────────┐
// │ Agent 已有代码                       │
// └─────────────────────────────────────┘
await signer.sendTransaction(tx);
```

**验收标准：**
- [ ] 新增代码 ≤ 3 行（import 算 1 行，instance 算 1 行，verify 算 1 行）
- [ ] 不需要修改 Agent 原有的交易构建代码
- [ ] L1 校验不发起任何链上交易（0 Gas）
- [ ] 同步返回校验结果（不需要等待外部服务）

---

## 三、开发计划

### 3.1 每日任务分解

```
Day 1  ▌ 类型定义 + 项目骨架
       类型：IntentTemplate, DecodedTx, VerificationReceipt, TxCandidate, ChironConfig
       骨架：Chiron class (intent, verify, storeReceipt)
       配置：package.json, tsconfig.json, jest.config.ts
       验证：pnpm build 通过

Day 2  ▌ IntentTemplate 生成器
       IntentParser.create() — 9 种 Action 类型
       TokenResolver — symbol → address
       decimal 精度自动转换
       验证：TC-01(标准Swap), TC-02(非法Action), TC-03(hash 确定性)

Day 3  ▌ Calldata 解码器基础
       TxDecoder.decode(target, data) → DecodedTx
       4byte selector 查找（内置缓存 + 4byte.directory 回退）
       基础 ABI 参数解码（uint, address, bytes32）
       验证：Uniswap V3 exactInputSingle 解码

Day 4  ▌ Calldata 解码器完善
       复杂类型解码（tuple, array, nested struct）
       已知合约 ABI 缓存初始化
       未知 selector 的 fallback（返回 raw hex）
       验证：Curve swap, Aave deposit, Uniswap multicall 解码

Day 5  ▌ L1 校验规则 1-3
       R1: 目标合约匹配已知协议地址表
       R2: 函数 selector 匹配 Action 类型
       R3: tokenIn/tokenOut 参数匹配
       验证：TC-07(Approve 替代 Swap → FAIL), TC-06(正常 Swap → PASS)

Day 6  ▌ L1 校验规则 4-6
       R4: amount ±slippage 范围检查
       R5: 异常参数检测（receiver 不匹配、附加 data）
       R6: 嵌套 delegatecall/create2 检测
       验证：TC-08(金额超限 → FAIL), delegatecall 检测 → FAIL

Day 7  ▌ 内置协议地址表
       整理 ≥ 20 个主流 DeFi 合约地址
       Uniswap V2/V3 (Ethereum, Arbitrum, Optimism, Polygon, Base)
       Curve, Balancer, Aave V2/V3, Compound V3
       Lido, 1inch V5/V6, ParaSwap, 0x Exchange Proxy
       Wormhole, Across, deBridge（桥接协议）
       验证：地址 → Action 映射准确率 100%

Day 8  ▌ SDK 主入口 + 3 行集成定型
       Chiron class: constructor, intent(), verify()
       storeReceipt() 骨架（返回 Promise<void>，Phase 2 实装）
       3 行集成示例代码验证
       验证：TC-04(3行集成), TC-05(0 Gas)

Day 9  ▌ 集成测试 + CI 配置
       GitHub Actions: lint + build + test
       5 条端到端测试（正常交易 ×3, 异常交易 ×2）
       Codecov 覆盖率配置（目标 ≥ 85%）
       验证：CI 流水线全绿

Day 10 ▌ Buffer + 文档 + 验收
       README 更新（快速开始 + API 文档）
       已知问题列表
       Phase 1 验收 CheckList 逐项确认
       发布 v0.1.0-alpha
```

### 3.2 交付物清单

| 交付物 | 路径 | 格式 |
|---|---|---|
| SDK npm 包 | `sdk/dist/` | TypeScript → JS |
| 类型定义 | `sdk/src/types.ts` | TypeScript |
| IntentParser | `sdk/src/intent.ts` | TypeScript |
| TxDecoder | `sdk/src/decoder.ts` | TypeScript |
| ConsistencyChecker | `sdk/src/checker.ts` | TypeScript |
| Protocol Registry | `sdk/src/registry.ts` | TypeScript |
| Chiron 主入口 | `sdk/src/index.ts` | TypeScript |
| 单元测试 | `sdk/test/` | Jest |
| 集成测试 | `sdk/test/integration/` | Jest |
| 内置协议地址表 | `sdk/src/registry-data.ts` | TypeScript (JSON) |

### 3.3 测试矩阵

| TCID | 场景 | 输入 | 预期 | 类型 |
|---|---|---|---|---|
| TC-01 | 标准 Swap 意图 | intent("swap", {protocol, tokenIn, tokenOut, amount}) | IntentTemplate 字段正确，hash 非空 | Unit |
| TC-02 | 非法 Action 名称 | intent("invalid_action", {}) | 抛出 UnknownActionError | Unit |
| TC-03 | Hash 确定性 | 两次相同输入 | hash1 === hash2 | Unit |
| TC-04 | 3 行集成 | 完整集成示例 | 仅 3 行新代码，校验通过 | E2E |
| TC-05 | 0 Gas 校验 | verify() 不接触链上 | receipt.gasUsed === undefined | Unit |
| TC-06 | 正常 Swap 放行 | Uniswap Swap 交易 | receipt.allowed === true | E2E |
| TC-07 | Approve 替换 Swap | Approve 交易 + Swap Intent | receipt.allowed === false | E2E |
| TC-08 | 金额超限 | amountIn 超出 ±slippage | receipt.allowed === false | E2E |
| TC-09 | 目标合约不匹配 | 非 Uniswap 合约 + Swap Intent | receipt.allowed === false | Unit |
| TC-10 | 嵌套 delegatecall | 含 delegatecall 的 calldata | receipt.allowed === false | Unit |
| TC-11 | 未知合约宽松 | 不在地址表的合约 + Standard 模式 | receipt.allowed === true (L1 UNCERTAIN) | Unit |
| TC-12 | 未知合约严格 | 不在地址表的合约 + Strict 模式 | receipt.allowed === false | Unit |

### 3.4 代码 API 设计冻结

Phase 1 结束时以下 API **不允许**在后续 Phase 中破坏性修改：

```typescript
// Chiron 构造函数签名
new Chiron(config: ChironConfig)

// Chiron 核心方法签名
chiron.intent(action: string, params: IntentParams): IntentTemplate
chiron.verify(intent: IntentTemplate, tx: TxCandidate): Promise<VerificationReceipt>

// VerificationReceipt 结构
interface VerificationReceipt {
  allowed: boolean;
  reason: string;
  intentHash: string;
  txHash: string;
  l1Result: 'PASS' | 'FAIL' | 'UNCERTAIN';
}

// IntentTemplate 结构
interface IntentTemplate {
  actionType: number;
  protocolHash: string;
  tokenIn: string;
  tokenOut: string;
  amount: string;
  amountOutMin: string;
  receiver: string;
  deadline: number;
  customData: string;
}
```

---

## 四、验收 CheckList

- [ ] `pnpm build` — 无 TypeScript 错误
- [ ] `pnpm test` — 12 个测试用例全绿
- [ ] `pnpm lint` — 无 ESLint 错误
- [ ] CI — GitHub Actions 全部通过
- [ ] 覆盖率 — 单元测试行覆盖率 ≥ 85%
- [ ] US-01 验收条件全部通过（4 条）
- [ ] US-02 验收条件全部通过（4 条）
- [ ] API 冻结 — 核心接口文档编写完成
- [ ] 内置协议地址表 ≥ 20 个合约
- [ ] L1 校验 p95 ≤ 15ms（本地测量）
