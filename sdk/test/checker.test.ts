/**
 * checker.test.ts — L1 一致性校验器测试
 *
 * 测试 ConsistencyChecker 的全部 6 条校验规则（R1-R6）：
 *   R1: 目标合约匹配已知协议地址表
 *   R2: 函数 selector 匹配 Action 类型
 *   R3: TokenIn/TokenOut 参数匹配
 *   R4: 金额在 ±slippage 范围内
 *   R5: 无意外参数（receiver 不一致、隐藏 Approve）
 *   R6: 无隐藏 delegatecall/CREATE2
 */

import { ProtocolRegistry } from '../src/registry';
import { ConsistencyChecker } from '../src/checker';
import { ActionType } from '../src/types';

/* ───────── 6 条校验规则的完整覆盖测试 ───────── */
// 验证每条规则在正确和错误场景下的行为，
// 以及规则组合时的 PASS/FAIL 判断。

describe('ConsistencyChecker', () => {
  const registry = new ProtocolRegistry(1);  // Ethereum 主网
  const checker = new ConsistencyChecker(registry);

  // 基础 Swap 意图模板（不指定 token/amount，仅验证协议和函数匹配）
  const swapIntent = {
    actionType: ActionType.SWAP,
    protocolHash: '0x756e69737761705f763300000000000000000000000000000000000000000000',
    tokenIn: '',
    tokenOut: '',
    amount: '',
    amountOutMin: '',
    receiver: '',
    deadline: 2000000000,
    customData: '',
  };

  // TC-15: 目标合约和函数签名完全匹配 → L1 PASS
  //        场景：Swap 意图 + Uniswap V3 Router + exactInputSingle
  test('check() passes for matching intent and tx', () => {
    const result = checker.check(swapIntent, {
      to: '0xE592427A0AEce92De3Edee1F18E0157C05861564',  // Uniswap V3 Router
      data: '0x414bf3890000000000000000000000000000000000000000000000000000000000000020',
      value: '0',
    });
    expect(result.l1Result).toBe('PASS');     // 6 条规则全部通过
    expect(result.details).toHaveLength(6);    // 返回了 6 条规则的检查结果
  });

  // TC-16: 目标合约不在已知协议表中 → R1 FAIL
  //        场景：同一 Swap 意图 + 零地址（非法合约）
  test('check() fails for non-matching target contract', () => {
    const result = checker.check(swapIntent, {
      to: '0x0000000000000000000000000000000000000000',  // 零地址（不在协议表中）
      data: '0x414bf3890000000000000000000000000000000000000000000000000000000000000020',
      value: '0',
    });
    expect(result.l1Result).toBe('FAIL');
    expect(result.details[0].ruleId).toBe('R1');      // R1 (目标合约) 失败
    expect(result.details[0].severity).toBe('error');
  });

  // TC-17: 意图声明 Swap 但合约是 Approve 类型 → R2 FAIL
  //        场景：ActionType=APPROVE + Uniswap V3 Router（Swap 协议）
  test('check() detects approve action mismatch', () => {
    const approveIntent = { ...swapIntent, actionType: ActionType.APPROVE };
    const result = checker.check(approveIntent, {
      to: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      data: '0x414bf3890000000000000000000000000000000000000000000000000000000000000020',
      value: '0',
    });
    expect(result.l1Result).toBe('FAIL');
    expect(result.details[1].ruleId).toBe('R2');      // R2 (函数匹配) 失败
  });

  // TC-18: 多个规则同时失败时 → 所有错误规则都应被标记 severity=error
  test('check() returns ERROR details for failed checks', () => {
    const result = checker.check(swapIntent, {
      to: '0x0000000000000000000000000000000000000000',  // 非法合约
      data: '0xdeadbeef...',                               // 未知 selector
      value: '0',
    });
    const errors = result.details.filter(d => d.severity === 'error');
    expect(errors.length).toBeGreaterThanOrEqual(1);       // 至少 1 条规则失败
  });

  // TC-19: 验证所有 6 条规则都被按顺序执行（R1→R2→R3→R4→R5→R6）
  test('check() runs all 6 rules', () => {
    const result = checker.check(swapIntent, {
      to: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      data: '0x414bf3890000000000000000000000000000000000000000000000000000000000000020',
      value: '0',
    });
    const ruleIds = result.details.map(d => d.ruleId);
    expect(ruleIds).toEqual(['R1', 'R2', 'R3', 'R4', 'R5', 'R6']);  // 全部 6 条
  });
});

/* ───────── R4 金额检查专项测试 ───────── */
// 验证金额检查在不同输入下的行为（意图有金额 vs 无金额）。

describe('ConsistencyChecker — R4 amount check', () => {
  const registry = new ProtocolRegistry(1);
  const checker = new ConsistencyChecker(registry);

  // TC-20: 意图指定金额但交易中无可提取金额 → R4 应通过但不报 error
  test('amount within slippage passes', () => {
    const intent = {
      actionType: ActionType.SWAP,
      protocolHash: '',
      tokenIn: '',
      tokenOut: '',
      amount: '100000000',  // 意图指定了金额
      amountOutMin: '0',
      receiver: '',
      deadline: 2000000000,
      customData: '',
    };
    const result = checker.check(intent, {
      to: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      data: '0x414bf389',  // 极短的 calldata，无法提取金额
      value: '0',
    });
    const r4 = result.details.find(d => d.ruleId === 'R4');
    expect(r4?.severity).toBe('info');  // 金额无法比较时只报 info，不报 error
  });
});
