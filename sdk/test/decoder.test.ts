import { TxDecoder } from '../src/decoder';

describe('TxDecoder', () => {
  const decoder = new TxDecoder();

  test('decode() extracts selector and function name for known selector', () => {
    // Uniswap V3 exactInputSingle
    const decoded = decoder.decode(
      '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      '0x414bf3890000000000000000000000000000000000000000000000000000000000000020'
    );
    expect(decoded.selector).toBe('0x414bf389');
    expect(decoded.functionName).toBeTruthy();
    expect(decoded.target).toBe('0xe592427a0aece92de3edee1f18e0157c05861564');
  });

  test('decode() detects delegatecall in data', () => {
    const decoded = decoder.decode(
      '0x1234567890123456789012345678901234567890',
      '0x12345678deadbeefdelegatecall'
    );
    expect(decoded.hasDelegateCall).toBe(true);
  });

  test('decode() detects CREATE2 in data', () => {
    const decoded = decoder.decode(
      '0x1234567890123456789012345678901234567890',
      '0x12345678create2pattern'
    );
    expect(decoded.hasCreate2).toBe(true);
  });

  test('decode() handles unknown selector gracefully', () => {
    const decoded = decoder.decode(
      '0x1234567890123456789012345678901234567890',
      '0xdeadbeef0000000000000000000000000000000000000000000000000000000000000020'
    );
    expect(decoded.functionName).toBe('unknown');
  });
});

describe('TxDecoder static methods', () => {
  test('getKnownSelectors returns selector map', () => {
    const selectors = TxDecoder.getKnownSelectors();
    expect(Object.keys(selectors).length).toBeGreaterThan(0);
    expect(selectors['0x414bf389']).toBe('exactInputSingle');
  });
});
