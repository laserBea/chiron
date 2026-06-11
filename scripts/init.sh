#!/bin/bash
# Chiron project initialization script

set -e

echo "=== Chiron — Agent Transaction Security Middleware ==="
echo ""

# Install SDK dependencies
echo "[1/3] Installing SDK dependencies..."
cd "$(dirname "$0")/../sdk"
npm install

# Install Foundry dependencies
echo "[2/3] Installing Foundry dependencies..."
cd "$(dirname "$0")/../contracts"
forge install --no-commit 2>/dev/null || echo "  ⚠️  forge not found, skipping. Install foundry: https://book.getfoundry.sh"

echo "[3/3] Done!"
echo ""
echo "Next steps:"
echo "  cd sdk && npm run build    # Build the SDK"
echo "  cd contracts && forge build  # Build the contracts"
