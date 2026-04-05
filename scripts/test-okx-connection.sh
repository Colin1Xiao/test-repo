#!/bin/bash
# OKX 连接测试快速脚本
# 使用方式：./test-okx-connection.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/okx-proxy-config.sh"

echo "============================================================"
echo "OKX 连接测试"
echo "============================================================"
echo ""

# 检查配置文件
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ 配置文件不存在：$CONFIG_FILE"
    exit 1
fi

# 加载配置
source "$CONFIG_FILE"

echo "配置信息:"
echo "  代理：$OKX_PROXY_HTTP"
echo "  API 端点：$OKX_API_BASE"
echo "  备用端点：$OKX_API_BASE_BACKUP"
echo "  超时：${OKX_CONNECT_TIMEOUT}s"
echo ""

echo "============================================================"
echo "测试主端点"
echo "============================================================"
test_okx_connection
MAIN_STATUS=$?

echo ""
echo "============================================================"
echo "测试备用端点"
echo "============================================================"

if [ "$OKX_USE_PROXY" = "true" ]; then
    response=$(curl -x "$OKX_PROXY_HTTP" -s --max-time "$OKX_CONNECT_TIMEOUT" \
        "$OKX_API_BASE_BACKUP/api/v5/public/time" 2>&1)
else
    response=$(curl -s --max-time "$OKX_CONNECT_TIMEOUT" \
        "$OKX_API_BASE_BACKUP/api/v5/public/time" 2>&1)
fi

if echo "$response" | grep -q '"code":"0"'; then
    ts=$(echo "$response" | grep -o '"ts":"[^"]*"' | cut -d'"' -f4)
    echo "✅ OKX 备用端点连接成功 - 服务器时间：$ts"
    BACKUP_STATUS=0
else
    echo "❌ OKX 备用端点连接失败：$response"
    BACKUP_STATUS=1
fi

echo ""
echo "============================================================"
echo "测试结果汇总"
echo "============================================================"

if [ $MAIN_STATUS -eq 0 ]; then
    echo "✅ 主端点：正常"
else
    echo "❌ 主端点：失败"
fi

if [ $BACKUP_STATUS -eq 0 ]; then
    echo "✅ 备用端点：正常"
else
    echo "❌ 备用端点：失败"
fi

echo ""

if [ $MAIN_STATUS -eq 0 ] || [ $BACKUP_STATUS -eq 0 ]; then
    echo "✅ OKX 网络可用，可以执行 V5.4 实盘验证"
    exit 0
else
    echo "❌ OKX 网络不可用，请检查："
    echo "   1. ClashX 是否运行"
    echo "   2. 代理端口是否正确"
    echo "   3. DNS 配置 (建议：8.8.8.8)"
    exit 1
fi
