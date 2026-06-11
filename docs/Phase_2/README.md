# Chiron Phase 2 — User Trust

> 周期：12 个工作日
> 交付用户故事：US-04（放心委托）+ US-06（审计查看）
> 交付版本：v0.2.0-beta
> 依赖：Phase 1 SDK 已发布

---

## 一、Phase Scope

### 1.1 包含范围

| 组件 | 包含 | 不包含 |
|---|---|---|
| VerificationReceipt 生成 | 构建、签名、序列化 | 链上存储（已包含）|
| VerificationStore 合约 | storeReceipt、getReceipt、getAgentReceipts | CircuitBreaker（Phase 4）|
| BondPool 合约（骨架）| 质押、查询 | 罚没逻辑（Phase 4）|
| 链上存证 SDK | storeReceipt() 实装 | L2 验证存证（Phase 4）|
| Demo Agent | 完整的 ETH/USDC Swap Agent | 多链 Demo（Phase 5）|
| Web UI（基础）| 验证记录查看 | 告警/通知（Phase 5）|

---

## 二、PRD — 需求规格

### 2.1 US-04: 放心委托

**功能规格 F-TRUST-01: 自动校验流程**

```
Agent 交易前 → Chiron L1 校验 → PASS → 自动签名 → 广播
                                → FAIL → 阻止 → 记录链上 → 可选告警
```

**关键约束：**
- 校验必须同步完成（不阻塞交易广播）
- 校验失败时不允许 Agent 访问私钥签名
- 校验结果链上存证必须在交易广播后异步完成

**功能规格 F-TRUST-02: 会话密钥管理**

```typescript
interface Session {
  agentAddress: string;
  policyId: string;
  sessionKey: string;       // 临时公钥
  createdAt: number;
  expiresAt: number;
  maxValuePerTx: string;    // 单笔上限
  usedValueToday: string;   // 当日已用额度
}

class SessionManager {
  createSession(agent: string, duration: number): Session;
  rotateKey(sessionId: string, newKey: string): void;
  closeSession(sessionId: string): void;
  getActivePolicy(agent: string): Policy | null;
}
```

**验收标准：**
- [ ] Agent 交易前自动执行 L1 校验，无需用户干预
- [ ] Intent 与 Tx 不一致时，拒绝签名
- [ ] L1 校验延迟 ≤ 15ms（不可阻塞交易）
- [ ] 校验结果在交易广播后 30s 内上链存证
- [ ] 用户可查询当前活跃的会话密钥列表
- [ ] 用户可一键撤销指定会话密钥

---

### 2.2 US-06: 审计查看

**功能规格 F-AUDIT-01: 链上数据模型**

```solidity
struct VerificationReceipt {
    bytes32 intentHash;      // keccak256(intentTemplate)
    bytes32 txHash;          // keccak256(target + data + chainId)
    address agent;           // Agent 地址
    L1Result l1Result;       // PASS / FAIL / UNCERTAIN
    uint256 timestamp;       // 写入时间
    uint256 blockNumber;     // 写入区块
}

// 合约存储
mapping(bytes32 txHash => VerificationReceipt) public receipts;
mapping(address agent => bytes32[]) public agentReceipts;
```

**功能规格 F-AUDIT-02: 查询接口**

```solidity
// 按 txHash 查单条
function getReceipt(bytes32 txHash) external view returns (VerificationReceipt memory);

// 按 Agent 查全部（分页）
function getAgentReceipts(address agent, uint256 offset, uint256 limit) 
    external view returns (bytes32[] memory txHashes);

// 统计
function getAgentStats(address agent) external view returns (
    uint256 totalTxs,
    uint256 passedCount,
    uint256 failedCount,
    uint256 lastActivity
);
```

**验收标准：**
- [ ] 链上可查 Agent 的全部验证记录（分页返回）
- [ ] 每条记录包含 intentHash + txHash + 校验结果 + 时间戳
- [ ] 支持按时间范围过滤（tsFrom, tsTo）
- [ ] Web UI 展示 Agent 的通过/拒绝比例图表
- [ ] Web UI 支持搜索 txHash 查看详情

---

## 三、开发计划

### 3.1 每日任务分解

