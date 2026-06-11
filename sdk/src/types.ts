/**
 * Chiron SDK — Core type definitions
 */

/** Action types supported by IntentTemplate */
export enum ActionType {
  SWAP = 1,
  APPROVE = 2,
  BRIDGE = 3,
  DEPOSIT = 4,
  WITHDRAW = 5,
  STAKE = 6,
  VOTE = 7,
  PERMIT = 8,
  CUSTOM = 9,
}

export const ACTION_NAMES: Record<ActionType, string> = {
  [ActionType.SWAP]: 'swap',
  [ActionType.APPROVE]: 'approve',
  [ActionType.BRIDGE]: 'bridge',
  [ActionType.DEPOSIT]: 'deposit',
  [ActionType.WITHDRAW]: 'withdraw',
  [ActionType.STAKE]: 'stake',
  [ActionType.VOTE]: 'vote',
  [ActionType.PERMIT]: 'permit',
  [ActionType.CUSTOM]: 'custom',
};

export const ACTION_FROM_NAME: Record<string, ActionType> = Object.fromEntries(
  Object.entries(ACTION_NAMES).map(([k, v]) => [v, Number(k) as ActionType])
);

export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  chainId: number;
}

export interface IntentParams {
  action: string;
  protocol: string;
  tokenIn?: string;
  tokenOut?: string;
  amount?: string;
  amountOutMin?: string;
  receiver?: string;
  slippage?: number;
  deadline?: number;
  customData?: string;
  [key: string]: unknown;
}

export interface IntentTemplate {
  actionType: ActionType;
  protocolHash: string;
  tokenIn: string;
  tokenOut: string;
  amount: string;
  amountOutMin: string;
  receiver: string;
  deadline: number;
  customData: string;
}

export interface DecodedParam {
  name: string;
  type: string;
  value: unknown;
}

export interface DecodedTx {
  target: string;
  value: string;
  selector: string;
  functionName: string;
  params: DecodedParam[];
  summary: string;
  hasDelegateCall: boolean;
  hasCreate2: boolean;
}

export interface TxCandidate {
  to: string;
  data: string;
  value?: string;
}

export interface ProtocolEntry {
  actionType: ActionType;
  protocol: string;
  contracts: string[];
  selectors: Record<string, string>; // selector → functionName
}

export type L1Result = 'PASS' | 'FAIL' | 'UNCERTAIN';

export interface CheckDetail {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  expected: string;
  actual: string;
  severity: 'info' | 'warning' | 'error';
}

export interface VerificationReceipt {
  allowed: boolean;
  reason: string;
  intentHash: string;
  txHash: string;
  l1Result: L1Result;
  details: CheckDetail[];
  decodedTx: DecodedTx | null;
  timestamp: number;
}

export interface ChironConfig {
  chainId: number;
  agentKey?: string;
  securityLevel?: 'standard' | 'strict';
  tokenResolver?: TokenResolver;
}

export interface TokenResolver {
  resolve(symbol: string, chainId: number): Promise<TokenInfo | null>;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UnknownActionError extends Error {
  constructor(action: string) {
    super(`Unknown action: ${action}. Valid actions: ${Object.values(ACTION_NAMES).join(', ')}`);
    this.name = 'UnknownActionError';
  }
}
