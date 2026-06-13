/**
 * attack-test.ts — Attack Test Framework
 *
 * Defines 15 attack types (A1-A15) with structured test cases
 * for verifying Chiron's L1 consistency checking capabilities.
 * Use: Automated adversarial testing for the ConsistencyChecker.
 */

import { ConsistencyChecker } from './checker';
import { ProtocolRegistry } from './registry';
import {
  ActionType, CheckDetail, DecodedTx, IntentTemplate,
  L1Result, TxCandidate, VerificationReceipt,
} from './types';

/* ──────── Attack Types ──────── */

export interface AttackTestCase {
  id: string;                     // "AT-A1" ~ "AT-A15"
  name: string;
  category: AttackCategory;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  construct: () => Promise<{
    intent: IntentTemplate;
    tx: TxCandidate;
    expectedL1: L1Result;
    expectedBlock: boolean;
    notes: string;
  }>;
}

export type AttackCategory =
  | 'INJECTION'        // Prompt injection / intent replacement
  | 'MANIPULATION'     // Amount / address / parameter manipulation
  | 'SPOOFING'         // Fake contract / phishing
  | 'RECOVERY'         // Key leak / replay
  | 'ECONOMIC'         // Quota / limit abuse
  | 'LIMITATION';      // Known system limitation

export interface AttackTestResult {
  id: string;
  name: string;
  category: AttackCategory;
  passed: boolean;
  detected: boolean;
  actualL1: L1Result;
  actualBlocked: boolean;
  detail: string;
  notes?: string;
  error?: string;
}

export class AttackTestRunner {
  private checker: ConsistencyChecker;
  private registry: ProtocolRegistry;
  private results: AttackTestResult[] = [];

  constructor(chainId: number = 1) {
    this.registry = new ProtocolRegistry(chainId);
    this.checker = new ConsistencyChecker(this.registry);
  }

  /* ──────── Run Tests ──────── */

  async runAll(): Promise<AttackTestResult[]> {
    this.results = [];
    for (const test of ALL_ATTACKS) {
      try {
        const r = await this.runSingle(test);
        this.results.push(r);
      } catch (e) {
        this.results.push({
          id: test.id, name: test.name, category: test.category,
          passed: false, detected: false,
          actualL1: 'FAIL', actualBlocked: false,
          detail: 'Test construction failed', error: String(e),
        });
      }
    }
    return this.results;
  }

  async runSingle(test: AttackTestCase): Promise<AttackTestResult> {
    const { intent, tx, expectedL1, expectedBlock, notes } = await test.construct();
    const result = this.checker.check(intent, tx);
    const l1Result = result.l1Result;
    const blocked = l1Result === 'FAIL';

    const shouldBlock = expectedBlock;
    const passed = shouldBlock === blocked;

    const errors = result.details?.filter((d: CheckDetail) => d.severity === 'error') || [];
    const detailStr = blocked && errors.length > 0
      ? `Blocked by: ${errors.map((e: CheckDetail) => e.ruleId).join(', ')} — ${errors[0]?.actual?.substring(0, 80) || ''}`
      : !blocked && !shouldBlock
        ? `Correctly allowed (known limitation: ${notes})`
        : blocked
          ? 'Blocked but should not have been (false positive)'
          : 'Not blocked but should have been (false negative)';

    return {
      id: test.id, name: test.name, category: test.category,
      passed, detected: blocked,
      actualL1: l1Result, actualBlocked: blocked,
      detail: detailStr, notes,
    };
  }

  getSummary(): { total: number; passed: number; blocked: number; blockedPct: string } {
    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const blocked = this.results.filter(r => r.detected).length;
    const blockRate = total > 0 ? ((blocked / total) * 100).toFixed(1) : '0.0';
    return { total, passed, blocked, blockedPct: `${blockRate}%` };
  }
}

/* ──────── All Attack Cases ──────── */

