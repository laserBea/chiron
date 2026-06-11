import { ProtocolRegistry } from '../src/registry';
import { ConsistencyChecker } from '../src/checker';
import { ActionType } from '../src/types';

describe('ConsistencyChecker', () => {
  const registry = new ProtocolRegistry(1);
  const checker = new ConsistencyChecker(registry);

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

  test('check() passes for matching intent and tx', () => {
    const result = checker.check(swapIntent, {
      to: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      data: '0x414bf3890000000000000000000000000000000000000000000000000000000000000020',
      value: '0',
    });
    expect(result.l1Result).toBe('PASS');
    expect(result.details).toHaveLength(6);
  });

  test('check() fails for non-matching target contract', () => {
    const result = checker.check(swapIntent, {
      to: '0x0000000000000000000000000000000000000000',
      data: '0x414bf3890000000000000000000000000000000000000000000000000000000000000020',
      value: '0',
    });
    expect(result.l1Result).toBe('FAIL');
    expect(result.details[0].ruleId).toBe('R1');
    expect(result.details[0].severity).toBe('error');
  });

  test('check() detects approve action mismatch', () => {
    const approveIntent = { ...swapIntent, actionType: ActionType.APPROVE };
    const result = checker.check(approveIntent, {
      to: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      data: '0x414bf3890000000000000000000000000000000000000000000000000000000000000020',
      value: '0',
    });
    expect(result.l1Result).toBe('FAIL');
    expect(result.details[1].ruleId).toBe('R2');
  });

  test('check() returns ERROR details for failed checks', () => {
    const result = checker.check(swapIntent, {
      to: '0x0000000000000000000000000000000000000000',
      data: '0xdeadbeef0000000000000000000000000000000000000000000000000000000000000020',
      value: '0',
    });
    const errors = result.details.filter(d => d.severity === 'error');
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  test('check() runs all 6 rules', () => {
    const result = checker.check(swapIntent, {
      to: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      data: '0x414bf3890000000000000000000000000000000000000000000000000000000000000020',
      value: '0',
    });
    const ruleIds = result.details.map(d => d.ruleId);
    expect(ruleIds).toEqual(['R1', 'R2', 'R3', 'R4', 'R5', 'R6']);
  });
});

describe('ConsistencyChecker — R4 amount check', () => {
  const registry = new ProtocolRegistry(1);
  const checker = new ConsistencyChecker(registry);

  test('amount within slippage passes', () => {
    const intent = {
      actionType: ActionType.SWAP,
      protocolHash: '',
      tokenIn: '',
      tokenOut: '',
      amount: '100000000',
      amountOutMin: '0',
      receiver: '',
      deadline: 2000000000,
      customData: '',
    };
    const result = checker.check(intent, {
      to: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      data: '0x414bf389',
      value: '0',
    });
    // R4 should pass when no specific amount is in the tx
    const r4 = result.details.find(d => d.ruleId === 'R4');
    expect(r4?.severity).toBe('info');
  });
});
