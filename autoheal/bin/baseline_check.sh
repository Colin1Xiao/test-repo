#!/bin/bash
# 基线检查与验证
# 所有健康判断、报告、告警都基于此基线

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOHEAL_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_DIR="$AUTOHEAL_DIR/config"
STATE_DIR="$AUTOHEAL_DIR/state"
DATA_DIR="$AUTOHEAL_DIR/data"

# 加载基线配置
load_baseline() {
    local baseline_file="$CONFIG_DIR/baselines.yaml"
    
    if [[ ! -f "$baseline_file" ]]; then
        echo "警告: 基线配置文件不存在"
        return 1
    fi
    
    # 简单的 YAML 解析
    CRITICAL_COUNT_MAX=$(grep "critical_count:" "$baseline_file" | grep -oE '[0-9]+' | head -1)
    WARNING_COUNT_MAX=$(grep "warning_count_max:" "$baseline_file" | grep -oE '[0-9]+' | head -1)
    TELEGRAM_LATENCY_MAX=$(grep "telegram_latency_ms_max:" "$baseline_file" | grep -oE '[0-9]+' | head -1)
    SNAPSHOT_COUNT_MAX=$(grep "snapshot_count_max:" "$baseline_file" | grep -oE '[0-9]+' | head -1)
    JUDGE_CONFIDENCE_THRESHOLD=$(grep "confidence_threshold:" "$baseline_file" | grep -oE '[0-9.]+' | head -1)
}

# 检查单个基线项
check_baseline_item() {
    local name="$1"
    local current="$2"
    local expected="$3"
    local operator="${4:-eq}"
    
    local result=""
    local status="PASS"
    
    case "$operator" in
        eq)
            if [[ "$current" == "$expected" ]]; then
                result="✅"
            else
                result="❌"
                status="FAIL"
            fi
            ;;
        le|"<=")
            if (( current <= expected )); then
                result="✅"
            else
                result="❌"
                status="FAIL"
            fi
            ;;
        ge|">=")
            if (( current >= expected )); then
                result="✅"
            else
                result="❌"
                status="FAIL"
            fi
            ;;
        true)
            if [[ "$current" == "true" ]]; then
                result="✅"
            else
                result="❌"
                status="FAIL"
            fi
            ;;
    esac
    
    echo "$result $name: 当前=$current, 基线=$expected"
    
    [[ "$status" == "FAIL" ]]
}

