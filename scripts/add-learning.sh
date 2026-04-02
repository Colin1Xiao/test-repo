#!/bin/bash
# 小龙学习日志添加工具
# 用法：./scripts/add-learning.sh <类型> <标题> <类别>

set -e

LEARNINGS_DIR="${HOME}/.openclaw/workspace/.learnings"
TIMESTAMP=$(date '+%Y-%m-%dT%H:%M:%S%z')
DATE_ID=$(date '+%Y%m%d')
RANDOM_ID=$(openssl rand -hex 2 | tr '[:lower:]' '[:upper:]')

# 参数检查
if [ $# -lt 3 ]; then
    echo "用法：$0 <类型> <标题> <类别>"
    echo "类型：lrn | err | feat"
    echo "类别：correction | knowledge_gap | best_practice | workflow | tool_gotcha"
    exit 1
fi

TYPE=$1
TITLE=$2
CATEGORY=$3

# 生成 ID
case $TYPE in
    lrn)
        PREFIX="LRN"
        FILE="$LEARNINGS_DIR/LEARNINGS.md"
        ;;
    err)
        PREFIX="ERR"
        FILE="$LEARNINGS_DIR/ERRORS.md"
        ;;
    feat)
        PREFIX="FEAT"
        FILE="$LEARNINGS_DIR/FEATURE_REQUESTS.md"
        ;;
    *)
        echo "错误：类型必须是 lrn | err | feat"
        exit 1
        ;;
esac

ENTRY_ID="${PREFIX}-${DATE_ID}-${RANDOM_ID}"

echo "创建学习条目：$ENTRY_ID"
echo "标题：$TITLE"
echo "类别：$CATEGORY"
echo ""

# 创建临时文件
TEMP_FILE=$(mktemp)

# 读取现有内容（到"## 条目"之前）
if grep -q "## 条目" "$FILE"; then
    head -n $(grep -n "## 条目" "$FILE" | cut -d: -f1) "$FILE" > "$TEMP_FILE"
else
    cp "$FILE" "$TEMP_FILE"
fi

# 添加新条目
cat >> "$TEMP_FILE" << EOF

## [$ENTRY_ID] $CATEGORY

**Logged**: $TIMESTAMP
**Priority**: medium
**Status**: pending
**Area**: config

### Summary
$TITLE

### Details
[待补充]

### Suggested Action
[待补充]

### Metadata
- Source: conversation
- Related Files: 
- Tags: 
- Pattern-Key: 
- Recurrence-Count: 1

---

EOF

# 添加剩余内容（如果有）
if grep -q "## 条目" "$FILE"; then
    tail -n +$(($(grep -n "## 条目" "$FILE" | cut -d: -f1) + 1)) "$FILE" >> "$TEMP_FILE"
fi

# 替换原文件
mv "$TEMP_FILE" "$FILE"

echo "✅ 学习条目已创建：$ENTRY_ID"
echo "📁 文件：$FILE"
echo ""
echo "下一步：编辑 $FILE 补充详细信息"
