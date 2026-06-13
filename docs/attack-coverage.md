# Chiron Attack Coverage Report

> Phase 3 交付物
> 日期：2026-06-13
> 版本：v0.3.0

---

## 一、覆盖总览

| 指标 | 值 |
|---|---|
| 定义攻击类型 | 15 |
| L1 可检测并阻止 | 9 |
| L1 已知局限（不阻止） | 6 |
| 攻击测试通过率 | 100%（15/15）|
| 阻止确认 | 9/9（100%）|

### 阻止的攻击（9）

| ID | 攻击 | 检测规则 |
|---|---|---|
| A1 | Prompt 注入 — Approve 替换 | R1+R2 |
| A2 | 意图声明伪造 | R3 |
| A3 | Calldata 篡改 | R2 |
| A4 | 隐藏 Approve 在 Swap 中 | R5 |
| A5 | 隐藏 delegatecall | R6 |
| A7 | 接收地址替换 | R5 |
| A8 | 钓鱼合约调用 | R1 |
| A9 | 新/未知合约 | R1 |
| A10 | 会话密钥泄露滥用 | R1 |

### 已知局限（6）

| ID | 攻击 | 不阻止原因 | 后续处理 |
|---|---|---|---|
| A6 | 金额操纵 | R4 需要在 calldata 中提取金额，当前解码器在极小 calldata 下无法提取 | Phase 4 加入真实 tx data |
| A11 | 批量交易单步篡改 | 需要 ERC-8211 batch 解析 | Phase 5 |
| A12 | 跨链目标篡改 | 需要源链上下文 | Phase 5 (ERC-7683) |
| A13 | 验证证明重放 | 链级问题（VerificationStore 绑定 txHash）| Phase 2 合约已实现 |
| A14 | 日额度耗尽 | CircuitBreaker | Phase 4 |
| A15 | Intent 声明绕过 | 设计边界（L1 只检查一致性，不检查正确性）| 永不可解（设计决策）|

---

## 二、测试框架

文件：`sdk/src/attack-test.ts`（357 行）

```
AttackTestRunner.runAll()
    │
    ├─ A1: 构造 Approve tx → 检查 L1 FAIL
    ├─ A2: 构造 token 反转 → 检查 L1 FAIL
    ├─ ...
    └─ A15: 构造一致性交易 → 检查 L1 PASS
    │
    ▼
AttackTestResult[] (15 条)
    │
    ├─ passed: 预期是否正确
    ├─ detected: 是否被阻止
    ├─ actualL1: 实际 L1 结果
    └─ detail: 详情描述
```

运行方式：

```bash
cd sdk && npm test -- --verbose
```

---

## 三、L1 规则实际覆盖能力

```
已覆盖（9/15 = 60%）

     Prompt注入 ─────→ R1+R2 ✅
     Intent伪造 ─────→ R3    ✅
     Calldata篡改 ───→ R2    ✅
     隐藏Approve ────→ R5    ✅
     delegatecall ───→ R6    ✅
     接收地址替换 ───→ R5    ✅
     钓鱼合约 ──────→ R1    ✅
     未知合约 ──────→ R1    ✅
     密钥泄露 ──────→ R1    ✅

未覆盖（6/15 = 40%）

     金额操纵 ──────→ R4       ⚠️ 需要真实 calldata
     批量篡改 ──────→ L1不支持  ⏳ Phase 5
     跨链篡改 ──────→ L1不支持  ⏳ Phase 5
     证明重放 ──────→ 合约级    ✅ 合约已实现
     额度耗尽 ──────→ 合约级    ⏳ Phase 4
     Intent恶意 ────→ 设计边界  ❌ 不解决
```

---

## 四、测试运行

```bash
cd sdk
npm test
# 47 tests passed (31 原有 + 15 攻击 + 1 汇总)
```
