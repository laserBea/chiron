# Chiron Phase 3 — Security Hardening

> 周期：10 个工作日
> 交付用户故事：US-10（攻击覆盖验证）+ US-03（调试信息）
> 交付版本：v0.2.1-beta（SDK 更新）
> 依赖：Phase 2 Demo Agent + 合约已部署

---

## 一、Phase Scope

| 组件 | 包含 | 不包含 |
|---|---|---|
| 攻击测试框架 | A1-A15 自动化测试脚本 | 漏洞赏金平台集成 |
| 调试信息增强 | receipt.reason 分级、校验日志 | 自然语言解释（L2 范围）|
| 误报率回测 | 200+ 笔正常交易数据集 | 动态 Agent 行为模拟 |
| 安全报告 | 攻击覆盖矩阵 PDF | 正式安全审计（第三方）|

---

## 二、PRD — 需求规格

### 2.1 US-10: 攻击覆盖验证

**功能规格 F-SEC-01: 攻击测试框架**

```typescript
interface AttackTestCase {
  id: string;             // "AT-A1" ~ "AT-A15"
  name: string;           // 攻击名称
  description: string;    // 攻击描述
  setup: () => Promise<void>;   // 测试环境准备
  execute: () => Promise<TxCandidate>;  // 构造攻击交易
  intent: IntentTemplate;         // 对应的正确 Intent
  expectedL1: 'PASS' | 'FAIL' | 'UNCERTAIN';
  expectedAction: 'BLOCK' | 'ALLOW' | 'TRACE_ONLY';
  notes?: string;         // 补充说明
}

class AttackTestRunner {
  async runAll(): Promise<AttackTestReport>;
  async runSingle(id: string): Promise<AttackTestResult>;
  async generateReport(): Promise<AttackCoverageReport>;
}
```

**验收标准：**
- [ ] A1-A15 每个攻击有独立可复现的测试用例
- [ ] 测试结果明确标注 BLOCK / ALLOW / TRACE_ONLY
- [ ] 不阻止的攻击（A15）有明确的已知边界说明
- [ ] 测试报告 PDF 格式，可提交审计

### 2.2 US-03: 调试信息

**功能规格 F-DEBUG-01: 多级校验反馈**

```typescript
interface VerificationDetails {
  ruleId: string;           // "R1" ~ "R6"
  ruleName: string;         // "目标合约检查"
  passed: boolean;
  expected: string;         // "uniswap_v3 Router (0xE5...)"
  actual: string;           // "0xMaliciousContract"
  severity: 'info' | 'warning' | 'error';
}

interface VerificationReceipt {
  // ... Phase 1 已有字段
  details: VerificationDetails[];   // 新增
  decodedTx: DecodedTx;             // 新增 — 人类可读交易摘要
}
```

**验收标准：**
- [ ] FAIL 时返回具体规则编号 + 规则名称
- [ ] 每条规则返回预期值 vs 实际值对比
- [ ] 失败规则标记为 error，通过的规则标记为 info
- [ ] decodedTx 包含解码后的函数名 + 参数 + 地址

---

## 三、开发计划

### 3.1 每日任务分解

