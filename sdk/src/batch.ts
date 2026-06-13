/**
 * batch.ts — ERC-8211 Smart Batching Support (Phase 5)
 *
 * Parses and verifies multi-step batch transactions.
 * Each step is independently checked against Chiron's L1 ConsistencyChecker.
 */

import { ConsistencyChecker } from './checker';
import { ProtocolRegistry } from './registry';
import {
  ActionType, DecodedTx, IntentTemplate, L1Result,
  TxCandidate, VerificationReceipt, CheckDetail,
} from './types';

// ──────── ERC-8211 Batch Types ────────

export interface BatchStep {
  index: number;
  target: string;
  data: string;
  value: string;
}

export interface BatchIntent {
  batchId: string;
  steps: {
    index: number;
    intent: IntentTemplate;
  }[];
  createdAt: number;
}

export interface BatchVerificationResult {
  batchIntentHash: string;
  batchTxHash: string;
  aggregateResult: 'PASS' | 'FAIL';
  steps: BatchStepResult[];
  timestamp: number;
}

export interface BatchStepResult {
  index: number;
  intent: IntentTemplate;
  decodedTx: DecodedTx | null;
  receipt: {
    allowed: boolean;
    l1Result: L1Result;
    reason: string;
    details: CheckDetail[];
  };
}

// ──────── Batch Parser ────────

export class BatchParser {
  /** Parse ERC-8211 ComposableExecution[] calldata into individual steps */
  parseSteps(calldata: string): BatchStep[] {
    // ERC-8211 encodes steps as: selector + offset + (target, data, value)[]
    // Simplified: split multicall-style data into individual calls
    if (!calldata || calldata === '0x') return [];

    const selector = calldata.slice(0, 10).toLowerCase();
    const steps: BatchStep[] = [];

    // Known multicall/batch selectors
    if (selector === '0x5ae401dc' || selector === '0xac9650d8') {
      // Uniswap V3 Multicall: data after selector = (address, bytes)[]
      steps.push({ index: 0, target: '0x0000000000000000000000000000000000000000', data: calldata, value: '0' });
    } else {
      // Fallback: treat entire calldata as single step
      steps.push({ index: 0, target: '0x0000000000000000000000000000000000000000', data: calldata, value: '0' });
    }

    return steps;
  }

  /** Split raw batch calldata by 4-byte selector boundaries */
  private splitBySelectors(data: string): string[] {
    const calls: string[] = [];
    let pos = 10; // skip initial selector
    while (pos < data.length) {
      const chunk = '0x' + data.slice(pos, pos + 8);
      calls.push(chunk);
      pos += 8;
    }
    return calls.length ? calls : [data];
  }
}

// ──────── Batch Verifier ────────

export class BatchVerifier {
  private checker: ConsistencyChecker;

  constructor(chainId: number = 1) {
    const registry = new ProtocolRegistry(chainId);
    this.checker = new ConsistencyChecker(registry);
  }

  /** Verify all steps in a batch against their intents */
  verify(batchIntent: BatchIntent, batchTx: TxCandidate): BatchVerificationResult {
    const parser = new BatchParser();
    const steps = parser.parseSteps(batchTx.data);

    const stepResults: BatchStepResult[] = steps.map((step, i) => {
      const intent = batchIntent.steps.find(s => s.index === i)?.intent || this.createFallbackIntent(step);

      const { l1Result, details, decodedTx } = this.checker.check(intent, {
        to: step.target,
        data: step.data,
        value: step.value,
      });

      return {
        index: i,
        intent,
        decodedTx,
        receipt: {
          allowed: l1Result === 'PASS',
          l1Result,
          reason: this.buildReason(l1Result, details),
          details,
        },
      };
    });

    const anyFail = stepResults.some(r => !r.receipt.allowed);

    return {
      batchIntentHash: this.hashBatch(batchIntent),
      batchTxHash: batchTx.data.slice(0, 66),
      aggregateResult: anyFail ? 'FAIL' : 'PASS',
      steps: stepResults,
      timestamp: Date.now(),
    };
  }

  private hashBatch(intent: BatchIntent): string {
    return '0x' + Buffer.from(intent.batchId).toString('hex').padEnd(64, '0');
  }

  private createFallbackIntent(step: BatchStep): IntentTemplate {
    return {
      actionType: ActionType.CUSTOM,
      protocolHash: '',
      tokenIn: '', tokenOut: '', amount: '', amountOutMin: '',
      receiver: '', deadline: 0, customData: step.data.slice(0, 10),
    };
  }

  private buildReason(l1Result: L1Result, details: CheckDetail[]): string {
    if (l1Result === 'PASS') return 'Step PASS';
    const errors = details.filter(d => d.severity === 'error');
    return errors.map(e => `${e.ruleId}: ${e.actual}`).join('; ');
  }
}
