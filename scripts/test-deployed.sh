#!/bin/bash

# ═══════════════════════════════════════════════════════════
# Chiron 部署测试脚本
# 前提：anvil 在 127.0.0.1:8545 运行，合约已部署
# ═══════════════════════════════════════════════════════════

RPC=http://127.0.0.1:8545
DEPLOYER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# 合约地址（刚部署的标准 Anvil 地址）
CHIRON=0x5FbDB2315678afecb367f032d93F642f64180aa3
BONDPOOL=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
CB=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
ITR=0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9

PKEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

PASS=0
FAIL=0

pass() { PASS=$((PASS+1)); echo "  ✅ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ❌ $1"; }

echo "════════════════════════════════════════════"
echo "  Chiron 部署测试"
echo "  链: Anvil :8545"
echo "  日期: $(date)"
echo "════════════════════════════════════════════"
echo ""

# ───────────────────────
# 1. 基本合约检查
# ───────────────────────
echo "━━━ 1. 合约部署检查 ━━━"

OWNER=$(cast call $CHIRON "owner()(address)" --rpc-url $RPC 2>/dev/null)
if [ "$OWNER" = "$DEPLOYER" ]; then
  pass "Chiron owner = $DEPLOYER"
else
  fail "Chiron owner mismatch: got $OWNER"
fi

CB_OWNER=$(cast call $CB "owner()(address)" --rpc-url $RPC 2>/dev/null)
if [ "$CB_OWNER" = "$DEPLOYER" ]; then
  pass "CircuitBreaker owner = $DEPLOYER"
else
  fail "CircuitBreaker owner mismatch"
fi

MAX_TX=$(cast call $CHIRON "MAX_DAILY_TX()(uint256)" --rpc-url $RPC 2>/dev/null)
if [ "$MAX_TX" = "1000" ]; then
  pass "MAX_DAILY_TX = 1000"
else
  fail "MAX_DAILY_TX mismatch: got $MAX_TX"
fi

echo ""

# ───────────────────────
# 2. VerificationStore 存证
# ───────────────────────
echo "━━━ 2. 校验存证 (VerificationStore) ━━━"

TX_HASH=0x1111111111111111111111111111111111111111111111111111111111111111
INTENT_HASH=0x2222222222222222222222222222222222222222222222222222222222222222
AGENT=0x1111111111111111111111111111111111111111
L1_RESULT=0  # PASS=0, FAIL=1

cast send $CHIRON "storeReceipt(bytes32,bytes32,address,uint8,uint8)" \
  $TX_HASH $INTENT_HASH $AGENT $L1_RESULT 0 \
  --rpc-url $RPC --private-key $PKEY --gas-limit 300000  2>&1

RECEIPT=$(cast call $CHIRON "getReceipt(bytes32)((bytes32,bytes32,address,uint8,uint8,uint256,uint256))" $TX_HASH --rpc-url $RPC 2>/dev/null)
if echo "$RECEIPT" | grep -qi "$AGENT"; then
  pass "storeReceipt + getReceipt: 记录存证成功"
else
  fail "storeReceipt 失败"
fi

AGENT_RECEIPTS=$(cast call $CHIRON "getAgentReceipts(address)(bytes32[])" $AGENT --rpc-url $RPC 2>/dev/null)
if echo "$AGENT_RECEIPTS" | grep -qi "1111"; then
  pass "getAgentReceipts: Agent 历史查询成功"
else
  fail "getAgentReceipts 失败"
fi

STORE_FAIL=$(cast send $CHIRON "storeReceipt(bytes32,bytes32,address,uint8,uint8)" \
  $TX_HASH 0x3333 $AGENT 0 0 \
  --rpc-url $RPC --private-key $PKEY --gas-limit 300000 2>&1 || true)
if echo "$STORE_FAIL" | grep -qi "revert"; then
  pass "重复 txHash 存证被拒绝"
else
  fail "重复 txHash 应被拒绝"
fi

echo ""

# ───────────────────────
# 3. BondPool 质押
# ───────────────────────
echo "━━━ 3. BondPool 质押 ━━━"

AGENT_BP=0x2222222222222222222222222222222222222222

cast send $BONDPOOL "deposit(address,uint256)" $AGENT_BP 1000000000000000000 \
  --rpc-url $RPC --private-key $PKEY --gas-limit 300000  2>&1

STAKE=$(cast call $BONDPOOL "stakes(address)(uint256)" $AGENT_BP --rpc-url $RPC 2>/dev/null)
if echo "$STAKE" | grep -q "1000000000000000000"; then
  pass "BondPool deposit: 质押 1 ETH"
else
  fail "BondPool deposit 失败: got $STAKE"
fi

LIMIT=$(cast call $BONDPOOL "getTxLimit(address)(uint256)" $AGENT_BP --rpc-url $RPC 2>/dev/null)
if echo "$LIMIT" | grep -q "10000000000000000000"; then
  pass "getTxLimit: 交易上限 = 质押 × 10 = 10 ETH"
else
  fail "getTxLimit 失败: got $LIMIT"
fi

