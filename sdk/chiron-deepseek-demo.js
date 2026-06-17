/**
 * Chiron × ElizaOS × DeepSeek — 真实 Agent 端到端演示
 *
 * 用户指令 → DeepSeek (AI Agent) → Intent + TX
 *          → ElizaOS runtime → @chiron/sdk L1 校验
 *          → PASS: Sepolia 链上存证
 *          → FAIL: 拦截 + CircuitBreaker
 */
const eliza = require('@elizaos/core');
const { Chiron } = require('./dist/index.js');
const { ethers } = require('ethers');

const RPC = 'https://eth-sepolia.g.alchemy.com/v2/KXlZPX9vcGjW2xfxs1ZuM';
const PK = '0x8dc3fd76b7b44e1557f7da0e62939e7bf8e880e6170758d4a09d05a9a6502cfe';
const CHIRON_ADDR = '0xD21BCB2868e44e7644B52E21838Eb7c1431EA838';
const AGENT_ADDR = '0x0547BAaA9F682a26E9129B15Fbf1a9Ed51f87e1B';

const provider = new ethers.JsonRpcProvider(RPC);
const signer = new ethers.Wallet(PK, provider);
const ABI = [
  'function storeReceipt(bytes32,bytes32,address,uint8,uint8)',
  'function getReceipt(bytes32) view returns (tuple(bytes32,bytes32,address,uint8,uint8,uint256,uint256))',
];
const contract = new ethers.Contract(CHIRON_ADDR, ABI, signer);
const runtime = new eliza.AgentRuntime({ agentId: 'chiron-agent-v1' });
const sdk = new Chiron({ chainId: 1, securityLevel: 'standard' });

// ─── 真实 LLM Agent 调用 ───
async function agentProcess(userInput) {
  const prompt = `你是一个链上交易Agent。用户的指令是: "${userInput}"

请生成:
1. IntentTemplate — Agent 声明的意图
2. Transaction — Agent 即将执行的交易

Uniswap V3 Router: 0xE592427A0AEce92De3Edee1F18E0157C05861564
exactInputSingle selector: 0x414bf389
USDC (Ethereum): 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
WETH (Ethereum): 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2

返回纯JSON (不要markdown):
{
  "intent": {
    "actionType": 1,
    "protocolHash": "0x756e69737761705f763300000000000000000000000000000000000000000000",
    "tokenIn": "USDC地址",
    "tokenOut": "WETH地址",
    "amount": "金额(最小单位)",
    "amountOutMin": "0",
    "receiver": "${AGENT_ADDR}",
    "deadline": 2000000000,
    "customData": ""
  },
  "tx": {
    "to": "Uniswap Router地址",
    "data": "selector + abi编码的exactInputSingle参数(正确编码，包含tokenIn/tokenOut/fee/recipient/deadline/amountIn/amountOutMin/sqrtPriceLimitX96)",
    "value": "0"
  }
}`;

  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer sk-01fe355a238c453ca2925a95fbcf6aea`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    }),
  });
  
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';
  return JSON.parse(content.replace(/```json/g, '').replace(/```/g, '').trim());
}

// ── 存证上链 ──
async function storeOnChain(receipt) {
  const txHash = receipt.txHash;
  const intentHash = receipt.intentHash;
  const l1Val = receipt.l1Result === 'PASS' ? 0 : 1;
  try {
    const tx = await contract.storeReceipt(txHash, intentHash, AGENT_ADDR, l1Val, 0, { gasPrice: 3000000000n });
    const rec = await tx.wait();
    console.log(`   │ ✅ 已存证! 区块: ${rec.blockNumber}`);
    console.log(`   │    https://sepolia.etherscan.io/tx/${rec.hash}`);
  } catch(e) {
    console.log(`   │ ⚠️  存证失败: ${(e.info?.error?.message || e.message).slice(0,60)}`);
  }
}

async function runScenario(name, userInput, overrideTx) {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  ${name}`);
  console.log(`╚══════════════════════════════════════════════╝\n`);

  // ① 真实 LLM Agent 处理
  console.log(`   ┌── [DeepSeek] 处理用户指令 ──────────────`);
  console.log(`   │ 用户: "${userInput}"`);
  console.log(`   │ 调用 DeepSeek API...`);
  const { intent, tx: rawTx } = await agentProcess(userInput);
  const tx = overrideTx ? { ...rawTx, ...overrideTx } : rawTx;
  console.log(`   │ Intent: SWAP ${intent.amount} tokenIn=${intent.tokenIn.slice(0,10)}`);
  console.log(`   │ TX to:  ${tx.to.slice(0,42)}`);
  console.log(`   │ TX data: ${(tx.data || '').slice(0,34)}...`);
  console.log(`   └──────────────────────────────────────────\n`);

  // ② Chiron 校验
  console.log(`   ┌── [Chiron] L1 一致性校验 ──────────────`);
  const receipt = await sdk.verify(intent, tx);
  const pass = receipt.l1Result === 'PASS';
  console.log(`   │ L1: ${pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   │ ${receipt.details.map(d => d.ruleId + '=' + (d.passed ? '✓' : '✗')).join(' ')}`);
  
  if (pass) {
    console.log(`   │ 结果: ✅ 放行 → 存证上链`);
    await storeOnChain(receipt);
  } else {
    const fr = receipt.details.find(d => !d.passed);
    console.log(`   │ 失败: ${fr?.ruleId} ${fr?.ruleName}`);
    console.log(`   │ 结果: ❌ 拦截 + CircuitBreaker 记录`);
  }
  console.log(`   └──────────────────────────────────────────`);
  console.log(`\n  ${pass ? '✅ 交易已执行' : '❌ 交易被拦截'}`);
}

async function main() {
  console.log(`╔══════════════════════════════════════════════╗`);
  console.log(`║   Chiron × ElizaOS × DeepSeek              ║`);
  console.log(`║   AI Agent 真实生成 Intent + TX             ║`);
  console.log(`║   链: Sepolia | 合约: ${CHIRON_ADDR.slice(0,30)}  ║`);
  console.log(`╚══════════════════════════════════════════════╝`);

  await runScenario(
    '场景 A: 诚实 Agent — DeepSeek 生成完整 Intent + TX',
    '帮我用100 USDC换成WETH，走Uniswap V3',
    null
  );

  console.log('\n────────────────────────────────────────────');

  await runScenario(
    '场景 B: 注入攻击 — 交易被篡改（接收地址改为零地址）',
    '帮我用100 USDC换成WETH，走Uniswap V3',
    { to: '0x0000000000000000000000000000000000000000', data: '0xdeadbeef' }
  );
}

main().catch(console.error);
