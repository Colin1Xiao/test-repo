#!/bin/bash
# Phase 2B-3A: Jenkins Live Test Script
# Jenkins 实盘测试脚本

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║  Phase 2B-3A: Jenkins Live Validation                 ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# 检查环境变量
if [ -z "$JENKINS_BASE_URL" ]; then
    echo "❌ 错误：JENKINS_BASE_URL 未设置"
    echo ""
    echo "请先设置环境变量："
    echo "  export JENKINS_BASE_URL=http://jenkins-server:8080"
    echo "  export JENKINS_USERNAME=admin"
    echo "  export JENKINS_TOKEN=your_api_token"
    echo ""
    exit 1
fi

echo "✅ 环境变量检查通过"
echo "Jenkins URL: $JENKINS_BASE_URL"
echo ""

# Step 1: 测试 Jenkins API 连接
echo "=== Step 1: 测试 Jenkins API 连接 ==="
curl -s -u "$JENKINS_USERNAME:$JENKINS_TOKEN" "$JENKINS_BASE_URL/api/json" | jq '.nodeDescription, .version' || {
    echo "❌ Jenkins API 连接失败"
    exit 1
}
echo ""

# Step 2: 列出可用 Job
echo "=== Step 2: 列出可用 Job ==="
curl -s -u "$JENKINS_USERNAME:$JENKINS_TOKEN" "$JENKINS_BASE_URL/api/json?tree=jobs[name,url,color]" | jq '.jobs[:5]' || echo "无法获取 Job 列表"
echo ""

# Step 3: 触发测试构建
echo "=== Step 3: 触发测试构建 ==="
echo "请手动在 Jenkins 中触发一个会失败的构建，或使用以下命令："
echo ""
echo "  curl -X POST \"$JENKINS_BASE_URL/job/YOUR_JOB_NAME/build\" \\"
echo "    -u \"$JENKINS_USERNAME:$JENKINS_TOKEN\""
echo ""
read -p "完成后按回车继续..."
echo ""

# Step 4: 检查 HTTP Server
echo "=== Step 4: 检查 HTTP Server ==="
echo "调用：curl http://localhost:3000/api/operator/incidents"
curl -s http://localhost:3000/api/operator/incidents | jq '.' || echo "HTTP Server 未运行"
echo ""

# Step 5: 检查 Approval
echo "=== Step 5: 检查 Approval ==="
curl -s http://localhost:3000/api/operator/approvals | jq '.' || echo "HTTP Server 未运行"
echo ""

echo "╔════════════════════════════════════════════════════════╗"
echo "║  测试完成                                              ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "下一步："
echo "  1. 在 Jenkins 中配置 Webhook"
echo "  2. 触发失败构建测试 Incident"
echo "  3. 触发 Input Step 测试 Approval"
echo "  4. 执行 Approve 验证闭环"
