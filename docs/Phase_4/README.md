# Chiron Phase 4 — Production Readiness

> 周期：10 个工作日
> 交付用户故事：US-07（紧急停止）+ US-11（误报率验证）
> 交付版本：v0.3.0-rc
> 依赖：Phase 3 攻击测试 + 调试信息

---

## 一、Phase Scope

| 组件 | 包含 | 不包含 |
|---|---|---|
| BondPool 合约 | 质押、单笔上限、取回 | 罚没分配（Phase 5）|
| CircuitBreaker 合约 | 连续 FAIL 暂停、日限额暂停、恢复 | 多签恢复（V2）|
| L2 Verifier 骨架 | GPT 适配器 | Claude/Gemini 适配器（Phase 4.5）|
| 多链部署脚本 | 5 条 EVM 链部署 | 跨链同步（Phase 5）|
| 性能基准报告 | 延迟/Gas/吞吐量 | 长期监控仪表盘 |

---

## 二、PRD — 需求规格

### 2.1 US-07: 紧急停止

**功能规格 F-CB-01: CircuitBreaker 逻辑**

```
[Agent 状态: ACTIVE]
    │
    ├─ L1 FAIL 计数 ≥ N → [Agent 状态: PAUSED]
    ├─ 日交易金额 ≥ 阈值 → [Agent 状态: PAUSED]
    └─ 可被所有者手动暂停 → [Agent 状态: PAUSED]

[Agent 状态: PAUSED]
    │
    ├─ 所有者签名 → [Agent 状态: ACTIVE] (恢复)
    └─ 等待冷却期结束 → [Agent 状态: ACTIVE] (自动恢复，可选)
```

**功能规格 F-CB-02: BondPool 合约**

```solidity
contract BondPool {
    // Agent 质押 amount 代币
    function deposit(address agent, uint256 amount) external;
    
    // 取回质押（需 Agent 所有者签名）
    function withdraw(address agent, uint256 amount) external;
    
    // 查询 Agent 的单笔交易上限 = stake * 10
    function getTxLimit(address agent) external view returns (uint256);
}
```

**验收标准：**
- [ ] 连续 5 次 L1 FAIL → Agent 自动暂停（默认值，可配置）
- [ ] 暂停后 Chiron 拒绝该 Agent 的所有交易
- [ ] 恢复需要 Agent 所有者签名（EIP-712）
- [ ] 日交易金额超限自动暂停
- [ ] 暂停阈值可由 Agent 所有者配置
- [ ] BondPool 质押量 = 单笔交易上限 × 10

### 2.2 US-11: 误报率验证

**功能规格 F-BENCH-01: 基准测试套件**

```typescript
interface BenchmarkReport {
  summary: {
    totalTransactions: number;
    passed: number;
    failed: number;
    falsePositive: number;
    falsePositiveRate: number;  // 目标 ≤ 1%
  };
  latency: {
    p50: number;  // ms
    p95: number;  // ms
    p99: number;  // ms
  };
  gas: {
    perStore: number;
  };
}
```

**验收标准：**
- [ ] 200+ 笔正常交易回测误报率 ≤ 1%
- [ ] 误报类型有根因分析文档
- [ ] 回测结果可复现

---

## 三、开发计划

### 3.1 每日任务分解

