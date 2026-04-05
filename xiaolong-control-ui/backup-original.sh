#!/bin/bash
# 🐉 备份原始 Control UI index.html

ORIGINAL="/usr/local/lib/node_modules/openclaw/dist/control-ui/index.html"
BACKUP_DIR="/Users/colin/.openclaw/workspace/xiaolong-control-ui/backup"
BACKUP_FILE="$BACKUP_DIR/index.html.original.$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR"

if [ -f "$ORIGINAL" ]; then
    cp "$ORIGINAL" "$BACKUP_FILE"
    echo "✅ 备份完成：$BACKUP_FILE"
else
    echo "❌ 原始文件不存在：$ORIGINAL"
    exit 1
fi
