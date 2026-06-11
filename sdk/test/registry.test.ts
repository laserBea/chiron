/**
 * registry.test.ts — 协议注册表测试
 *
 * 测试 ProtocolRegistry 的协议地址查询、Action 类型映射、
 * 大小写容错、跨链支持、selector 匹配和代币信息解析。
 */

import { ProtocolRegistry } from '../src/registry';
import { findProtocolByAddress, getContractAddresses, COMMON_TOKENS } from '../src/registry-data';
import { ActionType } from '../src/types';

/* ───────── ProtocolRegistry 查询功能测试 ───────── */
// 验证通过合约地址查找协议名称、Action 类型的准确性。

describe('ProtocolRegistry', () => {
  const ethRegistry = new ProtocolRegistry(1);  // Ethereum 主网

  // TC-21: Uniswap V3 Router 应匹配到 uniswap_v3（ActionType=SWAP）
  test('findByAddress returns correct protocol for Uniswap V3', () => {
    const entry = ethRegistry.findByAddress('0xE592427A0AEce92De3Edee1F18E0157C05861564');
    expect(entry).not.toBeNull();           // 能找到
    expect(entry!.protocol).toBe('uniswap_v3');   // 协议名正确
    expect(entry!.actionType).toBe(ActionType.SWAP);  // Action 类型正确
  });

  // TC-22: 零地址（未注册合约）应返回 null
  test('findByAddress returns null for unknown address', () => {
    const entry = ethRegistry.findByAddress('0x0000000000000000000000000000000000000000');
    expect(entry).toBeNull();  // 找不到
  });

  // TC-23: 地址查询应大小写不敏感（0xE5... == 0xe5...）
  test('findByAddress is case-insensitive', () => {
    const entry1 = ethRegistry.findByAddress('0xE592427A0AEce92De3Edee1F18E0157C05861564');
    const entry2 = ethRegistry.findByAddress('0xe592427a0aece92de3edee1f18e0157c05861564');
    expect(entry1!.protocol).toBe(entry2!.protocol);  // 大小写不同但结果相同
  });

  // TC-24: getActionType 应为 Uniswap V3 返回 SWAP
  test('getActionType returns SWAP for Uniswap V3', () => {
    const at = ethRegistry.getActionType('0xE592427A0AEce92De3Edee1F18E0157C05861564');
    expect(at).toBe(ActionType.SWAP);
  });

  // TC-25: getProtocolNames 应返回所有在 Ethereum 上注册的协议（≥ 10 个）
  test('getProtocolNames returns all registered protocols for chain 1', () => {
    const names = ethRegistry.getProtocolNames();
    expect(names).toContain('uniswap_v3');
    expect(names).toContain('aave_v3');
    expect(names).toContain('curve');
    expect(names.length).toBeGreaterThanOrEqual(10);  // Ethereum 有 10+ 个协议
  });

  // TC-26: matchSelector 应为已知 selector 返回正确的函数名
  test('matchSelector returns function name for known selector', () => {
    const result = ethRegistry.matchSelector('uniswap_v3', '0x3593564c');  // exactInput
    expect(result).not.toBeNull();
    expect(result!.functionName).toBe('exactInput');
  });
});

/* ───────── 跨链查询边界测试 ───────── */
// 验证不存在的链 ID 能否正确处理。

describe('findProtocolByAddress', () => {
  // TC-27: 不存在的链 ID (999) 应返回 null
  test('returns null for empty chain registry', () => {
    const result = findProtocolByAddress(999, '0x1234');
    expect(result).toBeNull();
  });
});

/* ───────── 合约地址列表测试 ───────── */
// 验证 getContractAddresses 是否能正确返回某链上的所有合约地址。

describe('getContractAddresses', () => {
  // TC-28: Ethereum 链应返回 10+ 个合约地址
  test('returns array of addresses for chain 1', () => {
    const addrs = getContractAddresses(1);
    expect(addrs.length).toBeGreaterThan(10);
    expect(addrs.map(a => a.toLowerCase())).toContain(
      "0xE592427A0AEce92De3Edee1F18E0157C05861564".toLowerCase()
    );
  });
});

/* ───────── 代币信息测试 ───────── */
// 验证 COMMON_TOKENS 中预置的代币地址和小数位是否正确。

describe('COMMON_TOKENS', () => {
  // TC-29: Ethereum 上有 ETH/USDC/USDT/DAI/WBTC 五种代币
  test('Ethereum has ETH, USDC, USDT, DAI, WBTC', () => {
    const tokens = COMMON_TOKENS[1];
    expect(tokens['ETH']).toBeDefined();
    expect(tokens['USDC']).toBeDefined();
    expect(tokens['USDT']).toBeDefined();
    expect(tokens['DAI']).toBeDefined();
    expect(tokens['WBTC']).toBeDefined();
  });

  // TC-30: USDC 的小数位是 6
  test('USDC has 6 decimals', () => {
    expect(COMMON_TOKENS[1]['USDC'].decimals).toBe(6);
  });

  // TC-31: ETH 的小数位是 18
  test('ETH has 18 decimals', () => {
    expect(COMMON_TOKENS[1]['ETH'].decimals).toBe(18);
  });
});
