#!/bin/bash

# 降级测试执行脚本
# 用法：./run_degrade_test.sh [test_name]

set -e

CONFIG_FILE="$HOME/.openclaw/config.json"
CONFIG_BACKUP="$HOME/.openclaw/config.json.bak"
OPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 备份配置
backup_config() {
    log_info "备份配置文件..."
    cp "$CONFIG_FILE" "$CONFIG_BACKUP"
}

# 恢复配置
restore_config() {
    log_info "恢复配置文件..."
    if [ -f "$CONFIG_BACKUP" ]; then
        cp "$CONFIG_BACKUP" "$CONFIG_FILE"
        restart_gateway
    else
        log_error "备份文件不存在: $CONFIG_BACKUP"
        exit 1
    fi
}

# 重启网关
restart_gateway() {
    log_info "重启网关..."
    openclaw gateway restart
    log_info "等待网关启动..."
    sleep 5
}

# 检查网关状态
check_gateway() {
    log_info "检查网关状态..."
    openclaw gateway status
}

# 测试 1: Telegram Callback 降级
test_telegram_callback() {
    log_info "=== 测试 1: Telegram Callback 降级 ==="
    
    backup_config
    
    log_info "禁用 ocnmps-router 插件..."
    jq '.plugins.entries["ocnmps-router"].enabled = false' "$CONFIG_FILE" > /tmp/config.json
    mv /tmp/config.json "$CONFIG_FILE"
    
    restart_gateway
    check_gateway
    
    log_warn "请手动验证:"
    echo "  1. 发送 Telegram 测试消息"
    echo "  2. 点击审批按钮 (应无响应)"
    echo "  3. 发送文本命令 /status"
    echo ""
    read -p "按回车继续恢复..."
    
    restore_config
    check_gateway
    
    log_info "测试 1 完成"
}

# 测试 2: 审批链路降级
test_approval_bridge() {
    log_info "=== 测试 2: 审批链路降级 ==="
    
    backup_config
    
    log_info "禁用 Telegram channel..."
    jq '.channels.telegram.enabled = false' "$CONFIG_FILE" > /tmp/config.json
    mv /tmp/config.json "$CONFIG_FILE"
    
    log_info "权限策略收紧 (deny)..."
    jq '.security.mode = "deny"' "$CONFIG_FILE" > /tmp/config.json
    mv /tmp/config.json "$CONFIG_FILE"
    
    restart_gateway
    check_gateway
    
    log_warn "请手动验证:"
    echo "  1. 尝试写入 workspace 外文件"
    echo "  2. 观察任务状态 (应被拒绝或挂起)"
    echo "  3. 检查日志是否有拒绝记录"
    echo ""
    read -p "按回车继续恢复..."
    
    restore_config
    check_gateway
    
    log_info "测试 2 完成"
}

# 测试 3: Memory 写入降级
test_memory_autowrite() {
    log_info "=== 测试 3: Memory 写入降级 ==="
    
    backup_config
    
    log_info "禁用自动写入 Agent (如果有)..."
    # 检查是否有 auto_summarizer Agent
    if jq -e '.agents.entries.auto_summarizer' "$CONFIG_FILE" > /dev/null 2>&1; then
        jq 'del(.agents.entries.auto_summarizer)' "$CONFIG_FILE" > /tmp/config.json
        mv /tmp/config.json "$CONFIG_FILE"
        log_info "已禁用 auto_summarizer"
    else
        log_warn "未找到 auto_summarizer Agent，跳过"
    fi
    
    restart_gateway
    check_gateway
    
    log_warn "请手动验证:"
    echo "  1. 发送 Memory 查询请求"
    echo "  2. 验证检索正常"
    echo "  3. 检查 memory/ 目录无新增文件"
    echo "  4. 发送 10 个请求测试性能"
    echo ""
    read -p "按回车继续恢复..."
    
    restore_config
    check_gateway
    
    log_info "测试 3 完成"
}

