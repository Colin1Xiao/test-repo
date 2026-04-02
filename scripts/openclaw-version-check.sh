#!/bin/bash
# OpenClaw 稳定版检查脚本
# 检测 npm 上的最新版本，如果是稳定版（非 beta）则通知用户

set -e

WORKSPACE="$HOME/.openclaw/workspace"
CURRENT_VERSION_FILE="$WORKSPACE/openclaw-version-check.json"
LOG_FILE="$WORKSPACE/logs/openclaw-version-check.log"

# 确保日志目录存在
mkdir -p "$WORKSPACE/logs"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 获取当前安装版本
CURRENT_VERSION=$(openclaw --version 2>/dev/null | grep -oE '2026\.[0-9]+\.[0-9]+' || echo "unknown")
log "当前安装版本：$CURRENT_VERSION"

# 获取 npm 最新版本
NPM_LATEST=$(npm view openclaw version 2>/dev/null || echo "unknown")
log "npm 最新版本：$NPM_LATEST"

# 获取 npm latest 标签指向的版本（排除 beta）
NPM_DIST_TAGS=$(npm view openclaw dist-tags --json 2>/dev/null || echo "{}")
STABLE_VERSION=$(echo "$NPM_DIST_TAGS" | grep -oP '"latest"\s*:\s*"\K[^"]+' || echo "$NPM_LATEST")
log "npm 稳定版标签：$STABLE_VERSION"

# 检查是否有新版本
if [ "$CURRENT_VERSION" != "$STABLE_VERSION" ] && [ "$STABLE_VERSION" != "unknown" ]; then
    # 检查是否为 beta 版本
    if [[ "$STABLE_VERSION" == *"-beta"* ]] || [[ "$STABLE_VERSION" == *"-rc"* ]]; then
        log "最新版本 $STABLE_VERSION 是测试版，跳过通知"
        echo "🟡 检测到测试版：$STABLE_VERSION（当前：$CURRENT_VERSION）"
        echo "   测试版本暂不推荐升级，等待稳定版发布。"
    else
        log "🎉 检测到新的稳定版：$STABLE_VERSION（当前：$CURRENT_VERSION）"
        
        # 获取版本发布时间
        RELEASE_TIME=$(npm view openclaw@$STABLE_VERSION time.created 2>/dev/null || echo "unknown")
        
        # 生成通知消息
        cat << EOF
【🎉 OpenClaw 稳定版发布提醒】

📦 当前版本：$CURRENT_VERSION
🆕 稳定版本：$STABLE_VERSION
📅 发布时间：$RELEASE_TIME

✅ 这是正式稳定版，可以安全升级。

**升级命令：**
\`\`\`bash
npm install -g openclaw@latest
\`\`\`

**升级后验证：**
\`\`\`bash
openclaw --version
openclaw status
~/.openclaw/workspace/scripts/post-upgrade-check.sh
\`\`\`

---
_小龙自动检测并推送_
EOF
    fi
else
    log "✅ 已是最新版本：$CURRENT_VERSION"
    echo "✅ 当前已是最新稳定版：$CURRENT_VERSION"
fi

# 保存检查结果
cat > "$CURRENT_VERSION_FILE" << EOF
{
  "lastCheck": "$(date -Iseconds)",
  "currentVersion": "$CURRENT_VERSION",
  "npmLatest": "$NPM_LATEST",
  "stableVersion": "$STABLE_VERSION",
  "isNewVersionAvailable": $([ "$CURRENT_VERSION" != "$STABLE_VERSION" ] && [ "$STABLE_VERSION" != "unknown" ] && [[ "$STABLE_VERSION" != *"-beta"* ]] && echo "true" || echo "false")
}
EOF

log "检查结果已保存到：$CURRENT_VERSION_FILE"
