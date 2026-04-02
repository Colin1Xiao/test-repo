#!/usr/bin/env bash
set -euo pipefail

echo "==> [1/8] 检查当前目录"
pwd

echo "==> [2/8] 创建新目录骨架"
mkdir -p products
mkdir -p products/legacy

mkdir -p platform

mkdir -p runtime
mkdir -p runtime/health

mkdir -p knowledge
mkdir -p knowledge/archive
mkdir -p knowledge/archive/legacy
mkdir -p knowledge/archive/backups/ocnmps
mkdir -p knowledge/archive/deprecated_docs
mkdir -p knowledge/archive/old_scripts

mkdir -p governance

echo "==> [3/8] 迁移产品层"
[ -d "helix_crypto_trading_platform" ] && mv helix_crypto_trading_platform products/helix_m3
[ -d "trading_system_v5_3" ] && mv trading_system_v5_3 products/trading_v5_3_ref
[ -d "trading_system_v5_4" ] && mv trading_system_v5_4 products/trading_v5_4_rc

if [ -d "小龙加密货币交易系统" ]; then
 mv "小龙加密货币交易系统" products/legacy/xiaolong_crypto_trading_system
fi

echo "==> [4/8] 迁移平台层"
[ -d "autoheal" ] && mv autoheal platform/autoheal
[ -d "ocnmps" ] && mv ocnmps platform/ocnmps
[ -d "superpowers" ] && mv superpowers platform/superpowers
[ -d "skills" ] && mv skills platform/skills

if [ -d "ocnmps-old-backup" ]; then
 mv ocnmps-old-backup knowledge/archive/backups/ocnmps/ocnmps-old-backup
fi

echo "==> [5/8] 迁移运行层"
[ -d "config" ] && mv config runtime/config
[ -d "memory" ] && mv memory runtime/memory
[ -d "logs" ] && mv logs runtime/logs

if [ -f "openclaw-health-check.json" ]; then
 mv openclaw-health-check.json runtime/health/openclaw-health-check.json
fi

echo "==> [6/8] 迁移知识层"
[ -d "docs" ] && mv docs knowledge/docs
[ -d "reports" ] && mv reports knowledge/reports
[ -d "research" ] && mv research knowledge/research
[ -d "archive" ] && mv archive/* knowledge/archive/ 2>/dev/null || true
[ -d "archive" ] && rmdir archive 2>/dev/null || true

echo "==> [7/8] 迁移治理层"
[ -f "AGENTS.md" ] && mv AGENTS.md governance/AGENTS.md
[ -f "SOUL.md" ] && mv SOUL.md governance/SOUL.md
[ -f "MEMORY.md" ] && mv MEMORY.md governance/MEMORY.md
[ -f "HEARTBEAT.md" ] && mv HEARTBEAT.md governance/HEARTBEAT.md
[ -f "USER.md" ] && mv USER.md governance/USER.md
[ -f "TOOLS.md" ] && mv TOOLS.md governance/TOOLS.md

echo "==> [8/8] 创建兼容软链接"
ln -sfn products/helix_m3 helix_crypto_trading_platform
ln -sfn products/trading_v5_3_ref trading_system_v5_3
ln -sfn products/trading_v5_4_rc trading_system_v5_4
ln -sfn products/legacy/xiaolong_crypto_trading_system "小龙加密货币交易系统"

ln -sfn platform/autoheal autoheal
ln -sfn platform/ocnmps ocnmps
ln -sfn platform/superpowers superpowers
ln -sfn platform/skills skills

ln -sfn runtime/config config
ln -sfn runtime/memory memory
ln -sfn runtime/logs logs
ln -sfn runtime/health/openclaw-health-check.json openclaw-health-check.json

ln -sfn knowledge/docs docs
ln -sfn knowledge/reports reports
ln -sfn knowledge/research research
ln -sfn knowledge/archive archive

ln -sfn governance/AGENTS.md AGENTS.md
ln -sfn governance/SOUL.md SOUL.md
ln -sfn governance/MEMORY.md MEMORY.md
ln -sfn governance/HEARTBEAT.md HEARTBEAT.md
ln -sfn governance/USER.md USER.md
ln -sfn governance/TOOLS.md TOOLS.md

echo "==> 完成。当前顶层结构："
find . -maxdepth 2 -mindepth 1 | sort
