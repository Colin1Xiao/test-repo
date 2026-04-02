#!/usr/bin/env bash
set -euo pipefail

echo "将创建："
cat <<'EOF'
products/
products/legacy/
platform/
runtime/
runtime/health/
knowledge/
knowledge/archive/
knowledge/archive/legacy/
knowledge/archive/backups/ocnmps/
knowledge/archive/deprecated_docs/
knowledge/archive/old_scripts/
governance/
EOF

echo
echo "将迁移的目录/文件："

for p in \
 helix_crypto_trading_platform \
 trading_system_v5_3 \
 trading_system_v5_4 \
 "小龙加密货币交易系统" \
 autoheal \
 ocnmps \
 superpowers \
 skills \
 ocnmps-old-backup \
 config \
 memory \
 logs \
 docs \
 reports \
 research \
 archive \
 AGENTS.md \
 SOUL.md \
 MEMORY.md \
 HEARTBEAT.md \
 USER.md \
 TOOLS.md \
 openclaw-health-check.json
do
 if [ -e "$p" ]; then
 echo " [FOUND] $p"
 else
 echo " [MISS ] $p"
 fi
done
