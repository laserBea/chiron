export const DEPLOY_CONFIG: Record<number, { rpc: string; explorer: string }> = {
  1:      { rpc: 'https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}', explorer: 'https://etherscan.io' },
  42161:  { rpc: 'https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}', explorer: 'https://arbiscan.io' },
  10:     { rpc: 'https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}', explorer: 'https://optimistic.etherscan.io' },
  8453:   { rpc: 'https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}', explorer: 'https://basescan.org' },
  137:    { rpc: 'https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}', explorer: 'https://polygonscan.com' },
};
