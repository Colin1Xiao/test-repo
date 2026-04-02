#!/usr/bin/env bash
# OpenClaw 自动清理脚本 - Retention Policy

set -euo pipefail

echo "=== OpenClaw Retention Cleanup ==="
echo "执行时间: $(date)"

# browser/ - 7天保留
echo "[1/5] 清理 browser/ (7天+)"
find ~/.openclaw/browser -mindepth 1 -maxdepth 1 -mtime +7 -exec rm -rf {} + 2>/dev/null || true

# agents/ - 14天保留
echo "[2/5] 清理 agents/ (14天+)"
find ~/.openclaw/agents -mindepth 1 -maxdepth 1 -mtime +14 -exec rm -rf {} + 2>/dev/null || true

# logs/ - 30天保留，压缩7天+
echo "[3/5] 处理 logs/"
find ~/.openclaw/logs -name "*.log" -mtime +30 -delete 2>/dev/null || true

# sessions/ - 30天保留
echo "[4/5] 清理 sessions/ (30天+)"
find ~/.openclaw/sessions -name "*.json" -mtime +30 -delete 2>/dev/null || true

# tasks/ - 7天保留
echo "[5/5] 清理 tasks/ (7天+)"
find ~/.openclaw/tasks -mindepth 1 -mtime +7 -exec rm -rf {} + 2>/dev/null || true

echo "=== 清理完成 ==="
