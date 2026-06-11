import { ActionType, ACTION_NAMES, ACTION_FROM_NAME, UnknownActionError, ValidationError } from '../src/types';
import { ProtocolRegistry } from '../src/registry';
import { IntentParser } from '../src/intent';

describe('ActionType', () => {
  test('has 9 action types', () => {
    const count = Object.keys(ActionType).filter(k => isNaN(Number(k))).length;
    expect(count).toBe(9);
  });

  test('ACTION_NAMES maps all types correctly', () => {
    expect(ACTION_NAMES[ActionType.SWAP]).toBe('swap');
    expect(ACTION_NAMES[ActionType.APPROVE]).toBe('approve');
    expect(ACTION_NAMES[ActionType.BRIDGE]).toBe('bridge');
    expect(ACTION_NAMES[ActionType.DEPOSIT]).toBe('deposit');
    expect(ACTION_NAMES[ActionType.WITHDRAW]).toBe('withdraw');
    expect(ACTION_NAMES[ActionType.STAKE]).toBe('stake');
    expect(ACTION_NAMES[ActionType.VOTE]).toBe('vote');
    expect(ACTION_NAMES[ActionType.PERMIT]).toBe('permit');
    expect(ACTION_NAMES[ActionType.CUSTOM]).toBe('custom');
  });

  test('ACTION_FROM_NAME reverse maps correctly', () => {
    expect(ACTION_FROM_NAME['swap']).toBe(ActionType.SWAP);
    expect(ACTION_FROM_NAME['approve']).toBe(ActionType.APPROVE);
    expect(ACTION_FROM_NAME['custom']).toBe(ActionType.CUSTOM);
    expect(ACTION_FROM_NAME['invalid']).toBeUndefined();
  });
});

describe('IntentParser', () => {
  const registry = new ProtocolRegistry(1);
  const parser = new IntentParser(registry);

  test('create() throws UnknownActionError for invalid action', async () => {
    await expect(parser.create('invalid_action', {})).rejects.toThrow(UnknownActionError);
  });

  test('create() throws ValidationError for missing protocol', async () => {
    await expect(parser.create('swap', {})).rejects.toThrow(ValidationError);
  });

  test('create() generates valid IntentTemplate for swap', async () => {
    const intent = await parser.create('swap', {
      protocol: 'uniswap_v3',
      tokenIn: 'USDC',
      tokenOut: 'WETH',
      amount: '100',
    });
    expect(intent.actionType).toBe(ActionType.SWAP);
    expect(intent.protocolHash).toBeTruthy();
    expect(intent.amount).toBe('100');
    expect(intent.deadline).toBeGreaterThan(0);
  });

  test('create() generates valid IntentTemplate for approve', async () => {
    const intent = await parser.create('approve', {
      protocol: 'erc20',
      token: 'USDC',
      spender: '0x1234567890123456789012345678901234567890',
      amount: '1000',
    });
    expect(intent.actionType).toBe(ActionType.APPROVE);
  });

  test('hash() returns deterministic results', async () => {
    const intent = await parser.create('swap', {
      protocol: 'uniswap_v3',
      tokenIn: 'USDC',
      tokenOut: 'WETH',
      amount: '100',
    });
    const hash1 = parser.hash(intent);
    const hash2 = parser.hash(intent);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^0x[a-f0-9]{64}$/);
  });

  test('hash() returns different hashes for different intents', async () => {
    const intent1 = await parser.create('swap', { protocol: 'uniswap_v3', amount: '100' });
    const intent2 = await parser.create('swap', { protocol: 'uniswap_v3', amount: '200' });
    const hash1 = parser.hash(intent1);
    const hash2 = parser.hash(intent2);
    expect(hash1).not.toBe(hash2);
  });
});
