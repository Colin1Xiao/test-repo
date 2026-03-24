#!/bin/bash
# 多代理协作框架
# SRE Agent, Security Agent, Code Agent, Reporter Agent
# 让 OpenClaw 从单代理工具变成小型自治系统

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENTS_DIR="$SCRIPT_DIR/agents"
INCIDENTS_DIR="$SCRIPT_DIR/incidents"

mkdir -p "$AGENTS_DIR" "$INCIDENTS_DIR"

# 当前事件 ID
INCIDENT_ID=$(date +%Y%m%d_%H%M%S)

# ============ SRE Agent ============
# 职责：盯健康状态、日志、重启、修复

sre_agent() {
    local action="$1"
    local context="$2"
    
    local report_file="$AGENTS_DIR/sre_report_$INCIDENT_ID.md"
    
    case "$action" in
        diagnose)
            cat > "$report_file" << EOF
# SRE Agent 诊断报告

**时间**: $(date)
**事件 ID**: $INCIDENT_ID

## 诊断步骤

### 1. 服务状态检查
\`\`\`
$(openclaw status 2>&1)
\`\`\`

### 2. Gateway 状态
\`\`\`
$(openclaw gateway status 2>&1)
\`\`\`

### 3. 最近日志异常
\`\`\`
$(tail -50 ~/.openclaw/logs/*.log 2>/dev/null | grep -iE "(error|fail|warn)" | tail -10)
\`\`\`

### 4. 资源使用
\`\`\`
$(df -h / 2>/dev/null | head -2)
\`\`\`

## 诊断结论

$(if pgrep -f "openclaw" > /dev/null; then
    echo "- ✅ OpenClaw 进程运行中"
else
    echo "- ❌ OpenClaw 进程未运行"
fi)

$(if pgrep -f "gateway" > /dev/null; then
    echo "- ✅ Gateway 进程运行中"
else
    echo "- ❌ Gateway 进程未运行"
fi)

## 建议操作

$(if ! pgrep -f "gateway" > /dev/null; then
    echo "1. 重启 Gateway: openclaw gateway start"
fi)

---
*SRE Agent Report*
EOF
            echo "$report_file"
            ;;
            
        repair)
            local repair_log="$AGENTS_DIR/sre_repair_$INCIDENT_ID.log"
            
            {
                echo "=== SRE Agent 修复操作 ==="
                echo "时间: $(date)"
                echo ""
                
                # 尝试修复
                echo "执行: doctor --repair --yes"
                openclaw doctor --repair --yes 2>&1
                echo ""
                
                # 检查结果
                sleep 2
                echo "验证修复结果..."
                openclaw health check 2>&1
                
            } > "$repair_log"
            
            echo "$repair_log"
            ;;
            
        monitor)
            # 持续监控模式
            echo "SRE Agent 监控中..."
            while true; do
                local health=$(openclaw health check 2>&1)
                if echo "$health" | grep -qi "error\|fail\|critical"; then
                    echo "[SRE] 检测到异常: $(date)"
                    # 触发其他 agent
                fi
                sleep 300  # 5分钟
            done
            ;;
    esac
}

# ============ Security Agent ============
# 职责：盯 dangerous-exec、quarantine、权限问题

security_agent() {
    local action="$1"
    local context="$2"
    
    local report_file="$AGENTS_DIR/security_report_$INCIDENT_ID.md"
    
    case "$action" in
        scan)
            cat > "$report_file" << EOF
# Security Agent 安全扫描报告

**时间**: $(date)
**事件 ID**: $INCIDENT_ID

## 安全检查项

### 1. Dangerous Exec 检查
\`\`\`
$(grep -r "dangerous-exec\|dangerous_exec" ~/.openclaw/logs/ 2>/dev/null | tail -10 || echo "无危险执行记录")
\`\`\`

### 2. 隔离技能检查
\`\`\`
$(find ~/.openclaw/skills -name ".quarantine" 2>/dev/null || echo "无隔离技能")
\`\`\`

### 3. 权限配置检查
\`\`\`
$(ls -la ~/.openclaw/config/ 2>/dev/null | head -10)
\`\`\`

### 4. 敏感文件权限
\`\`\`
$(stat -f "%Lp %N" ~/.openclaw/config/*.json 2>/dev/null | head -10)
\`\`\`

## 安全评估

$(if grep -r "dangerous-exec" ~/.openclaw/logs/ 2>/dev/null | grep -q "$(date +%Y-%m-%d)"; then
    echo "⚠️ 今日有危险执行记录，需要审查"
else
    echo "✅ 无近期安全事件"
fi)

## 建议操作

- 定期审查 dangerous-exec 日志
- 确保 .env 文件权限为 600
- 检查 quarantine 目录

---
*Security Agent Report*
EOF
            echo "$report_file"
            ;;
            
        quarantine-check)
            local quarantine_dir="$HOME/.openclaw/skills/quarantine"
            
            if [[ -d "$quarantine_dir" ]]; then
                echo "隔离的技能:"
                ls -la "$quarantine_dir" 2>/dev/null
            else
                echo "无隔离技能"
            fi
            ;;
    esac
}

# ============ Code Agent ============
# 职责：写修复脚本、解析日志、生成补丁

code_agent() {
    local action="$1"
    local context="$2"
    
    local work_dir="$AGENTS_DIR/code_work"
    mkdir -p "$work_dir"
    
    case "$action" in
        analyze-logs)
            local log_file="$3"
            local output="$work_dir/log_analysis_$INCIDENT_ID.md"
            
            cat > "$output" << EOF
# Code Agent 日志分析

**时间**: $(date)
**源文件**: $log_file

## 错误模式统计

| 模式 | 出现次数 |
|------|----------|
$(grep -oE '\b[A-Z_]{3,}\b' "$log_file" 2>/dev/null | sort | uniq -c | sort -rn | head -10 | awk '{printf "| %s | %d |\n", $2, $1}')

## 时间线分析

$(grep -E "^[0-9]{4}-[0-9]{2}-[0-9]{2}" "$log_file" 2>/dev/null | tail -20)

## 建议修复脚本

\`\`\`bash
# 自动生成的修复脚本
# 请审查后执行

#!/bin/bash
# TODO: 根据日志分析生成修复命令
\`\`\`

---
*Code Agent Analysis*
EOF
            echo "$output"
            ;;
            
        generate-fix)
            local issue="$3"
            local script_file="$work_dir/fix_$INCIDENT_ID.sh"
            
            # 根据问题类型生成修复脚本
            case "$issue" in
                gateway-down)
                    cat > "$script_file" << 'SCRIPT'
#!/bin/bash
# Gateway 修复脚本
set -e

echo "检查 Gateway 状态..."
if ! pgrep -f "openclaw-gateway" > /dev/null; then
    echo "Gateway 未运行，正在启动..."
    openclaw gateway start
    sleep 3
fi

echo "验证 Gateway..."
openclaw gateway status

echo "修复完成"
SCRIPT
                    ;;
                disk-full)
                    cat > "$script_file" << 'SCRIPT'
#!/bin/bash
# 磁盘清理脚本
set -e

echo "清理日志文件..."
find ~/.openclaw/logs -name "*.log" -mtime +7 -delete

echo "清理临时文件..."
find /tmp -name "openclaw_*" -mtime +1 -delete 2>/dev/null || true

echo "清理完成"
df -h /
SCRIPT
                    ;;
                *)
                    cat > "$script_file" << 'SCRIPT'
#!/bin/bash
# 通用修复脚本
# 请根据具体情况修改

echo "TODO: 实现具体修复逻辑"
SCRIPT
                    ;;
            esac
            
            chmod +x "$script_file"
            echo "$script_file"
            ;;
    esac
}

# ============ Reporter Agent ============
# 职责：生成日报、周报、变更摘要

reporter_agent() {
    local action="$1"
    
    case "$action" in
        incident-report)
            local incident_id="$2"
            local output="$INCIDENTS_DIR/incident_$incident_id.md"
            
            # 收集所有 agent 报告
            local sre_report=$(ls -t "$AGENTS_DIR"/sre_report_*.md 2>/dev/null | head -1)
            local security_report=$(ls -t "$AGENTS_DIR"/security_report_*.md 2>/dev/null | head -1)
            
            cat > "$output" << EOF
# 事件报告

**事件 ID**: $incident_id
**生成时间**: $(date)

---

## 事件摘要

$(if [[ -f "$sre_report" ]]; then
    echo "### SRE Agent 报告"
    cat "$sre_report"
fi)

$(if [[ -f "$security_report" ]]; then
    echo ""
    echo "### Security Agent 报告"
    cat "$security_report"
fi)

---

## 时间线

| 时间 | 事件 |
|------|------|
| $(date -u +%H:%M) | 事件检测 |
| $(date -u +%H:%M) | Agent 协作启动 |

## 影响评估

- 影响范围: 待评估
- 影响用户: 待评估
- 持续时间: 待评估

## 根因分析

待填写

## 解决方案

待填写

## 后续行动

- [ ] 记录经验教训到 ops_memory
- [ ] 更新监控阈值
- [ ] 通知相关方

---
*Reporter Agent Report*
EOF
            echo "$output"
            ;;
            
        summary)
            echo "📊 Agent 协作摘要"
            echo "=============================="
            echo ""
            echo "最近的 Agent 报告:"
            ls -lt "$AGENTS_DIR"/*.md 2>/dev/null | head -5
            echo ""
            echo "事件记录:"
            ls -lt "$INCIDENTS_DIR"/*.md 2>/dev/null | head -5
            ;;
    esac
}

# ============ 协调器 ============
# 协调多个 Agent 协作

coordinator() {
    local event_type="$1"
    local context="$2"
    
    echo "🐉 Agent 协调器启动"
    echo "事件类型: $event_type"
    echo "事件 ID: $INCIDENT_ID"
    echo "=============================="
    echo ""
    
    case "$event_type" in
        service-down)
            echo "📋 调用 SRE Agent 进行诊断..."
            local sre_report=$(sre_agent diagnose "$context")
            echo "  报告: $sre_report"
            echo ""
            
            echo "🔒 调用 Security Agent 进行安全检查..."
            local sec_report=$(security_agent scan "$context")
            echo "  报告: $sec_report"
            echo ""
            
            echo "🔧 调用 Code Agent 生成修复方案..."
            local fix_script=$(code_agent generate-fix gateway-down)
            echo "  脚本: $fix_script"
            echo ""
            
            echo "📝 调用 Reporter Agent 生成事件报告..."
            local incident_report=$(reporter_agent incident-report "$INCIDENT_ID")
            echo "  报告: $incident_report"
            ;;
            
        security-alert)
            echo "🔒 调用 Security Agent..."
            security_agent scan "$context"
            ;;
            
        performance-issue)
            echo "🔧 调用 Code Agent 分析日志..."
            code_agent analyze-logs "$context"
            ;;
            
        *)
            echo "未知事件类型: $event_type"
            echo ""
            echo "支持的事件类型:"
            echo "  - service-down    服务宕机"
            echo "  - security-alert  安全告警"
            echo "  - performance-issue 性能问题"
            ;;
    esac
}

# 主入口
case "${1:-}" in
    sre)
        shift
        sre_agent "$@"
        ;;
    security)
        shift
        security_agent "$@"
        ;;
    code)
        shift
        code_agent "$@"
        ;;
    reporter)
        shift
        reporter_agent "$@"
        ;;
    coordinate)
        shift
        coordinator "$@"
        ;;
    status)
        reporter_agent summary
        ;;
    *)
        echo "多代理协作框架"
        echo ""
        echo "用法:"
        echo "  $0 sre <diagnose|repair|monitor>     - SRE Agent"
        echo "  $0 security <scan|quarantine-check>  - Security Agent"
        echo "  $0 code <analyze-logs|generate-fix>  - Code Agent"
        echo "  $0 reporter <incident-report>        - Reporter Agent"
        echo "  $0 coordinate <事件类型>             - 协调多 Agent 协作"
        echo "  $0 status                            - 查看状态"
        echo ""
        echo "事件类型:"
        echo "  - service-down      服务宕机"
        echo "  - security-alert    安全告警"
        echo "  - performance-issue 性能问题"
        ;;
esac