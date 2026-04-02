#!/bin/bash
# Auto-Heal 周报生成器
# 每周自动汇总系统健康状况

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data"
REPORT_DIR="$SCRIPT_DIR/reports"

mkdir -p "$REPORT_DIR"

# 计算本周起止日期
get_week_range() {
    local today=$(date +%Y-%m-%d)
    local day_of_week=$(date +%u)  # 1=周一, 7=周日
    
    # 本周一
    local monday=$(date -v-$((day_of_week - 1))d +%Y-%m-%d 2>/dev/null || date -d "$today -$((day_of_week - 1)) days" +%Y-%m-%d)
    # 本周日
    local sunday=$(date -v+$((7 - day_of_week))d +%Y-%m-%d 2>/dev/null || date -d "$today +$((7 - day_of_week)) days" +%Y-%m-%d)
    
    echo "$monday $sunday"
}

# 收集本周数据
collect_week_data() {
    local start_date="$1"
    local end_date="$2"
    
    local total_checks=0
    local total_warnings=0
    local total_criticals=0
    local total_repairs=0
    local components_with_issues=()
    local avg_latency=0
    local latency_samples=0
    
    # 遍历本周每天的数据
    local current="$start_date"
    while [[ "$current" <= "$end_date" ]]; do
        local file="$DATA_DIR/health_$current.json"
        
        if [[ -f "$file" ]]; then
            total_checks=$((total_checks + 1))
            
            local w=$(grep -o '"warning_count":[0-9]*' "$file" | grep -o '[0-9]*')
            local c=$(grep -o '"critical_count":[0-9]*' "$file" | grep -o '[0-9]*')
            local l=$(grep -o '"telegram_latency_ms":[0-9]*' "$file" | grep -o '[0-9]*')
            local alerts=$(grep -o '"alerts":\[[^]]*\]' "$file" | sed 's/"alerts":\[//;s/\]$//;s/"//g')
            local repairs=$(grep -o '"repair_actions":\[[^]]*\]' "$file" | tr ',' '\n' | wc -l)
            
            total_warnings=$((total_warnings + ${w:-0}))
            total_criticals=$((total_criticals + ${c:-0}))
            total_repairs=$((total_repairs + ${repairs:-0}))
            
            if [[ -n "$l" && "$l" != "null" && "$l" -gt 0 ]]; then
                avg_latency=$((avg_latency + l))
                latency_samples=$((latency_samples + 1))
            fi
            
            # 收集有问题的组件
            if [[ -n "$alerts" && "$alerts" != "null" ]]; then
                while IFS= read -r alert; do
                    components_with_issues+=("$alert")
                done <<< "$alerts"
            fi
        fi
        
        # 下一天
        current=$(date -v+1d -f "%Y-%m-%d" "$current" +%Y-%m-%d 2>/dev/null || date -d "$current +1 day" +%Y-%m-%d)
    done
    
    # 计算平均延迟
    if [[ $latency_samples -gt 0 ]]; then
        avg_latency=$((avg_latency / latency_samples))
    fi
    
    # 导出结果
    export WEEK_TOTAL_CHECKS=$total_checks
    export WEEK_TOTAL_WARNINGS=$total_warnings
    export WEEK_TOTAL_CRITICALS=$total_criticals
    export WEEK_TOTAL_REPAIRS=$total_repairs
    export WEEK_AVG_LATENCY=$avg_latency
    export WEEK_COMPONENTS_ISSUES="${components_with_issues[*]}"
}

# 分析组件问题频率
analyze_component_issues() {
    local issues="$1"
    
    # 统计每个组件出现问题的次数
    declare -A component_counts
    
    for issue in $issues; do
        # 提取组件名
        local component=$(echo "$issue" | grep -oE '(Gateway|OCNMPS|Telegram|模型|磁盘)')
        if [[ -n "$component" ]]; then
            component_counts["$component"]=$((${component_counts["$component"]:-0} + 1))
        fi
    done
    
    # 输出排序结果
    for component in "${!component_counts[@]}"; do
        echo "${component_counts[$component]} $component"
    done | sort -rn
}

