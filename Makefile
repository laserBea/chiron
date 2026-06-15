# ──────── Chiron Makefile ────────
# Usage: make build    # compile contracts
#        make test     # run contract tests
#        make deploy   # deploy to Sepolia
#        make all      # build + test + deploy

-include .env
export

.PHONY: build test deploy clean verify

build:
	cd contracts && forge build

test: build
	cd contracts && forge test -vvv

deploy-sepolia:
	cd contracts && forge script script/Deploy.s.sol \
		--rpc-url $(ETHEREUM_RPC) \
		--private-key $(PRIVATE_KEY) \
		--broadcast \
		--verify \
		--etherscan-api-key $(ETHERSCAN_API_KEY) \
		--slow

deploy-arbitrum:
	cd contracts && forge script script/Deploy.s.sol \
		--rpc-url $(ARBITRUM_RPC) \
		--private-key $(PRIVATE_KEY) \
		--broadcast

deploy-all: deploy-sepolia deploy-arbitrum

verify:
	cd contracts && forge verify-contract \
		$(ADDRESS) src/Chiron.sol:Chiron \
		--chain $(CHAIN_ID) \
		--etherscan-api-key $(ETHERSCAN_API_KEY)

check-tx:
	cast tx $(TX_HASH) --chain $(CHAIN_ID)

check-receipt:
	cast call $(CHIRON_ADDRESS) "getReceipt(bytes32)((bytes32,bytes32,address,uint8,uint8,uint256,uint256))" $(TX_HASH) --chain $(CHAIN_ID)

clean:
	cd contracts && forge clean
	rm -rf sdk/dist

install:
	pip install slither-analyzer 2>/dev/null || true
	cd sdk && npm install
	cd verifier && npm install 2>/dev/null || true
	cd webhook && npm install 2>/dev/null || true

# ──────── Local Anvil ────────

anvil-start:
	@echo "Starting Anvil on :8545..."
	@anvil &
	@sleep 2
	@echo "Anvil ready"

deploy-local: build
	forge script contracts/script/Deploy.s.sol \
		--rpc-url $(ETHEREUM_RPC) \
		--private-key $(PRIVATE_KEY) \
		--broadcast \
		--slow

local: deploy-local
	@echo "=== Deployment complete ==="
	@echo "Chiron address:"
	@cat broadcast/Deploy.s.sol/31337/run-latest.json | python3 -c "import sys,json; r=json.load(sys.stdin); t=r['transactions'][0]; print(t['contractAddress'])" 2>/dev/null || echo "Check broadcast/ directory"

anvil-stop:
	@pkill anvil 2>/dev/null; echo "Anvil stopped"
