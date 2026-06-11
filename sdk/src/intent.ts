/**
 * Chiron SDK — IntentTemplate generator
 */
import { ethers } from "ethers";


import {
  ActionType,
  ACTION_FROM_NAME,
  IntentParams,
  IntentTemplate,
  UnknownActionError,
  ValidationError,
} from './types';
import { ProtocolRegistry } from './registry';

export class IntentParser {
  private registry: ProtocolRegistry;

  constructor(registry: ProtocolRegistry) {
    this.registry = registry;
  }

  /** Create an IntentTemplate from human-readable params */
  async create(actionName: string, params: Record<string, unknown>): Promise<IntentTemplate> {
    const actionType = ACTION_FROM_NAME[actionName];
    if (actionType === undefined) {
      throw new UnknownActionError(actionName);
    }

    this.validateParams(actionType, params);

    const protocol = (params.protocol as string) || '';
    const protocolHash = protocol ? this.hashProtocol(protocol) : '';

    const tokenIn = await this.resolveTokenParam(params.tokenIn as string | undefined, '');
    const tokenOut = await this.resolveTokenParam(params.tokenOut as string | undefined, '');
    const receiver = (params.receiver as string) || '';

    // Convert human-readable amount to wei
    const amountStr = (params.amount as string) || '0';
    const tokenInInfo = tokenIn ? await this.registry.resolveTokenFromAddress(tokenIn) : null;
    const amountWei = tokenInInfo && amountStr !== '0'
      ? this.registry.toWei(amountStr, tokenInInfo.decimals)
      : amountStr;

    const amountOutMinStr = (params.amountOutMin as string) || '0';
    const tokenOutInfo = tokenOut ? await this.registry.resolveTokenFromAddress(tokenOut) : null;
    const amountOutMinWei = tokenOutInfo && amountOutMinStr !== '0'
      ? this.registry.toWei(amountOutMinStr, tokenOutInfo.decimals)
      : amountOutMinStr;

    const deadline = (params.deadline as number) || Math.floor(Date.now() / 1000) + 3600;
    const customData = (params.customData as string) || '';

    return {
      actionType,
      protocolHash,
      tokenIn: tokenIn || '',
      tokenOut: tokenOut || '',
      amount: amountWei,
      amountOutMin: amountOutMinWei,
      receiver,
      deadline,
      customData,
    };
  }

  /** Compute a deterministic hash for an IntentTemplate */
  hash(intent: IntentTemplate): string {
    // ethers imported at top of file
    const abi = ethers.AbiCoder.defaultAbiCoder();
    const encoded = abi.encode(
      ['uint8', 'bytes32', 'address', 'address', 'uint256', 'uint256', 'address', 'uint256', 'bytes32'],
      [
        intent.actionType,
        intent.protocolHash,
        intent.tokenIn || '0x0000000000000000000000000000000000000000',
        intent.tokenOut || '0x0000000000000000000000000000000000000000',
        intent.amount,
        intent.amountOutMin,
        intent.receiver || '0x0000000000000000000000000000000000000000',
        intent.deadline,
        intent.customData || '0x0000000000000000000000000000000000000000000000000000000000000000',
      ]
    );
    return ethers.keccak256(encoded);
  }

  /** Validate params for a given action type */
  private validateParams(actionType: ActionType, params: Record<string, unknown>): void {
    if (actionType === ActionType.CUSTOM) return;

    if (actionType !== ActionType.VOTE && !params.protocol) {
      throw new ValidationError('Missing required field: protocol');
    }
  }

  /** Hash a protocol name to bytes32 */
  private hashProtocol(name: string): string {
    // ethers imported at top of file
    return ethers.encodeBytes32String(name);
  }

  /** Resolve a token param to its address */
  private async resolveTokenParam(token: string | undefined, fallback: string): Promise<string> {
    if (!token) return fallback;
    // Already an address
    if (token.startsWith('0x') && token.length === 42) return token.toLowerCase();
    // Try symbol resolution
    const info = await this.registry.resolveToken(token);
    return info ? info.address : token;
  }
}