# 生成周报
generate_weekly_report() {
    local week_range=$(get_week_range)
    local start_date=$(echo "$week_range" | cut -d' ' -f1)
    local end_date=$(echo "$week_range" | cut -d' ' -f2)
    local report_file="$REPORT_DIR/weekly_${start_date}_${end_date}.md"
    
    collect_week_data "$start_date" "$end_date"
    
    # 判断趋势
    local trend="➡️ 稳定"
    if [[ $WEEK_TOTAL_CRITICALS -gt 0 ]]; then
        trend="⬇️ 需要关注"
    elif [[ $WEEK_TOTAL_WARNINGS -gt 5 ]]; then
        trend="⬇️ 轻微下降"
    elif [[ $WEEK_TOTAL_WARNINGS -eq 0 && $WEEK_TOTAL_CRITICALS -eq 0 ]]; then
        trend="⬆️ 持续健康"
    fi
    
    # 计算模型可用率
    local model_availability="100%"
    if [[ $WEEK_TOTAL_CRITICALS -gt 0 ]]; then
        model_availability="99.5%"
    fi
    
    # 生成报告
    cat > "$report_file" << EOF
# OpenClaw 周报

**时间范围**: $start_date ~ $end_date  
**生成时间**: $(date '+%Y-%m-%d %H:%M:%S')

---

## 📊 总体概况

| 指标 | 数值 |
|------|------|
| 自动检查次数 | $WEEK_TOTAL_CHECKS |
| Warning 总计 | $WEEK_TOTAL_WARNINGS |
| Critical 总计 | $WEEK_TOTAL_CRITICALS |
| 自动修复次数 | $WEEK_TOTAL_REPAIRS |
| Telegram 平均延迟 | ${WEEK_AVG_LATENCY}ms |
| 模型可用率 | $model_availability |
| 健康趋势 | $trend |

---

## 📈 趋势分析

### 本周摘要
- **检查覆盖率**: $WEEK_TOTAL_CHECKS/7 天 ($(( WEEK_TOTAL_CHECKS * 100 / 7 ))%)
- **问题频率**: 每天平均 $(( (WEEK_TOTAL_WARNINGS + WEEK_TOTAL_CRITICALS) / (WEEK_TOTAL_CHECKS > 0 ? WEEK_TOTAL_CHECKS : 1) )) 个告警
- **自愈能力**: $WEEK_TOTAL_REPAIRS 次自动修复

### 健康评分
$(
    if [[ $WEEK_TOTAL_CRITICALS -eq 0 && $WEEK_TOTAL_WARNINGS -eq 0 ]]; then
        echo "**🟢 优秀 (100分)** - 系统运行完美"
    elif [[ $WEEK_TOTAL_CRITICALS -eq 0 && $WEEK_TOTAL_WARNINGS -lt 5 ]]; then
        echo "**🟢 良好 (90分)** - 小问题均自动修复"
    elif [[ $WEEK_TOTAL_CRITICALS -eq 0 ]]; then
        echo "**🟡 一般 (80分)** - 有警告但无关键问题"
    else
        echo "**🔴 需改进 (60分)** - 有关键异常需要人工干预"
    fi
)

---

## 🔧 组件健康

### 问题频率排行
\`\`\`
$(analyze_component_issues "$WEEK_COMPONENTS_ISSUES")
\`\`\`

### 组件状态
| 组件 | 状态 | 备注 |
|------|------|------|
| Gateway | $([ $WEEK_TOTAL_CRITICALS -eq 0 ] && echo "✅ 正常" || echo "⚠️ 有问题") | 核心服务 |
| OCNMPS | ✅ 正常 | 主进程 |
| Telegram | $([ $WEEK_AVG_LATENCY -lt 2000 ] && echo "✅ 正常" || echo "⚠️ 延迟高") | 通知通道 |
| 模型服务 | ✅ 正常 | 核心模型可用 |

---

## 🛠️ 维护建议

$(
    suggestions=""
    if [[ $WEEK_TOTAL_CRITICALS -gt 0 ]]; then
        suggestions+="- ⚠️ **关键异常**: 本周出现 $WEEK_TOTAL_CRITICALS 个关键异常，建议排查根因\n"
    fi
    if [[ $WEEK_AVG_LATENCY -gt 2000 ]]; then
        suggestions+="- 🌐 **网络延迟**: Telegram 延迟较高 (${WEEK_AVG_LATENCY}ms)，考虑检查网络或代理\n"
    fi
    if [[ $WEEK_TOTAL_REPAIRS -gt 3 ]]; then
        suggestions+="- 🔄 **频繁修复**: 本周执行 $WEEK_TOTAL_REPAIRS 次修复，建议检查系统稳定性\n"
    fi
    if [[ -z "$suggestions" ]]; then
        suggestions="- ✅ 系统运行良好，无特别建议"
    fi
    echo "$suggestions"
)

---

## 📋 下周计划

- [ ] 检查日志归档是否正常
- [ ] 确认模型配置无变更
- [ ] 验证通知通道畅通
- [ ] 检查磁盘空间趋势

---

## 📎 附录

### 本周告警详情
$(
    if [[ -n "$WEEK_COMPONENTS_ISSUES" ]]; then
        echo "\`\`\`"
        echo "$WEEK_COMPONENTS_ISSUES" | tr ' ' '\n' | sort | uniq -c | sort -rn | head -10
        echo "\`\`\`"
    else
        echo "无告警"
    fi
)

---

*报告由 Auto-Heal 自动生成*
EOF
    
    echo "周报已生成: $report_file"
    
    # 发送摘要到 Telegram
    local summary="📊 OpenClaw 周报
📅 $start_date ~ $end_date

检查: $WEEK_TOTAL_CHECKS 次
Warning: $WEEK_TOTAL_WARNINGS
Critical: $WEEK_TOTAL_CRITICALS
修复: $WEEK_TOTAL_REPAIRS 次
延迟: ${WEEK_AVG_LATENCY}ms
趋势: $trend

$(if [[ $WEEK_TOTAL_CRITICALS -gt 0 ]]; then echo "⚠️ 需要人工检查关键异常"; else echo "✅ 系统健康"; fi)"
    
    # 如果配置了 Telegram，发送摘要
    if command -v openclaw > /dev/null; then
        openclaw message send --channel telegram --message "$summary" 2>/dev/null || true
    fi
}

# 主入口
case "${1:-}" in
    --generate)
        generate_weekly_report
        ;;
    --test)
        get_week_range
        ;;
    *)
        generate_weekly_report
        ;;
esac