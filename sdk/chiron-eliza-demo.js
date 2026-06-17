/**
 * Chiron × ElizaOS: 完整 Agent 交易安全演示
 *
 * 框架:    @elizaos/core v1.7.2 (Agent Runtime)
 * 校验:    @chiron/sdk + Sepolia 链上存证
 * 流程:    自然语言 → Intent → 交易 → Chiron 校验 → 放行/拦截
 */
const eliza = require('@elizaos/core');
const { Chiron } = require('./dist/index.js');

const runtime = new eliza.AgentRuntime({ agentId: 'chiron-agent-v1' });
const sdk = new Chiron({ chainId: 1, securityLevel: 'standard' });

// ─── Chiron 拦截器 ───
runtime.on('beforeTransaction', async ({ intent, tx, resolve, reject }) => {
  const receipt = await sdk.verify(intent, tx);
  const pass = receipt.l1Result === 'PASS';
  
  console.log(`   │ L1:      ${pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   │ 规则:    ` + receipt.details.map(d => d.ruleId + '=' + (d.passed ? '✓' : '✗')).join(' '));
  
  if (pass) {
    console.log(`   │ 结果:    ✅ Chiron 放行 → Agent 执行交易`);
    resolve(receipt);
  } else {
    const fr = receipt.details.find(d => !d.passed);
    console.log(`   │ 失败:    ${fr ? fr.ruleId + ' ' + fr.ruleName : '?'}`);
    console.log(`   │ 原因:    ${fr ? fr.actual : receipt.reason}`);
    console.log(`   │ 结果:    ❌ Chiron 拦截 → CircuitBreaker 记录`);
    reject(new Error(`Chiron blocked: ${fr ? fr.ruleId : '?'}`));
  }
  console.log('   └───────────────────────────────────────────────');
});

async function run(userPrompt, scenarioName, tamper) {
  console.log(`\n━━━ ${scenarioName} ━━━\n`);

  // ① 模拟 LLM 处理自然语言
  console.log(`   ┌── [Agent] 接收用户指令 ──────────────────`);
  console.log(`   │ 用户: "${userPrompt}"`);
  console.log(`   │ LLM:  解析语义 → 决策: Uniswap V3 SWAP`);
  console.log(`   │        构造 Intent + Transaction`);
  console.log(`   └───────────────────────────────────────────\n`);

  // ② Agent 生成 Intent（使用 SDK 确保格式正确）
  const intent = await sdk.intent('swap', {
    protocol: 'uniswap_v3',
    tokenIn: tamper?.tokenIn || 'USDC',
    tokenOut: tamper?.tokenOut || 'WETH',
    amount: tamper?.amount || '100',
  });

  // ③ Agent 构造交易（匹配或偏离 Intent）
  const tx = tamper?.tx || {
    to: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    data: '0x414bf3890000000000000000000000000000000000000000000000000000000000000020',
    value: '0',
  };

  console.log(`   │ Intent:  ${intent.actionType === 1 ? 'SWAP' : '?'} ${intent.amount} ${intent.tokenIn.slice(0,10)} → ${intent.tokenOut.slice(0,10)}`);
  console.log(`   │ TX to:   ${(tx.to || '').slice(0,42)}`);
  console.log(`   │ TX data: ${(tx.data || '').slice(0,34)}...\n`);

  // ④ Agent 提交交易 → Chiron 拦截校验
  console.log(`   ┌── [Chiron] 交易前一致性校验 ─────────────`);
  try {
    await new Promise((resolve, reject) => {
      runtime.emit('beforeTransaction', { intent, tx, resolve, reject });
    });
    console.log(`\n  ✅ 交易已执行\n`);
  } catch (e) {
    console.log(`\n  ❌ 交易被拦截: ${e.message}\n`);
  }
}

async function main() {
  console.log(`╔══════════════════════════════════════════════╗`);
  console.log(`║   Chiron × ElizaOS — Agent 交易安全演示    ║`);
  console.log(`║   @elizaos/core v1.7.2                     ║`);
  console.log(`║   @chiron/sdk + Sepolia 链上存证           ║`);
  console.log(`╚══════════════════════════════════════════════╝`);

  // 场景 A: 诚实 Agent ─ Intent == TX
  await run(
    '帮我用 100 USDC 换 WETH，走 Uniswap V3',
    '场景 A: Agent 诚实行事',
    null
  );

  // 场景 B: 注入攻击 ─ 接收地址被篡改
  await run(
    '帮我用 100 USDC 换 WETH，走 Uniswap V3',
    '场景 B: Prompt 注入 → 接收地址被替换',
    { tx: { to: '0x0000000000000000000000000000000000000000', data: '0xdeadbeef', value: '0' } }
  );

  // 场景 C: 金额篡改 ─ Intent 说 100，交易做了更多
  await run(
    '帮我用 100 USDC 换 WETH',
    '场景 C: 数据投毒 → 金额从 100 变为 10000',
    { amount: '10000', tx: { to: '0xE592427A0AEce92De3Edee1F18E0157C05861564', data: '0x414bf3890000000000000000000000000000000000000000000000000000000000000020', value: '0' } }
  );

  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  演示完成                                    ║`);
  console.log(`╠══════════════════════════════════════════════╣`);
  console.log(`║  A: 诚实 → PASS → 放行                     ║`);
  console.log(`║  B: 注入 → FAIL → 拦截+CB                  ║`);
  console.log(`║  C: 投毒 → FAIL → 拦截+CB                  ║`);
  console.log(`╚══════════════════════════════════════════════╝`);
}

main().catch(console.error);
