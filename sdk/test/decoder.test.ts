/**
 * decoder.test.ts — Calldata 解码器测试
 *
 * 测试 TxDecoder 能否正确解码已知/未知函数签名的 calldata，
 * 检测隐藏的 delegatecall 和 CREATE2 调用。
 */

import { TxDecoder } from '../src/decoder';

/* ───────── TxDecoder 基础功能测试 ───────── */
// 验证解码器能否提取 selector、函数名、目标合约地址，
// 以及对恶意操作码的检测能力。

describe('TxDecoder', () => {
  const decoder = new TxDecoder();

  // TC-10: 已知 selector (0x414bf389 = exactInputSingle) 应正确解码
  //        验证 selector、函数名、目标地址均正确提取
  test('decode() extracts selector and function name for known selector', () => {
    const decoded = decoder.decode(
      '0xE592427A0AEce92De3Edee1F18E0157C05861564',  // Uniswap V3 Router
      '0x414bf3890000000000000000000000000000000000000000000000000000000000000020'
    );
    expect(decoded.selector).toBe('0x414bf389');       // exactInputSingle
    expect(decoded.functionName).toBeTruthy();          // 函数名已解析
    expect(decoded.target).toBe('0xe592427a0aece92de3edee1f18e0157c05861564'); // 转小写
  });

  // TC-11: calldata 中包含 delegatecall 关键词应被检测到
  test('decode() detects delegatecall in data', () => {
    const decoded = decoder.decode(
      '0x1234567890123456789012345678901234567890',
      '0x12345678deadbeefdelegatecall'
    );
    expect(decoded.hasDelegateCall).toBe(true);  // delegatecall 已标记
  });

  // TC-12: calldata 中包含 CREATE2 关键词应被检测到
  test('decode() detects CREATE2 in data', () => {
    const decoded = decoder.decode(
      '0x1234567890123456789012345678901234567890',
      '0x12345678create2pattern'
    );
    expect(decoded.hasCreate2).toBe(true);  // CREATE2 已标记
  });

  // TC-13: 未知 selector 应优雅降级（返回 unknown）
  test('decode() handles unknown selector gracefully', () => {
    const decoded = decoder.decode(
      '0x1234567890123456789012345678901234567890',
      '0xdeadbeef0000000000000000000000000000000000000000000000000000000000000020'
    );
    expect(decoded.functionName).toBe('unknown');  // 未识别的 selector
  });
});

/* ───────── 已知 Selector 静态查询测试 ───────── */
// 验证 getKnownSelectors 能否正确返回内置的 selector → 函数名映射表。

describe('TxDecoder static methods', () => {
  // TC-14: 验证已知 selector 映射表非空且包含正确条目
  test('getKnownSelectors returns selector map', () => {
    const selectors = TxDecoder.getKnownSelectors();
    expect(Object.keys(selectors).length).toBeGreaterThan(0);      // 有已知条目
    expect(selectors['0x414bf389']).toBe('exactInputSingle');       // exactInputSingle
  });
});
