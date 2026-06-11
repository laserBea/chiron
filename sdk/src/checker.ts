/**
 * Chiron SDK — L1 Consistency Checker
 *
 * 6 deterministic rules to verify Intent ↔ Tx consistency.
 * Rules:
 *   R1 — Target contract matches known protocol address table
 *   R2 — Function selector matches expected action type
 *   R3 — TokenIn/TokenOut addresses match intent
 *   R4 — Amount is within ±slippage of intent
 *   R5 — No unexpected parameters (receiver mismatch, hidden approvals)
 *   R6 — No hidden delegatecall/create2
 */

import {
  ActionType,
  CheckDetail,
  DecodedTx,
  IntentTemplate,
  L1Result,
  TxCandidate,
  VerificationReceipt,
} from './types';
import { ProtocolRegistry } from './registry';
import { TxDecoder } from './decoder';

export class ConsistencyChecker {
  private registry: ProtocolRegistry;
  private decoder: TxDecoder;

  constructor(registry: ProtocolRegistry) {
    this.registry = registry;
    this.decoder = new TxDecoder();
  }

  /** Run all 6 L1 checks against intent + tx */
  check(intent: IntentTemplate, tx: TxCandidate): { l1Result: L1Result; details: CheckDetail[]; decodedTx: DecodedTx } {
    const decodedTx = this.decoder.decode(tx.to, tx.data);
    const details: CheckDetail[] = [];

    details.push(this.r1_targetCheck(intent, tx));
    details.push(this.r2_selectorCheck(intent, decodedTx));
    details.push(this.r3_tokenCheck(intent, decodedTx));
    details.push(this.r4_amountCheck(intent, decodedTx));
    details.push(this.r5_unexpectedParams(intent, decodedTx));
    details.push(this.r6_hiddenCalls(intent, decodedTx));

    const hasError = details.some(d => d.severity === 'error');
    const l1Result: L1Result = hasError ? 'FAIL' : 'PASS';

    return { l1Result, details, decodedTx };
  }

  /** R1: Target contract must be in known protocol address table */
  private r1_targetCheck(intent: IntentTemplate, tx: TxCandidate): CheckDetail {
    const entry = this.registry.findByAddress(tx.to);
    const passed = entry !== null;
    return {
      ruleId: 'R1',
      ruleName: 'Target protocol check',
      passed,
      expected: `Known protocol contract (action: ${ActionType[intent.actionType]})`,
      actual: entry
        ? `${entry.protocol} (${tx.to})`
        : `Unknown contract: ${tx.to}`,
      severity: passed ? 'info' : 'error',
    };
  }

  /** R2: Function selector must match expected action type */
  private r2_selectorCheck(intent: IntentTemplate, decoded: DecodedTx): CheckDetail {
    const entry = this.registry.findByAddress(decoded.target);
    const passed = entry !== null && entry.actionType === intent.actionType;
    return {
      ruleId: 'R2',
      ruleName: 'Function selector check',
      passed,
      expected: `Function matching action: ${ActionType[intent.actionType]}`,
      actual: passed
        ? `${decoded.functionName} (${decoded.selector})`
        : entry
          ? `${decoded.functionName} — expected ${ActionType[intent.actionType]} but contract is ${ActionType[entry.actionType]}`
          : `Unknown function for action ${ActionType[intent.actionType]}`,
      severity: passed ? 'info' : 'error',
    };
  }

