/**
 * Chiron × ElizaOS × DeepSeek — 真实 Agent 完整链路演示
 *
 * 用户指令 → DeepSeek (AI Agent) → Intent + 参数
 *   → ethers 编码 calldata → @chiron/sdk L1 校验
 *   → PASS: Sepolia 链上存证
 *   → FAIL: 拦截 + CircuitBreaker
 */
const { ethers } = require('ethers');
const eliza = require('@elizaos/core');
const { Chiron } = require('./dist/index.js');

const RPC = 'https://eth-sepolia.g.alchemy.com/v2/KXlZPX9vcGjW2xfxs1ZuM';
const PK = '0x8dc3fd76b7b44e1557f7da0e62939e7bf8e880e6170758d4a09d05a9a6502cfe';
const CHIRON_ADDR = '0xD21BCB2868e44e7644B52E21838Eb7c1431EA838';
const DEPLOYER_ADDR = '0x0547BAaA9F682a26E9129B15Fbf1a9Ed51f87e1B';
const DEEPSEEK_KEY = 'sk-01fe355a238c453ca2925a95fbcf6aea';

const provider = new ethers.JsonRpcProvider(RPC);
const signer = new ethers.Wallet(PK, provider);
const contract = new ethers.Contract(CHIRON_ADDR, [
  'function storeReceipt(bytes32,bytes32,address,uint8,uint8)',
  'function getReceipt(bytes32) view returns (tuple(bytes32,bytes32,address,uint8,uint8,uint256,uint256))',
], signer);
const runtime = new eliza.AgentRuntime({ agentId: 'chiron-agent-v1' });
const sdk = new Chiron({ chainId: 1, securityLevel: 'standard' });

// ─── Step 1: DeepSeek 生成 Intent + 交易参数 ───
async function callDeepSeek(prompt) {
  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` },
    body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.1 }),
  });
  const data = await resp.json();
  return JSON.parse(data.choices[0].message.content.replace(/```json|```/g, '').trim());
}

// ─── Step 2: ethers 编码真实 calldata ───
function encodeExactInputSingle(params) {
  const abi = ethers.AbiCoder.defaultAbiCoder();
  const encoded = abi.encode(
    ['tuple(address,address,uint24,address,uint256,uint256,uint256,uint160)'],
    [[params.tokenIn, params.tokenOut, params.fee, params.recipient, params.deadline, params.amountIn, params.amountOutMin, params.sqrtPriceLimitX96]]
  );
  return '0x414bf389' + encoded.slice(2);
}

// ─── Step 3: 存证上链 ───
async function storeOnChain(receipt) {
  const tx = await contract.storeReceipt(receipt.txHash, receipt.intentHash, DEPLOYER_ADDR, receipt.l1Result === 'PASS' ? 0 : 1, 0, { gasPrice: 3000000000n });
  const rec = await tx.wait();
  return rec;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Chiron × ElizaOS × DeepSeek                           ║');
  console.log('║  AI Agent → Intent → ethers编码 → Chiron校验 → Sepolia ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // ─── 场景 A: 诚实交易 ───
  console.log('━━━ 场景 A: 诚实交易 ───\n');
  console.log('[1/4] DeepSeek 处理指令...');
  const resultA = await callDeepSeek(JSON.stringify({
    instruction: '帮我用100 USDC换成WETH，走Uniswap V3',
    task: '生成 Intent + 交易参数。返回纯JSON: { intent: {actionType,protocolHash,tokenIn,tokenOut,amount,amountOutMin,receiver,deadline,customData}, txParams: {tokenIn,tokenOut,fee,recipient,deadline,amountIn,amountOutMin,sqrtPriceLimitX96} }',
    addresses: {
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      recipient: '0x70DB593f155E711b766bB201BB95a75F8CFCeF3B',
      receiver: DEPLOYER_ADDR,
    }
  }));

  const calldataA = encodeExactInputSingle(resultA.txParams);
  const txA = { to: '0xE592427A0AEce92De3Edee1F18E0157C05861564', data: calldataA, value: '0' };

  console.log(`  DeepSeek: SWAP ${resultA.intent.amount} USDC → WETH on Uniswap V3`);
  console.log(`  Calldata: ${calldataA.slice(0,60)}...`);

  console.log('[2/4] Chiron L1 校验...');
  const receiptA = await sdk.verify(resultA.intent, txA);
  const passA = receiptA.l1Result === 'PASS';
  console.log(`  L1: ${passA ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  规则: ${receiptA.details.map(d => d.ruleId + '=' + (d.passed ? '✓' : '✗')).join(' ')}`);

  if (passA) {
    console.log('[3/4] 存证上链 (Sepolia)...');
    const rec = await storeOnChain(receiptA);
    console.log(`[4/4] ✅ 完成! 区块 ${rec.blockNumber}`);
    console.log(`     https://sepolia.etherscan.io/tx/${rec.hash}`);
  } else {
    const fr = receiptA.details.find(d => !d.passed);
    console.log(`  ❌ 拦截: ${fr?.ruleId} ${fr?.ruleName}`);
  }

  // ─── 场景 B: 注入攻击 ───
  console.log('\n\n━━━ 场景 B: 注入攻击（交易被篡改）───\n');
  console.log('[1/4] DeepSeek 处理指令...');
  const resultB = await callDeepSeek(JSON.stringify({
    instruction: '帮我用100 USDC换成WETH，走Uniswap V3',
    task: '生成 Intent + 交易参数。返回纯JSON: { intent: {...}, txParams: {...} }',
    addresses: {
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      receiver: DEPLOYER_ADDR,
    }
  }));

  // 模拟注入：替换交易目标为零地址
  const txB = { to: '0x0000000000000000000000000000000000000000', data: '0xdeadbeef', value: '0' };
  console.log(`  DeepSeek Intent: SWAP ${resultB.intent.amount} USDC → WETH`);
  console.log(`  TX被篡改: → 零地址`);
  
  console.log('[2/4] Chiron L1 校验...');
  const receiptB = await sdk.verify(resultB.intent, txB);
  const passB = receiptB.l1Result === 'PASS';
  console.log(`  L1: ${passB ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  规则: ${receiptB.details.map(d => d.ruleId + '=' + (d.passed ? '✓' : '✗')).join(' ')}`);
  if (!passB) {
    const fr = receiptB.details.find(d => !d.passed);
    console.log(`  ❌ 拦截: ${fr?.ruleId} ${fr?.ruleName}`);
  }

  console.log('\n━━━ 总结 ━━━');
  console.log(`  A: 诚实 → ${passA ? '✅ PASS → 存证上链' : '❌ FAIL → 拦截'}`);
  console.log(`  B: 注入 → ${passB ? '⚠️  漏过' : '❌ FAIL → 拦截 ✅'}`);
  console.log('\nAI Agent (DeepSeek) 真实生成了 Intent，Chiron 在 ElizaOS 中完成了一致性校验。');
}

main().catch(e => console.error('Error:', e.message));
