---
name: Protocol Registration
about: Submit a new protocol for the Chiron registry
title: '[REGISTRY] Protocol: <name>'
labels: registry
---

## Protocol Information

- **Name:** <!-- e.g. uniswap_v3 -->
- **Action Type:** <!-- SWAP / APPROVE / BRIDGE / DEPOSIT / WITHDRAW / STAKE -->
- **Chain(s):** <!-- e.g. Ethereum(1), Arbitrum(42161) -->

## Contract Addresses

<!-- List all relevant contracts -->
| Contract | Address | Chain |
|---|---|---|
| Router | 0x... | 1 |
| Pool | 0x... | 1 |

## Function Selectors

| Selector | Function Name | Action |
|---|---|---|
| 0x414bf389 | exactInputSingle | SWAP |
| 0x3593564c | exactInput | SWAP |

## Verification

- [ ] I confirm the contract addresses are correct
- [ ] I confirm the function selectors match the described actions
- [ ] This protocol is deployed on mainnet
