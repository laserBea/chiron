# Chiron Phase 5 — Ecosystem

> 周期：8 个工作日
> 交付用户故事：US-09（协议地址注册）+ US-05（异常告警）+ US-08（批量交易支持）
> 交付版本：v1.0.0
> 依赖：Phase 4 CircuitBreaker + 多链部署

---

## 一、Phase Scope

| 组件 | 包含 | 不包含 |
|---|---|---|
| ERC-8211 Batch 支持 | batch 解析、每步独立校验 | 跨链 batch（ERC-7683）|
| IntentTemplateRegistry | 社区提交 Action 映射 | 自动发现（链上扫描）|
| Webhook 告警 | FAIL 事件推送 | 多通道聚合（Telegram/Slack）|
| MetaMask Snap | 交易前验证展示 | Snap 签名验证 |
| 铸造罚没 | 违规 → 质押分配 | DAO 治理分配（V2）|

---

## 二、PRD — 需求规格

### 2.1 US-08: 批量交易支持

**功能规格 F-BATCH-01: ERC-8211 Batch 校验**

```typescript
interface BatchStep {
  index: number;
  target: string;
  data: string;
  value: string;
}

interface BatchVerificationReceipt {
  batchIntent: IntentTemplate;     // 整体 batch 意图
  steps: {
    index: number;
    intent: IntentTemplate;        // 该步的意图
    decodedTx: DecodedTx;
    result: VerificationReceipt;   // 该步的校验结果
  }[];
  aggregateResult: 'PASS' | 'FAIL';  // 任一步 FAIL → 整体 FAIL
}
```

**验收标准：**
- [ ] 解析 ERC-8211 batch 中的每一步（ComposableExecution[]）
- [ ] 对每一步独立执行 L1 校验
- [ ] 任一步 FAIL → 整个 batch 被阻止
- [ ] 返回具体被阻止的 step index + 原因
- [ ] 支持 batch 中不同 Action 类型混合（如 Swap → Approve）

### 2.2 US-09: 协议地址注册

**功能规格 F-REG-01: 社区提交流程**

```
社区开发者 → GitHub PR（添加合约地址 + Action 映射）
           → CI 自动验证地址正确性
           → Maintainer 审核 → 合并
           → 自动发布 SDK 更新（地址表增补）
```

**功能规格 F-REG-02: IntentTemplateRegistry 合约**

```solidity
contract IntentTemplateRegistry {
    // 注册协议 → Action 映射
    function registerProtocol(
        bytes32 protocolHash,    // keccak256("uniswap_v3")
        address[] calldata contracts,
        bytes4[] calldata selectors,
        uint8 actionType
    ) external;

    // 查询合约对应的 Action
    function getActionType(address contractAddr) external view returns (uint8 actionType);
    
    // 查询协议对应的所有合约
    function getProtocolContracts(bytes32 protocolHash) external view returns (address[] memory);
}
```

**验收标准：**
- [ ] 提供 GitHub PR 模板（包含合约地址 + Action 类型）
- [ ] CI 自动验证提交的地址是否正确（codehash 检查）
- [ ] 合并后自动发布 SDK 更新
- [ ] IntentTemplateRegistry 合约支持链上查询

### 2.3 US-05: 异常告警

**验收标准：**
- [ ] FAIL 事件通过 Webhook 推送
- [ ] 通知包含：Agent 地址、被阻止交易详情、阻止原因
- [ ] 通知延迟 ≤ 30 秒（从校验到 Webhook 送达）
- [ ] 用户可通过通知直接暂停 Agent（深度链接）

---

## 三、开发计划

### 3.1 每日任务分解

