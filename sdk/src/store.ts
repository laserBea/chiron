import { ethers } from 'ethers';
import { VerificationReceipt } from './types';

const CHIRON_ABI = [
  'function storeReceipt(bytes32 txHash, bytes32 intentHash, address agent, uint8 l1Result, uint8 l2Result) external',
  'function getReceipt(bytes32 txHash) external view returns (tuple(bytes32 intentHash, bytes32 txHash, address agent, uint8 l1Result, uint8 l2Result, uint256 timestamp, uint256 blockNumber))',
  'function getAgentReceipts(address agent, uint256 offset, uint256 limit) external view returns (bytes32[] memory)',
  'function getAgentStats(address agent) external view returns (uint256, uint256, uint256)',
  'event ReceiptStored(bytes32 indexed txHash, bytes32 indexed intentHash, address indexed agent, uint8 l1Result)',
];

export class OnChainStore {
  private contract: ethers.Contract;
  private provider: ethers.Provider;
  private signer?: ethers.Signer;

  constructor(address: string, provider: ethers.Provider, signer?: ethers.Signer) {
    this.contract = new ethers.Contract(address, CHIRON_ABI, provider);
    this.provider = provider;
    this.signer = signer;
  }

  async store(receipt: VerificationReceipt): Promise<ethers.TransactionReceipt> {
    if (!this.signer) throw new Error('Signer required for on-chain storage');
    const contractWithSigner = this.contract.connect(this.signer) as ethers.Contract;
    const l1Result = receipt.l1Result === 'PASS' ? 0 : receipt.l1Result === 'FAIL' ? 1 : 2;
    const tx = await contractWithSigner.storeReceipt(
      receipt.txHash, receipt.intentHash,
      await this.signer.getAddress(), l1Result, 0
    );
    return tx.wait();
  }

  async getReceipt(txHash: string): Promise<[string, string, string, number, number, bigint, bigint]> {
    return this.contract.getReceipt(txHash);
  }

  async getAgentReceipts(agent: string, offset = 0, limit = 50): Promise<string[]> {
    return this.contract.getAgentReceipts(agent, offset, limit);
  }

  async getAgentStats(agent: string): Promise<{ total: bigint; passed: bigint; failed: bigint }> {
    const [total, passed, failed] = await this.contract.getAgentStats(agent);
    return { total, passed, failed };
  }
}
