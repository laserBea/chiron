# Chiron — Sepolia 测试链测试方案

> 本计划面向一次完整的 Sepolia 测试循环：从环境准备、合约部署，到 4 个合约的全量功能验证，再到 SDK 端到端集成。
> 预计耗时：**首次 1-2 小时**（含 API 注册 + faucet）；后续回归 **15-30 分钟**。

---

## 一、前置准备

### 1.1 你需要准备的

| 项目 | 用途 | 获取方式 |
|---|---|---|
| Alchemy / Infura RPC URL | 向 Sepolia 发送交易 | [alchemy.com](https://alchemy.com) → 免费 Tier → 创建 Sepolia App |
| 测试以太坊地址 | 部署 + 发送测试交易 | `cast wallet new` 或 MetaMask 生成 |
| >= 0.05 Sepolia ETH | 支付 gas 费 | 见下方 faucet 清单 |
| Etherscan API Key | 合约 verify（可选但推荐） | [etherscan.io](https://etherscan.io) → My API Keys |

### 1.2 获取测试 ETH（Faucet）

| Faucet | 额度 | 说明 |
|---|---|---|
| [Alchemy Sepolia Faucet](https://sepoliafaucet.com/) | 0.5 ETH/天 | 最快，邮箱验证即可 |
| [Infura Faucet](https://www.infura.io/faucet/sepolia) | 0.5 ETH/天 | 需注册 Infura |
| [Sepolia PoW Faucet](https://sepolia-faucet.pk910.de/) | 按需（挖矿） | 无限制，耐心等 1-2 分钟 |
| [LearnWeb3 Faucet](https://learnweb3.io/faucets/sepolia/) | 0.01 ETH | Discord 验证 |

> **建议：** 在 Alchemy Faucet 一次性领 0.5 ETH，单次测试循环消耗约 0.00002 ETH，0.5 ETH 够跑几千轮。

### 1.3 配置 .env

编辑项目根目录的 `.env`，填入真实值：

```bash
PRIVATE_KEY=0x你的测试私钥
ETHEREUM_RPC=https://eth-sepolia.g.alchemy.com/v2/你的KEY
CHAIN_ID=11155111
ETHERSCAN_API_KEY=你的EtherscanKey   # 选填，不填则 deploy 去掉 --verify
```

> ⚠️ PRIVATE_KEY 对应的地址必须有至少 0.05 Sepolia ETH。用测试专用私钥，不要用主网私钥。

### 1.4 环境确认

```bash
# 检查 forge 版本
forge --version

# 检查 RPC 连通性
cast chain-id --rpc-url $ETHEREUM_RPC
# 预期输出: 11155111

# 检查账户余额
cast balance $DEPLOYER_ADDRESS --rpc-url $ETHEREUM_RPC
# 预期: >= 50000000000000000 (0.05 ETH)
```

到这个步骤，环境就绪。

---

## 二、合约部署

### 2.1 首次部署

已有快捷命令：

```bash
make deploy-sepolia
```

如果未配置 Etherscan API Key，改为：

```bash
cd contracts && forge script script/Deploy.s.sol \
  --rpc-url $ETHEREUM_RPC \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --slow
```

成功后终端会打印 4 个合约地址：

```
Chiron deployed at: 0x...
BondPool deployed at: 0x...
CircuitBreaker deployed at: 0x...
IntentTemplateRegistry deployed at: 0x...
```

### 2.2 记录合约地址

部署完成后，导出到环境变量（两个办法）：

**方法 A：自动提取**

```bash
LATEST_JSON=$(ls -t contracts/broadcast/Deploy.s.sol/11155111/run-*.json | head -1)
export CHIRON=$(cat $LATEST_JSON | python3 -c "
import sys,json
r=json.load(sys.stdin)
for t in r['transactions']:
    if t.get('contractAddress'):
        print(t['contractAddress'])
")
```

**方法 B：手动复制终端输出**

```bash
export CHIRON=0x...  # 第 1 行
export POOL=0x...    # 第 2 行
export CB=0x...      # 第 3 行
export ITR=0x...     # 第 4 行
```

### 2.3 验证部署（冒烟）

```bash
echo "=== 冒烟检查 ==="

# Chiron 所有者
cast call $CHIRON "owner()(address)" --rpc-url $ETHEREUM_RPC

# Chiron MAX_DAILY_TX
cast call $CHIRON "MAX_DAILY_TX()(uint256)" --rpc-url $ETHEREUM_RPC
# 预期: 1000

# CircuitBreaker 默认阈值
cast call $CB "defaultThreshold()(uint256)" --rpc-url $ETHEREUM_RPC
# 预期: 5

# BondPool 初始总质押
cast call $POOL "totalStaked()(uint256)" --rpc-url $ETHEREUM_RPC
# 预期: 0

# IntentTemplateRegistry 合约数
cast call $ITR "getRegisteredContractCount()(uint256)" --rpc-url $ETHEREUM_RPC
# 预期: 0
```

> 如果这一步任何值不符预期，**不要往下走**，先排查部署是否完整。

---

## 三、单合约功能测试（cast send / call）

以下测试全部通过 `cast send` / `cast call` 直接操作链上合约。
建议按顺序逐个执行，**每完成一项核对预期结果**。

### 3.1 Chiron —— 校验存证

```bash
AGENT=0x1111111111111111111111111111111111111111
TX_HASH=$(cast keccak "test_tx_001")
INTENT_HASH=$(cast keccak "swap_usdc_eth")

echo "=== 3.1a storeReceipt (PASS) ==="
cast send $CHIRON "storeReceipt(bytes32,bytes32,address,uint8,uint8)" \
  $TX_HASH $INTENT_HASH $AGENT 0 0 \
  --rpc-url $ETHEREUM_RPC --private-key $PRIVATE_KEY

echo "=== 3.1b getReceipt ==="
cast call $CHIRON "getReceipt(bytes32)((bytes32,bytes32,address,uint8,uint8,uint256,uint256))" $TX_HASH \
  --rpc-url $ETHEREUM_RPC
# 预期: agent == $AGENT, l1Result == 0 (PASS), timestamp > 0

echo "=== 3.1c getAgentReceipts ==="
cast call $CHIRON "getAgentReceipts(address)(bytes32[])" $AGENT \
  --rpc-url $ETHEREUM_RPC
# 预期: 返回数组，包含 $TX_HASH

echo "=== 3.1d 重复 txHash ==="
cast send $CHIRON "storeReceipt(bytes32,bytes32,address,uint8,uint8)" \
  $TX_HASH 0x3333 $AGENT 0 0 \
  --rpc-url $ETHEREUM_RPC --private-key $PRIVATE_KEY 2>&1
# 预期: revert "Receipt already exists"

echo "=== 3.1e isAgentPaused (正常状态) ==="
cast call $CHIRON "isAgentPaused(address)(bool)" $AGENT \
  --rpc-url $ETHEREUM_RPC
# 预期: false
```

### 3.2 CircuitBreaker —— 暂停 / 恢复

```bash
AGENT_CB=0x2222222222222222222222222222222222222222

echo "=== 3.2a 连续 5 次 FAIL ==="
for i in $(seq 1 5); do
  cast send $CB "recordFail(address)" $AGENT_CB \
    --rpc-url $ETHEREUM_RPC --private-key $PRIVATE_KEY --gas-limit 50000 >/dev/null 2>&1
done

echo "=== 3.2b isPaused ==="
cast call $CB "isPaused(address)(bool)" $AGENT_CB --rpc-url $ETHEREUM_RPC
# 预期: true

echo "=== 3.2c resume ==="
cast send $CB "resume(address)" $AGENT_CB \
  --rpc-url $ETHEREUM_RPC --private-key $PRIVATE_KEY

echo "=== 3.2d 恢复后状态 ==="
cast call $CB "isPaused(address)(bool)" $AGENT_CB --rpc-url $ETHEREUM_RPC
# 预期: false

echo "=== 3.2e setThreshold（自定义阈值）==="
cast send $CB "setThreshold(address,uint256)" $AGENT_CB 2 \
  --rpc-url $ETHEREUM_RPC --private-key $PRIVATE_KEY
```

### 3.3 BondPool —— 质押 / 提取 / Slash

```bash
AGENT_BP=0x3333333333333333333333333333333333333333
ONE_ETH=1000000000000000000
HALF_ETH=500000000000000000

echo "=== 3.3a deposit ==="
cast send $POOL "deposit(address,uint256)" $AGENT_BP $ONE_ETH \
  --rpc-url $ETHEREUM_RPC --private-key $PRIVATE_KEY

echo "=== 3.3b 验证 stakes ==="
cast call $POOL "stakes(address)(uint256)" $AGENT_BP --rpc-url $ETHEREUM_RPC
# 预期: $ONE_ETH

echo "=== 3.3c getTxLimit ==="
cast call $POOL "getTxLimit(address)(uint256)" $AGENT_BP --rpc-url $ETHEREUM_RPC
# 预期: 10000000000000000000 (10 ETH = 1 * MULTIPLIER(10))

echo "=== 3.3d withdraw 一半 ==="
cast send $POOL "withdraw(address,uint256)" $AGENT_BP $HALF_ETH \
  --rpc-url $ETHEREUM_RPC --private-key $PRIVATE_KEY

cast call $POOL "stakes(address)(uint256)" $AGENT_BP --rpc-url $ETHEREUM_RPC
# 预期: $HALF_ETH

echo "=== 3.3e 超额提取 ==="
cast send $POOL "withdraw(address,uint256)" $AGENT_BP 9999999999999999999 \
  --rpc-url $ETHEREUM_RPC --private-key $PRIVATE_KEY 2>&1
# 预期: revert "Insufficient stake"

echo "=== 3.3f slash ==="
cast send $POOL "slash(address,uint256,address)" $AGENT_BP 200000000000000000 0x0000000000000000000000000000000000000001 \
  --rpc-url $ETHEREUM_RPC --private-key $PRIVATE_KEY

cast call $POOL "stakes(address)(uint256)" $AGENT_BP --rpc-url $ETHEREUM_RPC
# 预期: 300000000000000000 (0.5 ETH - 0.2 ETH)
```

### 3.4 IntentTemplateRegistry —— 协议注册

```bash
HASH=$(cast keccak "chiron_test_protocol")
ADDRS="[0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa]"
SELS="[0x414bf389]"

echo "=== 3.4a registerProtocol ==="
cast send $ITR "registerProtocol(bytes32,address[],bytes4[],uint8)" \
  $HASH "$ADDRS" "$SELS" 1 \
  --rpc-url $ETHEREUM_RPC --private-key $PRIVATE_KEY

echo "=== 3.4b getActionType ==="
cast call $ITR "getActionType(address)(uint8)" 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
  --rpc-url $ETHEREUM_RPC
# 预期: 1 (SWAP)

echo "=== 3.4c getRegisteredContractCount ==="
cast call $ITR "getRegisteredContractCount()(uint256)" \
  --rpc-url $ETHEREUM_RPC
# 预期: 1

echo "=== 3.4d deactivateProtocol ==="
cast send $ITR "deactivateProtocol(bytes32)" $HASH \
  --rpc-url $ETHEREUM_RPC --private-key $PRIVATE_KEY

echo "=== 3.4e 停用后 getActionType 应返回 0 ==="
cast call $ITR "getActionType(address)(uint8)" 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
  --rpc-url $ETHEREUM_RPC
# 预期: 0
```

---

## 四、跨合约集成测试

这里验证 Chiron 和 CircuitBreaker 的联动行为——这是系统的核心安全逻辑。

```bash
AGENT_INT=0x4444444444444444444444444444444444444444

echo "=== 4a 通过 Chiron.storeReceipt 触发 5 次 FAIL ==="
for i in $(seq 1 5); do
  TX="0x${i}0000000000000000000000000000000000000000000000000000000000000000"
  cast send $CHIRON "storeReceipt(bytes32,bytes32,address,uint8,uint8)" \
    $TX $(cast keccak "intent_$i") $AGENT_INT 1 0 \
    --rpc-url $ETHEREUM_RPC --private-key $PRIVATE_KEY
done

echo "=== 4b 验证 agent 已通过 CB 暂停 ==="
cast call $CHIRON "isAgentPaused(address)(bool)" $AGENT_INT --rpc-url $ETHEREUM_RPC
# 预期: true

echo "=== 4c 暂停后 storeReceipt 应被拒绝 ==="
cast send $CHIRON "storeReceipt(bytes32,bytes32,address,uint8,uint8)" \
  0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff \
  $(cast keccak "rejected") $AGENT_INT 0 0 \
  --rpc-url $ETHEREUM_RPC --private-key $PRIVATE_KEY 2>&1
# 预期: revert "Agent is paused"

echo "=== 4d 通过 CB 恢复 agent ==="
cast send $CB "resume(address)" $AGENT_INT \
  --rpc-url $ETHEREUM_RPC --private-key $PRIVATE_KEY

echo "=== 4e 恢复后再次存储 PASS ==="
cast send $CHIRON "storeReceipt(bytes32,bytes32,address,uint8,uint8)" \
  $(cast keccak "recovered_tx") $(cast keccak "recovered") $AGENT_INT 0 0 \
  --rpc-url $ETHEREUM_RPC --private-key $PRIVATE_KEY
# 预期: 成功，不 revert
```

**关键验证点：** 第 4c 步必须 revert。如果没 revert，说明 Chiron 和 CircuitBreaker 的桥接逻辑存在 bug。

---

## 五、边界 / 安全测试

### 5.1 权限守卫

```bash
# 用另一个账户（非 owner）尝试敏感操作
ATTACKER_KEY=0x...  # 随便另一个私钥

echo "=== 5.1a 非 owner 调用 setThreshold ==="
cast send $CB "setThreshold(address,uint256)" 0x... 3 \
  --rpc-url $ETHEREUM_RPC --private-key $ATTACKER_KEY 2>&1
# 预期: revert "Only owner"

echo "=== 5.1b 非 owner 调用 slash ==="
cast send $POOL "slash(address,uint256,address)" 0x... 100 0x... \
  --rpc-url $ETHEREUM_RPC --private-key $ATTACKER_KEY 2>&1
# 预期: revert "Only owner"

echo "=== 5.1c 非 owner 调用 deactivateProtocol ==="
cast send $ITR "deactivateProtocol(bytes32)" 0x... \
  --rpc-url $ETHEREUM_RPC --private-key $ATTACKER_KEY 2>&1
# 预期: revert "Only owner"

echo "=== 5.1d 非 owner 调用 setCircuitBreaker ==="
cast send $CHIRON "setCircuitBreaker(address)" 0x... \
  --rpc-url $ETHEREUM_RPC --private-key $ATTACKER_KEY 2>&1
# 预期: revert "Only owner"
```

### 5.2 空参数 / 边界值

```bash
echo "=== 5.2a BondPool.deposit(amount=0) ==="
cast send $POOL "deposit(address,uint256)" 0x... 0 \
  --rpc-url $ETHEREUM_RPC --private-key $PRIVATE_KEY 2>&1
# 预期: revert "Amount must be > 0"

echo "=== 5.2b IntentTemplateRegistry 注册空 contracts ==="
cast send $ITR "registerProtocol(bytes32,address[],bytes4[],uint8)" \
  $(cast keccak "empty") "[]" "[]" 1 \
  --rpc-url $ETHEREUM_RPC --private-key $PRIVATE_KEY 2>&1
# 预期: revert "At least one contract"
```

### 5.3 大 Batch 写入（可选，验证 gas 稳定性）

```bash
echo "=== 5.3 连续写入 50 条 receipt ==="
for i in $(seq 1 50); do
  TX=$(cast keccak "batch_tx_$(printf '%04d' $i)")
  INTENT=$(cast keccak "batch_intent_$i")
  cast send $CHIRON "storeReceipt(bytes32,bytes32,address,uint8,uint8)" \
    $TX $INTENT 0x5555555555555555555555555555555555555555 0 0 \
    --rpc-url $ETHEREUM_RPC --private-key $PRIVATE_KEY --gas-limit 100000 >/dev/null 2>&1
  echo "  $i/50 done"
done

echo "=== 验证写入数 ==="
cast call $CHIRON "getAgentReceipts(address)(bytes32[])" 0x5555555555555555555555555555555555555555 \
  --rpc-url $ETHEREUM_RPC
# 预期: 返回 50 个元素
```

---

## 六、SDK 端到端集成测试

这一步验证 SDK 能正确连接 Sepolia 上的已部署合约。

### 6.1 准备工作

```bash
cd sdk && npm install && npm run build
```

### 6.2 运行已有 SDK 单测（确保 SDK 自身无回归）

```bash
# SDK 单元测试（离线）
cd sdk && npm test

# 合约单元测试（离线）
cd ../contracts && forge test -vvv
```

两个测试套件应全部通过。

### 6.3 SDK + OnChainStore 连接 Sepolia

创建 `scripts/test-e2e-sepolia.ts`：

```typescript
import { ethers } from 'ethers';
import { Chiron } from '../sdk/src';
import { OnChainStore } from '../sdk/src/store';

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC!);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const store = new OnChainStore(process.env.CHIRON!, provider, signer);
  const sdk = new Chiron({ chainId: 11155111 });

  // 1) 生成 Intent
  const intent = await sdk.intent('swap', {
    protocol: 'uniswap_v3', tokenIn: 'USDC', tokenOut: 'WETH', amount: '100',
  });

  // 2) L1 校验（离线）
  const receipt = await sdk.verify(intent, {
    to: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    data: '0x414bf3890000000000000000000000000000000000000000000000000000000000000020',
    value: '0',
  });
  console.log('L1 result:', receipt.l1Result);

  // 3) 写入 Sepolia
  const txReceipt = await store.store(receipt);
  console.log('Store tx:', txReceipt.hash, 'block:', txReceipt.blockNumber);

  // 4) 从 Sepolia 读取
  const chainReceipt = await store.getReceipt(receipt.txHash);
  console.log('Chain receipt agent:', chainReceipt[2]);

  console.log('E2E passed');
}

main().catch(console.error);
```

运行：

```bash
npx ts-node scripts/test-e2e-sepolia.ts
```

---

## 七、新合约部署后的重置流程

每次重新部署合约后，所有之前的合约地址作废。快速重置流程：

```bash
# 1. 重新部署
make deploy-sepolia

# 2. 导出新地址
export CHIRON=0x新地址
export POOL=0x新地址
export CB=0x新地址
export ITR=0x新地址

# 3. 重跑冒烟
cast call $CHIRON "owner()(address)" --rpc-url $ETHEREUM_RPC

# 4. 按第 3 章顺序执行测试
```

---

## 八、FAQ

**Q: cast send 报 insufficient funds 怎么办？**
A: 去 faucet（见 1.2）补充 Sepolia ETH。

**Q: 交易一直 pending？**
A: 加 `--gas-price 2000000000`（2 gwei）。

**Q: --verify 失败？**
A: Etherscan API Key 可能填错。可以去掉 `--verify`，部署后手动在 [sepolia.etherscan.io](https://sepolia.etherscan.io) 验证。

**Q: 某个 revert 检查没有 revert？**
A: 这本身就是一个重要发现——说明合约的权限/验证逻辑存在缺口，需要修复后再部署测试。

**Q: 钱包余额不够了？**
A: 一次完整测试循环约消耗 0.00002 ETH。0.05 ETH 大约够跑 2500 轮。

---

## 九、测试清单（Checklist）

每次执行时逐项打勾：

- [ ] 1. 环境检查：forge 版本、RPC 连通、余额 >= 0.05 ETH
- [ ] 2. 部署 4 个合约，记录地址
- [ ] 3. 冒烟：owner / MAX_DAILY_TX / defaultThreshold / totalStaked / contractCount
- [ ] 4. Chiron：storeReceipt → getReceipt → getAgentReceipts → 重复拒绝
- [ ] 5. CircuitBreaker：5 次 FAIL → pause → resume → setThreshold
- [ ] 6. BondPool：deposit → getTxLimit → withdraw → 超额拒绝 → slash
- [ ] 7. IntentTemplateRegistry：register → getActionType → deactivate
- [ ] 8. 集成：Chiron 触发 CB pause → 暂停后拒绝 store → resume → 恢复
- [ ] 9. 权限：非 owner 调用 setThreshold / slash / deactivate / setCircuitBreaker
- [ ] 10. 边界：amount=0 拒绝、空 contracts 拒绝
- [ ] 11. Batch：写入 50 条 receipt 验证 gas 稳定性
- [ ] 12. SDK E2E：SDK 生成 Intent → L1 校验 → store 上链 → getReceipt 读回
