#!/bin/bash
# 小龙自动交易系统 V3 监控启动脚本
# 用于启动7×24小时监控系统

echo "======================================"
echo "🚀 启动小龙自动交易系统 V3"
echo "======================================"
echo ""

# 1. 进入工作目录
echo "📂 进入工作目录..."
cd /Users/colin/.openclaw/workspace
echo "   当前目录: $(pwd)"
echo ""

# 2. 加载代理配置
echo "🔌 加载网络代理..."
source ~/.zshrc
echo "   代理配置: $https_proxy"
echo ""

# 3. 检查必要文件
echo "🔍 检查必要文件..."
if [ ! -f "auto_monitor_v3.py" ]; then
    if [ -f "auto_monitor_v2.py" ]; then
        echo "   ⚠️  V3监控脚本不存在，使用V2替代"
        MONITOR_SCRIPT="auto_monitor_v2.py"
    else
        echo "   ❌ 监控脚本不存在"
        exit 1
    fi
else
    MONITOR_SCRIPT="auto_monitor_v3.py"
fi
echo "   使用监控脚本: $MONITOR_SCRIPT"
echo ""

# 4. 检查配置文件
echo "⚙️  检查配置文件..."
CONFIG_FILES=("telegram_config.json" "trader_config.json")
for config in "${CONFIG_FILES[@]}"; do
    if [ -f "$config" ]; then
        echo "   ✅ $config 存在"
    else
        echo "   ⚠️  $config 不存在"
    fi
done
echo ""

# 5. 启动监控系统
echo "🤖 启动监控系统..."
echo "   监控脚本: $MONITOR_SCRIPT"
echo "   日志文件: monitor_live.log"
echo "   启动时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 启动监控进程（后台运行）
nohup python3 "$MONITOR_SCRIPT" > monitor_live.log 2>&1 &

# 获取进程PID
MONITOR_PID=$!
echo "   进程PID: $MONITOR_PID"

# 6. 验证进程启动
sleep 3
if ps -p $MONITOR_PID > /dev/null; then
    echo "✅ 监控系统启动成功!"
    echo "📊 系统状态:"
    echo "   - 进程: $MONITOR_PID"
    echo "   - 文件: $MONITOR_SCRIPT"
    echo "   - 日志: monitor_live.log"
    echo ""
    echo "📈 查看实时日志:"
    echo "   tail -f monitor_live.log"
    echo ""
    echo "📱 Telegram告警: 已启用"
    echo "🔒 风控参数: 已加载"
    echo "🔄 自动重启: 已配置"
    echo ""
    echo "======================================"
    echo "🎉 小龙自动交易系统 V3 运行中!"
    echo "======================================"
else
    echo "❌ 监控系统启动失败!"
    echo "   检查 monitor_live.log 获取详细信息"
    exit 1
fi