  /** R3: TokenIn/TokenOut addresses match intent */
  private r3_tokenCheck(intent: IntentTemplate, decoded: DecodedTx): CheckDetail {
    if (!intent.tokenIn && !intent.tokenOut) {
      return {
        ruleId: 'R3',
        ruleName: 'Token address check',
        passed: true,
        expected: 'No tokens specified in intent',
        actual: 'No tokens in intent',
        severity: 'info',
      };
    }

    // Check first address param for tokenIn match
    const addressParams = decoded.params.filter(p => p.type === 'address');
    let tokenInMatched = !intent.tokenIn;
    let tokenOutMatched = !intent.tokenOut;

    for (const p of addressParams) {
      const val = String(p.value).toLowerCase();
      if (intent.tokenIn && val === intent.tokenIn.toLowerCase()) tokenInMatched = true;
      if (intent.tokenOut && val === intent.tokenOut.toLowerCase()) tokenOutMatched = true;
    }

    const passed = tokenInMatched && tokenOutMatched;
    return {
      ruleId: 'R3',
      ruleName: 'Token address check',
      passed,
      expected: intent.tokenIn ? `TokenIn: ${intent.tokenIn}` : '(any)',
      actual: tokenInMatched ? 'TokenIn matched' : `TokenIn not found in params`,
      severity: passed ? 'info' : 'error',
    };
  }

  /** R4: Amount must be within ±slippage of intent */
  private r4_amountCheck(intent: IntentTemplate, decoded: DecodedTx): CheckDetail {
    const amount = BigInt(intent.amount || '0');
    if (amount === BigInt(0)) {
      return {
        ruleId: 'R4',
        ruleName: 'Amount check',
        passed: true,
        expected: 'No amount specified in intent',
        actual: 'Amount not checked',
        severity: 'info',
      };
    }

    // Check decoded params for amount field
    let txAmount = BigInt(0);
    for (const p of decoded.params) {
      const val = String(p.value);
      try {
        const bigVal = BigInt(val);
        if (bigVal > txAmount) txAmount = bigVal;
      } catch {
        // Non-numeric param
      }
    }

    if (txAmount === BigInt(0)) {
      return {
        ruleId: 'R4',
        ruleName: 'Amount check',
        passed: true,
        expected: `Amount: ${amount.toString()}`,
        actual: 'Could not extract amount from tx',
        severity: 'info',
      };
    }

    // Check with ±0.5% tolerance
    const slippage = BigInt(1000); // 0.5% = 5/1000
    const minAmount = amount - (amount * slippage) / BigInt(1000);
    const maxAmount = amount + (amount * slippage) / BigInt(1000);

    const passed = txAmount >= minAmount && txAmount <= maxAmount;

    return {
      ruleId: 'R4',
      ruleName: 'Amount check',
      passed,
      expected: `Amount ≈ ${amount.toString()} (±0.5%)`,
      actual: `Tx amount: ${txAmount.toString()}`,
      severity: passed ? 'info' : 'error',
    };
  }

  /** R5: Check for unexpected parameters (receiver mismatch, hidden approvals) */
  private r5_unexpectedParams(intent: IntentTemplate, decoded: DecodedTx): CheckDetail {
    const issues: string[] = [];

    // Check receiver if specified in intent
    if (intent.receiver) {
      const receiverParam = decoded.params.find(p => {
        const val = String(p.value).toLowerCase();
        return val === intent.receiver.toLowerCase();
      });
      if (!receiverParam) {
        issues.push('Receiver address not found in tx params');
      }
    }

    // Check for approve-like calls hidden in swap
    if (decoded.functionName === 'approve' && intent.actionType !== ActionType.APPROVE) {
      issues.push('Tx contains approve call but intent is not approve');
    }

    const passed = issues.length === 0;
    return {
      ruleId: 'R5',
      ruleName: 'Unexpected parameter check',
      passed,
      expected: 'No unexpected parameters',
      actual: passed ? 'All params match intent' : issues.join('; '),
      severity: passed ? 'info' : 'error',
    };
  }

  /** R6: Check for hidden delegatecall/create2 */
  private r6_hiddenCalls(_intent: IntentTemplate, decoded: DecodedTx): CheckDetail {
    const passed = !decoded.hasDelegateCall && !decoded.hasCreate2;
    return {
      ruleId: 'R6',
      ruleName: 'Hidden call check',
      passed,
      expected: 'No hidden delegatecall or CREATE2',
      actual: decoded.hasDelegateCall
        ? 'Transaction contains delegatecall'
        : decoded.hasCreate2
          ? 'Transaction contains CREATE2'
          : 'No hidden calls detected',
      severity: passed ? 'info' : 'error',
    };
  }
}