# 执行完整基线检查
run_baseline_check() {
    echo "📊 OpenClaw 基线检查"
    echo "=========================================="
    echo ""
    
    load_baseline
    
    local failed=0
    local total=0
    
    # 读取最新健康数据
    local health_file="$DATA_DIR/health_$(date +%Y-%m-%d).json"
    local health_data="{}"
    
    if [[ -f "$health_file" ]]; then
        health_data=$(cat "$health_file")
    fi
    
    # 解析当前值
    local critical_count=$(echo "$health_data" | python3 -c "import json,sys; print(json.load(sys.stdin).get('critical_count',0))" 2>/dev/null || echo "0")
    local warning_count=$(echo "$health_data" | python3 -c "import json,sys; print(json.load(sys.stdin).get('warning_count',0))" 2>/dev/null || echo "0")
    local telegram_latency=$(echo "$health_data" | python3 -c "import json,sys; print(json.load(sys.stdin).get('telegram_latency_ms',0))" 2>/dev/null || echo "0")
    local health_ok_after=$(echo "$health_data" | python3 -c "import json,sys; print(str(json.load(sys.stdin).get('health_ok_after',True)).lower())" 2>/dev/null || echo "true")
    local exit_code=$(echo "$health_data" | python3 -c "import json,sys; print(json.load(sys.stdin).get('exit_code',0))" 2>/dev/null || echo "0")
    
    # 服务状态
    local gateway_online="false"
    local ocnmps_online="false"
    local telegram_reachable="false"
    
    if ps aux | grep -v grep | grep -q "openclaw-gateway"; then
        gateway_online="true"
    fi
    
    if openclaw status 2>&1 | grep -q "running\|active"; then
        ocnmps_online="true"
    fi
    
    if curl -s --max-time 3 https://api.telegram.org > /dev/null 2>&1; then
        telegram_reachable="true"
    fi
    
    # 快照数量
    local snapshot_count=$(ls "$AUTOHEAL_DIR/snapshots"/snapshot_*.tar.gz 2>/dev/null | wc -l | tr -d ' ')
    
    # Judge 低置信度比例
    local judge_stats="$DATA_DIR/judge_summary.json"
    local low_confidence_ratio=0
    if [[ -f "$judge_stats" ]]; then
        low_confidence_ratio=$(cat "$judge_stats" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('low_confidence_count',0) / max(d.get('total',1),1))" 2>/dev/null || echo "0")
    fi
    
    # Manual Review 队列
    local review_file="$STATE_DIR/manual_review.txt"
    local review_count=0
    if [[ -f "$review_file" ]]; then
        review_count=$(wc -l < "$review_file" | tr -d ' ')
    fi
    
    echo "核心基线:"
    echo "──────────────────────────────────────────"
    
    # 检查各项
    total=$((total + 1))
    if check_baseline_item "critical_count" "$critical_count" "${CRITICAL_COUNT_MAX:-0}" "le"; then
        failed=$((failed + 1))
    fi
    
    total=$((total + 1))
    if check_baseline_item "warning_count" "$warning_count" "${WARNING_COUNT_MAX:-3}" "le"; then
        failed=$((failed + 1))
    fi
    
    total=$((total + 1))
    if check_baseline_item "health_ok_after" "$health_ok_after" "true" "true"; then
        failed=$((failed + 1))
    fi
    
    total=$((total + 1))
    if check_baseline_item "exit_code" "$exit_code" "0" "eq"; then
        failed=$((failed + 1))
    fi
    
    echo ""
    echo "服务状态:"
    echo "──────────────────────────────────────────"
    
    total=$((total + 1))
    if check_baseline_item "gateway_online" "$gateway_online" "true" "true"; then
        failed=$((failed + 1))
    fi
    
    total=$((total + 1))
    if check_baseline_item "ocnmps_online" "$ocnmps_online" "true" "true"; then
        failed=$((failed + 1))
    fi
    
    total=$((total + 1))
    if check_baseline_item "telegram_reachable" "$telegram_reachable" "true" "true"; then
        failed=$((failed + 1))
    fi
    
    echo ""
    echo "性能基线:"
    echo "──────────────────────────────────────────"
    
    total=$((total + 1))
    if check_baseline_item "telegram_latency" "$telegram_latency" "${TELEGRAM_LATENCY_MAX:-2000}" "le"; then
        failed=$((failed + 1))
    fi
    
    echo ""
    echo "存储基线:"
    echo "──────────────────────────────────────────"
    
    total=$((total + 1))
    if check_baseline_item "snapshot_count" "$snapshot_count" "${SNAPSHOT_COUNT_MAX:-10}" "le"; then
        failed=$((failed + 1))
    fi
    
    echo ""
    echo "Judge 基线:"
    echo "──────────────────────────────────────────"
    
    total=$((total + 1))
    local ratio_int=0
    if [[ -n "$low_confidence_ratio" && "$low_confidence_ratio" != "0" ]]; then
        ratio_int=$(echo "$low_confidence_ratio * 100" | bc 2>/dev/null | cut -d. -f1)
    fi
    # 0% 是通过的（低于 20%）
    if [[ $ratio_int -le 20 ]]; then
        echo "✅ low_confidence_ratio: 当前=${ratio_int}%, 基线=20%"
    else
        echo "❌ low_confidence_ratio: 当前=${ratio_int}%, 基线=20%"
        failed=$((failed + 1))
    fi
    
    echo ""
    echo "Manual Review 队列:"
    echo "──────────────────────────────────────────"
    echo "  当前队列: $review_count 项"
    
    if [[ -f "$review_file" ]]; then
        echo "  内容:"
        head -5 "$review_file" | while read -r line; do
            echo "    - $line"
        done
    fi
    
    # 汇总
    echo ""
    echo "=========================================="
    echo "基线检查结果: $((total - failed))/$total 通过"
    
    if [[ $failed -eq 0 ]]; then
        echo -e "状态: ${GREEN}✅ 符合基线${NC}"
        return 0
    else
        echo -e "状态: ${RED}❌ 偏离基线 ($failed 项失败)${NC}"
        return 1
    fi
}

# 获取基线状态 JSON
get_baseline_json() {
    load_baseline
    
    local health_file="$DATA_DIR/health_$(date +%Y-%m-%d).json"
    local health_data="{}"
    
    if [[ -f "$health_file" ]]; then
        health_data=$(cat "$health_file")
    fi
    
    python3 << EOF
import json

health = $health_data

result = {
    "baseline_version": "1.0.0",
    "check_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "core": {
        "critical_count": health.get('critical_count', 0),
        "warning_count": health.get('warning_count', 0),
        "health_ok_after": health.get('health_ok_after', True),
        "exit_code": health.get('exit_code', 0)
    },
    "services": {
        "gateway_online": $(pgrep -f "openclaw-gateway" > /dev/null && echo 'true' || echo 'false'),
        "ocnmps_online": $(openclaw status 2>&1 | grep -q "running" && echo 'true' || echo 'false'),
        "telegram_reachable": $(curl -s --max-time 3 https://api.telegram.org > /dev/null 2>&1 && echo 'true' || echo 'false')
    },
    "performance": {
        "telegram_latency_ms": health.get('telegram_latency_ms', 0)
    },
    "storage": {
        "snapshot_count": $(ls "$AUTOHEAL_DIR/snapshots"/snapshot_*.tar.gz 2>/dev/null | wc -l | tr -d ' ' || echo "0")
    },
    "compliance": {
        "meets_baseline": $(if [[ $failed -eq 0 ]]; then echo 'true'; else echo 'false'; fi)
    }
}

print(json.dumps(result, indent=2))
EOF
}

# 主入口
case "${1:-}" in
    check)
        run_baseline_check
        ;;
    json)
        get_baseline_json
        ;;
    config)
        cat "$CONFIG_DIR/baselines.yaml"
        ;;
    drift)
        echo "检测基线偏离..."
        run_baseline_check | grep "❌" || echo "无偏离"
        ;;
    *)
        echo "基线检查工具"
        echo ""
        echo "用法:"
        echo "  $0 check    - 执行完整基线检查"
        echo "  $0 json     - 输出基线状态 JSON"
        echo "  $0 config   - 显示基线配置"
        echo "  $0 drift    - 仅显示偏离项"
        ;;
esac