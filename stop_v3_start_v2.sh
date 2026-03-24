#!/bin/bash
# 小龙自动交易系统 V3 -> V2 回滚脚本

echo "🔄 开始执行 V3 -> V2 回滚流程..."

# 1. 停止 V3 监控进程
echo "🛑 停止 V3 监控进程..."
pkill -f "auto_monitor_v3\|monitor_v3\|dragon_v3"

# 2. 验证 V3 进程已停止
sleep 2
V3_PROCESSES=$(ps aux | grep -E "(auto_monitor_v3|monitor_v3|dragon_v3)" | grep -v grep | wc -l)
if [ $V3_PROCESSES -eq 0 ]; then
    echo "✅ V3 进程已停止"
else
    echo "⚠️ 仍有 $V3_PROCESSES 个 V3 进程在运行"
    ps aux | grep -E "(auto_monitor_v3|monitor_v3|dragon_v3)" | grep -v grep
fi

# 3. 启动 V2 监控进程
echo "🚀 启动 V2 监控进程..."
cd /Users/colin/.openclaw/workspace
python3 auto_monitor_v2.py > monitor_v2.log 2>&1 &

# 4. 验证 V2 进程启动
sleep 3
V2_PROCESSES=$(ps aux | grep -E "auto_monitor_v2\.py" | grep -v grep | wc -l)
if [ $V2_PROCESSES -gt 0 ]; then
    echo "✅ V2 进程已启动"
    ps aux | grep -E "auto_monitor_v2\.py" | grep -v grep
else
    echo "❌ V2 进程启动失败"
    exit 1
fi

echo "✅ 回滚完成！系统已切换至 V2 版本"
echo "📋 V2 日志输出至: /Users/colin/.openclaw/workspace/monitor_v2.log"