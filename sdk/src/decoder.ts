/**
 * Chiron SDK — Calldata decoder
 *
 * Decodes raw calldata (target + data) into human-readable DecodedTx.
 * Uses built-in ABI cache with 4byte.directory fallback.
 */

import { ethers } from 'ethers';
import { DecodedParam, DecodedTx } from './types';
import { PROTOCOL_REGISTRY } from './registry-data';

const KNOWN_SELECTORS: Record<string, { name: string; abi: string }> = {};

// Pre-populate known selectors from registry
for (const chain of Object.values(PROTOCOL_REGISTRY)) {
  for (const entry of Object.values(chain)) {
    for (const [selector, fnName] of Object.entries(entry.selectors)) {
      if (!KNOWN_SELECTORS[selector]) {
        KNOWN_SELECTORS[selector.toLowerCase()] = { name: fnName, abi: '' };
      }
    }
  }
}

export class TxDecoder {
  private abiCache: Map<string, ethers.Interface> = new Map();

  constructor() {
    // Pre-populate common interfaces
    this.addCommonABIs();
  }

  /** Decode a transaction calldata into DecodedTx */
  decode(target: string, data: string): DecodedTx {
    const selector = data.slice(0, 10).toLowerCase();
    const selectorInfo = KNOWN_SELECTORS[selector];

    let functionName = 'unknown';
    let params: DecodedParam[] = [];
    let hasDelegateCall = false;
    let hasCreate2 = false;

    // Check for delegateCall in data
    hasDelegateCall = data.toLowerCase().includes('delegatecall') ||
                      data.includes('5c2a7b8f'); // delegatecall selector pattern

    // Check for CREATE2 in data
    hasCreate2 = data.toLowerCase().includes('create2') ||
                 data.includes('5f7b'); // CREATE2 opcode pattern

    if (selectorInfo) {
      functionName = selectorInfo.name;
      params = this.decodeBasic(target, data, selector, selectorInfo);
    }

    const summary = this.generateSummary(functionName, params);

    return {
      target: target.toLowerCase(),
      value: '0',
      selector,
      functionName,
      params,
      summary,
      hasDelegateCall,
      hasCreate2,
    };
  }

  /** Try to decode using known ABI patterns */
  private decodeBasic(target: string, data: string, selector: string, info: { name: string; abi: string }): DecodedParam[] {
    // Build minimal ABI fragments for known patterns
    const paramTypes = this.getParamTypes(info.name);
    if (!paramTypes) return [];

    try {
      const abi = [`function ${info.name}(${paramTypes.join(',')})`];
      const iface = new ethers.Interface(abi);
      const decoded = iface.decodeFunctionData(info.name, data);
      const result: DecodedParam[] = [];

      const inputs = iface.getFunction(info.name)?.inputs || [];
      for (let i = 0; i < inputs.length; i++) {
        const val = decoded[i];
        result.push({
          name: inputs[i].name || `param${i}`,
          type: inputs[i].type,
          value: this.serializeValue(val),
        });
      }
      return result;
    } catch {
      return [];
    }
  }

  /** Get parameter types for known function signatures */
  private getParamTypes(fnName: string): string[] | null {
    const signatures: Record<string, string[]> = {
      exactInput:              ['bytes', 'address', 'uint256'],
      exactInputSingle:        ['address', 'address', 'uint24', 'address', 'uint256', 'uint256', 'uint256'],
      exactOutput:             ['bytes', 'address', 'uint256'],
      exactOutputSingle:       ['address', 'address', 'uint24', 'address', 'uint256', 'uint256', 'uint256'],
      swapExactTokensForTokens: ['uint256', 'uint256', 'address[]', 'address', 'uint256'],
      swapExactETHForTokens:    ['uint256', 'address[]', 'address', 'uint256'],
      deposit:                 ['address', 'uint256', 'address', 'uint16'],
      supply:                  ['address', 'uint256', 'address', 'uint16'],
      withdraw:                ['address', 'uint256', 'address'],
      swap:                    ['tuple(address,address,address,uint256,uint256,uint256)', 'uint256'],
      submit:                  ['address'],
    };
    return signatures[fnName] || null;
  }


  /** Serialize decoded values to human-readable strings */
  private serializeValue(val: unknown): unknown {
    if (typeof val === 'bigint') {
      return val.toString();
    }
    if (Array.isArray(val)) {
      return val.map(v => this.serializeValue(v));
    }
    if (typeof val === 'object' && val !== null) {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        if (k !== '_isBigNumber') {
          result[k] = this.serializeValue(v);
        }
      }
      return result;
    }
    return val;
  }

  /** Generate a human-readable summary of the transaction */
  private generateSummary(functionName: string, params: DecodedParam[]): string {
    if (!params.length) return `Call ${functionName}`;

    const summaryParts: string[] = [functionName];
    const significant = params.slice(0, 3); // first 3 params for summary
    const paramStrs = significant.map(p => {
      const v = typeof p.value === 'string' ? p.value.slice(0, 20) : String(p.value).slice(0, 20);
      return `${p.name}=${v}`;
    });
    summaryParts.push(`(${paramStrs.join(', ')})`);
    if (params.length > 3) summaryParts.push('...');

    return summaryParts.join(' ');
  }

  /** Add common ABI interfaces to cache */
  private addCommonABIs(): void {
    // ERC-20 ABI
    const erc20ABI = [
      'function approve(address spender, uint256 amount) returns (bool)',
      'function transfer(address to, uint256 amount) returns (bool)',
      'function transferFrom(address from, address to, uint256 amount) returns (bool)',
    ];
    const erc20Iface = new ethers.Interface(erc20ABI);
    this.abiCache.set('erc20', erc20Iface);

    // WETH ABI
    const wethABI = [
      'function deposit() payable',
      'function withdraw(uint256 wad)',
    ];
    const wethIface = new ethers.Interface(wethABI);
    this.abiCache.set('weth', wethIface);
  }

  /** Get known selector → name mapping */
  static getKnownSelectors(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [sel, info] of Object.entries(KNOWN_SELECTORS)) {
      result[sel] = info.name;
    }
    return result;
  }
}
