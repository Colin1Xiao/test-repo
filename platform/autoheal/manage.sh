#!/bin/bash
# OpenClaw vNext 管理面板
# 事件驱动 + 策略引擎 + 多代理裁决 + 可复盘

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="$SCRIPT_DIR/bin"
CONFIG_DIR="$SCRIPT_DIR/config"
STATE_DIR="$SCRIPT_DIR/state"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# ASCII Art
show_banner() {
    echo -e "${CYAN}"
    cat << 'EOF'
   ____ _             _ _   _       _    _ _    _ _   _ _____ ____  
  / ___| |_   _  __ _| | | | | __ _| | _(_) | _(_) |_| |  ___|  _ \ 
 | |   | | | | |/ _` | | |_| |/ _` | |/ / | |/ / | __| | |_  | |_) |
 | |___| | |_| | (_| | |  _  | (_| |   <| |   <| | |_| |  _| |  _ < 
  \____|_|\__,_|\__,_|_|_| |_|\__,_|_|\_\_|_|\_\_|\__|_|_|   |_| \_\
  
  vNext - 事件驱动 · 策略可配 · 多代理裁决 · 可复盘
EOF
    echo -e "${NC}"
}

# 快速状态
quick_status() {
    echo -e "${BLUE}📊 系统状态${NC}"
    echo "=========================================="
    echo ""
    
    # Gateway
    if ps aux | grep -v grep | grep -q "openclaw-gateway"; then
        echo -e "Gateway:    ${GREEN}✅ 运行中${NC}"
    else
        echo -e "Gateway:    ${RED}❌ 未运行${NC}"
    fi
    
    # OCNMPS
    if openclaw status 2>&1 | grep -q "running\|active"; then
        echo -e "OCNMPS:     ${GREEN}✅ 运行中${NC}"
    else
        echo -e "OCNMPS:     ${YELLOW}⚠️ 检查状态${NC}"
    fi
    
    # Telegram
    if curl -s --max-time 2 https://api.telegram.org > /dev/null 2>&1; then
        echo -e "Telegram:   ${GREEN}✅ 可达${NC}"
    else
        echo -e "Telegram:   ${YELLOW}⚠️ 不可达${NC}"
    fi
    
    # 当前模式
    local mode=$("$BIN_DIR/run_policy.sh" mode show 2>/dev/null || echo "normal")
    echo -e "运行模式:   ${CYAN}$mode${NC}"
    
    # 事件状态
    local inbox=$(ls "$SCRIPT_DIR/events/inbox"/*.json 2>/dev/null | wc -l | tr -d ' ')
    local processed=$(ls "$SCRIPT_DIR/events/processed"/*.json 2>/dev/null | wc -l | tr -d ' ')
    echo -e "事件:       ${inbox} 待处理 / ${processed} 已处理"
    
    echo ""
}

# 主菜单
show_menu() {
    echo ""
    echo -e "${CYAN}功能菜单:${NC}"
    echo ""
    echo "  ${MAGENTA}[事件系统]${NC}"
    echo "  1  发射事件"
    echo "  2  处理事件"
    echo "  3  事件复盘"
    echo "  4  事件状态"
    echo ""
    echo "  ${MAGENTA}[健康检查]${NC}"
    echo "  5  执行健康检查"
    echo "  6  查看健康状态"
    echo "  7  触发修复"
    echo ""
    echo "  ${MAGENTA}[策略管理]${NC}"
    echo "  8  查看策略"
    echo "  9  切换模式"
    echo "  10 验证策略"
    echo ""
    echo "  ${MAGENTA}[Agent 协作]${NC}"
    echo "  11 SRE Agent 诊断"
    echo "  12 Security Agent 扫描"
    echo "  13 Judge Agent 裁决"
    echo "  14 协调诊断"
    echo ""
    echo "  ${MAGENTA}[运维工具]${NC}"
    echo "  15 快照管理"
    echo "  16 告警管理"
    echo "  17 自然语言查询"
    echo "  18 运维记忆库"
    echo ""
    echo "  ${MAGENTA}[报告]${NC}"
    echo "  19 生成每日简报"
    echo "  20 生成周报"
    echo "  21 复盘报告"
    echo ""
    echo "  0  退出"
    echo ""
}

# 执行命令
execute() {
    local choice="$1"
    
    case "$choice" in
        1)
            echo ""
            echo "发射事件"
            echo "─────────────"
            echo "类型: 1)health.check.completed 2)critical.detected 3)warning.detected 4)repair.started"
            read -p "选择类型 (1-4): " type_choice
            
            case "$type_choice" in
                1) "$BIN_DIR/emit_event.sh" health.check.completed 0 0 0 500 ;;
                2) read -p "告警内容: " alert; "$BIN_DIR/emit_event.sh" critical.detected "$alert" "system" ;;
                3) read -p "告警内容: " alert; "$BIN_DIR/emit_event.sh" warning.detected "$alert" "system" ;;
                4) read -p "修复动作: " action; "$BIN_DIR/emit_event.sh" repair.started "$action" ;;
            esac
            echo ""
            echo "事件已发射到 inbox"
            ;;
        2)
            echo ""
            "$BIN_DIR/process_event.sh" all
            ;;
        3)
            echo ""
            echo "事件复盘"
            echo "─────────────"
            echo "1) 今日 2) 昨日 3) 按日期 4) 最近事件 5) 按事件ID"
            read -p "选择 (1-5): " replay_choice
            
            case "$replay_choice" in
                1) "$BIN_DIR/replay.sh" today ;;
                2) "$BIN_DIR/replay.sh" yesterday ;;
                3) read -p "日期 (YYYY-MM-DD): " date; "$BIN_DIR/replay.sh" date "$date" ;;
                4) "$BIN_DIR/replay.sh" latest 20 ;;
                5) read -p "事件ID: " eid; "$BIN_DIR/replay.sh" event "$eid" ;;
            esac
            ;;
        4)
            echo ""
            "$BIN_DIR/process_event.sh" status
            ;;
        5)
            echo ""
            echo "执行健康检查..."
            "$SCRIPT_DIR/autoheal.sh"
            ;;
        6)
            echo ""
            if [[ -f "$STATE_DIR/latest_health.json" ]]; then
                cat "$STATE_DIR/latest_health.json" | python3 -m json.tool 2>/dev/null || cat "$STATE_DIR/latest_health.json"
            else
                echo "暂无健康数据"
            fi
            ;;
        7)
            echo ""
            echo "触发修复..."
            read -p "修复类型 (gateway_unhealthy/doctor_fixable): " healing_type
            "$BIN_DIR/run_policy.sh" execute "$healing_type" "manual_trigger"
            ;;
        8)
            echo ""
            "$BIN_DIR/run_policy.sh" show
            ;;
        9)
            echo ""
            echo "切换运行模式"
            echo "─────────────"
            echo "当前模式: $( "$BIN_DIR/run_policy.sh" mode show)"
            echo ""
            echo "1) normal  - 自动修复开启"
            echo "2) safe    - 仅巡检不修复"
            echo "3) debug   - 详细日志"
            read -p "选择 (1-3): " mode_choice
            
            case "$mode_choice" in
                1) "$BIN_DIR/run_policy.sh" mode set normal ;;
                2) "$BIN_DIR/run_policy.sh" mode set safe ;;
                3) "$BIN_DIR/run_policy.sh" mode set debug ;;
            esac
            ;;
        10)
            echo ""
            "$BIN_DIR/run_policy.sh" validate
            ;;
        11)
            echo ""
            echo "SRE Agent 诊断..."
            "$SCRIPT_DIR/agents.sh" sre diagnose
            ;;
        12)
            echo ""
            echo "Security Agent 扫描..."
            "$SCRIPT_DIR/agents.sh" security scan
            ;;
        13)
            echo ""
            echo "Judge Agent 裁决..."
            "$BIN_DIR/judge_agent.sh" evaluate
            ;;
        14)
            echo ""
            echo "协调诊断..."
            "$SCRIPT_DIR/agents.sh" coordinate service-down
            ;;
        15)
            echo ""
            echo "快照管理"
            echo "─────────────"
            echo "1) 创建快照 2) 列出快照 3) 查看最新"
            read -p "选择 (1-3): " snap_choice
            
            case "$snap_choice" in
                1) "$SCRIPT_DIR/snapshot.sh" create manual ;;
                2) "$SCRIPT_DIR/snapshot.sh" list ;;
                3) "$SCRIPT_DIR/snapshot.sh" latest ;;
            esac
            ;;
        16)
            echo ""
            echo "告警管理"
            echo "─────────────"
            echo "1) 查看摘要 2) 清理过期 3) 测试通知"
            read -p "选择 (1-3): " alert_choice
            
            case "$alert_choice" in
                1) "$SCRIPT_DIR/alert_manager.sh" summary ;;
                2) "$SCRIPT_DIR/alert_manager.sh" cleanup ;;
                3) read -p "测试内容: " msg; "$SCRIPT_DIR/alert_manager.sh" notify "$msg" warning ;;
            esac
            ;;
        17)
            echo ""
            read -p "请输入问题: " query
            "$SCRIPT_DIR/query.sh" ask "$query"
            ;;
        18)
            echo ""
            echo "运维记忆库"
            echo "─────────────"
            echo "1) 搜索 2) 添加 3) 统计"
            read -p "选择 (1-3): " mem_choice
            
            case "$mem_choice" in
                1) read -p "搜索关键词: " kw; "$SCRIPT_DIR/ops_memory.sh" search "$kw" ;;
                2) 
                    read -p "类型 (incidents/repairs/learnings/known_issues): " mt
                    read -p "标题: " title
                    echo "内容 (Ctrl+D 结束):"
                    content=$(cat)
                    "$SCRIPT_DIR/ops_memory.sh" add "$mt" "$title" "$content"
                    ;;
                3) "$SCRIPT_DIR/ops_memory.sh" stats ;;
            esac
            ;;
        19)
            echo ""
            "$SCRIPT_DIR/autoheal.sh" --digest
            cat "$SCRIPT_DIR/data/digest_$(date +%Y-%m-%d).md" 2>/dev/null
            ;;
        20)
            echo ""
            "$SCRIPT_DIR/reporter.sh" --generate
            ;;
        21)
            echo ""
            read -p "日期 (回车为今天): " report_date
            report_date=${report_date:-$(date +%Y-%m-%d)}
            "$BIN_DIR/replay.sh" report "$report_date"
            ;;
        0)
            echo ""
            echo "👋 再见！"
            exit 0
            ;;
        *)
            echo "无效选择"
            ;;
    esac
}

# 交互模式
interactive() {
    show_banner
    quick_status
    
    while true; do
        show_menu
        read -p "请选择 (0-21): " choice
        execute "$choice"
        echo ""
        read -p "按回车继续..."
    done
}

# CLI 模式
cli() {
    local cmd="$1"
    shift
    
    case "$cmd" in
        # 事件
        emit)
            "$BIN_DIR/emit_event.sh" "$@"
            ;;
        process)
            "$BIN_DIR/process_event.sh" "$@"
            ;;
        replay)
            "$BIN_DIR/replay.sh" "$@"
            ;;
            
        # 健康
        check)
            "$SCRIPT_DIR/autoheal.sh"
            ;;
        health)
            cat "$STATE_DIR/latest_health.json" 2>/dev/null || echo "无健康数据"
            ;;
        repair)
            "$BIN_DIR/run_policy.sh" execute "$@"
            ;;
            
        # 策略
        policy)
            "$BIN_DIR/run_policy.sh" "$@"
            ;;
        mode)
            "$BIN_DIR/run_policy.sh" mode "$@"
            ;;
            
        # Agent
        sre)
            "$SCRIPT_DIR/agents.sh" sre "$@"
            ;;
        security)
            "$SCRIPT_DIR/agents.sh" security "$@"
            ;;
        judge)
            "$BIN_DIR/judge_agent.sh" "$@"
            ;;
        agents)
            "$SCRIPT_DIR/agents.sh" "$@"
            ;;
            
        # 工具
        snapshot)
            "$SCRIPT_DIR/snapshot.sh" "$@"
            ;;
        alerts)
            "$SCRIPT_DIR/alert_manager.sh" "${1:-summary}"
            ;;
        ask)
            "$SCRIPT_DIR/query.sh" ask "$@"
            ;;
        memory)
            "$SCRIPT_DIR/ops_memory.sh" "$@"
            ;;
            
        # 报告
        digest)
            "$SCRIPT_DIR/autoheal.sh" --digest
            ;;
        weekly)
            "$SCRIPT_DIR/reporter.sh" --generate
            ;;
            
        # 快捷
        status)
            quick_status
            ;;
        dashboard)
            open "$SCRIPT_DIR/dashboard/index.html" 2>/dev/null || echo "Dashboard: $SCRIPT_DIR/dashboard/index.html"
            ;;
        watch)
            "$BIN_DIR/process_event.sh" watch
            ;;
            
        help|--help|-h)
            show_banner
            echo "用法: $0 [命令] [参数]"
            echo ""
            echo "事件系统:"
            echo "  emit <类型> [参数]    发射事件"
            echo "  process [all|watch]   处理事件"
            echo "  replay <日期|事件ID>  事件复盘"
            echo ""
            echo "健康检查:"
            echo "  check                 执行健康检查"
            echo "  health                查看健康状态"
            echo "  repair <类型>         触发修复"
            echo ""
            echo "策略管理:"
            echo "  policy <命令>         策略操作"
            echo "  mode [show|set]       模式管理"
            echo ""
            echo "Agent:"
            echo "  sre diagnose          SRE 诊断"
            echo "  security scan         安全扫描"
            echo "  judge evaluate        裁决"
            echo "  agents <命令>         Agent 协作"
            echo ""
            echo "工具:"
            echo "  snapshot <命令>       快照管理"
            echo "  alerts [命令]         告警管理"
            echo "  ask <问题>            自然语言查询"
            echo "  memory <命令>         运维记忆库"
            echo ""
            echo "报告:"
            echo "  digest                每日简报"
            echo "  weekly                周报"
            echo ""
            echo "其他:"
            echo "  status                快速状态"
            echo "  dashboard             打开 Dashboard"
            echo "  watch                 持续监听事件"
            echo ""
            echo "无参数运行进入交互模式"
            ;;
        *)
            interactive
            ;;
    esac
}

# 主入口
cli "$@"