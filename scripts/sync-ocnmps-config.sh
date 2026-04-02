#!/bin/bash
# OCNMPS 配置同步检查脚本

echo "=== OCNMPS 配置同步检查 ==="

CORE_FILE="$HOME/.openclaw/plugins/ocnmps-router/ocnmps_core.js"
PLUGIN_FILE="$HOME/.openclaw/plugins/ocnmps-router/plugin.js"
CONFIG_FILE="$HOME/.openclaw/plugins/ocnmps-router/ocnmps_plugin_config.json"

# 提取各文件的意图列表
echo ""
echo "Core 文件意图:"
node -e "const c = require('$CORE_FILE'); const r = c.createOCNMPSRouterV3(); console.log(Object.keys(r.modelMapping).sort().join(', '));"

echo ""
echo "Plugin 文件意图:"
grep -A15 "modelMapping:" "$PLUGIN_FILE" | grep -E "^\s+[A-Z_]+:" | sed 's/:.*//' | tr -d ' ' | sort | tr '\n' ', ' && echo ""

if [ -f "$CONFIG_FILE" ]; then
  echo ""
  echo "配置文件意图:"
  cat "$CONFIG_FILE" | grep -E '"[A-Z_]+"[[:space:]]*:' | sed 's/":.*//' | sed 's/"//' | sort | tr '\n' ', ' && echo ""
fi

echo ""
echo "=== 配置一致性检查完成 ==="