```
Day 1  ▌ VerificationReceipt SDK 端
       receipt.ts – ReceiptBuilder, serialize(), sign()
       hash 计算: intentHash = keccak256(encodePacked(intentTemplate))
                 txHash   = keccak256(encodePacked(target, data, chainId))
       Receipt → bytes 序列化（链上存储格式）
       验证：Receipt hash 确定性

Day 2  ▌ Chiron.sol 合约 — VerificationStore（初版）
       VerificationReceipt struct
       storeReceipt(txHash, intentHash, agent, l1Result)
       getReceipt(txHash) → receipt
       getAgentReceipts(agent) → txHashes[]
       require: 同一 txHash 不可重复存储
       require: 每个 Agent 日存证上限 1000 次
       验证：forge build 通过

Day 3  ▌ Chiron.sol 合约 — 扩展查询
       getAgentReceipts(agent, offset, limit) → 分页
       getAgentStats(agent) → total, passed, failed
       getReceiptByTxHash(txHash) → receipt（event 索引）
       事件: ReceiptStored(txHash, intentHash, agent, l1Result)
       验证：Foundry test 全覆盖

Day 4  ▌ 合约单元测试
       Foundry fuzz test: storeReceipt 各种边界条件
       Foundry invariant test: 存储一致性
       测试覆盖率目标：≥ 90%
       验证：forge test 全绿

Day 5  ▌ 链上存证 SDK 集成
       store.ts – eth_getTransactionReceipt 监听 + VerificationStore 写链
       storeReceipt(receipt) – 异步非阻塞
       getReceipt(txHash) – 链上查询
       getAgentReceipts(agent) – 链上查询
       gas 优化: 批量存证（多条 receipt → 一次交易）
       验证：存证不阻塞交易广播

Day 6  ▌ Deploy 脚本
       Deploy.s.sol – Foundry 部署脚本
       deploy.config.ts – 各链配置
       deploy.sh – 一键部署脚本
       Sepolia 测试网部署 + 验证
       验证：部署后 store/get 可正常工作

Day 7  ▌ Demo Agent 搭建
       Swap Agent:
         1. 获取报价（Uniswap V3 Quoter）
         2. 生成 IntentTemplate
         3. Chiron L1 校验
         4. 签名 + 广播
         5. 异步上链存证
       验证：Agent 可独立完成 1 笔 Swap

Day 8  ▌ Demo Agent 完善
       持续运行模式（每 60s 检查一次价格 → 条件满足时 Swap）
       错误处理（校验失败 → 记录日志 + 继续监控）
       命令行参数（token 对、金额、链、API key）
       验证：Agent 连续运行 1 小时无崩溃

Day 9  ▌ Demo Agent 测试
       50 笔正常交易 → 0 误报
       10 笔模拟注入攻击 → 100% 阻止
       验证通过率和延迟
       验证：0 误报 + 100% 阻止

Day 10 ▌ 基础 Web UI
       React + Vite 项目初始化
       连接钱包 → 选择 Agent → 查看 Agent 验证记录
       Intent hash → 展开详情（action, protocol, amount 等）
       通过/拒绝比例饼图
       验证：可查 Phase 2 Demo Agent 的验证记录

Day 11 ▌ Web UI 完善
       搜索（txHash 搜索）
       时间范围过滤器
       导出（CSV 下载）
       验证：搜索 + 过滤 + 导出正常工作

Day 12 ▌ Buffer + 验收
       Phase 1 → Phase 2 迁移（已有 SDK 升级到新版）
       问题修复
       Phase 2 验收 CheckList
       发布 v0.2.0-beta
```

### 3.2 交付物清单

| 交付物 | 路径 | 类型 |
|---|---|---|
| VerificationReceipt SDK | `sdk/src/receipt.ts` | TypeScript |
| 链上存证 SDK | `sdk/src/store.ts` | TypeScript |
| Chiron 合约 | `contracts/src/Chiron.sol` | Solidity |
| 合约部署脚本 | `contracts/script/Deploy.s.sol` | Solidity |
| 合约测试 | `contracts/test/Chiron.t.sol` | Solidity |
| Demo Agent | `examples/swap-agent/` | TypeScript |
| Web UI | `web/` | React + Vite |
| 验证记录面板 | `web/src/pages/AgentAudit.tsx` | React |

### 3.3 测试矩阵

| TCID | 场景 | 预期 | 类型 |
|---|---|---|---|
| TC-09 | 存证 → 查询 | store → get 一致 | Integration |
| TC-10 | Agent 历史遍历分页 | 分页正确，无遗漏 | Integration |
| TC-11 | 重复存证拒绝 | 同一 txHash 第二次 store revert | Unit |
| TC-12 | 日存证上限 1000 | 第 1001 次 revert | Unit |
| TC-13 | 50 笔正常交易 | 0 误报 | E2E |
| TC-14 | 10 笔注入攻击 | 100% 阻止 | E2E |
| TC-15 | 异步存证非阻塞 | 交易广播时间 < storeReceipt 时间 | E2E |
| TC-16 | Demo Agent 24h 运行 | 无内存泄漏 | E2E |
| TC-17 | Web UI 查验证记录 | 数据与链上一致 | E2E |

---

## 四、验收 CheckList

- [ ] VerificationStore 合约定稿并通过全部测试
- [ ] 合约已部署到 Sepolia 测试网
- [ ] SDK 链上存证实装（异步非阻塞）
- [ ] Demo Agent 可完整运行（报价 → 校验 → 签名 → 广播 → 存证）
- [ ] Demo Agent 24h 运行无崩溃
- [ ] US-04 验收条件全部通过（6 条）
- [ ] US-06 验收条件全部通过（4 条）
- [ ] Web UI 基础功能可用
- [ ] Phase 1 API 无破坏性修改
- [ ] 误报率 0%（50 笔正常交易）
