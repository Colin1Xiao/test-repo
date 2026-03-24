#!/bin/bash
# Fix node-llama-cpp native compilation

cd /usr/local/lib/node_modules/openclaw

echo "=== Step 1: Check cmake ==="
which cmake || echo "cmake not found - need to install"

echo "=== Step 2: Run postinstall ==="
cd node_modules/node-llama-cpp
node ./dist/cli/cli.js postinstall

echo "=== Step 3: Check for .node files ==="
find . -name "*.node" 2>/dev/null

echo "=== Done ==="