```
Day 1  ▌ ERC-8211 Batch 解析
       解析 ComposableExecution[] 数组
       提取每步的 target + data + value
       支持嵌套 batch（batch 中的 batch）
       验证：标准 ERC-8211 batch 可正确解析

Day 2  ▌ Batch 校验
       SDK verifyBatch(intents, batchTxs) → BatchVerificationReceipt
       每步独立 L1 校验
       任一步 FAIL → aggregate FAIL
       验证：混合 Action batch（Swap + Approve）→ Approve 步 FAIL

Day 3  ▌ IntentTemplateRegistry 合约
       registerProtocol / getActionType / getProtocolContracts
       链上查询合约 → Action
       Foundry fuzz test
       验证：注册 → 查询 → 正确

Day 4  ▌ 社区提交流程
       .github/ISSUE_TEMPLATE/protocol-registration.md
       .github/workflows/verify-protocol.yml
       CI: 验证合约 codehash + selector 匹配
       CI: 自动生成 PR 给 SDK 地址表
       验证：提交一个假协议 → CI 拒绝

Day 5  ▌ Webhook 告警服务
       webhook/ 目录初始化
       FAIL 事件监听（链上 ReceiptStored 事件）
       Webhook 推送（POST JSON 到用户配置的 URL）
       通知模板:
         { agent, txHash, intentHash, reason,
           timestamp, chainId, blockNumber }
       Webhook 重试（3 次，指数退避）
       验证：触发 FAIL → 1s 内收到 Webhook

Day 6  ▌ 告警深度链接
       Webhook payload 增加 pauseAgentUrl
       用户点击 → 签名 → 暂停 Agent
       验证：深度链接可正确暂停 Agent

Day 7  ▌ 铸造罚没合约
       BondPool 增加 slashing 逻辑
       连续违规 → 部分质押分配给受害者
       slashing 条件: 7 天内 FAIL 率 > 50%
       Foundry test
       验证：满足条件 → 质押减少

Day 8  ▌ Buffer + v1.0.0 发布
       全量回归测试
       README 更新（所有 Phase）
       npm publish @chiron/sdk
       GitHub Release v1.0.0
       发布检查清单逐项确认
```

### 3.2 交付物清单

| 交付物 | 路径 | 类型 |
|---|---|---|
| Batch 校验 | `sdk/src/batch.ts` | TypeScript |
| IntentTemplateRegistry | `contracts/src/IntentTemplateRegistry.sol` | Solidity |
| Webhook 服务 | `webhook/src/index.ts` | TypeScript |
| 社区 PR 模板 | `.github/ISSUE_TEMPLATE/protocol-registration.md` | Markdown |
| CI 验证 | `.github/workflows/verify-protocol.yml` | YAML |
| 铸造罚没 | `contracts/src/BondPool.sol`（更新）| Solidity |

### 3.3 测试矩阵

| TCID | 场景 | 预期 | 类型 |
|---|---|---|---|
| TC-21 | ERC-8211 batch 解析 | 4 步 batch → 4 个 DecodedTx | Unit |
| TC-22 | batch 任一步 FAIL → 整体 FAIL | 3 PASS + 1 FAIL → aggregate FAIL | Integration |
| TC-23 | batch 全部 PASS → 整体 PASS | 4 步全部 PASS → aggregate PASS | Integration |
| TC-24 | IntentTemplateRegistry 注册 + 查询 | register → getActionType 正确 | Unit |
| TC-25 | 社区 PR CI 验证 | 无效合约地址 → CI 拒绝 | Automation |
| TC-26 | Webhook FAIL 推送 | L1 FAIL → 1s 内收到 | Integration |
| TC-27 | Webhook 重试 | 第一次失败 → 重试 3 次 | Unit |
| TC-28 | 铸造罚没 | 7 天 FAIL 率 > 50% → 质押减少 | Integration |
| TC-29 | 全量回归 | Phase 1-4 测试全部通过 | E2E |

---

## 四、验收 CheckList

- [ ] ERC-8211 batch 解析 + 校验通过
- [ ] IntentTemplateRegistry 合约部署
- [ ] 社区 PR 模板 + CI 自动化验证就绪
- [ ] Webhook 服务可用（FAIL 事件推送 ≤ 30s）
- [ ] 深度链接可暂停 Agent
- [ ] 铸造罚没合约通过测试
- [ ] v1.0.0 npm publish 完成
- [ ] US-09 验收通过（3 条）
- [ ] US-05 验收通过（4 条）
- [ ] US-08 验收通过（5 条）
- [ ] 全量回归测试通过（Phase 1-5 所有测试）