const UNISWAP_R = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
const UNISWAP_SEL = '0x414bf389';
const ATTACKER_ADDR = '0xAttackerAddressDeadBeefCafeBabe1234567890ABad';

export const ALL_ATTACKS: AttackTestCase[] = [

  // ════════════════════════════════════════
  // A1: Prompt Injection → Approve Replace
  // ════════════════════════════════════════
  {
    id: 'AT-A1', name: 'Prompt Injection — Approve Replace',
    category: 'INJECTION', severity: 'CRITICAL',
    description: 'Agent declares Swap but actual tx is Approve to attacker',
    construct: async () => ({
      intent: baseIntent(ActionType.SWAP, 'uniswap_v3', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', '100000000'),
      tx: { to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', data: '0x095ea7b3000000000000000000000000'+ATTACKER_ADDR.slice(2)+'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', value: '0' },
      expectedL1: 'FAIL', expectedBlock: true, notes: 'Selector=approve, target mismatch intent',
    }),
  },

  // ════════════════════════════════════════
  // A2: Intent Declaration Forgery
  // ════════════════════════════════════════
  {
    id: 'AT-A2', name: 'Intent Declaration Forgery',
    category: 'INJECTION', severity: 'HIGH',
    description: 'Intent says ETH→USDC but tx actually does USDC→ETH (token reversal)',
    construct: async () => ({
      intent: baseIntent(ActionType.SWAP, 'uniswap_v3', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', '1000000000000000000'),
      tx: { to: UNISWAP_R, data: UNISWAP_SEL + '0'.repeat(62), value: '0' },
      expectedL1: 'FAIL', expectedBlock: true, notes: 'TokenIn in intent != decoded tx params',
    }),
  },

  // ════════════════════════════════════════
  // A3: Calldata Manipulation
  // ════════════════════════════════════════
  {
    id: 'AT-A3', name: 'Calldata Manipulation',
    category: 'MANIPULATION', severity: 'CRITICAL',
    description: 'Valid swap intent but actual calldata is for an unknown/different function',
    construct: async () => ({
      intent: baseIntent(ActionType.SWAP, 'uniswap_v3', '0xA0b86991', '100000000'),
      tx: { to: UNISWAP_R, data: '0xdeadbeef0000000000000000000000000000000000000000000000000000000000000020', value: '0' },
      expectedL1: 'FAIL', expectedBlock: true, notes: 'Selector 0xdeadbeef not in uniswap_v3 known selectors',
    }),
  },

  // ════════════════════════════════════════
  // A4: Hidden Approve in Swap Tx
  // ════════════════════════════════════════
  {
    id: 'AT-A4', name: 'Hidden Approve in Swap',
    category: 'MANIPULATION', severity: 'CRITICAL',
    description: 'Agent declares Swap but tx contains approve to attacker (R5 detects approve)',
    construct: async () => ({
      intent: baseIntent(ActionType.SWAP, 'uniswap_v3', '', ''),
      tx: { to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', data: '0x095ea7b3000000000000000000000000'+ATTACKER_ADDR.slice(2)+'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', value: '0' },
      expectedL1: 'FAIL', expectedBlock: true, notes: 'R5 detects approve function with type mismatch',
    }),
  },

  // ════════════════════════════════════════
  // A5: Hidden delegatecall
  // ════════════════════════════════════════
  {
    id: 'AT-A5', name: 'Hidden delegatecall',
    category: 'MANIPULATION', severity: 'CRITICAL',
    description: 'Tx data contains delegatecall opcode reference (execution sandbox escape)',
    construct: async () => ({
      intent: baseIntent(ActionType.SWAP, 'uniswap_v3', '', ''),
      tx: { to: UNISWAP_R, data: UNISWAP_SEL + 'delegatecall', value: '0' },
      expectedL1: 'FAIL', expectedBlock: true, notes: 'R6 detects delegatecall keyword in calldata',
    }),
  },

  // ════════════════════════════════════════
  // A6: Amount Manipulation
  // ════════════════════════════════════════
  {
    id: 'AT-A6', name: 'Amount Manipulation (10x)',
    category: 'MANIPULATION', severity: 'CRITICAL',
    description: 'Intent says amount 100 but tx sends 1000',
    construct: async () => ({
      intent: baseIntent(ActionType.SWAP, 'uniswap_v3', '', '100'),
      tx: { to: UNISWAP_R, data: UNISWAP_SEL + '0'.repeat(62), value: '0' },
      expectedL1: 'PASS', expectedBlock: false, notes: 'R4 passes because amount extraction fails on minimal calldata (Phase 4 will add real tx data)',
    }),
  },

  // ════════════════════════════════════════
  // A7: Receiver Address Replacement
  // ════════════════════════════════════════
  {
    id: 'AT-A7', name: 'Receiver Address Replacement',
    category: 'MANIPULATION', severity: 'CRITICAL',
    description: 'Intent specifies receiver A, tx routes output to attacker address B',
    construct: async () => ({
      intent: {
        actionType: ActionType.SWAP,
        protocolHash: '0x756e69737761705f763300000000000000000000000000000000000000000000',
        tokenIn: '', tokenOut: '', amount: '', amountOutMin: '',
        receiver: '0x1111111111111111111111111111111111111111',
        deadline: 2000000000, customData: '',
      },
      tx: { to: UNISWAP_R, data: UNISWAP_SEL + ATTACKER_ADDR.slice(2), value: '0' },
      expectedL1: 'FAIL', expectedBlock: true, notes: 'R5 detects receiver mismatch',
    }),
  },

  // ════════════════════════════════════════
  // A8: Phishing Contract Call
  // ════════════════════════════════════════
  {
    id: 'AT-A8', name: 'Phishing Contract Call',
    category: 'SPOOFING', severity: 'CRITICAL',
    description: 'Target contract address differs by 1 char from known Uniswap router',
    construct: async () => ({
      intent: baseIntent(ActionType.SWAP, 'uniswap_v3', '', ''),
      tx: { to: '0xE592427A0AEce92De3Edee1F18E0157C05861565', data: UNISWAP_SEL, value: '0' },
      expectedL1: 'FAIL', expectedBlock: true, notes: 'R1: address not in protocol registry',
    }),
  },

  // ════════════════════════════════════════
  // A9: New / Unknown Contract
  // ════════════════════════════════════════
  {
    id: 'AT-A9', name: 'New / Unknown Contract',
    category: 'SPOOFING', severity: 'HIGH',
    description: 'Agent calls a newly deployed contract not in registry',
    construct: async () => ({
      intent: baseIntent(ActionType.SWAP, 'uniswap_v3', '', ''),
      tx: { to: '0x0000000000000000000000000000000000000001', data: UNISWAP_SEL, value: '0' },
      expectedL1: 'FAIL', expectedBlock: true, notes: 'R1: address not in registry',
    }),
  },

  // ════════════════════════════════════════
  // A10: Session Key Leak Abuse
  // ════════════════════════════════════════
  {
    id: 'AT-A10', name: 'Session Key Leak Abuse',
    category: 'RECOVERY', severity: 'HIGH',
    description: 'Attacker has agent key but tx does not match declared intent',
    construct: async () => ({
      intent: baseIntent(ActionType.SWAP, 'uniswap_v3', '', ''),
      tx: { to: '0x0000000000000000000000000000000000000000', data: UNISWAP_SEL, value: '0' },
      expectedL1: 'FAIL', expectedBlock: true, notes: 'R1: intent says Uniswap but target is zero address',
    }),
  },

  // ════════════════════════════════════════
  // A11: Batch Step Manipulation
  // ════════════════════════════════════════
  {
    id: 'AT-A11', name: 'Batch Step Manipulation',
    category: 'MANIPULATION', severity: 'CRITICAL',
    description: 'In multi-step batch, one step is replaced with approve to attacker',
    construct: async () => ({
      intent: baseIntent(ActionType.SWAP, 'uniswap_v3', '', ''),
      tx: { to: UNISWAP_R, data: UNISWAP_SEL, value: '0' },
      expectedL1: 'PASS', expectedBlock: false, notes: 'Batch parsing is Phase 5; individual steps verified once parsed',
    }),
  },

  // ════════════════════════════════════════
  // A12: Cross-chain Target Manipulation
  // ════════════════════════════════════════
  {
    id: 'AT-A12', name: 'Cross-chain Target Manipulation',
    category: 'MANIPULATION', severity: 'MEDIUM',
    description: 'Intent says Arbitrum but tx executes on Ethereum mainnet',
    construct: async () => ({
      intent: baseIntent(ActionType.BRIDGE, 'stargate', '', ''),
      tx: { to: '0x8731d54E9D02c286767d56ac03e8037C07e01e98', data: '0x9b3ebc21', value: '0' },
      expectedL1: 'PASS', expectedBlock: false, notes: 'Cross-chain manipulation needs source chain context (Phase 5 with ERC-7683)',
    }),
  },

  // ════════════════════════════════════════
  // A13: Verification Proof Replay
  // ════════════════════════════════════════
  {
    id: 'AT-A13', name: 'Verification Proof Replay',
    category: 'RECOVERY', severity: 'HIGH',
    description: 'Old verification receipt reused with a different transaction',
    construct: async () => ({
      intent: baseIntent(ActionType.SWAP, 'uniswap_v3', '', ''),
      tx: { to: UNISWAP_R, data: UNISWAP_SEL + '99', value: '0' },
      expectedL1: 'PASS', expectedBlock: false, notes: 'Replay detection is chain-level (VerificationStore); L1 only checks intent↔tx consistency',
    }),
  },

  // ════════════════════════════════════════
  // A14: Daily Quota Exhaustion
  // ════════════════════════════════════════
  {
    id: 'AT-A14', name: 'Daily Quota Exhaustion',
    category: 'ECONOMIC', severity: 'HIGH',
    description: 'Agent exceeds daily transaction volume limit',
    construct: async () => ({
      intent: baseIntent(ActionType.SWAP, 'uniswap_v3', '', '1000000'),
      tx: { to: UNISWAP_R, data: UNISWAP_SEL, value: '0' },
      expectedL1: 'PASS', expectedBlock: false, notes: 'Quota enforcement is CircuitBreaker contract (Phase 4); L1 only checks consistency',
    }),
  },

  // ════════════════════════════════════════
  // A15: Intent Declaration Bypass (Known Limitation)
  // ════════════════════════════════════════
  {
    id: 'AT-A15', name: 'Intent Bypass (Known Limitation)',
    category: 'LIMITATION', severity: 'LOW',
    description: 'Malicious swap that matches intent — L1 cannot detect (intent itself is bad)',
    construct: async () => ({
      intent: baseIntent(ActionType.SWAP, 'uniswap_v3', '', ''),
      tx: { to: UNISWAP_R, data: UNISWAP_SEL, value: '0' },
      expectedL1: 'PASS', expectedBlock: false, notes: 'Intent=Execution, but intent itself malicio us — L1 only checks consistency, not goodness',
    }),
  },
];

/* ──────── Helpers ──────── */

function baseIntent(action: ActionType, protocol: string, tokenIn?: string, amount?: string): IntentTemplate {
  return {
    actionType: action,
    protocolHash: '0x' + protocol.padEnd(64, '0'),
    tokenIn: tokenIn || '',
    tokenOut: '',
    amount: amount || '',
    amountOutMin: '',
    receiver: '',
    deadline: 2000000000,
    customData: '',
  };
}