```
Day 1  ▌ BondPool 合约
       deposit / withdraw / getTxLimit
       质押量 = 存款总金额
       单笔上限 = 质押量 × 10
       Foundry fuzz test
       验证：质押后额度正确

Day 2  ▌ CircuitBreaker 合约 + 集成
       consecutiveFailCount → N 次 FAIL 后暂停
       dailyTxValue → 超限后暂停
       resume(agent, signature) → 恢复
       configurability: failThreshold, dailyLimit, cooldown
       Chiron 合约集成: verify() 前检查 CircuitBreaker 状态
       验证：TC-12(暂停), TC-13(恢复)

Day 3  ▌ CircuitBreaker 全面测试
       fuzz test: 各种暂停条件组合
       invariant test: 暂停后不可能误放行
       edge case: 自动恢复 vs 手动恢复
       验证：forge test 全绿

Day 4  ▌ L2 Verifier 骨架 — GPT Adapter
       verifier/ 目录初始化
       GPTAdapter.verify(intent, decodedTx) → {consistent, reason}
       Prompt 模板 v1: "Does this transaction match the intent?"
       验证：已知测试用例 GPT 判断正确

Day 5  ▌ L2 集成 — SDK 升级路径
       SDK verify() 中 L1 → UNCERTAIN → L2 升级
       L2 异步模式（不阻塞交易）
       L2 同步模式（等待结果）
       L2 结果存证（VerificationStore）
       验证：L2 结果可上链

Day 6  ▌ 多链部署脚本
       Ethereum / Arbitrum / Optimism / Base / Polygon
       每条链：部署 Chiron + BondPool + CircuitBreaker
       deploy.sh 一键部署
       deploy.config.ts 各链配置
       验证：5 条链部署验证通过

Day 7  ▌ 性能基准测试 — L1 延迟
       场景: Swap/Approve/Bridge/Custom 各 100 笔
       测量: p50 / p95 / p99
       目标: p95 ≤ 15ms
       报告: benchmark-l1-latency.md
       验证：p95 ≤ 15ms

Day 8  ▌ 性能基准测试 — Gas + 吞吐量
       存证 Gas 测量: min / avg / max
       并发测试: 100 个 Agent 同时校验
       吞吐量: txs/sec
       报告: benchmark-gas-throughput.md
       验证：存证 ≤ 30k Gas

Day 9  ▌ 误报率正式回测
       数据集: 200+ 笔正常交易（来自 Phase 2 Demo Agent）
       回测: 批量运行 L1 校验
       分析: 误报类型归类
       文档: false-positive-analysis.md
       验证：误报率 ≤ 1%

Day 10 ▌ Buffer + 验收
       问题修复
       Phase 4 验收 CheckList
       发布 v0.3.0-rc
```

### 3.2 交付物清单

| 交付物 | 路径 | 类型 |
|---|---|---|
| BondPool 合约 | `contracts/src/BondPool.sol` | Solidity |
| CircuitBreaker 合约 | `contracts/src/CircuitBreaker.sol` | Solidity |
| 合约集成 | `contracts/src/Chiron.sol`（更新）| Solidity |
| GPT Adapter | `verifier/src/adapters/gpt.ts` | TypeScript |
| L2 升级路径 | `sdk/src/l2.ts` | TypeScript |
| 多链部署脚本 | `scripts/deploy.sh` | Shell |
| 配置 | `contracts/deploy.config.ts` | TypeScript |
| 性能报告 | `docs/benchmark/` | Markdown |
| 误报率报告 | `docs/false-positive-analysis.md` | Markdown |

### 3.3 测试矩阵

| TCID | 场景 | 预期 | 类型 |
|---|---|---|---|
| TC-12 | 5 次 FAIL → 暂停 | paused === true | Integration |
| TC-13 | 暂停后恢复 | 恢复签名后 paused === false | Integration |
| TC-14 | 日金额超限暂停 | paused === true | Integration |
| TC-15 | 暂停后交易被阻止 | verify() 返回 CIRCUIT_OPEN | Integration |
| TC-16 | BondPool 质押 + 额度 | deposit 100 → limit 1000 | Unit |
| TC-17 | 误报率 ≤ 1% | 200 笔 ≤ 2 误报 | Batch |
| TC-18 | L1 延迟 (p95) | ≤ 15ms | Perf |
| TC-19 | 存证 Gas | ≤ 30,000 | Perf |
| TC-20 | L2 异步模式 | 不阻塞交易广播 | E2E |

---

## 四、验收 CheckList

- [ ] BondPool 合约通过全部测试
- [ ] CircuitBreaker 合约通过全部测试
- [ ] CircuitBreaker 集成到 Chiron.verify() 流程
- [ ] 多链部署脚本就绪（5 条链）
- [ ] L1 校验 p95 ≤ 15ms
- [ ] 存证 Gas ≤ 30,000
- [ ] 误报率 ≤ 1%（200+ 笔）
- [ ] L2 GPT 适配器可用
- [ ] 性能基准报告已生成
- [ ] US-07 验收通过（6 条）
- [ ] US-11 验收通过（3 条）
