#!/bin/bash
# GitHub Live Validation 脚本
# Phase 2B-1-L - 真实 GitHub 环境端到端验证
#
# 使用方法：
#   ./scripts/github-live-validate.sh
#
# 环境变量：
#   GITHUB_TEST_OWNER - 测试仓库 Owner
#   GITHUB_TEST_REPO - 测试仓库名称
#   GITHUB_TOKEN - GitHub API Token
#   GITHUB_WEBHOOK_SECRET - Webhook Secret
#   GITHUB_WEBHOOK_URL - Webhook URL (ngrok 等)

set -e

echo "🔍 GitHub Live Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. 检查环境变量
echo "【1/6】检查环境变量..."

required_vars=(
  "GITHUB_TEST_OWNER"
  "GITHUB_TEST_REPO"
  "GITHUB_TOKEN"
  "GITHUB_WEBHOOK_SECRET"
)

missing_vars=()
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    missing_vars+=("$var")
  fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
  echo "❌ 缺少必需的环境变量:"
  for var in "${missing_vars[@]}"; do
    echo "   - $var"
  done
  echo ""
  echo "请设置环境变量后重试:"
  echo "  export GITHUB_TEST_OWNER=your-owner"
  echo "  export GITHUB_TEST_REPO=your-repo"
  echo "  export GITHUB_TOKEN=your-token"
  echo "  export GITHUB_WEBHOOK_SECRET=your-secret"
  exit 1
fi

echo "   ✅ 所有必需环境变量已设置"
echo "   仓库：${GITHUB_TEST_OWNER}/${GITHUB_TEST_REPO}"
echo ""

# 2. 验证 GitHub API 连接
echo "【2/6】验证 GitHub API 连接..."

api_response=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: token ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/${GITHUB_TEST_OWNER}/${GITHUB_TEST_REPO}")

if [ "$api_response" -ge 200 ] && [ "$api_response" -lt 300 ]; then
  echo "   ✅ GitHub API 连接正常 (${api_response})"
else
  echo "   ❌ GitHub API 连接失败 (${api_response})"
  echo "   请检查 GITHUB_TOKEN 和仓库权限"
  exit 1
fi
echo ""

# 3. 检查 Webhook 配置
echo "【3/6】检查 Webhook 配置..."

if [ -n "${GITHUB_WEBHOOK_URL}" ]; then
  echo "   ✅ Webhook URL 已配置：${GITHUB_WEBHOOK_URL}"
  
  # 测试 Webhook 可达性
  webhook_test=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"test": true}' \
    "${GITHUB_WEBHOOK_URL}" || echo "000")
  
  if [ "$webhook_test" -ge 200 ] && [ "$webhook_test" -lt 300 ]; then
    echo "   ✅ Webhook 端点可达 (${webhook_test})"
  else
    echo "   ⚠️  Webhook 端点不可达 (${webhook_test})"
    echo "   请确保本地服务器正在运行且 URL 正确"
  fi
else
  echo "   ⚠️  Webhook URL 未配置"
  echo "   如需接收真实 webhook，请设置 GITHUB_WEBHOOK_URL"
fi
echo ""

# 4. 创建测试 PR (可选)
echo "【4/6】创建测试 PR..."

if [ "${GITHUB_CREATE_TEST_PR:-false}" = "true" ]; then
  echo "   📝 创建测试 PR..."
  
  # 创建测试分支
  base_sha=$(curl -s -H "Authorization: token ${GITHUB_TOKEN}" \
    "https://api.github.com/repos/${GITHUB_TEST_OWNER}/${GITHUB_TEST_REPO}/git/refs/heads/main" \
    | jq -r '.object.sha')
  
  if [ -n "$base_sha" ] && [ "$base_sha" != "null" ]; then
    # 创建测试分支
    branch_name="test/pr-validation-$(date +%s)"
    
    curl -s -X POST \
      -H "Authorization: token ${GITHUB_TOKEN}" \
      -H "Accept: application/vnd.github.v3+json" \
      -d "{\"ref\":\"refs/heads/${branch_name}\",\"sha\":\"${base_sha}\"}" \
      "https://api.github.com/repos/${GITHUB_TEST_OWNER}/${GITHUB_TEST_REPO}/git/refs"
    
    echo "   ✅ 测试分支创建成功：${branch_name}"
    echo "   ⚠️  请手动创建 PR 以继续验证"
  else
    echo "   ❌ 无法获取 main 分支 SHA"
  fi
else
  echo "   ⏭️  跳过测试 PR 创建 (GITHUB_CREATE_TEST_PR=false)"
  echo "   请使用现有 PR 进行验证"
fi
echo ""

# 5. 运行验证脚本
echo "【5/6】运行端到端验证脚本..."

export GITHUB_VALIDATION_MODE=live

if command -v ts-node &> /dev/null; then
  ts-node scripts/validate_github_connector.ts
  validation_exit=$?
  
  if [ $validation_exit -eq 0 ]; then
    echo "   ✅ 验证脚本执行成功"
  elif [ $validation_exit -eq 1 ]; then
    echo "   🟡 验证脚本部分通过"
  else
    echo "   ❌ 验证脚本失败"
  fi
else
  echo "   ⚠️  ts-node 未安装，跳过验证脚本"
  echo "   请手动运行：ts-node scripts/validate_github_connector.ts"
fi
echo ""

# 6. 发送测试 Webhook
echo "【6/6】发送测试 Webhook..."

if [ -n "${GITHUB_WEBHOOK_URL}" ]; then
  export GITHUB_WEBHOOK_URL
  
  if command -v ts-node &> /dev/null; then
    ts-node scripts/test_github_webhook.ts all
  else
    echo "   ⚠️  ts-node 未安装，跳过 Webhook 测试"
  fi
else
  echo "   ⏭️  跳过 Webhook 测试 (GITHUB_WEBHOOK_URL 未设置)"
fi
echo ""

# 总结
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Live Validation 完成"
echo ""
echo "下一步:"
echo "1. 在 GitHub 仓库配置 Webhook:"
echo "   Settings → Webhooks → Add webhook"
echo "   Payload URL: ${GITHUB_WEBHOOK_URL:-<未设置>}"
echo "   Content type: application/json"
echo "   Secret: ${GITHUB_WEBHOOK_SECRET}"
echo "   Events: Pull requests, Check suites"
echo ""
echo "2. 创建或打开一个测试 PR"
echo ""
echo "3. 请求 Review:"
echo "   Reviewers → 选择测试 reviewer"
echo ""
echo "4. 在 OpenClaw 中查看:"
echo "   oc inbox"
echo "   /inbox (Telegram)"
echo ""
echo "5. 执行动作:"
echo "   oc approve <approval_id>"
echo "   或在 Telegram 中点击 Approve 按钮"
echo ""
echo "6. 验证 GitHub Review 状态更新"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
