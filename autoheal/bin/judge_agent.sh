#!/bin/bash
# Judge Agent - 多代理裁决器
# 当多个 Agent 结论冲突时，由 Judge 统一裁决

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOHEAL_DIR="$(dirname "$SCRIPT_DIR")"
AGENTS_DIR="$AUTOHEAL_DIR/agents"
STATE_DIR="$AUTOHEAL_DIR/state"
CONFIG_DIR="$AUTOHEAL_DIR/config"

mkdir -p "$STATE_DIR"

# 读取策略配置
get_confidence_threshold() {
    if [[ -f "$CONFIG_DIR/policies.yaml" ]]; then
        grep -A 3 "judge:" "$CONFIG_DIR/policies.yaml" | grep "confidence_threshold" | grep -oE '[0-9.]+' | head -1
    else
        echo "0.75"
    fi
}

# 解析 Agent 报告
parse_agent_report() {
    local report_file="$1"
    local agent_type="$2"
    
    if [[ ! -f "$report_file" ]]; then
        echo "{}"
        return
    fi
    
    # 提取关键结论
    local conclusion=$(grep -i "诊断结论\|结论\|建议\|recommendation" "$report_file" 2>/dev/null | head -3 | tr '\n' ' ')
    local severity=$(grep -i "critical\|warning\|error" "$report_file" 2>/dev/null | head -1 | grep -oE '(critical|warning|error|info)' | head -1)
    
    python3 << EOF
import json
result = {
    "agent": "$agent_type",
    "conclusion": """$conclusion""",
    "severity": "${severity:-info}",
    "report_file": "$report_file"
}
print(json.dumps(result))
EOF
}

# SRE Agent 建议
get_sre_recommendation() {
    local sre_report=$(ls -t "$AGENTS_DIR"/sre_report_*.md 2>/dev/null | head -1)
    
    if [[ -f "$sre_report" ]]; then
        # 分析 SRE 建议
        if grep -q "重启\|restart" "$sre_report" 2>/dev/null; then
            echo "restart_recommended"
        elif grep -q "正常\|healthy\|✅" "$sre_report" 2>/dev/null; then
            echo "healthy"
        else
            echo "investigate"
        fi
    else
        echo "no_data"
    fi
}

# Security Agent 建议
get_security_recommendation() {
    local sec_report=$(ls -t "$AGENTS_DIR"/security_report_*.md 2>/dev/null | head -1)
    
    if [[ -f "$sec_report" ]]; then
        # 分析安全问题
        if grep -q "dangerous-exec\|权限\|permission" "$sec_report" 2>/dev/null; then
            echo "security_concern"
        elif grep -q "无安全\|安全\|✅" "$sec_report" 2>/dev/null; then
            echo "secure"
        else
            echo "needs_review"
        fi
    else
        echo "no_data"
    fi
}

# Code Agent 建议
get_code_recommendation() {
    local fix_script=$(ls -t "$AGENTS_DIR"/code_work/fix_*.sh 2>/dev/null | head -1)
    
    if [[ -f "$fix_script" ]]; then
        # 检查修复脚本内容
        if grep -q "restart\|修复" "$fix_script" 2>/dev/null; then
            echo "script_generated"
        else
            echo "needs_custom_fix"
        fi
    else
        echo "no_script"
    fi
}

