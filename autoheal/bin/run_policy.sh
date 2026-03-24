#!/bin/bash
# run_policy.sh - 策略执行引擎
# 根据事件类型加载并执行对应策略

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOHEAL_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_DIR="$AUTOHEAL_DIR/config"
STATE_DIR="$AUTOHEAL_DIR/state"

# 解析 YAML 策略 (简化版)
get_policy() {
    local category="$1"
    local key="$2"
    local default="${3:-}"
    
    local policy_file="$CONFIG_DIR/policies.yaml"
    
    if [[ ! -f "$policy_file" ]]; then
        echo "$default"
        return
    fi
    
    # 简单的 YAML 解析
    local value=$(grep -A 20 "^$category:" "$policy_file" 2>/dev/null | grep -E "^\s+$key:" | head -1 | sed 's/.*: *//' | tr -d ' "')
    
    if [[ -n "$value" ]]; then
        echo "$value"
    else
        echo "$default"
    fi
}

# 获取当前模式
get_mode() {
    local mode_file="$STATE_DIR/current_mode"
    
    if [[ -f "$mode_file" ]]; then
        cat "$mode_file"
    else
        get_policy "modes" "default_mode" "normal"
    fi
}

# 设置模式
set_mode() {
    local mode="$1"
    
    case "$mode" in
        normal|safe|debug)
            echo "$mode" > "$STATE_DIR/current_mode"
            echo "✅ 模式已切换为: $mode"
            ;;
        *)
            echo "❌ 无效模式: $mode"
            echo "有效模式: normal, safe, debug"
            return 1
            ;;
    esac
}

# 检查是否允许自动修复
can_auto_repair() {
    local mode=$(get_mode)
    local auto_repair=$(get_policy "modes.$mode" "auto_repair" "true")
    
    [[ "$auto_repair" == "true" ]]
}

# 检查是否是高风险动作
is_manual_only() {
    local action="$1"
    local policy_file="$CONFIG_DIR/policies.yaml"
    
    if grep -q "$action" "$policy_file" 2>/dev/null; then
        grep -A 20 "^manual_only:" "$policy_file" | grep -q "$action"
    else
        # 默认手动列表
        case "$action" in
            modify_permissions|change_operator_scope|unquarantine_skill|replace_model_config|rotate_credentials|modify_trusted_proxies)
                return 0
                ;;
            *)
                return 1
                ;;
        esac
    fi
}

# 检查是否需要 Judge 裁决
requires_judge() {
    local healing_type="$1"
    
    local requires=$(get_policy "healing.$healing_type" "requires_judge" "false")
    
    [[ "$requires" == "true" ]]
}

# 获取告警冷却时间
get_alert_cooldown() {
    local level="$1"
    
    case "$level" in
        critical) echo $(get_policy "alerts.critical" "cooldown_minutes" "30") ;;
        warning)  echo $(get_policy "alerts.warning" "cooldown_minutes" "60") ;;
        info)     echo $(get_policy "alerts.info" "cooldown_minutes" "120") ;;
        *)        echo "60" ;;
    esac
}

# 获取修复最大尝试次数
get_max_repair_attempts() {
    local healing_type="$1"
    
    echo $(get_policy "healing.$healing_type" "max_attempts" "1")
}

# 执行修复动作
execute_healing() {
    local healing_type="$1"
    local reason="$2"
    
    echo "🔧 执行修复: $healing_type"
    echo "   原因: $reason"
    
    # 检查是否是高风险动作
    if is_manual_only "$healing_type"; then
        echo "⚠️ 高风险动作，需要人工确认"
        echo "   动作: $healing_type"
        return 1
    fi
    
    # 检查是否允许自动修复
    if ! can_auto_repair; then
        echo "⏸️ 当前模式禁止自动修复: $(get_mode)"
        return 1
    fi
    
    # 检查是否需要 Judge 裁决
    if requires_judge "$healing_type"; then
        echo "⚖️ 需要 Judge 裁决..."
        
        local decision=$("$SCRIPT_DIR/judge_agent.sh" decision 2>/dev/null)
        local decision_type=$(echo "$decision" | python3 -c "import json,sys; print(json.load(sys.stdin).get('decision','manual_review'))" 2>/dev/null)
        
        if [[ "$decision_type" != "auto_repair" ]]; then
            echo "❌ Judge 裁决不允许自动修复: $decision_type"
            return 1
        fi
    fi
    
    # 检查尝试次数
    local max_attempts=$(get_max_repair_attempts "$healing_type")
    local attempts_file="$STATE_DIR/repair_attempts_${healing_type}"
    local current_attempts=0
    
    if [[ -f "$attempts_file" ]]; then
        current_attempts=$(cat "$attempts_file")
    fi
    
    if [[ $current_attempts -ge $max_attempts ]]; then
        echo "❌ 已达最大尝试次数: $current_attempts/$max_attempts"
        return 1
    fi
    
    # 执行修复动作
    local actions=$(get_policy "healing.$healing_type" "actions" "[]")
    
    echo "   动作列表: $actions"
    
    case "$healing_type" in
        gateway_unhealthy)
            echo "   执行: restart_gateway"
            openclaw gateway restart 2>&1
            sleep 3
            echo "   执行: recheck_health"
            openclaw health check 2>&1 | head -5
            ;;
        doctor_fixable)
            echo "   执行: doctor_repair"
            openclaw doctor --repair --yes 2>&1
            ;;
        stale_status_cache)
            echo "   执行: refresh_status"
            openclaw status > "$STATE_DIR/latest_status_raw.txt" 2>&1
            ;;
        *)
            echo "   未知修复类型: $healing_type"
            ;;
    esac
    
    # 记录尝试
    echo $((current_attempts + 1)) > "$attempts_file"
    
    # 发射事件
    "$SCRIPT_DIR/emit_event.sh" repair.applied "$healing_type" "true"
    
    echo "✅ 修复完成"
}

