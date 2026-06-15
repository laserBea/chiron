# Chiron Smart Contracts

## Contracts

| Contract | Path | Description |
|---|---|---|
| Chiron | src/Chiron.sol | VerificationStore + CircuitBreaker |
| BondPool | src/BondPool.sol | Agent staking |
| CircuitBreaker | src/CircuitBreaker.sol | Auto-pause on failures |
| IntentTemplateRegistry | src/IntentTemplateRegistry.sol | Protocol registry |

## Deploy

```bash
cp ../.env.example ../.env
# Edit .env with your keys
make -C ../ deploy-sepolia
```

## Test

```bash
forge test -vvv
```

## Verify on Etherscan

```bash
forge verify-contract $ADDRESS src/Chiron.sol:Chiron --chain 11155111
```
