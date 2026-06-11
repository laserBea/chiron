import { ProtocolRegistry } from '../src/registry';
import { findProtocolByAddress, getContractAddresses, COMMON_TOKENS } from '../src/registry-data';
import { ActionType } from '../src/types';

describe('ProtocolRegistry', () => {
  const ethRegistry = new ProtocolRegistry(1);

  test('findByAddress returns correct protocol for Uniswap V3', () => {
    const entry = ethRegistry.findByAddress('0xE592427A0AEce92De3Edee1F18E0157C05861564');
    expect(entry).not.toBeNull();
    expect(entry!.protocol).toBe('uniswap_v3');
    expect(entry!.actionType).toBe(ActionType.SWAP);
  });

  test('findByAddress returns null for unknown address', () => {
    const entry = ethRegistry.findByAddress('0x0000000000000000000000000000000000000000');
    expect(entry).toBeNull();
  });

  test('findByAddress is case-insensitive', () => {
    const entry1 = ethRegistry.findByAddress('0xE592427A0AEce92De3Edee1F18E0157C05861564');
    const entry2 = ethRegistry.findByAddress('0xe592427a0aece92de3edee1f18e0157c05861564');
    expect(entry1!.protocol).toBe(entry2!.protocol);
  });

  test('getActionType returns SWAP for Uniswap V3', () => {
    const at = ethRegistry.getActionType('0xE592427A0AEce92De3Edee1F18E0157C05861564');
    expect(at).toBe(ActionType.SWAP);
  });

  test('getProtocolNames returns all registered protocols for chain 1', () => {
    const names = ethRegistry.getProtocolNames();
    expect(names).toContain('uniswap_v3');
    expect(names).toContain('aave_v3');
    expect(names).toContain('curve');
    expect(names.length).toBeGreaterThanOrEqual(10);
  });

  test('matchSelector returns function name for known selector', () => {
    const result = ethRegistry.matchSelector('uniswap_v3', '0x3593564c');
    expect(result).not.toBeNull();
    expect(result!.functionName).toBe('exactInput');
  });
});

describe('findProtocolByAddress', () => {
  test('returns null for empty chain registry', () => {
    const result = findProtocolByAddress(999, '0x1234');
    expect(result).toBeNull();
  });
});

describe('getContractAddresses', () => {
  test('returns array of addresses for chain 1', () => {
    const addrs = getContractAddresses(1);
    expect(addrs.length).toBeGreaterThan(10);
    expect(addrs.map(a => a.toLowerCase())).toContain("0xE592427A0AEce92De3Edee1F18E0157C05861564".toLowerCase());
  });
});

describe('COMMON_TOKENS', () => {
  test('Ethereum has ETH, USDC, USDT, DAI, WBTC', () => {
    const tokens = COMMON_TOKENS[1];
    expect(tokens['ETH']).toBeDefined();
    expect(tokens['USDC']).toBeDefined();
    expect(tokens['USDT']).toBeDefined();
    expect(tokens['DAI']).toBeDefined();
    expect(tokens['WBTC']).toBeDefined();
  });

  test('USDC has 6 decimals', () => {
    expect(COMMON_TOKENS[1]['USDC'].decimals).toBe(6);
  });

  test('ETH has 18 decimals', () => {
    expect(COMMON_TOKENS[1]['ETH'].decimals).toBe(18);
  });
});
