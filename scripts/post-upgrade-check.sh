#!/bin/bash
# 小龙升级后检查脚本 (简化版)
# 自动检查并修复 brew/Python/npm 环境配置

set -e

SCRIPT_NAME="post-upgrade-check"
LOG_FILE="${HOME}/.openclaw/workspace/logs/${SCRIPT_NAME}.log"
mkdir -p "$(dirname "$LOG_FILE")"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

section() {
    echo "" | tee -a "$LOG_FILE"
    echo -e "${BLUE}=== $1 ===${NC}" | tee -a "$LOG_FILE"
}

check_ok() { echo -e "  ${GREEN}✓${NC} $1" | tee -a "$LOG_FILE"; }
check_warn() { echo -e "  ${YELLOW}⚠${NC} $1" | tee -a "$LOG_FILE"; }

main() {
    log "小龙升级后检查开始"
    
    section "1. brew 链接"
    if brew list python@3.14 &>/dev/null; then
        if [ -L "/usr/local/bin/python3" ] && [[ $(readlink /usr/local/bin/python3) == *"python@3.14"* ]]; then
            check_ok "Python 3.14 已链接"
        else
            log "修复 Python 链接..."
            brew link --overwrite python@3.14 >/dev/null 2>&1
            check_ok "Python 3.14 链接已修复"
        fi
    fi
    
    section "2. PATH 配置"
    if grep -q 'export PATH="/usr/local/bin' ~/.zshrc 2>/dev/null; then
        check_ok "~/.zshrc PATH 已配置"
    else
        log "添加 PATH 配置..."
        echo 'export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"' >> ~/.zshrc
        check_ok "~/.zshrc PATH 已添加"
    fi
    
    if [[ ":$PATH:" == *":/usr/local/bin:"* ]]; then
        check_ok "当前 PATH 正确"
    else
        check_warn "需运行 'source ~/.zshrc' 或重启终端"
    fi
    
    section "3. Python 环境"
    if [ -x "/usr/local/bin/python3" ]; then
        check_ok "$(/usr/local/bin/python3 --version)"
    fi
    if [ -x "/usr/local/bin/pip3" ]; then
        check_ok "pip3 可用"
    fi
    
    section "4. npm 环境"
    if command -v npm &>/dev/null; then
        check_ok "npm v$(npm -v)"
    fi
    
    section "5. 清理缓存"
    brew cleanup --quiet 2>/dev/null && check_ok "brew 缓存已清理" || true
    npm cache clean --force &>/dev/null && check_ok "npm 缓存已清理" || true
    
    section "完成"
    echo "" | tee -a "$LOG_FILE"
    echo -e "${GREEN}✓ 检查完成${NC}" | tee -a "$LOG_FILE"
    echo "日志：$LOG_FILE" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    log "建议：重启终端或运行 'source ~/.zshrc'"
}

main "$@"