# 综合裁决
make_decision() {
    local sre_rec="$1"
    local sec_rec="$2"
    local code_rec="$3"
    local context="$4"
    
    local decision="manual_review"
    local confidence=0.5
    local reason=""
    
    # 决策逻辑
    
    # 1. 如果所有 Agent 都说正常
    if [[ "$sre_rec" == "healthy" && "$sec_rec" == "secure" ]]; then
        decision="alert_only"
        confidence=0.95
        reason="所有 Agent 报告正常，无需修复"
        
    # 2. 如果 SRE 建议重启且 Security 无反对
    elif [[ "$sre_rec" == "restart_recommended" && "$sec_rec" != "security_concern" ]]; then
        decision="auto_repair"
        confidence=0.85
        reason="SRE 建议重启，Security 无异议，Code 已准备修复脚本"
        
    # 3. 如果 Security 有安全顾虑
    elif [[ "$sec_rec" == "security_concern" ]]; then
        decision="manual_review"
        confidence=0.90
        reason="Security Agent 检测到安全相关问题，需要人工审核"
        
    # 4. 如果 SRE 和 Code 都有建议
    elif [[ "$sre_rec" != "no_data" && "$code_rec" == "script_generated" ]]; then
        decision="auto_repair"
        confidence=0.80
        reason="SRE 和 Code Agent 都有修复建议"
        
    # 5. 其他情况转人工
    else
        decision="manual_review"
        confidence=0.60
        reason="Agent 结论不完全一致，建议人工审核"
    fi
    
    # 检查置信度阈值
    local threshold=$(get_confidence_threshold)
    if (( $(echo "$confidence < $threshold" | bc -l) )); then
        decision="manual_review"
        reason="置信度 ($confidence) 低于阈值 ($threshold)，转人工审核"
    fi
    
    # 输出 JSON
    python3 << EOF
import json
result = {
    "decision": "$decision",
    "confidence": $confidence,
    "reason": "$reason",
    "analysis": {
        "sre": "$sre_rec",
        "security": "$sec_rec",
        "code": "$code_rec"
    },
    "context": "$context",
    "threshold": $threshold
}
print(json.dumps(result, indent=2))
EOF
}

# 执行裁决
evaluate() {
    local event="$1"
    local incident_id=$(date +%Y%m%d_%H%M%S)
    
    echo "⚖️ Judge Agent 开始裁决..."
    echo "事件 ID: $incident_id"
    echo "=============================="
    echo ""
    
    # 收集各 Agent 建议
    local sre_rec=$(get_sre_recommendation)
    local sec_rec=$(get_security_recommendation)
    local code_rec=$(get_code_recommendation)
    
    echo "SRE Agent 建议: $sre_rec"
    echo "Security Agent 建议: $sec_rec"
    echo "Code Agent 建议: $code_rec"
    echo ""
    
    # 综合裁决
    local decision=$(make_decision "$sre_rec" "$sec_rec" "$code_rec" "$event")
    
    echo "裁决结果:"
    echo "$decision"
    echo ""
    
    # 发射裁决事件
    local decision_type=$(echo "$decision" | python3 -c "import json,sys; print(json.load(sys.stdin)['decision'])")
    local confidence=$(echo "$decision" | python3 -c "import json,sys; print(json.load(sys.stdin)['confidence'])")
    local reason=$(echo "$decision" | python3 -c "import json,sys; print(json.load(sys.stdin)['reason'])")
    
    "$SCRIPT_DIR/emit_event.sh" judge.decision "$decision_type" "$confidence" "$reason"
    
    # 保存裁决结果
    echo "$decision" > "$STATE_DIR/judge_decision_$incident_id.json"
    
    # 返回裁决
    echo "$decision"
}

# 主入口
case "${1:-}" in
    evaluate)
        shift
        evaluate "$@"
        ;;
    decision)
        # 返回最近一次裁决
        local latest=$(ls -t "$STATE_DIR"/judge_decision_*.json 2>/dev/null | head -1)
        if [[ -f "$latest" ]]; then
            cat "$latest"
        else
            echo '{"error": "无裁决记录"}'
        fi
        ;;
    history)
        echo "裁决历史:"
        echo "=============================="
        for f in $(ls -t "$STATE_DIR"/judge_decision_*.json 2>/dev/null | head -10); do
            local id=$(basename "$f" .json | sed 's/judge_decision_//')
            local decision=$(cat "$f" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f\"{d['decision']} (置信度: {d['confidence']})\")" 2>/dev/null)
            echo "  $id: $decision"
        done
        ;;
    threshold)
        echo "置信度阈值: $(get_confidence_threshold)"
        ;;
    *)
        echo "Judge Agent - 多代理裁决器"
        echo ""
        echo "用法:"
        echo "  $0 evaluate [事件]   - 评估并裁决"
        echo "  $0 decision          - 查看最近裁决"
        echo "  $0 history           - 查看裁决历史"
        echo "  $0 threshold         - 查看置信度阈值"
        ;;
esac