# Chiron Testnet Deployment Guide

> 部署目标：Sepolia（Ethereum 测试网）
> 最后更新：2026-06-15
> 前置依赖：Node.js v20+, Foundry, Alchemy/Infura API Key

---

## 一、前置准备

### 1.1 安装 Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
source ~/.zshrc  # 或重启终端
foundryup         # 安装 forge, cast, anvil
```

验证安装：

```bash
forge --version   # 应输出 forge x.x.x
```

### 1.2 获取测试网 ETH

| 水龙头 | 链 | URL |
|---|---|---|
| Alchemy | Sepolia | https://sepoliafaucet.com |
| Infura | Sepolia | https://www.infura.io/faucet/sepolia |
| PoW Faucet | Sepolia | https://sepolia-faucet.pk910.de |

### 1.3 环境变量

```bash
cp .env.example .env
# 编辑 .env，填入你的 PRIVATE_KEY 和 RPC URL
```

⚠️ **安全提醒：** `.env` 文件已写入 `.gitignore`，永远不会被提交。

---

## 二、合约架构

### 2.1 部署合约清单

| 合约 | 文件 | 用途 |
|---|---|---|
| `Chiron` | `contracts/src/Chiron.sol` | VerificationStore + CircuitBreaker 集成 |
| `BondPool` | `contracts/src/BondPool.sol` | Agent 质押 | 
| `CircuitBreaker` | `contracts/src/CircuitBreaker.sol` | 自动暂停 |
| `IntentTemplateRegistry` | `contracts/src/IntentTemplateRegistry.sol` | 社区注册 |

### 2.2 部署顺序

```
Step 1: 部署 Chiron
Step 2: 部署 BondPool
Step 3: 部署 CircuitBreaker
Step 4: 部署 IntentTemplateRegistry
Step 5: 调用 Chiron.setCircuitBreaker(circuitBreakerAddress)
```

---

## 三、编译合约

```bash
cd contracts

# 编译全部合约
forge build

# 确认无错误
echo $?  # 应输出 0
```

---

## 四、部署到 Sepolia

### 4.1 单命令部署

```bash
make deploy-sepolia
```

### 4.2 手动部署（分步）

```bash
cd contracts

# 1. 部署 Chiron
CHIRON=$(forge create src/Chiron.sol:Chiron \
  --rpc-url $ETHEREUM_RPC \
  --private-key $PRIVATE_KEY \
  --constructor-args \
  --json | jq -r '.deployedTo')
echo "Chiron: $CHIRON"

# 2. 部署 BondPool
BOND_POOL=$(forge create src/BondPool.sol:BondPool \
  --rpc-url $ETHEREUM_RPC \
  --private-key $PRIVATE_KEY \
  --json | jq -r '.deployedTo')
echo "BondPool: $BOND_POOL"

# 3. 部署 CircuitBreaker
CB=$(forge create src/CircuitBreaker.sol:CircuitBreaker \
  --rpc-url $ETHEREUM_RPC \
  --private-key $PRIVATE_KEY \
  --json | jq -r '.deployedTo')
echo "CircuitBreaker: $CB"

# 4. 连接 Chiron → CircuitBreaker
cast send $CHIRON "setCircuitBreaker(address)" $CB \
  --rpc-url $ETHEREUM_RPC \
  --private-key $PRIVATE_KEY
echo "CircuitBreaker connected to Chiron"

# 5. 部署 IntentTemplateRegistry
ITR=$(forge create src/IntentTemplateRegistry.sol:IntentTemplateRegistry \
  --rpc-url $ETHEREUM_RPC \
  --private-key $PRIVATE_KEY \
  --json | jq -r '.deployedTo')
echo "IntentTemplateRegistry: $ITR"
```

### 4.3 合约验证

```bash
forge verify-contract $CHIRON src/Chiron.sol:Chiron \
  --chain 11155111 \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

---

## 五、部署到其他测试网

### 5.1 链配置

| 链 | chainId | RPC | 浏览器 |
|---|---|---|---|
| Sepolia | 11155111 | `ETHEREUM_RPC` | etherscan.io |
| Arbitrum Sepolia | 421614 | `ARBITRUM_RPC` | arbiscan.io |
| Optimism Sepolia | 11155420 | `OPTIMISM_RPC` | optimistic.etherscan.io |
| Base Sepolia | 84532 | `BASE_RPC` | basescan.org |
| Polygon Amoy | 80002 | `POLYGON_RPC` | polygonscan.com |

