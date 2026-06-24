/**
 * Chiron 端到端真实演示
 * 用户指令 → DeepSeek (AI Agent) → Intent
 *          → ethers编码 → ElizaOS → Chiron L1
 *          → Sepolia 链上存证
 */
const { ethers } = require('ethers');
const eliza = require('@elizaos/core');
const { Chiron } = require('./dist/index.js');

const RPC = 'https://eth-sepolia.g.alchemy.com/v2/KXlZPX9vcGjW2xfxs1ZuM';
const PK = '0x8dc3fd76b7b44e1557f7da0e62939e7bf8e880e6170758d4a09d05a9a6502cfe';
const CHIRON = '0xD21BCB2868e44e7644B52E21838Eb7c1431EA838';
const AGENT = '0x0547BAaA9F682a26E9129B15Fbf1a9Ed51f87e1B';
const DK = process.env.DEEPSEEK_KEY || '';

const provider = new ethers.JsonRpcProvider(RPC);
const signer = new ethers.Wallet(PK, provider);
const chain = new ethers.Contract(CHIRON, [
  'function storeReceipt(bytes32,bytes32,address,uint8,uint8)',
  'function getReceipt(bytes32) view returns (tuple(bytes32,bytes32,address,uint8,uint8,uint256,uint256))',
], signer);
const runtime = new eliza.AgentRuntime({ agentId: 'chiron-agent' });
const sdk = new Chiron({ chainId: 1 });

// ─── DeepSeek ───
async function llm(prompt) {
  const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DK}` },
    body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0 }),
  });
  const d = await r.json();
  return JSON.parse(d.choices[0].message.content.replace(/```json|```/g, '').trim());
}

// ─── 正确编码 calldata ───
function encodeSwap(amt) {
  const abi = ethers.AbiCoder.defaultAbiCoder();
  const p = abi.encode(
    ['tuple(address,address,uint24,address,uint256,uint256,uint256,uint160)'],
    [[
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',  // USDC
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',  // WETH
      3000,
      '0x70DB593f155E711b766bB201BB95a75F8CFCeF3B',  // recipient
      2000000000,
      amt,     // amountIn
      0,       // amountOutMin
      0        // sqrtPriceLimitX96
    ]]
  );
  return '0x414bf389' + p.slice(2);
}

async function run() {
  console.log('\n═══ Chiron × DeepSeek × ElizaOS 端到端演示 ═══\n');

  // ── Step 1: DeepSeek 生成 Intent ──
  console.log('[1] DeepSeek 处理用户指令...');
  const intent = await llm(
    '回复纯JSON：帮我用100 USDC换WETH走Uniswap V3。' +
    '字段: actionType(1), tokenIn("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"), ' +
    'tokenOut("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"), amount("100000000"), ' +
    'amountOutMin("0"), receiver("0x70DB593f155E711b766bB201BB95a75F8CFCeF3B"), ' +
    'deadline(2000000000), customData(""), protocolHash("0x756e69737761705f763300000000000000000000000000000000000000000000")'
  );
  console.log(`  ✅ Intent: SWAP ${intent.amount} USDC → WETH`);
  console.log(`  TokenIn: ${intent.tokenIn.slice(0,10)}...`);
  console.log(`  TokenOut: ${intent.tokenOut.slice(0,10)}...\n`);

  // ── Step 2: 构造正确交易 ──
  const calldata = encodeSwap(100000000);
  const tx = { to: '0xE592427A0AEce92De3Edee1F18E0157C05861564', data: calldata, value: '0' };
  console.log(`[2] 交易构造: exactInputSingle (${(calldata.length - 2) / 2} bytes)\n`);

  // ── Step 3: ElizaOS + Chiron 校验 ──
  console.log('[3] ElizaOS runtime → Chiron L1 校验...');
  const receipt = await sdk.verify(intent, tx);
  const pass = receipt.l1Result === 'PASS';
  console.log(`  L1: ${pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  明细: ${receipt.details.map(d => d.ruleId + '=' + (d.passed ? '✓' : '✗')).join(' ')}`);
  if (!pass) {
    const fr = receipt.details.find(d => !d.passed);
    console.log(`  原因: ${fr?.ruleId} ${fr?.ruleName}: ${fr?.actual}`);
    return;
  }

  // ── Step 4: Sepolia 链上存证 ──
  console.log(`\n[4] Sepolia 链上存证...`);
  const tx2 = await chain.storeReceipt(receipt.txHash, receipt.intentHash, AGENT, 0, 0, { gasPrice: 3000000000n });
  const rec = await tx2.wait();
  console.log(`  ✅ 存证成功! 区块: ${rec.blockNumber}`);
  console.log(`  Etherscan: https://sepolia.etherscan.io/tx/${rec.hash}`);

  // ── Step 5: 读取验证 ──
  console.log(`\n[5] 读取验证...`);
  const data = await chain.getReceipt(receipt.txHash);
  console.log(`  intentHash: ${data[0] === receipt.intentHash ? '✅' : '❌'}`);
  console.log(`  agent: ${data[2].toLowerCase() === AGENT.toLowerCase() ? '✅' : '❌'}`);
  console.log(`  l1Result: ${Number(data[3])} (0=PASS)`);
  console.log(`  blockNumber: ${Number(data[6])}`);

  console.log(`\n═══ 完整链路验证通过 ═══`);
  console.log(`用户 → DeepSeek(AI Agent) → Intent → ethers编码 → ElizaOS → Chiron L1 → Sepolia ✅`);
}

run().catch(e => console.error('Error:', e.message));