# 测试 4: Worktree 降级
test_worktree() {
    log_info "=== 测试 4: Worktree 降级 ==="
    
    backup_config
    
    log_info "禁用写操作 Agent (如果有)..."
    # 检查是否有 code_fixer Agent
    if jq -e '.agents.entries.code_fixer' "$CONFIG_FILE" > /dev/null 2>&1; then
        jq 'del(.agents.entries.code_fixer)' "$CONFIG_FILE" > /tmp/config.json
        mv /tmp/config.json "$CONFIG_FILE"
        log_info "已禁用 code_fixer"
    else
        log_warn "未找到 code_fixer Agent，跳过"
    fi
    
    log_info "权限策略收紧 (ask=always)..."
    jq '.security.ask = "always"' "$CONFIG_FILE" > /tmp/config.json
    mv /tmp/config.json "$CONFIG_FILE"
    
    restart_gateway
    check_gateway
    
    log_warn "请手动验证:"
    echo "  1. 尝试修改 workspace 内文件"
    echo "  2. 观察是否有审批提示"
    echo "  3. 检查主工作区文件未被直接修改"
    echo "  4. 验证只读操作不受影响"
    echo ""
    read -p "按回车继续恢复..."
    
    restore_config
    check_gateway
    
    log_info "测试 4 完成"
}

# 测试 5: Runtime V2 降级
test_runtime_v2() {
    log_info "=== 测试 5: Runtime V2 降级 ==="
    
    backup_config
    
    log_info "仅保留 main Agent..."
    # 保存其他 Agent 配置到临时文件
    jq '.agents.entries = {"main": .agents.entries.main}' "$CONFIG_FILE" > /tmp/config.json
    mv /tmp/config.json "$CONFIG_FILE"
    
    restart_gateway
    check_gateway
    
    log_warn "请手动验证:"
    echo "  1. 发送 main Agent 任务 (应正常)"
    echo "  2. 发送 code_fixer 任务 (应被拒绝)"
    echo "  3. 验证核心只读链路正常"
    echo ""
    read -p "按回车继续恢复..."
    
    restore_config
    check_gateway
    
    log_info "测试 5 完成"
}

# 运行所有测试
run_all_tests() {
    log_info "=== 开始运行所有降级测试 ==="
    echo ""
    
    test_telegram_callback
    echo ""
    
    test_approval_bridge
    echo ""
    
    test_memory_autowrite
    echo ""
    
    test_worktree
    echo ""
    
    test_runtime_v2
    echo ""
    
    log_info "=== 所有测试完成 ==="
}

# 显示帮助
show_help() {
    echo "用法：$0 [test_name]"
    echo ""
    echo "可用测试:"
    echo "  telegram_callback  - 测试 1: Telegram Callback 降级"
    echo "  approval_bridge    - 测试 2: 审批链路降级"
    echo "  memory_autowrite   - 测试 3: Memory 写入降级"
    echo "  worktree           - 测试 4: Worktree 降级"
    echo "  runtime_v2         - 测试 5: Runtime V2 降级"
    echo "  all                - 运行所有测试"
    echo "  help               - 显示帮助"
    echo ""
    echo "示例:"
    echo "  $0 all                    # 运行所有测试"
    echo "  $0 telegram_callback      # 运行单个测试"
}

# 主函数
main() {
    case "${1:-all}" in
        telegram_callback)
            test_telegram_callback
            ;;
        approval_bridge)
            test_approval_bridge
            ;;
        memory_autowrite)
            test_memory_autowrite
            ;;
        worktree)
            test_worktree
            ;;
        runtime_v2)
            test_runtime_v2
            ;;
        all)
            run_all_tests
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知测试：$1"
            show_help
            exit 1
            ;;
    esac
}

# 检查依赖
check_dependencies() {
    if ! command -v jq &> /dev/null; then
        log_error "jq 未安装，请先安装：brew install jq"
        exit 1
    fi
    
    if ! command -v openclaw &> /dev/null; then
        log_error "openclaw 未安装或未在 PATH 中"
        exit 1
    fi
}

# 执行
check_dependencies
main "$@"
