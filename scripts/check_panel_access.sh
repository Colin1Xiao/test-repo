#!/bin/bash
# 面板访问检查脚本
# 每次修改面板后运行此脚本验证

echo "=========================================="
echo "🔍 面板访问检查"
echo "=========================================="
echo ""

# 1. 检查本地访问
echo "1️⃣ 检查本地访问..."
LOCAL_RESULT=$(curl -s --connect-timeout 5 http://localhost:8765/dashboard/api/stats 2>&1)

if echo "$LOCAL_RESULT" | jq -e '.network' > /dev/null 2>&1; then
    echo "   ✅ 本地访问正常"
    LOCAL_PRICE=$(echo "$LOCAL_RESULT" | jq -r '.price')
    echo "   价格: \$$LOCAL_PRICE"
else
    echo "   ❌ 本地访问失败"
    echo "   请检查 server.main 是否运行"
fi

echo ""

# 2. 检查公网访问
echo "2️⃣ 检查公网访问..."
PUBLIC_URL="https://unpersonal-currently-amberly.ngrok-free.dev"
PUBLIC_RESULT=$(curl -s --connect-timeout 10 "$PUBLIC_URL/dashboard/api/stats" 2>&1)

if echo "$PUBLIC_RESULT" | jq -e '.network' > /dev/null 2>&1; then
    echo "   ✅ 公网访问正常"
    echo "   地址: $PUBLIC_URL"
else
    echo "   ❌ 公网访问失败"
    echo "   尝试重启 ngrok..."

    # 尝试重启 ngrok
    pkill -f ngrok 2>/dev/null
    sleep 1
    ngrok http 8765 > /dev/null 2>&1 &
    sleep 3

    # 再次检查
    PUBLIC_RESULT=$(curl -s --connect-timeout 10 "$PUBLIC_URL/dashboard/api/stats" 2>&1)
    if echo "$PUBLIC_RESULT" | jq -e '.network' > /dev/null 2>&1; then
        echo "   ✅ ngrok 重启后访问正常"
    else
        echo "   ❌ ngrok 重启后仍然失败"
        echo "   请手动检查 ngrok 配置"
    fi
fi

echo ""

# 3. 检查数据更新
echo "3️⃣ 检查数据更新..."
LIVE_STATE="/Users/colin/.openclaw/workspace/trading_system_v5_3/logs/live_state.json"

if [ -f "$LIVE_STATE" ]; then
    LAST_UPDATE=$(stat -f "%Sm" "$LIVE_STATE" 2>/dev/null || stat -c "%y" "$LIVE_STATE" 2>/dev/null)
    echo "   最后更新: $LAST_UPDATE"

    # 检查是否在 10 秒内更新
    CURRENT_TIME=$(date +%s)
    FILE_TIME=$(stat -f "%m" "$LIVE_STATE" 2>/dev/null || stat -c "%Y" "$LIVE_STATE" 2>/dev/null)
    DIFF=$((CURRENT_TIME - FILE_TIME))

    if [ $DIFF -lt 10 ]; then
        echo "   ✅ 数据实时更新中"
    else
        echo "   ⚠️ 数据更新延迟 ${DIFF} 秒"
    fi
else
    echo "   ❌ 数据文件不存在"
fi

echo ""
echo "=========================================="
echo "✅ 检查完成"
echo "=========================================="