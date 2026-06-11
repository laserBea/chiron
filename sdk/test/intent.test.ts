/**
 * intent.test.ts — IntentTemplate 生成器测试
 *
 * 测试 IntentParser 是否能正确生成各种 Action 类型的意图模板，
 * 验证字段完整性、异常处理和 hash 确定性。
 */

import { ActionType, ACTION_NAMES, ACTION_FROM_NAME, UnknownActionError, ValidationError } from '../src/types';
import { ProtocolRegistry } from '../src/registry';
import { IntentParser } from '../src/intent';

/* ───────── ActionType 枚举测试 ───────── */
// 验证 ActionType 枚举定义是否完整（9 种类型）、
// 名称映射表 ACTION_NAMES 是否正确、反向映射 ACTION_FROM_NAME 是否准确。

describe('ActionType', () => {
  // TC-01: 验证 ActionType 枚举有且仅有 9 个成员
  test('has 9 action types', () => {
    const count = Object.keys(ActionType).filter(k => isNaN(Number(k))).length;
    expect(count).toBe(9);
  });

  // TC-02: 验证 ACTION_NAMES 映射表覆盖所有 9 种 Action
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

  // TC-03: 验证 ACTION_FROM_NAME 反向映射的正确性
  test('ACTION_FROM_NAME reverse maps correctly', () => {
    expect(ACTION_FROM_NAME['swap']).toBe(ActionType.SWAP);
    expect(ACTION_FROM_NAME['approve']).toBe(ActionType.APPROVE);
    expect(ACTION_FROM_NAME['custom']).toBe(ActionType.CUSTOM);
    expect(ACTION_FROM_NAME['invalid']).toBeUndefined(); // 非法名称返回 undefined
  });
});

/* ───────── IntentParser 功能测试 ───────── */
// 验证 IntentParser.create() 能否正确生成各 Action 的 IntentTemplate，
// 参数校验是否严格，hash 是否确定性和唯一性。

describe('IntentParser', () => {
  const registry = new ProtocolRegistry(1);  // Ethereum 主网
  const parser = new IntentParser(registry);

  // TC-04: 非法 Action 名称应抛出 UnknownActionError
  test('create() throws UnknownActionError for invalid action', async () => {
    await expect(parser.create('invalid_action', {})).rejects.toThrow(UnknownActionError);
  });

  // TC-05: 缺少必填字段(protocol)应抛出 ValidationError
  test('create() throws ValidationError for missing protocol', async () => {
    await expect(parser.create('swap', {})).rejects.toThrow(ValidationError);
  });

  // TC-06: Swap 意图应正确生成（ActionType=SWAP, amount 自动转为 wei）
  test('create() generates valid IntentTemplate for swap', async () => {
    const intent = await parser.create('swap', {
      protocol: 'uniswap_v3',
      tokenIn: 'USDC',
      tokenOut: 'WETH',
      amount: '100',              // 100 USDC
    });
    expect(intent.actionType).toBe(ActionType.SWAP);
    expect(intent.protocolHash).toBeTruthy();           // protocolHash 非空
    expect(intent.amount).toBe('100000000');            // USDC 6 decimals: "100" → "100000000"
    expect(intent.deadline).toBeGreaterThan(0);         // 默认 deadline 在当前时间之后
  });

  // TC-07: Approve 意图应正确生成
  test('create() generates valid IntentTemplate for approve', async () => {
    const intent = await parser.create('approve', {
      protocol: 'erc20',
      token: 'USDC',
      spender: '0x1234567890123456789012345678901234567890',
      amount: '1000',
    });
    expect(intent.actionType).toBe(ActionType.APPROVE);
  });

  // TC-08: 相同 IntentTemplate 应产出相同 hash（确定性）
  test('hash() returns deterministic results', async () => {
    const intent = await parser.create('swap', {
      protocol: 'uniswap_v3',
      tokenIn: 'USDC',
      tokenOut: 'WETH',
      amount: '100',
    });
    const hash1 = parser.hash(intent);
    const hash2 = parser.hash(intent);
    expect(hash1).toBe(hash2);                                  // 两次 hash 相同
    expect(hash1).toMatch(/^0x[a-f0-9]{64}$/);                  // 格式是 0x + 64 hex chars
  });

  // TC-09: 不同 IntentTemplate 产出不同 hash（唯一性）
  test('hash() returns different hashes for different intents', async () => {
    const intent1 = await parser.create('swap', { protocol: 'uniswap_v3', amount: '100' });
    const intent2 = await parser.create('swap', { protocol: 'uniswap_v3', amount: '200' });
    const hash1 = parser.hash(intent1);
    const hash2 = parser.hash(intent2);
    expect(hash1).not.toBe(hash2);  // 金额不同 → hash 不同
  });
});
