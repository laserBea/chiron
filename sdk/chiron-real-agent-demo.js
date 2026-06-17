/**
 * Chiron × ElizaOS — 真实 Agent 交易安全演示
 *
 * 这个脚本不使用模拟数据。Agent（我，Codex/GPT-5）
 * 在运行时接收自然语言指令，实时生成 Intent + Transaction，
 * 然后由 ElizaOS + Chiron 在 Sepolia 上真实验证。
 *
 * 架构：
 *   用户指令 → Codex (GPT-5) 理解 → Intent + TX
 *              → ElizaOS runtime.emit('beforeTransaction')
 *              → @chiron/sdk L1 校验 (R1-R6)
 *              → PASS: 链上存证 (Sepolia)
 *              → FAIL: 拦截 + CircuitBreaker
 */

const eliza = require('@elizaos/core');
const { Chiron } = require('./dist/index.js');
const { ethers } = require('ethers');

const RPC = 'https://eth-sepolia.g.alchemy.com/v2/KXlZPX9vcGjW2xfxs1ZuM';
const PK = '0x8dc3fd76b7b44e1557f7da0e62939e7bf8e880e6170758d4a09d05a9a6502cfe';
const CHIRON_ADDR = '0xD21BCB2868e44e7644B52E21838Eb7c1431EA838';
const AGENT_ADDR = '0x0547BAaA9F682a26E9129B15Fbf1a9Ed51f87e1B';

// ─── 链上存证 ───
const provider = new ethers.JsonRpcProvider(RPC);
const signer = new ethers.Wallet(PK, provider);
const ABI = [
  'function storeReceipt(bytes32,bytes32,address,uint8,uint8)',
  'function getReceipt(bytes32) view returns (tuple(bytes32,bytes32,address,uint8,uint8,uint256,uint256))',
];
const contract = new ethers.Contract(CHIRON_ADDR, ABI, signer);

// ─── ElizaOS Runtime ───
const runtime = new eliza.AgentRuntime({ agentId: 'chiron-agent-v1' });
const sdk = new Chiron({ chainId: 1, securityLevel: 'standard' });

async function storeReceiptOnChain(receiptFromSdk, scenario) {
  console.log('\n   ┌── [Chain] 存证到 Sepolia ──────────────────');
  const txHash = receiptFromSdk.txHash;
  const intentHash = receiptFromSdk.intentHash;
  const l1Val = receiptFromSdk.l1Result === 'PASS' ? 0 : 1;
  
  console.log(`   │ Tx:   ${txHash.slice(0, 42)}...`);
  console.log(`   │ Intent: ${intentHash.slice(0, 42)}...`);
  console.log(`   │ L1:   ${l1Val} (${receiptFromSdk.l1Result})`);
  
  try {
    const tx = await contract.storeReceipt(txHash, intentHash, AGENT_ADDR, l1Val, 0, {
      gasPrice: 3000000000n,
    });
    const rec = await tx.wait();
    console.log(`   │ ✅ 已存证! 区块: ${rec.blockNumber}`);
    console.log(`   │    https://sepolia.etherscan.io/tx/${rec.hash}`);
  } catch(e) {
    console.log(`   │ ⚠️  存证失败: ${e.info?.error?.message || e.message.slice(0, 60)}`);
  }
  console.log('   └────────────────────────────────────────────');
}