cast send $BONDPOOL "withdraw(address,uint256)" $AGENT_BP 500000000000000000 \
  --rpc-url $RPC --private-key $PKEY --gas-limit 300000  2>&1

STAKE2=$(cast call $BONDPOOL "stakes(address)(uint256)" $AGENT_BP --rpc-url $RPC 2>/dev/null)
if echo "$STAKE2" | grep -q "500000000000000000"; then
  pass "BondPool withdraw: 提取 0.5 ETH，剩余 0.5 ETH"
else
  fail "BondPool withdraw 失败: got $STAKE2"
fi

echo ""

# ───────────────────────
# 4. CircuitBreaker 暂停
# ───────────────────────
echo "━━━ 4. CircuitBreaker 自动暂停 ━━━"

AGENT_CB=0x3333333333333333333333333333333333333333

for i in $(seq 1 5); do
  cast send $CB "recordFail(address)" $AGENT_CB \
    --rpc-url $RPC --private-key $PKEY --gas-limit 300000 >/dev/null 2>&1
done

PAUSED=$(cast call $CB "isPaused(address)(bool)" $AGENT_CB --rpc-url $RPC 2>/dev/null)
if echo "$PAUSED" | grep -qi "true"; then
  pass "5 次 FAIL 后 Agent 自动暂停"
else
  fail "Agent 应被暂停"
fi

cast send $CB "resume(address)" $AGENT_CB \
  --rpc-url $RPC --private-key $PKEY --gas-limit 300000  2>&1

PAUSED2=$(cast call $CB "isPaused(address)(bool)" $AGENT_CB --rpc-url $RPC 2>/dev/null)
if echo "$PAUSED2" | grep -qi "false"; then
  pass "resume 后 Agent 恢复"
else
  fail "resume 后仍应可用"
fi

echo ""

# ───────────────────────
# 5. Chiron ↔ CircuitBreaker 集成
# ───────────────────────
echo "━━━ 5. Chiron ↔ CircuitBreaker 集成 ━━━"

echo "  （通过 Chiron.storeReceipt 触发 CircuitBreaker.recordFail）"
echo "  测试：存 5 条 FAIL 记录 → 检查 Agent 是否通过 Chiron 被暂停"

AGENT_INT=0x4444444444444444444444444444444444444444

for i in $(seq 1 5); do
  TX="0x${i}0000000000000000000000000000000000000000000000000000000000000000"
  cast send $CHIRON "storeReceipt(bytes32,bytes32,address,uint8,uint8)" \
    $TX 0x5555 $AGENT_INT 1 0 \
    --rpc-url $RPC --private-key $PKEY --gas-limit 300000 >/dev/null 2>&1
done

PAUSED3=$(cast call $CHIRON "circuitBreaker()(address)" --rpc-url $RPC 2>/dev/null)
echo "  CircuitBreaker 地址: $PAUSED3"

# Diagnostics
FAILS=$(cast call $CB "consecutiveFails(address)(uint256)" $AGENT_INT --rpc-url $RPC 2>/dev/null)
echo "  consecutiveFails(agent_int) = $FAILS"
DIRECT=$(cast send $CB "recordFail(address)" $AGENT_INT --rpc-url $RPC --private-key $PKEY --gas-limit 50000 2>&1 || true)
FAILS2=$(cast call $CB "consecutiveFails(address)(uint256)" $AGENT_INT --rpc-url $RPC 2>/dev/null)
echo "  After direct recordFail + 1 = $FAILS2"

INT_PAUSED=$(cast call $CB "isPaused(address)(bool)" $AGENT_INT --rpc-url $RPC 2>/dev/null)
if echo "$INT_PAUSED" | grep -qi "true"; then
  pass "Chiron → CircuitBreaker 集成: 5 条 FAIL 后 Agent 暂停"
else
  fail "集成验证失败: Agent 应被暂停"
fi

echo ""

# ───────────────────────
# 6. IntentTemplateRegistry
# ───────────────────────
echo "━━━ 6. IntentTemplateRegistry ━━━"

HASH=0x6d795f70726f746f636f6c000000000000000000000000000000000000000000
ADDRS="[0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa]"
SELS="[0x414bf389]"

cast send $ITR "registerProtocol(bytes32,address[],bytes4[],uint8)" \
  $HASH "$ADDRS" "$SELS" 1 \
  --rpc-url $RPC --private-key $PKEY --gas-limit 300000  2>&1

AT=$(cast call $ITR "getActionType(address)(uint8)" 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --rpc-url $RPC 2>/dev/null)
if echo "$AT" | grep -q "1"; then
  pass "IntentTemplateRegistry: 注册协议 → getActionType = 1 (SWAP)"
else
  fail "IntentTemplateRegistry 查询失败: got $AT"
fi

COUNT=$(cast call $ITR "getRegisteredContractCount()(uint256)" --rpc-url $RPC 2>/dev/null)
if echo "$COUNT" | grep -q "1"; then
  pass "getRegisteredContractCount = 1"
else
  fail "合约计数应为 1: got $COUNT"
fi

echo ""
echo "════════════════════════════════════════════"
echo "  测试完成: $PASS 通过 / $FAIL 失败"
echo "════════════════════════════════════════════"
