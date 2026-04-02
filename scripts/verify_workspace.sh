#!/usr/bin/env bash
set -euo pipefail

echo "==> 验证五层目录"
for d in products platform runtime knowledge governance; do
 if [ -d "$d" ]; then
 echo "[OK] $d"
 else
 echo "[ERR] 缺少目录: $d"
 fi
done

echo
echo "==> 验证产品层"
for d in \
 products/helix_m3 \
 products/trading_v5_3_ref \
 products/trading_v5_4_rc
do
 if [ -d "$d" ]; then
 echo "[OK] $d"
 else
 echo "[WARN] 缺少目录: $d"
 fi
done

echo
echo "==> 验证平台层"
for d in \
 platform/autoheal \
 platform/ocnmps \
 platform/superpowers \
 platform/skills
do
 if [ -d "$d" ]; then
 echo "[OK] $d"
 else
 echo "[WARN] 缺少目录: $d"
 fi
done

echo
echo "==> 验证运行层"
for d in runtime/config runtime/memory runtime/logs runtime/health; do
 if [ -e "$d" ]; then
 echo "[OK] $d"
 else
 echo "[WARN] 缺少: $d"
 fi
done

echo
echo "==> 验证治理层文件"
for f in \
 governance/AGENTS.md \
 governance/SOUL.md \
 governance/MEMORY.md \
 governance/HEARTBEAT.md \
 governance/USER.md \
 governance/TOOLS.md
do
 if [ -f "$f" ]; then
 echo "[OK] $f"
 else
 echo "[WARN] 缺少文件: $f"
 fi
done

echo
echo "==> 验证兼容软链接"
for l in \
 helix_crypto_trading_platform \
 trading_system_v5_3 \
 trading_system_v5_4 \
 autoheal \
 ocnmps \
 superpowers \
 skills \
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
 TOOLS.md
do
 if [ -L "$l" ]; then
 echo "[OK] 软链接: $l -> $(readlink "$l")"
 else
 echo "[INFO] 非软链接或不存在: $l"
 fi
done
