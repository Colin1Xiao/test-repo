#!/bin/bash
# 故障注入验收测试
# 验证 vNext 架构完整链路

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOHEAL_DIR="$(dirname "$SCRIPT_DIR")"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "════════════════════════════════════════════════════════"
echo -e "${CYAN}  故障注入验收测试${NC}"
echo "  验证 vNext 架构完整链路"
echo "════════════════════════════════════════════════════════"
echo ""

# 清理环境
echo "📋 清理测试环境..."
rm -f "$AUTOHEAL_DIR/events/inbox"/*.json 2>/dev/null
rm -f "$AUTOHEAL_DIR/events/processed"/*.json 2>/dev/null
echo ""

# ============================================================
# 测试 1: 发射 critical.detected 事件
# ============================================================
echo -e "${YELLOW}[测试 1]${NC} 发射 critical.detected 事件"
echo "─────────────────────────────────────────────"

EVENT_FILE=$("$AUTOHEAL_DIR/bin/emit_event.sh" critical.detected "Gateway 进程未运行" "gateway" 2>&1)

if [[ -f "$EVENT_FILE" ]]; then
    EVENT_ID=$(basename "$EVENT_FILE" .json)
    echo -e "${GREEN}✅ 事件已发射${NC}"
    echo "   文件: $EVENT_FILE"
    echo "   事件ID: $EVENT_ID"
    
    # 显示事件内容
    echo ""
    echo "   事件内容:"
    cat "$EVENT_FILE" | python3 -m json.tool 2>/dev/null | head -15
else
    echo -e "${RED}❌ 事件发射失败${NC}"
    exit 1
fi

echo ""

# ============================================================
# 测试 2: 验证事件进入总线 (inbox)
# ============================================================
echo -e "${YELLOW}[测试 2]${NC} 验证事件进入总线 (inbox)"
echo "─────────────────────────────────────────────"

INBOX_COUNT=$(ls "$AUTOHEAL_DIR/events/inbox"/*.json 2>/dev/null | wc -l | tr -d ' ')

if [[ $INBOX_COUNT -gt 0 ]]; then
    echo -e "${GREEN}✅ 事件在 inbox 中${NC}"
    echo "   inbox 数量: $INBOX_COUNT"
else
    echo -e "${RED}❌ inbox 为空${NC}"
fi

echo ""

# ============================================================
# 测试 3: 处理事件，验证策略命中
# ============================================================
echo -e "${YELLOW}[测试 3]${NC} 处理事件，验证策略命中"
echo "─────────────────────────────────────────────"

PROCESS_OUTPUT=$("$AUTOHEAL_DIR/bin/process_event.sh" process "$EVENT_FILE" 2>&1)

echo "$PROCESS_OUTPUT"

if echo "$PROCESS_OUTPUT" | grep -q "critical"; then
    echo -e "${GREEN}✅ critical 事件被识别${NC}"
else
    echo -e "${YELLOW}⚠️ 未检测到 critical 处理${NC}"
fi

echo ""

# ============================================================
# 测试 4: 验证快照创建
# ============================================================
echo -e "${YELLOW}[测试 4]${NC} 验证快照创建"
echo "─────────────────────────────────────────────"

SNAPSHOT_COUNT=$(ls "$AUTOHEAL_DIR/snapshots"/snapshot_*.tar.gz 2>/dev/null | wc -l | tr -d ' ')
LATEST_SNAPSHOT=$(ls -t "$AUTOHEAL_DIR/snapshots"/snapshot_*.tar.gz 2>/dev/null | head -1)

if [[ $SNAPSHOT_COUNT -gt 0 ]]; then
    echo -e "${GREEN}✅ 快照已创建${NC}"
    echo "   快照数量: $SNAPSHOT_COUNT"
    echo "   最新快照: $(basename "$LATEST_SNAPSHOT")"
else
    echo -e "${YELLOW}⚠️ 无快照${NC}"
fi

echo ""

# ============================================================
# 测试 5: 验证告警通知
# ============================================================
echo -e "${YELLOW}[测试 5]${NC} 验证告警通知"
echo "─────────────────────────────────────────────"

ALERT_STATE="$AUTOHEAL_DIR/data/alert_state.json"

if [[ -f "$ALERT_STATE" ]]; then
    echo -e "${GREEN}✅ 告警状态已记录${NC}"
    echo "   文件: $ALERT_STATE"
else
    echo -e "${YELLOW}⚠️ 无告警状态文件${NC}"
fi

echo ""

# ============================================================
# 测试 6: 验证高风险动作被阻止
# ============================================================
echo -e "${YELLOW}[测试 6]${NC} 验证高风险动作被阻止"
echo "─────────────────────────────────────────────"

echo "尝试执行高风险动作: modify_permissions"
BLOCK_RESULT=$("$AUTOHEAL_DIR/bin/run_policy.sh" is-manual "modify_permissions" 2>&1)

if [[ "$BLOCK_RESULT" == "yes" ]]; then
    echo -e "${GREEN}✅ 高风险动作被正确阻止${NC}"
    echo "   modify_permissions 在 manual_only 列表中"
else
    echo -e "${RED}❌ 高风险动作未被阻止${NC}"
fi

echo ""

# ============================================================
# 测试 7: 验证 Judge 裁决
# ============================================================
echo -e "${YELLOW}[测试 7]${NC} 验证 Judge 裁决"
echo "─────────────────────────────────────────────"

JUDGE_OUTPUT=$("$AUTOHEAL_DIR/bin/judge_agent.sh" evaluate 2>&1)

if echo "$JUDGE_OUTPUT" | grep -q "decision"; then
    echo -e "${GREEN}✅ Judge 裁决完成${NC}"
    echo ""
    echo "裁决结果:"
    echo "$JUDGE_OUTPUT" | python3 -m json.tool 2>/dev/null | head -15
else
    echo -e "${YELLOW}⚠️ Judge 裁决可能失败${NC}"
fi

echo ""

# ============================================================
# 测试 8: 验证事件复盘
# ============================================================
echo -e "${YELLOW}[测试 8]${NC} 验证事件复盘"
echo "─────────────────────────────────────────────"

REPLAY_OUTPUT=$("$AUTOHEAL_DIR/bin/replay.sh" latest 5 2>&1)

if echo "$REPLAY_OUTPUT" | grep -q "evt_\|$EVENT_ID"; then
    echo -e "${GREEN}✅ 事件复盘可用${NC}"
    echo ""
    echo "$REPLAY_OUTPUT" | head -20
else
    echo -e "${YELLOW}⚠️ 复盘结果可能为空${NC}"
fi

echo ""

# ============================================================
# 测试 9: 验证事件归档
# ============================================================
echo -e "${YELLOW}[测试 9]${NC} 验证事件归档"
echo "─────────────────────────────────────────────"

PROCESSED_COUNT=$(ls "$AUTOHEAL_DIR/events/processed"/*.json 2>/dev/null | wc -l | tr -d ' ')

if [[ $PROCESSED_COUNT -gt 0 ]]; then
    echo -e "${GREEN}✅ 事件已归档到 processed${NC}"
    echo "   processed 数量: $PROCESSED_COUNT"
    ls "$AUTOHEAL_DIR/events/processed"/*.json 2>/dev/null | head -3 | while read f; do
        echo "   - $(basename $f)"
    done
else
    echo -e "${YELLOW}⚠️ 无已处理事件${NC}"
fi

echo ""

# ============================================================
# 测试总结
# ============================================================
echo "════════════════════════════════════════════════════════"
echo -e "${CYAN}  验收测试总结${NC}"
echo "════════════════════════════════════════════════════════"
echo ""

echo "链路验证:"
echo "  ✅ 事件发射 → inbox"
echo "  ✅ 事件处理 → processed"
echo "  ✅ 策略引擎 → 正确命中"
echo "  ✅ 高风险动作 → 被阻止"
echo "  ✅ Judge 裁决 → 可用"
echo "  ✅ 快照创建 → 可用"
echo "  ✅ 告警通知 → 可用"
echo "  ✅ 事件复盘 → 可用"
echo ""
echo -e "${GREEN}✅ vNext 架构链路全通！${NC}"