#!/bin/bash
echo "=== Chiron L1 Benchmark ==="
echo "Chain ID: 1 | Security Level: standard"
echo "---"

echo "1. L1 Latency Test (100 iterations)..."
total=0
for i in $(seq 1 100); do
  start=$(date +%s%N)
  npx ts-node -e "
    const {ProtocolRegistry} = require('./src/registry');
    const {ConsistencyChecker} = require('./src/checker');
    const r = new ProtocolRegistry(1);
    const c = new ConsistencyChecker(r);
    c.check({actionType:1,protocolHash:'0x00',tokenIn:'',tokenOut:'',amount:'',amountOutMin:'',receiver:'',deadline:1,customData:''}, {to:'0xE592427A0AEce92De3Edee1F18E0157C05861564',data:'0x414bf389',value:'0'});
  " 2>/dev/null
  end=$(date +%s%N)
  total=$((total + (end - start)))
done
avg=$((total / 100 / 1000000))
echo "   Avg L1 latency: ${avg}ms"
echo ""
echo "2. Protocol Registry Coverage"
npx ts-node -e "
  const {ProtocolRegistry} = require('./src/registry');
  [1,42161,10,8453,137].forEach(c => {
    const r = new ProtocolRegistry(c);
    console.log('   Chain ' + c + ': ' + r.getProtocolNames().length + ' protocols');
  });
" 2>/dev/null
echo ""
echo "3. Memory usage"
npx ts-node -e "const os = require('os'); console.log('   RSS: ' + (process.memoryUsage().rss / 1024 / 1024).toFixed(0) + 'MB')" 2>/dev/null
echo "---"
echo "Benchmark complete."
