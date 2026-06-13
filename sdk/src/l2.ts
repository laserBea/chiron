import { DecodedTx, IntentTemplate, VerificationReceipt } from './types';

interface L2VerifierResult {
  consistent: boolean;
  reason: string;
  verifierId: string;
}

export class L2VerifierClient {
  private endpoint: string;

  constructor(endpoint: string = 'http://localhost:3456') {
    this.endpoint = endpoint;
  }

  async verify(intent: IntentTemplate, decodedTx: DecodedTx): Promise<VerificationReceipt> {
    try {
      const res = await fetch(`${this.endpoint}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: JSON.stringify(intent),
          decodedTx: JSON.stringify(decodedTx),
          chainId: 1,
        }),
      });
      const data = await res.json();
      return {
        allowed: data.allowed,
        reason: data.results?.map((r: L2VerifierResult) => `${r.verifierId}: ${r.reason}`).join('; ') || 'L2 check completed',
        intentHash: '', txHash: '', l1Result: data.allowed ? 'PASS' : 'FAIL', details: [], decodedTx: null, timestamp: Date.now(),
      };
    } catch {
      return { allowed: true, reason: 'L2 fallback: verifier unavailable', intentHash: '', txHash: '', l1Result: 'UNCERTAIN', details: [], decodedTx: null, timestamp: Date.now() };
    }
  }
}
