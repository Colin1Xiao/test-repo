#!/bin/bash
# OCNMPS V3 灰度观察统计
# 每天两次（08:00 / 20:00）执行，统计灰度命中率和路由错误

LOG_FILE="$HOME/.openclaw/plugins/ocnmps-router/ocnmps_v3.log"
OUTPUT_FILE="$HOME/.openclaw/workspace/logs/ocnmps-gray-stats.json"

echo "╔════════════════════════════════════════════════════════╗"
echo "║  OCNMPS V3 灰度观察统计                                ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# 检查日志文件是否存在
if [ ! -f "$LOG_FILE" ]; then
    echo "❌ 日志文件不存在：$LOG_FILE"
    exit 1
fi

# 1. Gray Calculation 分布（最近 100 条）
echo "### 1️⃣ Gray Calculation 分布（最近 100 条）"
echo ""

GRAY_HIT=$(grep '"grayHit":true' "$LOG_FILE" | tail -100 | wc -l)
GRAY_MISS=$(grep '"grayHit":false' "$LOG_FILE" | tail -100 | wc -l)
TOTAL_100=$((GRAY_HIT + GRAY_MISS))

if [ $TOTAL_100 -gt 0 ]; then
    HIT_RATE=$(echo "scale=1; $GRAY_HIT * 100 / $TOTAL_100" | bc)
    echo "总样本：$TOTAL_100 条"
    echo "grayHit: true  → $GRAY_HIT 条 ($HIT_RATE%)"
    echo "grayHit: false → $GRAY_MISS 条"
    
    # 提取命中的 hashBucket
    BUCKETS=$(grep '"grayHit":true' "$LOG_FILE" | tail -100 | grep -oE '"hashBucket":[0-9]+' | cut -d: -f2 | sort -n | uniq | tr '\n' ', ' | sed 's/,$//')
    echo "命中桶：$BUCKETS"
else
    echo "无足够样本"
fi

echo ""

# 2. Gray Hit/Miss 日志（最近 50 条）
echo "### 2️⃣ Gray Hit/Miss 日志（最近 50 条）"
echo ""

GRAY_HIT_50=$(grep '"grayHit":true' "$LOG_FILE" | tail -50 | wc -l)
GRAY_MISS_50=$(grep '"grayHit":false' "$LOG_FILE" | tail -50 | wc -l)
TOTAL_50=$((GRAY_HIT_50 + GRAY_MISS_50))

if [ $TOTAL_50 -gt 0 ]; then
    HIT_RATE_50=$(echo "scale=1; $GRAY_HIT_50 * 100 / $TOTAL_50" | bc)
    echo "Gray hit:  $GRAY_HIT_50 条 ($HIT_RATE_50%)"
    echo "Gray miss: $GRAY_MISS_50 条"
else
    echo "无足够样本"
fi

echo ""

# 3. V3 Routing Errors（最近 10 条）
echo "### 3️⃣ V3 Routing Errors（最近 10 条）"
echo ""

ERROR_COUNT=$(grep -i '"level":"error"' "$LOG_FILE" | grep -i "routing\|model\|split" | tail -10 | wc -l)

if [ $ERROR_COUNT -gt 0 ]; then
    echo "发现 $ERROR_COUNT 条错误:"
    grep -i '"level":"error"' "$LOG_FILE" | grep -i "routing\|model\|split" | tail -10 | while read -r line; do
        echo "  - $(echo "$line" | jq -r '.message // "unknown"')"
    done
else
    echo "✅ 未发现路由错误"
fi

echo ""

# 4. 异常判断
echo "## 🚨 异常判断"
echo ""

# 判断灰度命中率是否正常（预期 30%）
if (( $(echo "$HIT_RATE < 20" | bc -l) )); then
    echo "| 灰度命中率 | 🔴 异常 | $HIT_RATE% 远低于预期 30% |"
elif (( $(echo "$HIT_RATE < 25" | bc -l) )); then
    echo "| 灰度命中率 | 🟡 偏低 | $HIT_RATE% 略低于预期 30% |"
else
    echo "| 灰度命中率 | 🟢 正常 | $HIT_RATE% 符合预期 |"
fi

if [ $ERROR_COUNT -gt 5 ]; then
    echo "| Routing Error | 🔴 异常 | $ERROR_COUNT 次错误，需修复 |"
elif [ $ERROR_COUNT -gt 0 ]; then
    echo "| Routing Error | 🟡 需关注 | $ERROR_COUNT 次错误 |"
else
    echo "| Routing Error | 🟢 正常 | 无错误 |"
fi

echo ""

# 5. 保存统计结果
cat > "$OUTPUT_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "grayCalculation": {
    "total": $TOTAL_100,
    "grayHit": $GRAY_HIT,
    "grayMiss": $GRAY_MISS,
    "hitRate": "$HIT_RATE%"
  },
  "recent50": {
    "grayHit": $GRAY_HIT_50,
    "grayMiss": $GRAY_MISS_50,
    "hitRate": "$HIT_RATE_50%"
  },
  "errors": {
    "count": $ERROR_COUNT
  }
}
EOF

echo "📝 统计结果已保存：$OUTPUT_FILE"
echo ""
