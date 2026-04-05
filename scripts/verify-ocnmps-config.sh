#!/bin/bash
# 验证 OCNMPS 配置是否正确加载

echo "╔════════════════════════════════════════════════════════╗"
echo "║  OCNMPS 配置验证                                       ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# 1. 检查配置文件
echo "1. 配置文件检查:"
CONFIG_FILE="$HOME/.openclaw/plugins/ocnmps-router/ocnmps_plugin_config.json"
if [ -f "$CONFIG_FILE" ]; then
    GRAY_RATIO=$(cat "$CONFIG_FILE" | grep -o '"grayRatio":[0-9.]*' | cut -d: -f2)
    echo "   配置文件：$CONFIG_FILE"
    echo "   grayRatio: $GRAY_RATIO"
    if [ "$GRAY_RATIO" = "0.30" ]; then
        echo "   ✅ 配置正确"
    else
        echo "   ❌ 配置错误 (预期 0.30)"
    fi
else
    echo "   ❌ 配置文件不存在"
fi

echo ""

# 2. 检查核心代码
echo "2. 核心代码检查:"
CORE_FILE="$HOME/.openclaw/plugins/ocnmps-router/ocnmps_core.js"
if [ -f "$CORE_FILE" ]; then
    DEFAULT_VALUE=$(grep "grayRatio ?? " "$CORE_FILE" | head -1 | grep -oE '0\.[0-9]+')
    echo "   核心文件：$CORE_FILE"
    echo "   默认值：$DEFAULT_VALUE"
    if [ "$DEFAULT_VALUE" = "0.30" ]; then
        echo "   ✅ 代码正确"
    else
        echo "   ❌ 代码错误 (预期 0.30)"
    fi
else
    echo "   ❌ 核心文件不存在"
fi

echo ""

# 3. 检查 plugin.js
echo "3. plugin.js 检查:"
PLUGIN_FILE="$HOME/.openclaw/plugins/ocnmps-router/plugin.js"
if [ -f "$PLUGIN_FILE" ]; then
    FALLBACK_VALUE=$(grep "grayRatio.*0\." "$PLUGIN_FILE" | head -1 | grep -oE '0\.[0-9]+')
    echo "   插件文件：$PLUGIN_FILE"
    echo "   fallback 值：$FALLBACK_VALUE"
    if [ "$FALLBACK_VALUE" = "0.30" ]; then
        echo "   ✅ 代码正确"
    else
        echo "   ❌ 代码错误 (预期 0.30)"
    fi
else
    echo "   ❌ 插件文件不存在"
fi

echo ""

# 4. 检查 Gateway 状态
echo "4. Gateway 状态:"
openclaw gateway status 2>&1 | head -5

echo ""
echo "验证完成。"
