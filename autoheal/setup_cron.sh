#!/bin/bash
# Auto-Heal Cron 任务设置
# 配置定时任务：每日检查、每日简报、周报

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOHEAL_SCRIPT="$SCRIPT_DIR/autoheal.sh"
REPORTER_SCRIPT="$SCRIPT_DIR/reporter.sh"

# 当前用户的 crontab
CRONTAB_FILE="/tmp/openclaw_cron_$$"

# 保存当前 crontab
crontab -l > "$CRONTAB_FILE" 2>/dev/null || true

# 检查是否已存在 Auto-Heal 任务
if grep -q "autoheal.sh" "$CRONTAB_FILE"; then
    echo "⚠️ Auto-Heal 定时任务已存在"
    echo ""
    echo "当前任务:"
    grep "autoheal" "$CRONTAB_FILE"
    echo ""
    read -p "是否更新？ (y/N): " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        rm "$CRONTAB_FILE"
        exit 0
    fi
    # 移除旧任务
    grep -v "autoheal" "$CRONTAB_FILE" > "${CRONTAB_FILE}.new"
    mv "${CRONTAB_FILE}.new" "$CRONTAB_FILE"
fi

echo ""
echo "🐉 Auto-Heal 定时任务配置"
echo "=============================="
echo ""
echo "选择要配置的任务:"
echo ""
echo "1. 每日健康检查 (推荐: 每4小时)"
echo "2. 每日简报 (推荐: 04:05)"
echo "3. 每周报告 (推荐: 周日 09:00)"
echo "4. 全部配置 (推荐设置)"
echo "5. 自定义"
echo ""
read -p "请选择 (1-5): " choice

case "$choice" in
    1)
        echo ""
        echo "每日健康检查频率:"
        echo "  a) 每2小时"
        echo "  b) 每4小时 (推荐)"
        echo "  c) 每6小时"
        echo "  d) 每12小时"
        echo ""
        read -p "选择 (a-d): " freq
        
        case "$freq" in
            a) cron_expr="0 */2 * * *" ;;
            b) cron_expr="0 */4 * * *" ;;
            c) cron_expr="0 */6 * * *" ;;
            d) cron_expr="0 */12 * * *" ;;
            *) cron_expr="0 */4 * * *" ;;
        esac
        
        echo "$cron_expr $AUTOHEAL_SCRIPT >> $SCRIPT_DIR/logs/cron.log 2>&1" >> "$CRONTAB_FILE"
        echo "✅ 已配置: $cron_expr 运行健康检查"
        ;;
        
    2)
        echo ""
        read -p "每日简报时间 (默认 04:05, 格式 HH:MM): " time
        time=${time:-04:05}
        
        hour=$(echo "$time" | cut -d: -f1)
        minute=$(echo "$time" | cut -d: -f2)
        
        echo "$minute $hour * * * $AUTOHEAL_SCRIPT --digest >> $SCRIPT_DIR/logs/cron.log 2>&1" >> "$CRONTAB_FILE"
        echo "✅ 已配置: 每天 $time 生成简报"
        ;;
        
    3)
        echo ""
        echo "周报生成时间:"
        echo "  a) 周日 09:00 (推荐)"
        echo "  b) 周一 08:00"
        echo "  c) 自定义"
        echo ""
        read -p "选择 (a-c): " weekly
        
        case "$weekly" in
            a) 
                cron_expr="0 9 * * 0"
                time_desc="周日 09:00"
                ;;
            b)
                cron_expr="0 8 * * 1"
                time_desc="周一 08:00"
                ;;
            c)
                read -p "输入 cron 表达式 (如 '0 9 * * 0' 表示周日9点): " cron_expr
                time_desc="$cron_expr"
                ;;
            *)
                cron_expr="0 9 * * 0"
                time_desc="周日 09:00"
                ;;
        esac
        
        echo "$cron_expr $REPORTER_SCRIPT --generate >> $SCRIPT_DIR/logs/cron.log 2>&1" >> "$CRONTAB_FILE"
        echo "✅ 已配置: $time_desc 生成周报"
        ;;
        
    4)
        echo ""
        echo "配置推荐的完整监控方案..."
        echo ""
        
        # 每4小时健康检查
        echo "0 */4 * * * $AUTOHEAL_SCRIPT >> $SCRIPT_DIR/logs/cron.log 2>&1" >> "$CRONTAB_FILE"
        echo "  ✅ 每4小时健康检查"
        
        # 每日简报 04:05
        echo "5 4 * * * $AUTOHEAL_SCRIPT --digest >> $SCRIPT_DIR/logs/cron.log 2>&1" >> "$CRONTAB_FILE"
        echo "  ✅ 每天 04:05 生成简报"
        
        # 周报 周日 09:00
        echo "0 9 * * 0 $REPORTER_SCRIPT --generate >> $SCRIPT_DIR/logs/cron.log 2>&1" >> "$CRONTAB_FILE"
        echo "  ✅ 每周日 09:00 生成周报"
        ;;
        
    5)
        echo ""
        echo "自定义配置"
        echo ""
        
        echo "--- 健康检查 ---"
        read -p "健康检查 cron 表达式 (如 '0 */4 * * *'): " health_cron
        if [[ -n "$health_cron" ]]; then
            echo "$health_cron $AUTOHEAL_SCRIPT >> $SCRIPT_DIR/logs/cron.log 2>&1" >> "$CRONTAB_FILE"
            echo "  ✅ 健康检查: $health_cron"
        fi
        
        echo ""
        echo "--- 每日简报 ---"
        read -p "简报 cron 表达式 (如 '5 4 * * *'): " digest_cron
        if [[ -n "$digest_cron" ]]; then
            echo "$digest_cron $AUTOHEAL_SCRIPT --digest >> $SCRIPT_DIR/logs/cron.log 2>&1" >> "$CRONTAB_FILE"
            echo "  ✅ 每日简报: $digest_cron"
        fi
        
        echo ""
        echo "--- 周报 ---"
        read -p "周报 cron 表达式 (如 '0 9 * * 0'): " weekly_cron
        if [[ -n "$weekly_cron" ]]; then
            echo "$weekly_cron $REPORTER_SCRIPT --generate >> $SCRIPT_DIR/logs/cron.log 2>&1" >> "$CRONTAB_FILE"
            echo "  ✅ 周报: $weekly_cron"
        fi
        ;;
        
    *)
        echo "❌ 无效选择"
        rm "$CRONTAB_FILE"
        exit 1
        ;;
esac

# 安装新的 crontab
echo ""
echo "正在安装定时任务..."
crontab "$CRONTAB_FILE"
rm "$CRONTAB_FILE"

echo ""
echo "✅ 配置完成！"
echo ""
echo "当前定时任务:"
echo "=============================="
crontab -l | grep -E "(autoheal|reporter)" || echo "无任务"
echo ""
echo "日志位置: $SCRIPT_DIR/logs/cron.log"
echo ""
echo "提示: 使用 'crontab -e' 手动编辑定时任务"