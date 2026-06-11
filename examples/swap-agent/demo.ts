import { Chiron } from '@chiron/sdk';
import { ethers } from 'ethers';

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const UNISWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

interface SwapSignal {
  shouldSwap: boolean;
  amount: string;
  route: string;
}

class DemoSwapAgent {
  private chiron: Chiron;
  private wallet: ethers.Wallet;
  private provider: ethers.Provider;

  constructor(privateKey: string, chainId: number) {
    this.provider = new ethers.JsonRpcProvider('https://eth-mainnet.g.alchemy.com/v2/demo');
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.chiron = new Chiron({ chainId, agentKey: privateKey });
  }

  private getSwapSignal(prices: { ethPrice: number; usdcPrice: number }): SwapSignal {
    if (prices.ethPrice < 1600) {
      return { shouldSwap: true, amount: '1000', route: 'USDC→ETH' };
    }
    return { shouldSwap: false, amount: '0', route: 'none' };
  }

  async checkAndExecuteSwap(prices: { ethPrice: number; usdcPrice: number }): Promise<void> {
    const signal = this.getSwapSignal(prices);
    if (!signal.shouldSwap) {
      console.log(`[${new Date().toISOString()}] No swap signal. ETH=${prices.ethPrice}`);
      return;
    }

    const intent = await this.chiron.intent('swap', {
      protocol: 'uniswap_v3',
      tokenIn: 'USDC',
      tokenOut: 'WETH',
      amount: signal.amount,
    });

    const tx = {
      to: UNISWAP_ROUTER,
      data: this.buildSwapCalldata(signal.amount),
      value: '0',
    };

    const receipt = await this.chiron.verify(intent, tx);
    if (!receipt.allowed) {
      console.error(`[SECURITY] Chiron blocked: ${receipt.reason}`);
      return;
    }

    console.log(`[EXECUTE] Swap $${signal.amount} USDC → ETH (verified by Chiron)`);
    // await this.wallet.sendTransaction(tx); // uncomment to execute
  }

  private buildSwapCalldata(_amount: string): string {
    return '0x414bf389' + '0'.repeat(62 * 2);
  }
}

async function main() {
  const agent = new DemoSwapAgent('0xYOUR_PRIVATE_KEY', 1);
  await agent.checkAndExecuteSwap({ ethPrice: 1580, usdcPrice: 1.0 });
  console.log('Demo Agent executed successfully');
}

main().catch(console.error);
