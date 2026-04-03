#!/bin/bash
# GitHub Live Validation 配置脚本
# 自动引导用户完成配置

set -e

echo "🔧 GitHub Live Validation 配置向导"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. 检查并启动 ngrok
echo "【1/5】检查 ngrok..."

ngrok_pid=$(pgrep ngrok || echo "")

if [ -n "$ngrok_pid" ]; then
  echo "   ✅ ngrok 正在运行 (PID: $ngrok_pid)"
  
  # 获取 ngrok URL
  ngrok_url=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url' 2>/dev/null || echo "")
  
  if [ -n "$ngrok_url" ]; then
    echo "   ✅ ngrok URL: $ngrok_url"
    export NGROK_URL="$ngrok_url"
  else
    echo "   ⚠️  无法获取 ngrok URL"
  fi
else
  echo "   ⚠️  ngrok 未运行"
  echo ""
  echo "   请启动 ngrok:"
  echo "   ngrok http 18789"
  echo ""
  read -p "   按回车继续，或 Ctrl+C 退出启动 ngrok..."
  
  # 尝试自动启动
  ngrok http 18789 > /dev/null 2>&1 &
  NGROK_PID=$!
  echo "   ✅ ngrok 已启动 (PID: $NGROK_PID)"
  
  # 等待 ngrok 启动
  sleep 2
  
  # 获取 ngrok URL
  for i in {1..5}; do
    ngrok_url=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url' 2>/dev/null || echo "")
    if [ -n "$ngrok_url" ]; then
      break
    fi
    sleep 1
  done
  
  if [ -n "$ngrok_url" ]; then
    echo "   ✅ ngrok URL: $ngrok_url"
    export NGROK_URL="$ngrok_url"
  else
    echo "   ❌ 无法获取 ngrok URL，请手动启动"
    exit 1
  fi
fi

echo ""

# 2. 获取 GitHub Token
echo "【2/5】配置 GitHub Token..."
echo ""
echo "   创建步骤:"
echo "   1. 访问：https://github.com/settings/tokens"
echo "   2. 点击 'Generate new token (classic)'"
echo "   3. 选择权限：repo + admin:repo_hook"
echo "   4. 生成并复制 token"
echo ""
read -p "   输入 GitHub Token: " GITHUB_TOKEN

if [ -z "$GITHUB_TOKEN" ]; then
  echo "   ❌ Token 不能为空"
  exit 1
fi

echo "   ✅ Token 已设置"
echo ""

# 3. 生成或确认 Webhook Secret
echo "【3/5】配置 Webhook Secret..."
echo ""

if [ -n "$GITHUB_WEBHOOK_SECRET" ]; then
  echo "   ✅ 使用现有 Secret: ${GITHUB_WEBHOOK_SECRET:0:8}..."
else
  # 生成新 Secret
  GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 32)
  echo "   ✅ 已生成新 Secret: ${GITHUB_WEBHOOK_SECRET:0:8}..."
fi

echo ""

# 4. 获取测试仓库信息
echo "【4/5】配置测试仓库..."
echo ""
read -p "   GitHub Username: " GITHUB_TEST_OWNER
read -p "   测试仓库名称 [test-repo]: " GITHUB_TEST_REPO

GITHUB_TEST_REPO=${GITHUB_TEST_REPO:-test-repo}

if [ -z "$GITHUB_TEST_OWNER" ]; then
  echo "   ❌ Username 不能为空"
  exit 1
fi

echo "   ✅ 仓库：${GITHUB_TEST_OWNER}/${GITHUB_TEST_REPO}"
echo ""

# 5. 验证 GitHub API 连接
echo "【5/5】验证 GitHub API 连接..."

api_response=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: token ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/user")

if [ "$api_response" -ge 200 ] && [ "$api_response" -lt 300 ]; then
  echo "   ✅ GitHub API 连接正常"
  
  # 获取用户名
  github_user=$(curl -s -H "Authorization: token ${GITHUB_TOKEN}" \
    "https://api.github.com/user" | jq -r '.login' 2>/dev/null || echo "")
  
  if [ -n "$github_user" ]; then
    echo "   ✅ 已验证用户：$github_user"
  fi
else
  echo "   ⚠️  GitHub API 连接失败 (${api_response})"
  echo "   请检查 Token 是否正确"
fi

echo ""

# 保存配置
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "保存配置..."

CONFIG_FILE="$HOME/.openclaw/workspace/.env.github"

cat > "$CONFIG_FILE" << EOF
# GitHub Live Validation 配置
# 生成时间：$(date -Iseconds)

GITHUB_TOKEN=$GITHUB_TOKEN
GITHUB_WEBHOOK_SECRET=$GITHUB_WEBHOOK_SECRET
GITHUB_TEST_OWNER=$GITHUB_TEST_OWNER
GITHUB_TEST_REPO=$GITHUB_TEST_REPO
GITHUB_WEBHOOK_URL=${NGROK_URL:-}/webhook/github
GITHUB_CREATE_TEST_PR=true
GITHUB_AUTO_CLEANUP=false
GITHUB_VALIDATION_MODE=live
EOF

echo "✅ 配置已保存到：$CONFIG_FILE"
echo ""
echo "下一步:"
echo "1. 运行验证脚本：./scripts/github-live-validate.sh"
echo "2. 在 GitHub 配置 Webhook:"
echo "   https://github.com/${GITHUB_TEST_OWNER}/${GITHUB_TEST_REPO}/settings/hooks"
echo "   Payload URL: ${NGROK_URL:-<ngrok-url>}/webhook/github"
echo "   Secret: ${GITHUB_WEBHOOK_SECRET}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "配置完成！"
