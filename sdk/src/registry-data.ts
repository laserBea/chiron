/**
 * Chiron SDK — Built-in protocol address registry
 *
 * Maps protocol names to their contract addresses and function selectors.
 * Supports Ethereum L1 and major L2s (Arbitrum, Optimism, Base, Polygon).
 */

import { ActionType, ProtocolEntry } from './types';

type ChainProtocolMap = Record<number, Record<string, ProtocolEntry>>;

export const PROTOCOL_REGISTRY: ChainProtocolMap = {
  // ─── Ethereum (chainId: 1) ───
  1: {
    'uniswap_v2': {
      actionType: ActionType.SWAP,
      protocol: 'uniswap_v2',
      contracts: ['0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'],
      selectors: {
        '0x38ed1739': 'swapExactTokensForTokens',
        '0x7ff36ab5': 'swapExactETHForTokens',
        '0x4a25d94a': 'swapTokensForExactETH',
        '0x18cbafe5': 'swapExactTokensForETH',
      },
    },
    'uniswap_v3': {
      actionType: ActionType.SWAP,
      protocol: 'uniswap_v3',
      contracts: [
        '0xE592427A0AEce92De3Edee1F18E0157C05861564',  // SwapRouter
        '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',  // SwapRouter02
      ],
      selectors: {
        '0x3593564c': 'exactInput',
        '0x414bf389': 'exactInputSingle',
        '0xf28c0498': 'exactOutput',
        '0xdb3e2198': 'exactOutputSingle',
      },
    },
    'cow_swap': {
      actionType: ActionType.SWAP,
      protocol: 'cow_swap',
      contracts: [
        '0x9008D19f58AABd9eD0D60971565AA8510560ab41',  // GPv2Settlement
      ],
      selectors: {
        '0x2c7713b9': 'settle',
        '0x322e0676': 'preSettle',
        '0x2c66debc': 'setPreSignature',
      },
    },
    'curve': {
      actionType: ActionType.SWAP,
      protocol: 'curve',
      contracts: [
        '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7',  // 3pool
        '0xA5407eAE9Ba41422680e2e00537571bcC53efBfD',  // sBTC
        '0x06364f10B501e2cC3A6Ee254E788E17E76A0D12',  // stETH
      ],
      selectors: {
        '0xf22ed14f': 'exchange',
        '0x3df02124': 'exchange_underlying',
      },
    },
    'balancer_v2': {
      actionType: ActionType.SWAP,
      protocol: 'balancer_v2',
      contracts: ['0xBA12222222228d8Ba445958a75a0704d566BF2C8'],
      selectors: {
        '0x52bbbe29': 'batchSwap',
        '0xbe5b8dcb': 'swap',
      },
    },
    'aave_v2': {
      actionType: ActionType.DEPOSIT,
      protocol: 'aave_v2',
      contracts: ['0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9'],
      selectors: {
        '0xe8eda9df': 'deposit',
        '0x69328dec': 'withdraw',
        '0xa415bcad': 'borrow',
        '0x7df5bd01': 'repay',
      },
    },
    'aave_v3': {
      actionType: ActionType.DEPOSIT,
      protocol: 'aave_v3',
      contracts: ['0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'],
      selectors: {
        '0xe8eda9df': 'supply',
        '0x69328dec': 'withdraw',
        '0x474cf53d': 'supplyWithPermit',
      },
    },
    'spark': {
      actionType: ActionType.DEPOSIT,
      protocol: 'spark',
      contracts: [
        '0xC13e21B648A5Ee794902342038FF3aD4F8f2e9c7',  // SparkLend
      ],
      selectors: {
        '0xe8eda9df': 'supply',
        '0x69328dec': 'withdraw',
        '0xa415bcad': 'borrow',
        '0x7df5bd01': 'repay',
        '0x474cf53d': 'supplyWithPermit',
      },
    },
    'sky_maker': {
      actionType: ActionType.DEPOSIT,
      protocol: 'sky_maker',
      contracts: [
        '0x373238337Bfe1146fB499Bb9Ee5F7b7c44E50DcF',  // DSR
        '0x83F20F44975D03b1b09e64809B757c47f942BEeA',  // sDAI
        '0x6B175474E89094C44Da98b954EedeAC495271d0F',  // DAI
      ],
      selectors: {
        '0xbc61394a': 'deposit',
        '0x2e1a7d4d': 'withdraw',
        '0x07522a2f': 'redeem',
      },
    },
    'ethena': {
      actionType: ActionType.STAKE,
      protocol: 'ethena',
      contracts: [
        '0x9D39A5DE30e57443BfF2A8307A4256c8797A3497',  // sUSDe
        '0x4c9EDD5852cd905f086C759E8383e09bff1E68B3',  // USDe
      ],
      selectors: {
        '0x9b3ebc21': 'stake',
        '0x2e1a7d4d': 'unstake',
        '0xa9059cbb': 'transfer',
      },
    },
    'eigenlayer': {
      actionType: ActionType.STAKE,
      protocol: 'eigenlayer',
      contracts: [
        '0x858646372CC42E1a627fcE94aa7A7033e7A075cc',  // StrategyManager
        '0x39053D51b77DC0d36036Fc1fCc8Cb819df8Ef37A',  // DelegationManager
      ],
      selectors: {
        '0x35bb3e69': 'depositIntoStrategy',
        '0x285353c5': 'depositIntoStrategyWithSignature',
        '0x2e1a7d4d': 'withdraw',
        '0x0d2e2e8c': 'queueWithdrawals',
        '0x7a8b2633': 'completeQueuedWithdrawal',
      },
    },
    'ether_fi': {
      actionType: ActionType.STAKE,
      protocol: 'ether_fi',
      contracts: [
        '0x35fA164735182de50811E8e2E824cFb9B6118ac2',  // eETH
        '0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee',  // weETH
        '0x308861A430be4cce5712b9e94f9fBc8c6a07F6a5',  // LiquidityPool
      ],
      selectors: {
        '0xa1903eab': 'deposit',
        '0x2e1a7d4d': 'withdraw',
        '0x9b3ebc21': 'stake',
        '0xf305d719': 'wrap',
        '0xea598db0': 'unwrap',
      },
    },
    'pendle': {
      actionType: ActionType.SWAP,
      protocol: 'pendle',
      contracts: [
        '0x00000000005BBB0EF59571E58418F9a4357b68A0',  // PendleRouter
        '0x1b6f2dEA9AC4A2e4bCDe8CbF5A7e8D4c8F5E8C2A',  // MarketFactory (legacy)
      ],
      selectors: {
        '0x1fc2991a': 'swapExactIn',
        '0x1c19b44e': 'swapExactOut',
        '0x7832e9e8': 'addLiquidity',
        '0x763b9e6d': 'removeLiquidity',
        '0x9b3ebc21': 'mintSy',
        '0x2e1a7d4d': 'redeemPy',
      },
    },
    'yearn': {
      actionType: ActionType.DEPOSIT,
      protocol: 'yearn',
      contracts: [
        '0x0000000000E66FE7e3c8Ea3F5ae3C1C1314014F5',  // yVault generic proxy
      ],
      selectors: {
        '0x6e553f65': 'deposit',
        '0x2e1a7d4d': 'withdraw',
        '0xb6b55f25': 'mint',
        '0xba087652': 'redeem',
      },
    },
    'convex': {
      actionType: ActionType.DEPOSIT,
      protocol: 'convex',
      contracts: [
        '0xF403C135812408BFbE8713b5A23a04b3D48AAE31',  // Booster
      ],
      selectors: {
        '0xb5b5e9e6': 'deposit',
        '0x2e1a7d4d': 'withdraw',
        '0x7d8601f0': 'claimRewards',
        '0x372500ab': 'stake',
      },
    },
    'compound_v3': {
      actionType: ActionType.DEPOSIT,
      protocol: 'compound_v3',
      contracts: ['0xc3d688B66703497DAA19211EEdff47f25384cdc3'],
      selectors: {
        '0xf3fef3a3': 'supply',
        '0x5fe3b567': 'withdraw',
        '0x6fa825ef': 'supplyTo',
        '0x8c9a0286': 'withdrawTo',
      },
    },
    'morpho_blue': {
      actionType: ActionType.DEPOSIT,
      protocol: 'morpho_blue',
      contracts: [
        '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',  // Morpho Blue
      ],
      selectors: {
        '0xbf488d24': 'supply',
        '0x935929c4': 'supplyCollateral',
        '0xc4b5e0e7': 'withdraw',
        '0x487a2f23': 'withdrawCollateral',
        '0xf3fef3a3': 'borrow',
        '0xba087652': 'repay',
      },
    },
    'morpho_aave_v3': {
      actionType: ActionType.DEPOSIT,
      protocol: 'morpho_aave_v3',
      contracts: [
        '0x33333bAc38dA8E7e6cE23E3e2Fb33Ccc5aA8A9F',  // Morpho-Aave V3
      ],
      selectors: {
        '0x47e7ef24': 'supply',
        '0x441a3e70': 'withdraw',
        '0xc5e368bc': 'borrow',
        '0x0b8f6729': 'repay',
      },
    },
    'rocket_pool': {
      actionType: ActionType.STAKE,
      protocol: 'rocket_pool',
      contracts: [
        '0xae78736Cd615f374D3085123A210448E74Fc6393',  // rETH
      ],
      selectors: {
        '0x9b3ebc21': 'deposit',
        '0x2e1a7d4d': 'withdraw',
      },
    },
    'lido': {
      actionType: ActionType.STAKE,
      protocol: 'lido',
      contracts: [
        '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',  // stETH
        '0x7f39C581F595B53c5cb19bD0b3f8dE6b9351cA5D',  // wstETH
        '0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1',  // WithdrawalQueue
      ],
      selectors: {
        '0xa1903eab': 'submit',
        '0xc51b3547': 'wrap',
        '0xea598db0': 'unwrap',
        '0x2e1a7d4d': 'withdraw',
      },
    },
    '1inch_v5': {
      actionType: ActionType.SWAP,
      protocol: '1inch_v5',
      contracts: ['0x111111125421cA6dc452d289314280a0f8842A65'],
      selectors: {
        '0xe449022e': 'swap',
        '0xfb6e531f': 'unoswap',
      },
    },
    '1inch_v6': {
      actionType: ActionType.SWAP,
      protocol: '1inch_v6',
      contracts: ['0x1111111254f36C509CeB3C9c4Ff631E963e3cD1c'],
      selectors: {
        '0xe449022e': 'swap',
        '0xfb6e531f': 'unoswap',
      },
    },
    'paraswap_v5': {
      actionType: ActionType.SWAP,
      protocol: 'paraswap_v5',
      contracts: ['0x216B4B4Ba9F3e719726886d34dD3F2F352a0dF3b'],
      selectors: {
        '0x902f1b0a': 'swap',
        '0x0d0b91c4': 'swapOnEVM',
      },
    },
    'zero_x_exchange': {
      actionType: ActionType.SWAP,
      protocol: '0x_exchange',
      contracts: ['0xDef1C0ded9bec7F1a1670819833240f027b25EfF'],
      selectors: {
        '0x22b6b934': 'transformERC20',
        '0xbc80f1a8': 'sellToUniswap',
        '0x6af479b2': 'multiplexSellTokenForToken',
      },
    },
    'stargate': {
      actionType: ActionType.BRIDGE,
      protocol: 'stargate',
      contracts: [
        '0x8731d54E9D02c286767d56ac03e8037C07e01e98',  // Stargate Router
      ],
      selectors: {
        '0x9b3ebc21': 'swap',
        '0x2f5ab6d8': 'addLiquidity',
        '0xbf7e2238': 'removeLiquidity',
        '0xf19a6c3c': 'instantRedeemLocal',
      },
    },
    'circle_cctp': {
      actionType: ActionType.BRIDGE,
      protocol: 'circle_cctp',
      contracts: [
        '0xBd3fa81B58Ba92a82136038B25aDec7066af3155',  // TokenMessenger
      ],
      selectors: {
        '0x6fd87cea': 'depositForBurn',
        '0x37a64b00': 'replaceDepositForBurn',
      },
    },
    'across': {
      actionType: ActionType.BRIDGE,
      protocol: 'across',
      contracts: ['0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5'],
      selectors: {
        '0x6e742a6d': 'deposit',
        '0x27b5b1c0': 'fillRelay',
      },
    },
    'weth': {
      actionType: ActionType.SWAP,
      protocol: 'weth',
      contracts: ['0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'],
      selectors: {
        '0xd0e30db0': 'deposit',
        '0x2e1a7d4d': 'withdraw',
      },
    },
  },

  // ─── Arbitrum (chainId: 42161) ───
  42161: {
    'uniswap_v3': {
      actionType: ActionType.SWAP,
      protocol: 'uniswap_v3',
      contracts: [
        '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
      ],
      selectors: {
        '0x3593564c': 'exactInput',
        '0x414bf389': 'exactInputSingle',
        '0xf28c0498': 'exactOutput',
        '0xdb3e2198': 'exactOutputSingle',
      },
    },
    'aave_v3': {
      actionType: ActionType.DEPOSIT,
      protocol: 'aave_v3',
      contracts: ['0x794a61358D6845594F94dc1DB02A252b5b4814aD'],
      selectors: {
        '0xe8eda9df': 'supply',
        '0x69328dec': 'withdraw',
        '0x474cf53d': 'supplyWithPermit',
      },
    },
  },

  // ─── Optimism (chainId: 10) ───
  10: {
    'uniswap_v3': {
      actionType: ActionType.SWAP,
      protocol: 'uniswap_v3',
      contracts: [
        '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
      ],
      selectors: {
        '0x3593564c': 'exactInput',
        '0x414bf389': 'exactInputSingle',
        '0xf28c0498': 'exactOutput',
        '0xdb3e2198': 'exactOutputSingle',
      },
    },
  },
  // ─── Base (chainId: 8453) ───
  8453: {
    'uniswap_v3': {
      actionType: ActionType.SWAP,
      protocol: 'uniswap_v3',
      contracts: [
        '0x2626664c2603336E57B271c5C0b26F421741e481',
        '0x6b3e6171f992D9E7e8CCE609f8c84E54C94E4F78',
      ],
      selectors: {
        '0x3593564c': 'exactInput',
        '0x414bf389': 'exactInputSingle',
        '0xf28c0498': 'exactOutput',
        '0xdb3e2198': 'exactOutputSingle',
      },
    },
  },
  // ─── Polygon (chainId: 137) ───
  137: {
    'uniswap_v3': {
      actionType: ActionType.SWAP,
      protocol: 'uniswap_v3',
      contracts: [
        '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
      ],
      selectors: {
        '0x3593564c': 'exactInput',
        '0x414bf389': 'exactInputSingle',
        '0xf28c0498': 'exactOutput',
        '0xdb3e2198': 'exactOutputSingle',
      },
    },
  },
};

/**
 * Common token addresses for decimal resolution.
 */
export const COMMON_TOKENS: Record<number, Record<string, { address: string; decimals: number }>> = {
  1: {
    ETH:  { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
    WETH: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
    USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    DAI:  { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
    WBTC: { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
  },
  42161: {
    ETH:  { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
    USDC: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
    USDT: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
  },
  10: {
    ETH:  { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
    USDC: { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6 },
  },
  8453: {
    ETH:  { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
    USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
  },
  137: {
    ETH:  { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
    USDC: { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
    WETH: { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18 },
  },
};

export function getContractAddresses(chainId: number): string[] {
  const chain = PROTOCOL_REGISTRY[chainId];
  if (!chain) return [];
  const addresses: string[] = [];
  for (const entry of Object.values(chain)) {
    addresses.push(...entry.contracts);
  }
  return addresses;
}

export function findProtocolByAddress(chainId: number, address: string): ProtocolEntry | null {
  const chain = PROTOCOL_REGISTRY[chainId];
  if (!chain) return null;
  const addr = address.toLowerCase();
  for (const entry of Object.values(chain)) {
    if (entry.contracts.some(c => c.toLowerCase() === addr)) {
      return entry;
    }
  }
  return null;
}