### 5.2 跨链部署

```bash
make deploy-arbitrum    # Arbitrum Sepolia
# 或
CHAIN_ID=421614 make deploy-sepolia  # 需要修改 Makefile 中 RPC 变量
```

---

## 六、SDK 配置

### 6.1 连接到部署的合约

```typescript
import { Chiron } from '@chiron/sdk';
import { OnChainStore } from '@chiron/sdk/store';

const chiron = new Chiron({ chainId: 11155111 });

// 连接到部署的 VerificationStore
const store = new OnChainStore(
  '0xYOUR_DEPLOYED_CHIRON_ADDRESS',  // 替换为实际地址
  new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY')
);
```

### 6.2 测试流程

```typescript
// 1. Agent 声明意图
const intent = await chiron.intent('swap', {
  protocol: 'uniswap_v3',
  tokenIn: 'USDC',
  tokenOut: 'WETH',
  amount: '100',
});

// 2. L1 校验
const receipt = await chiron.verify(intent, tx);
console.log('Verified:', receipt.allowed);

// 3. 链上存证
await store.store(receipt);
console.log('Receipt stored on-chain');
```

---

## 七、验证部署

### 7.1 检查合约

```bash
# 读取链上 Chiron 信息
cast call $CHIRON "owner()(address)" --chain 11155111
# 应输出你的部署钱包地址

cast call $CHIRON "MAX_DAILY_TX()(uint256)" --chain 11155111
# 应输出 1000
```

### 7.2 存证测试

```bash
# 模拟存证
cast send $CHIRON "storeReceipt(bytes32,bytes32,address,uint8,uint8)" \
  0x01 0x02 0x0000000000000000000000000000000000000001 0 0 \
  --rpc-url $ETHEREUM_RPC \
  --private-key $PRIVATE_KEY

# 查询存证
cast call $CHIRON "getReceipt(bytes32)((bytes32,bytes32,address,uint8,uint8,uint256,uint256))" \
  0x01 --chain 11155111
```

---

## 八、常见问题

### 8.1 "insufficient funds for gas"

测试网 ETH 不足 → 去水龙头领取 Sepolia ETH。

### 8.2 "nonce too low"

交易队列中有 pending 交易 → 等前一笔确认或重置 nonce：

```bash
cast rpc anvil_setNonce $YOUR_ADDRESS $NEW_NONCE --chain 11155111
```

### 8.3 "execution reverted"

合约 require 条件不满足 → 用 `cast call` 模拟交易找出原因：

```bash
cast call $CHIRON "storeReceipt(...)" ... --chain 11155111
# 错误信息会在 revert 原因中显示
```

### 8.4 Contract verification failed

构造函数参数不匹配 → 确认部署时使用的构造函数参数与验证时一致。

---

## 九、部署后操作

### 9.1 注册协议到 SDK

```bash
# 向内置注册表添加新协议（提交 PR 到 sdk/src/registry-data.ts）
# 或直接通过 IntentTemplateRegistry 合约注册
cast send $ITR "registerProtocol(bytes32,address[],bytes4[],uint8)" \
  $(cast keccak256 "my_protocol") \
  "[0x...]" \
  "[0x...]" \
  1 \
  --rpc-url $ETHEREUM_RPC \
  --private-key $PRIVATE_KEY
```

### 9.2 启动 L2 Verifier

```bash
cd verifier && npm install && npm start
# 服务运行在 http://localhost:3456
```

### 9.3 启动 Webhook

```bash
cd webhook && npm install && npm start
# 服务运行在 http://localhost:3457
```

---

## 十、安全建议

1. **私钥管理** — 使用硬件钱包或 MPC 方案管理部署私钥
2. **测试环境** — 先在 Sepolia 完成全部测试后再部署主网
3. **Gas 上限** — 单次部署所有合约约需 0.05-0.1 ETH（Sepolia）
4. **合约升级** — 当前使用不可升级模式。如需升级，需部署新版后迁移数据
5. **监控** — 部署后设置 alert 监控合约事件和 Agent 行为
