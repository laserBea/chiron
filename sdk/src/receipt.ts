/**
 * Chiron SDK — Verification receipt builder
 */

import { ethers } from 'ethers';
import { CheckDetail, DecodedTx, IntentTemplate, L1Result, VerificationReceipt } from './types';

export class ReceiptBuilder {
  /** Build a VerificationReceipt from L1 check results */
  build(
    intent: IntentTemplate,
    txHash: string,
    l1Result: L1Result,
    details: CheckDetail[],
    decodedTx: DecodedTx | null
  ): VerificationReceipt {
    const errorDetails = details.filter(d => d.severity === 'error');
    const reason = this.buildReason(errorDetails, l1Result);

    const intentHash = this.computeIntentHash(intent);

    return {
      allowed: l1Result === 'PASS',
      reason,
      intentHash,
      txHash,
      l1Result,
      details,
      decodedTx,
      timestamp: Date.now(),
    };
  }

  /** Build a human-readable failure reason */
  private buildReason(errors: CheckDetail[], result: L1Result): string {
    if (result === 'PASS') return 'L1 PASS — All checks passed';

    if (errors.length === 0 && result === 'FAIL') return 'L1 FAIL — Unknown reason';

    const reasons = errors.map(e => `${e.ruleId}: ${e.actual}`);
    return `L1 FAIL — ${reasons.join('; ')}`;
  }

  /** Compute deterministic hash for an IntentTemplate */
  private computeIntentHash(intent: IntentTemplate): string {
    const abi = ethers.AbiCoder.defaultAbiCoder();
    const encoded = abi.encode(
      ['uint8', 'bytes32', 'address', 'address', 'uint256', 'uint256', 'address', 'uint256', 'bytes32'],
      [
        intent.actionType,
        intent.protocolHash,
        intent.tokenIn || '0x0000000000000000000000000000000000000000',
        intent.tokenOut || '0x0000000000000000000000000000000000000000',
        intent.amount || '0',
        intent.amountOutMin || '0',
        intent.receiver || '0x0000000000000000000000000000000000000000',
        intent.deadline,
        intent.customData || ethers.ZeroHash,
      ]
    );
    return ethers.keccak256(encoded);
  }
}