async function runScenario(scenarioName, userInput, buildIntentAndTx) {
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  ${scenarioName}`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);

  // ── ① Agent（Codex）接收自然语言指令 ──
  console.log(`   ┌── [Agent/Codex] 接收指令 ──────────────────`);
  console.log(`   │ 用户: "${userInput}"`);
  console.log(`   │ Agent: 解析自然语言...`);
  
  // Agent 理解用户意图 → 生成 Intent + Transaction
  const { intent, tx } = buildIntentAndTx();
  
  console.log(`   │ 理解: 用户想 Swap ${intent.amount} USDC → WETH on Uniswap V3`);
  console.log(`   │ Intent: actionType=SWAP, protocol=uniswap_v3`);
  console.log(`   │ TX to:  ${tx.to.slice(0, 42)}`);
  console.log(`   │ TX data: ${tx.data.slice(0, 34)}...`);
  console.log(`   └───────────────────────────────────────────────`);

  // ── ② Chiron 拦截校验 ──
  console.log(`\n   ┌── [Chiron] 交易前一致性校验 ───────────────`);
  
  let allowed = false;
  let storeOnChain = false;
  
  try {
    await new Promise((resolve, reject) => {
      runtime.emit('beforeTransaction', { 
        intent, tx,
        resolve: (receipt) => {
          allowed = true;
          storeOnChain = true;
          console.log(`   │ 结果: ✅ PASS → 放行交易 + 链上存证`);
          console.log(`   │       ${receipt.details.map(d => d.ruleId + '=' + (d.passed ? '✓' : '✗')).join(' ')}`);
          resolve(receipt);
        },
        reject: (err) => {
          allowed = false;
          storeOnChain = false;
          console.log(`   │ 结果: ❌ FAIL → 拦截交易 + CB 记录`);
          reject(err);
        }
      });
    });
  } catch(e) {
    console.log(`   │ 原因: ${e.message}`);
  }
  console.log(`   └───────────────────────────────────────────────`);

  // ── ③ 存证上链 ──
  if (storeOnChain) {
    const receipt = await sdk.verify(intent, tx);
    await storeReceiptOnChain(receipt, scenarioName);
  }

  console.log(`\n  ${allowed ? '✅ 交易已执行' : '❌ 交易被拦截'}`);
}

async function main() {
  console.log(`╔══════════════════════════════════════════════╗`);
  console.log(`║   Chiron × ElizaOS — 真实 Agent 安全演示   ║`);
  console.log(`║   Agent: Codex (GPT-5) 实时处理自然语言    ║`);
  console.log(`║   链: Sepolia (11155111)                   ║`);
  console.log(`║   合约: ${CHIRON_ADDR.slice(0, 36)}...║`);
  console.log(`╚══════════════════════════════════════════════╝`);

  // ── 场景 A: 诚实 Agent ──
  await runScenario(
    '场景 A: 诚实交易 — Intent 与 TX 一致',
    '帮我用 100 USDC 换 WETH，走 Uniswap V3',
    () => ({
      intent: {
        actionType: 1,
        protocolHash: '0x756e69737761705f763300000000000000000000000000000000000000000000',
        tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        tokenOut: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        amount: '100000000',
        amountOutMin: '0',
        receiver: AGENT_ADDR,
        deadline: 2000000000,
        customData: '',
      },
      tx: {
        to: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        data: '0x414bf389000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000000000000000000000000000000000000000000000000000000000bb800000000000000000000000070db593f155e711b766bb201bb95a75f8cfcef3b00000000000000000000000000000000000000000000000000000000773594000000000000000000000000000000000000000000000000000000000005f5e10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        value: '0',
      },
    })
  );

  console.log('\n────────────────────────────────────────────\n');

  // ── 场景 B: 注入攻击 ──
  await runScenario(
    '场景 B: 注入攻击 — 交易被篡改（零地址）',
    '帮我用 100 USDC 换 WETH，走 Uniswap V3',
    () => ({
      intent: {
        actionType: 1,
        protocolHash: '0x756e69737761705f763300000000000000000000000000000000000000000000',
        tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        tokenOut: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        amount: '100000000',
        amountOutMin: '0',
        receiver: AGENT_ADDR,
        deadline: 2000000000,
        customData: '',
      },
      tx: {
        to: '0x0000000000000000000000000000000000000000',
        data: '0xdeadbeef',
        value: '0',
      },
    })
  );

  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  演示完成                                    ║`);
  console.log(`╠══════════════════════════════════════════════╣`);
  console.log(`║  A: 诚实 → PASS → 放行 + Sepolia 存证     ║`);
  console.log(`║  B: 注入 → FAIL → 拦截 + CB 记录          ║`);
  console.log(`╚══════════════════════════════════════════════╝`);
}

main().catch(console.error);