# 重置修复计数
reset_repair_attempts() {
    local healing_type="$1"
    local attempts_file="$STATE_DIR/repair_attempts_${healing_type}"
    
    rm -f "$attempts_file" 2>/dev/null
    echo "✅ 已重置修复计数: $healing_type"
}

# 显示当前策略
show_policy() {
    local category="${1:-all}"
    
    echo "📋 策略配置"
    echo "=========================================="
    echo ""
    
    local policy_file="$CONFIG_DIR/policies.yaml"
    
    if [[ ! -f "$policy_file" ]]; then
        echo "⚠️ 策略文件不存在: $policy_file"
        return
    fi
    
    if [[ "$category" == "all" ]]; then
        cat "$policy_file"
    else
        grep -A 30 "^$category:" "$policy_file" 2>/dev/null || echo "未找到分类: $category"
    fi
}

# 验证策略
validate_policy() {
    local policy_file="$CONFIG_DIR/policies.yaml"
    
    echo "🔍 验证策略配置..."
    echo ""
    
    if [[ ! -f "$policy_file" ]]; then
        echo "❌ 策略文件不存在"
        return 1
    fi
    
    # 检查必需字段
    local required_fields=("modes" "baseline" "alerts" "healing" "manual_only")
    local missing=()
    
    for field in "${required_fields[@]}"; do
        if ! grep -q "^$field:" "$policy_file"; then
            missing+=("$field")
        fi
    done
    
    if [[ ${#missing[@]} -gt 0 ]]; then
        echo "❌ 缺少必需字段:"
        printf '  - %s\n' "${missing[@]}"
        return 1
    fi
    
    echo "✅ 策略配置有效"
    echo ""
    
    # 显示摘要
    echo "当前配置:"
    echo "  模式: $(get_mode)"
    echo "  自动修复: $(can_auto_repair && echo '启用' || echo '禁用')"
    echo "  告警冷却 (critical): $(get_alert_cooldown critical) 分钟"
    echo "  告警冷却 (warning): $(get_alert_cooldown warning) 分钟"
}

# 主入口
case "${1:-}" in
    get)
        get_policy "$2" "$3" "$4"
        ;;
    mode)
        case "$2" in
            show) echo "$(get_mode)" ;;
            set)  set_mode "$3" ;;
            *)    echo "当前模式: $(get_mode)" ;;
        esac
        ;;
    can-repair)
        can_auto_repair && echo "yes" || echo "no"
        ;;
    is-manual)
        is_manual_only "$2" && echo "yes" || echo "no"
        ;;
    cooldown)
        get_alert_cooldown "$2"
        ;;
    execute)
        execute_healing "$2" "$3"
        ;;
    reset)
        reset_repair_attempts "$2"
        ;;
    show)
        show_policy "$2"
        ;;
    validate)
        validate_policy
        ;;
    *)
        echo "策略执行引擎"
        echo ""
        echo "用法:"
        echo "  $0 get <分类> <键> [默认]    - 获取策略值"
        echo "  $0 mode show                 - 显示当前模式"
        echo "  $0 mode set <模式>           - 设置模式 (normal/safe/debug)"
        echo "  $0 can-repair                - 检查是否允许自动修复"
        echo "  $0 is-manual <动作>          - 检查是否是高风险动作"
        echo "  $0 cooldown <级别>           - 获取告警冷却时间"
        echo "  $0 execute <修复类型> <原因>  - 执行修复"
        echo "  $0 reset <修复类型>          - 重置修复计数"
        echo "  $0 show [分类]               - 显示策略配置"
        echo "  $0 validate                  - 验证策略配置"
        ;;
esac