```
Day 1  ▌ 攻击测试框架搭建
       AttackTestCase 类型定义
       AttackTestRunner.runAll() / runSingle()
       测试报告生成器（Markdown + PDF）
       验证：空运行通过（0 个测试用例）

Day 2  ▌ 攻击测试 A1-A5
       A1: Prompt 注入 → Approve 替代 Swap
       A2: 意图声明伪造（篡改 IntentTemplate）
       A3: Calldata 替换
       A4: 隐藏 Approve（同笔交易中）
       A5: 隐藏 delegatecall
       验证：全部 BLOCK

Day 3  ▌ 攻击测试 A6-A10
       A6: 金额操纵（100 → 10000）
       A7: 接收地址替换
       A8: 钓鱼合约（相似地址）
       A9: 零日新合约
       A10: 密钥泄露后滥用
       验证：A6-A8 BLOCK, A9 TRACE_ONLY, A10 BLOCK

Day 4  ▌ 攻击测试 A11-A15
       A11: 批量交易单步篡改
       A12: 跨链目标篡改
       A13: 验证证明重放
       A14: 日额度耗尽
       A15: Intent 声明绕过（利用已知漏洞）
       验证：A11-A14 BLOCK, A15 ALLOW（标注已知边界）

Day 5  ▌ 调试信息增强 — 规则级别
       ConsistencyChecker 每条规则返回 details[]
       R1-R6 的 expected/actual/severity
       FAIL 时原因拼接（全部失败规则）
       验证：TC-11(调试信息完整)

Day 6  ▌ 调试信息增强 — 交易摘要
       DecodedTx 增加 human summary
       decodedTx.summary → "Swap 100 USDC for 0.05 WETH via Uniswap V3"
       地址 → ENS/标签（如果可用）
       验证：摘要可读性

Day 7  ▌ 误报率回测工具
       BatchVerifier.run(txDataset)
       txDataset 收集 ≥ 200 笔正常交易
       统计误报笔数 + 误报类型
       验证：误报率 ≤ 1%

Day 8  ▌ 安全报告生成
       Markdown 攻击覆盖矩阵
       PDF 导出（攻击描述 + 复现步骤 + 检测结果）
       已知局限清单
       验证：报告可公开访问

Day 9  ▌ 回归测试
       Phase 1 全部测试 → 仍绿
       Phase 2 全部测试 → 仍绿
       API 兼容性检查
       验证：无回归

Day 10 ▌ Buffer + 验收
       问题修复
       Phase 3 验收 CheckList
       发布 v0.2.1-beta
```

### 3.2 测试矩阵

| ATID | 攻击 | 构造 | 预期 | 实际（测试后填）|
|---|---|---|---|---|
| AT-A1 | Prompt 注入交易替换 | Intent=Swap → Tx=Approve | ❌ BLOCK | — |
| AT-A2 | 意图声明伪造 | 篡改 Intent 的 tokenOut | ❌ BLOCK | — |
| AT-A3 | Calldata 替换 | 广播前替换 calldata | ❌ BLOCK | — |
| AT-A4 | 隐藏 Approve | Swap tx 中嵌入 Approve 参数 | ❌ BLOCK | — |
| AT-A5 | 隐藏 delegatecall | 通过 delegatecall 调用恶意逻辑 | ❌ BLOCK | — |
| AT-A6 | 金额操纵 | amount 100 → 10000 | ❌ BLOCK | — |
| AT-A7 | 接收地址替换 | recipient → attacker address | ❌ BLOCK | — |
| AT-A8 | 钓鱼合约 | 合约地址 = Uniswap 地址 ± 1 char | ❌ BLOCK (Strict) | — |
| AT-A9 | 零日新合约 | 未知合约 + Standard 模式 | ⚠️ TRACE_ONLY | — |
| AT-A10 | 密钥泄露 | 持有私钥但交易不匹配 Intent | ❌ BLOCK | — |
| AT-A11 | 批量单步篡改 | batch 中某步被替换 | ❌ BLOCK | — |
| AT-A12 | 跨链目标篡改 | 桥的目标链被改 | ❌ BLOCK | — |
| AT-A13 | 验证证明重放 | 旧 receipt 附到新 tx | ❌ BLOCK | — |
| AT-A14 | 日额度耗尽 | 超日限额后继续交易 | ❌ BLOCK | — |
| AT-A15 | 恶意 Intent（一致）| Intent=Tx 但 Intent 本身恶意 | ⚠️ ALLOW（边界）| — |

---

## 四、验收 CheckList

- [ ] A1-A15 全部攻击测试用例实现
- [ ] A1-A14 全部预期阻断
- [ ] A15 标注为已知边界（不阻止）
- [ ] 攻击测试报告（PDF）已生成
- [ ] 调试信息包含规则编号 + 预期值 + 实际值
- [ ] DecodedTx 包含人类可读摘要
- [ ] 误报率回测 ≤ 1%（200+ 笔）
- [ ] 无回归（Phase 1 + 2 测试全绿）
