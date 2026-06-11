/**
 * Chiron SDK — Protocol registry and token resolver
 */

import {
  ActionType,
  IntentParams,
  ProtocolEntry,
  TokenInfo,
  TokenResolver,
} from './types';
import {
  PROTOCOL_REGISTRY,
  COMMON_TOKENS,
  findProtocolByAddress,
} from './registry-data';

export class ProtocolRegistry {
  private chainId: number;
  private customResolver?: TokenResolver;

  constructor(chainId: number, customResolver?: TokenResolver) {
    this.chainId = chainId;
    this.customResolver = customResolver;
  }

  /** Find protocol entry by contract address */
  findByAddress(address: string): ProtocolEntry | null {
    return findProtocolByAddress(this.chainId, address);
  }

  /** Get action type for a contract address */
  getActionType(address: string): ActionType | null {
    const entry = this.findByAddress(address);
    return entry ? entry.actionType : null;
  }

  /** Check if a selector matches the expected action */
  matchSelector(protocol: string, selector: string): { functionName: string } | null {
    const chain = PROTOCOL_REGISTRY[this.chainId];
    if (!chain) return null;
    const entry = chain[protocol];
    if (!entry) return null;
    const s = selector.toLowerCase();
    const fn = entry.selectors[s];
    if (fn) return { functionName: fn };
    return null;
  }

  /** Resolve a token symbol to its info */
  async resolveToken(symbol: string): Promise<TokenInfo | null> {
    // Check built-in registry
    const chainTokens = COMMON_TOKENS[this.chainId];
    if (chainTokens && chainTokens[symbol]) {
      const t = chainTokens[symbol];
      return { address: t.address, symbol, decimals: t.decimals, chainId: this.chainId };
    }

    // Try custom resolver
    if (this.customResolver) {
      return this.customResolver.resolve(symbol, this.chainId);
    }

    return null;
  }

  /** Resolve a token from address to info (lookup by address) */
  resolveTokenFromAddress(address: string): TokenInfo | null {
    const addr = address.toLowerCase();
    const chainTokens = COMMON_TOKENS[this.chainId];
    if (!chainTokens) return null;
    for (const [symbol, info] of Object.entries(chainTokens)) {
      if (info.address.toLowerCase() === addr) {
        return { address: info.address, symbol, decimals: info.decimals, chainId: this.chainId };
      }
    }
    return null;
  }

  /** Get all registered protocol names */
  getProtocolNames(): string[] {
    const chain = PROTOCOL_REGISTRY[this.chainId];
    return chain ? Object.keys(chain) : [];
  }

  /** Convert amount from human-readable to wei (with decimals) */
  toWei(amount: string, decimals: number): string {
    const [int, frac = ''] = amount.split('.');
    const padded = frac.padEnd(decimals, '0').slice(0, decimals);
    return int + padded;
  }
}
