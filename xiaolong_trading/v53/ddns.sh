#!/bin/bash
# DDNS 动态域名更新脚本
# 支持 Cloudflare / DuckDNS / 花生壳

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/ddns.conf"
LOG_FILE="$SCRIPT_DIR/logs/ddns.log"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 获取当前公网 IP
get_public_ip() {
    curl -s https://api.ipify.org 2>/dev/null || \
    curl -s http://ifconfig.me 2>/dev/null || \
    curl -s https://icanhazip.com 2>/dev/null
}

# 获取上次记录的 IP
get_last_ip() {
    if [ -f "$SCRIPT_DIR/.last_ip" ]; then
        cat "$SCRIPT_DIR/.last_ip"
    fi
}

# 保存 IP
save_ip() {
    echo "$1" > "$SCRIPT_DIR/.last_ip"
}

# 记录日志
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Cloudflare DDNS 更新
update_cloudflare() {
    local zone_id="$1"
    local record_id="$2"
    local name="$3"
    local token="$4"
    local ip="$5"
    
    curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$zone_id/dns_records/$record_id" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        --data "{\"type\":\"A\",\"name\":\"$name\",\"content\":\"$ip\",\"ttl\":120,\"proxied\":false}"
}

# DuckDNS 更新
update_duckdns() {
    local domain="$1"
    local token="$2"
    local ip="$3"
    
    curl -s "https://www.duckdns.org/update?domains=$domain&token=$token&ip=$ip"
}

# 主逻辑
main() {
    # 加载配置
    if [ -f "$CONFIG_FILE" ]; then
        source "$CONFIG_FILE"
    else
        echo -e "${RED}❌ 配置文件不存在: $CONFIG_FILE${NC}"
        echo ""
        echo "请创建配置文件:"
        echo ""
        echo "# DuckDNS（推荐，免费简单）"
        echo "PROVIDER=duckdns"
        echo "DUCKDNS_DOMAIN=your-domain"
        echo "DUCKDNS_TOKEN=your-token"
        echo ""
        echo "# 或 Cloudflare"
        echo "PROVIDER=cloudflare"
        echo "CF_ZONE_ID=your-zone-id"
        echo "CF_RECORD_ID=your-record-id"
        echo "CF_NAME=your-domain.com"
        echo "CF_TOKEN=your-api-token"
        exit 1
    fi
    
    # 获取当前 IP
    CURRENT_IP=$(get_public_ip)
    if [ -z "$CURRENT_IP" ]; then
        log "ERROR: 无法获取公网 IP"
        exit 1
    fi
    
    # 获取上次 IP
    LAST_IP=$(get_last_ip)
    
    # 检查 IP 是否变化
    if [ "$CURRENT_IP" = "$LAST_IP" ]; then
        log "INFO: IP 未变化 ($CURRENT_IP)"
        exit 0
    fi
    
    log "INFO: IP 变化 $LAST_IP -> $CURRENT_IP"
    
    # 更新 DDNS
    case "$PROVIDER" in
        duckdns)
            RESULT=$(update_duckdns "$DUCKDNS_DOMAIN" "$DUCKDNS_TOKEN" "$CURRENT_IP")
            if [ "$RESULT" = "OK" ]; then
                log "SUCCESS: DuckDNS 更新成功"
                save_ip "$CURRENT_IP"
            else
                log "ERROR: DuckDNS 更新失败: $RESULT"
                exit 1
            fi
            ;;
        cloudflare)
            RESULT=$(update_cloudflare "$CF_ZONE_ID" "$CF_RECORD_ID" "$CF_NAME" "$CF_TOKEN" "$CURRENT_IP")
            if echo "$RESULT" | grep -q '"success":true'; then
                log "SUCCESS: Cloudflare 更新成功"
                save_ip "$CURRENT_IP"
            else
                log "ERROR: Cloudflare 更新失败: $RESULT"
                exit 1
            fi
            ;;
        *)
            log "ERROR: 未知的 DDNS 提供商: $PROVIDER"
            exit 1
            ;;
    esac
}

# 显示状态
status() {
    CURRENT_IP=$(get_public_ip)
    LAST_IP=$(get_last_ip)
    
    echo "当前公网 IP: $CURRENT_IP"
    echo "上次记录 IP: $LAST_IP"
    
    if [ "$CURRENT_IP" = "$LAST_IP" ]; then
        echo "状态: ✅ 已同步"
    else
        echo "状态: ⚠️  需要更新"
    fi
}

# 安装定时任务
install_cron() {
    # 每 5 分钟检查一次
    (crontab -l 2>/dev/null | grep -v "ddns.sh"; echo "*/5 * * * * cd $SCRIPT_DIR && ./ddns.sh update") | crontab -
    echo "✅ 定时任务已安装（每 5 分钟检查）"
}

# 卸载定时任务
uninstall_cron() {
    crontab -l 2>/dev/null | grep -v "ddns.sh" | crontab -
    echo "✅ 定时任务已卸载"
}

# 命令处理
case "${1:-update}" in
    update)
        main
        ;;
    status)
        status
        ;;
    install)
        install_cron
        ;;
    uninstall)
        uninstall_cron
        ;;
    *)
        echo "用法: $0 [update|status|install|uninstall]"
        echo ""
        echo "  update    - 检查并更新 DDNS"
        echo "  status    - 显示当前状态"
        echo "  install   - 安装定时任务"
        echo "  uninstall - 卸载定时任务"
        exit 1
        ;;
esac
