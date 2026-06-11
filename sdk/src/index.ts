/**
import { ethers } from "ethers";
 * Chiron SDK — Agent Transaction Security Middleware
 *
 * Main entry point. Provides:
 *   - intent() — generate structured intent templates
 *   - verify() — L1 consistency verification
 *   - storeReceipt() — async on-chain receipt storage
 */

import { ProtocolRegistry } from './registry';
import { IntentParser } from './intent';
import { ConsistencyChecker } from './checker';
import { ReceiptBuilder } from './receipt';
import {
  ChironConfig,
  IntentParams,
  IntentTemplate,
  TxCandidate,
  VerificationReceipt,
} from './types';

export * from './types';

export class Chiron {
  private config: ChironConfig;
  private registry: ProtocolRegistry;
  private intentParser: IntentParser;
  private checker: ConsistencyChecker;
  private receiptBuilder: ReceiptBuilder;

  constructor(config: ChironConfig) {
    this.config = {
      securityLevel: 'standard',
      ...config,
    };
    this.registry = new ProtocolRegistry(this.config.chainId, this.config.tokenResolver);
    this.intentParser = new IntentParser(this.registry);
    this.checker = new ConsistencyChecker(this.registry);
    this.receiptBuilder = new ReceiptBuilder();
  }

  /**
   * Create a structured intent template for a DeFi action.
   * @param action Action name (swap, approve, bridge, deposit, withdraw, stake, vote, permit, custom)
   * @param params Action-specific parameters
   */
  async intent(action: string, params: IntentParams): Promise<IntentTemplate> {
    return this.intentParser.create(action, params as unknown as Record<string, unknown>);
  }

  /**
   * Verify that a transaction is semantically consistent with the declared intent.
   * L1 check: deterministic local verification (~10ms, 0 cost).
   * @param intent The structured intent template
   * @param tx The transaction to verify
   */
  async verify(intent: IntentTemplate, tx: TxCandidate): Promise<VerificationReceipt> {
    const txHash = this.computeTxHash(tx);

    const { l1Result, details, decodedTx } = this.checker.check(intent, tx);

    return this.receiptBuilder.build(intent, txHash, l1Result, details, decodedTx);
  }

  /**
   * Asynchronously store a verification receipt on-chain (non-blocking skeleton).
   * Full implementation in Phase 2.
   */
  async storeReceipt(_receipt: VerificationReceipt): Promise<void> {
    // Phase 2: on-chain storage via VerificationStore contract
    return Promise.resolve();
  }

  /** Compute deterministic transaction hash */
  private computeTxHash(tx: TxCandidate): string {
    // ethers imported at top
    const data = ethers.solidityPacking(
      ['address', 'bytes', 'uint256'],
      [tx.to, tx.data, tx.value || '0']
    );
    return ethers.keccak256(data);
  }
}
