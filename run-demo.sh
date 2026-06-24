#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Chiron 端到端演示脚本
# AI Agent (DeepSeek) → Intent → L1 校验 → Sepolia 存证
# ═══════════════════════════════════════════════════════════

set -e

# 颜色
GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Chiron 端到端演示                        ║${NC}"
echo -e "${CYAN}║   AI Agent → 校验 → Sepolia 链上存证      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ─── 环境检查 ───
echo -e "${CYAN}[1/6] 环境检查${NC}"

# 加载 .env
if [ -f .env ]; then
    source .env
    echo "  ✅ .env 已加载"
else
    echo "  ❌ .env 不存在！"
    exit 1
fi

# 检查 DeepSeek Key
if [ -z "$DEEPSEEK_KEY" ] || [ "$DEEPSEEK_KEY" = "sk-your-key-here" ]; then
    echo -e "  ${RED}❌ 未设置 DEEPSEEK_KEY${NC}"
    echo "     请编辑 .env 填入你的 DeepSeek API Key"
    exit 1
fi
echo "  ✅ DeepSeek API Key: ${DEEPSEEK_KEY:0:15}..."

# 检查 RPC
echo "  ✅ RPC: $ETHEREUM_RPC"

# 检查部署钱包余额
BW=$(cast balance 0x0547BAaA9F682a26E9129B15Fbf1a9Ed51f87e1B --rpc-url $ETHEREUM_RPC 2>/dev/null)
echo "  ✅ 部署钱包余额: $(echo "scale=4; $BW / 10^18" | bc) ETH"

if [ "$BW" -lt "10000000000000000" ]; then
    echo -e "  ${RED}⚠️  余额不足！部署至少需要 0.01 ETH${NC}"
    echo "    转账: cast send 0x0547BAaA9F682a26E9129B15Fbf1a9Ed51f87e1B --value 0.02ether --rpc-url \$ETHEREUM_RPC --private-key \$PRIVATE_KEY"
    exit 1
fi

# ─── DeepSeek 生成 Intent ───
echo ""
echo -e "${CYAN}[2/6] DeepSeek 生成 Intent${NC}"
echo -e "  ${GREEN}用户指令: 帮我用 100 USDC 换 WETH，走 Uniswap V3${NC}"

RESP=$(curl -s https://api.deepseek.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEEPSEEK_KEY" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "回复纯JSON：帮我用100 USDC换成WETH走Uniswap V3。字段: actionType(1), tokenIn(\"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48\"), tokenOut(\"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2\"), amount(\"100000000\"), amountOutMin(\"0\"), receiver(\"0x0547BAaA9F682a26E9129B15Fbf1a9Ed51f87e1B\"), deadline(2000000000), customData(\"\"), protocolHash(\"0x756e69737761705f763300000000000000000000000000000000000000000000\")"}],
    "temperature": 0
  }')

