#!/bin/bash
# Phase 2B-2-I-H: GitHub Actions HTTP Server 启动脚本

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║  Phase 2B-2-I-H: GitHub Actions HTTP Server           ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# 加载环境变量
set -a && source ~/.openclaw/workspace/.env.github && set +a

# 检查环境变量
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ 错误：GITHUB_TOKEN 未设置"
    exit 1
fi

if [ -z "$GITHUB_WEBHOOK_SECRET" ]; then
    echo "❌ 错误：GITHUB_WEBHOOK_SECRET 未设置"
    exit 1
fi

echo "✅ 环境变量检查通过"
echo ""

# 启动服务器
echo "启动 GitHub Actions HTTP Server..."
echo "端口：3000"
echo "Base Path: /api"
echo ""

# 使用 ts-node 运行（如果有）或编译后运行
if command -v ts-node &> /dev/null; then
    echo "使用 ts-node 运行..."
    cd ~/.openclaw/workspace
    GITHUB_TOKEN="$GITHUB_TOKEN" \
    GITHUB_WEBHOOK_SECRET="$GITHUB_WEBHOOK_SECRET" \
    PORT=3000 \
    BASE_PATH=/api \
    ts-node src/connectors/github-actions/github_actions_http_server.ts
else
    echo "❌ ts-node 未安装"
    echo ""
    echo "请先安装："
    echo "  npm install -g ts-node typescript"
    exit 1
fi
