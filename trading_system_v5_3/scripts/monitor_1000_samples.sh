#!/bin/bash
# 监控样本积累到 1000 笔

LOG_FILE="/Users/colin/.openclaw/workspace/trading_system_v5_3/logs/system_state.jsonl"
TARGET=1000

while true; do
    if [ -f "$LOG_FILE" ]; then
        # 获取最新状态
        LAST_LINE=$(tail -1 "$LOG_FILE" 2>/dev/null)
        if [ -n "$LAST_LINE" ]; then
            TRADES=$(echo "$LAST_LINE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('total_trades',0))" 2>/dev/null)
            TIMESTAMP=$(echo "$LAST_LINE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('timestamp',''))" 2>/dev/null)
            
            # 计算进度
            PROGRESS=$(echo "scale=1; $TRADES / $TARGET * 100" | bc 2>/dev/null || echo "0")
            
            # 显示进度条
            FILLED=$((TRADES / 10))
            EMPTY=$((100 - FILLED))
            BAR=""
            for i in $(seq 1 $FILLED); do BAR="${BAR}█"; done
            for i in $(seq 1 $EMPTY); do BAR="${BAR}░"; done
            
            clear
            echo "========================================"
            echo "🐉 小龙交易系统 V5.3 - 样本积累监控"
            echo "========================================"
            echo ""
            echo "目标样本: $TARGET 笔"
            echo "当前样本: $TRADES 笔"
            echo "完成进度: $PROGRESS%"
            echo ""
            echo "进度: [$BAR]"
            echo ""
            echo "最后更新: $TIMESTAMP"
            echo ""
            
            # 检查是否达到目标
            if [ "$TRADES" -ge "$TARGET" ]; then
                echo "🎉 恭喜！已达到目标 $TARGET 笔样本！"
                echo "========================================"
                # 发送通知 (如果配置了 Telegram)
                exit 0
            fi
            
            # 预估剩余时间
            if [ "$TRADES" -gt 0 ]; then
                # 假设每 10-15 秒一笔交易
                REMAINING=$((TARGET - TRADES))
                SECONDS_LOW=$((REMAINING * 10))
                SECONDS_HIGH=$((REMAINING * 15))
                echo "预计还需: $SECONDS_LOW - $SECONDS_HIGH 秒"
            fi
            
            echo ""
            echo "按 Ctrl+C 停止监控"
            echo "========================================"
        fi
    fi
    
    sleep 5
done