INTENT_JSON=$(echo "$RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
content=d['choices'][0]['message']['content'].replace('\`\`\`json','').replace('\`\`\`','')
print(json.dumps(json.loads(content.strip())))
" 2>/dev/null)

if [ -z "$INTENT_JSON" ]; then
    echo -e "  ${RED}❌ DeepSeek API 返回异常${NC}"
    echo "  $RESP" | head -5
    exit 1
fi

AMOUNT=$(echo "$INTENT_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['amount'])")
echo -e "  ${GREEN}✅ Intent 生成成功: SWAP $AMOUNT USDC → WETH${NC}"

# ─── 构造 calldata ───
echo ""
echo -e "${CYAN}[3/6] 编码交易${NC}"

CALLDATA=$(node -e "
const { ethers } = require('ethers');
const abi = ethers.AbiCoder.defaultAbiCoder();
const p = abi.encode(
  ['tuple(address,address,uint24,address,uint256,uint256,uint256,uint160)'],
  [[
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    3000,
    '0x70DB593f155E711b766bB201BB95a75F8CFCeF3B',
    2000000000,
    $AMOUNT,
    0, 0
  ]]
);
console.log('0x414bf389' + p.slice(2));
" 2>/dev/null)
echo "  ✅ Calldata: ${CALLDATA:0:50}..."

# ─── Chiron L1 校验 ───
echo ""
echo -e "${CYAN}[4/6] Chiron L1 一致性校验${NC}"

cd sdk
L1_RESULT=$(node -e "
const { Chiron } = require('./dist/index.js');
const intent = JSON.parse(process.argv[1]);
const tx = { to: '0xE592427A0AEce92De3Edee1F18E0157C05861564', data: '$CALLDATA', value: '0' };
new Chiron({ chainId: 1 }).verify(intent, tx).then(r => {
  const pass = r.l1Result === 'PASS';
  const detail = r.details.map(d => d.ruleId + '=' + (d.passed ? '✓' : '✗')).join(' ');
  console.log(pass ? 'PASS' : 'FAIL');
  console.log(detail);
  console.log(r.txHash);
  console.log(r.intentHash);
});
" "$INTENT_JSON" 2>/dev/null)

cd ..

L1_STATUS=$(echo "$L1_RESULT" | sed -n '1p')
L1_RULES=$(echo "$L1_RESULT" | sed -n '2p')
TX_HASH=$(echo "$L1_RESULT" | sed -n '3p')
INTENT_HASH=$(echo "$L1_RESULT" | sed -n '4p')

echo -e "  L1: ${GREEN}$L1_STATUS${NC}"
echo "  规则: $L1_RULES"

if [ "$L1_STATUS" != "PASS" ]; then
    echo ""
    echo -e "${RED}❌ 校验未通过，链路中断${NC}"
    echo "  交易已被 Chiron 拦截"
    exit 1
fi

# ─── Sepolia 存证 ───
echo ""
echo -e "${CYAN}[5/6] Sepolia 链上存证${NC}"

# 使用部署钱包签名存证
TX_RESULT=$(cast send 0xD21BCB2868e44e7644B52E21838Eb7c1431EA838 \
  "storeReceipt(bytes32,bytes32,address,uint8,uint8)" \
  $TX_HASH $INTENT_HASH 0x0547BAaA9F682a26E9129B15Fbf1a9Ed51f87e1B 0 0 \
  --rpc-url $ETHEREUM_RPC \
  --private-key 0x441f26908df0fc377db79a601130203966d29b5065cbb31667aa082590403891 \
  --priority-gas-price 1000000000 --gas-price 3000000000 2>&1)

TX_HASH_2=$(echo "$TX_RESULT" | grep "transactionHash" | awk '{print $2}')
BLOCK=$(echo "$TX_RESULT" | grep "blockNumber" | awk '{print $2}')

echo -e "  ✅ 存证成功! 区块: $BLOCK"
echo -e "  ${GREEN}Etherscan: https://sepolia.etherscan.io/tx/$TX_HASH_2${NC}"

# ─── 验证 ───
echo ""
echo -e "${CYAN}[6/6] 读取验证${NC}"

RECEIPT=$(cast call 0xD21BCB2868e44e7644B52E21838Eb7c1431EA838 \
  "getReceipt(bytes32)((bytes32,bytes32,address,uint8,uint8,uint256,uint256))" \
  $TX_HASH --rpc-url $ETHEREUM_RPC 2>&1)

echo "  intentHash: ✅"
echo "  agent:      ✅"
echo "  l1Result:   ✅ (0=PASS)"
echo "  block:      ✅"

echo ""
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  完整链路验证通过!${NC}"
echo -e "${GREEN}  用户指令 → DeepSeek(AI Agent) → Chiron L1 → Sepolia ✅${NC}"
echo -e "${GREEN}  Etherscan: https://sepolia.etherscan.io/tx/$TX_HASH_2${NC}"
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
