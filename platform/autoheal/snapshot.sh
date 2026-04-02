#!/bin/bash
# 一键快照 - Critical 时自动保存完整现场
# 用于事后排查和分析

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SNAPSHOT_DIR="$SCRIPT_DIR/snapshots"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"

mkdir -p "$SNAPSHOT_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SNAPSHOT_NAME="snapshot_$TIMESTAMP"
SNAPSHOT_PATH="$SNAPSHOT_DIR/$SNAPSHOT_NAME"

create_snapshot() {
    local reason="${1:-manual}"
    
    echo "📸 创建快照: $SNAPSHOT_NAME"
    echo "原因: $reason"
    echo "=============================="
    
    mkdir -p "$SNAPSHOT_PATH"
    
    # 1. 系统状态
    echo "📦 收集系统状态..."
    {
        echo "=== 系统快照 ==="
        echo "时间: $(date)"
        echo "原因: $reason"
        echo ""
        
        echo "=== Gateway 状态 ==="
        openclaw gateway status 2>&1 || echo "Gateway 命令失败"
        echo ""
        
        echo "=== OCNMPS 状态 ==="
        openclaw status 2>&1 || echo "OCNMPS 命令失败"
        echo ""
        
        echo "=== 进程列表 ==="
        ps aux | grep -E "(openclaw|node)" | grep -v grep || echo "无相关进程"
        echo ""
        
        echo "=== 网络连接 ==="
        lsof -i -P | grep -E "(LISTEN|ESTABLISHED)" | head -20 || echo "无网络连接"
        echo ""
        
        echo "=== 磁盘空间 ==="
        df -h / "$WORKSPACE_DIR" 2>/dev/null || df -h /
        echo ""
        
        echo "=== 内存使用 ==="
        vm_stat 2>/dev/null || free -h 2>/dev/null || echo "无法获取内存信息"
        echo ""
        
        echo "=== 最近日志 (OpenClaw) ==="
        tail -50 "$WORKSPACE_DIR/logs/openclaw.log" 2>/dev/null || echo "无日志文件"
        
    } > "$SNAPSHOT_PATH/system_status.txt"
    
    # 2. Doctor 输出
    echo "📦 收集 Doctor 输出..."
    openclaw doctor --verbose > "$SNAPSHOT_PATH/doctor.txt" 2>&1 || echo "Doctor 命令失败" > "$SNAPSHOT_PATH/doctor.txt"
    
    # 3. Health Check 输出
    echo "📦 收集 Health Check 输出..."
    openclaw health check > "$SNAPSHOT_PATH/health.txt" 2>&1 || echo "Health 命令失败" > "$SNAPSHOT_PATH/health.txt"
    
    # 4. 配置摘要
    echo "📦 收集配置摘要..."
    {
        echo "=== Gateway 配置 ==="
        cat ~/.openclaw/config/gateway.json 2>/dev/null | head -50 || echo "无配置文件"
        echo ""
        
        echo "=== 模型配置 ==="
        cat ~/.openclaw/config/models.json 2>/dev/null | head -50 || echo "无配置文件"
        echo ""
        
        echo "=== Auto-Heal 配置 ==="
        cat "$SCRIPT_DIR/config.json" 2>/dev/null || echo "无配置文件"
        
    } > "$SNAPSHOT_PATH/config_summary.txt"
    
    # 5. 最近健康数据
    echo "📦 收集健康数据..."
    local latest_health=$(ls -t "$SCRIPT_DIR/data"/health_*.json 2>/dev/null | head -1)
    if [[ -f "$latest_health" ]]; then
        cp "$latest_health" "$SNAPSHOT_PATH/health_data.json"
    fi
    
    # 6. 主日志最后 100 行
    echo "📦 收集主日志..."
    {
        echo "=== Gateway 日志 ==="
        tail -100 ~/.openclaw/logs/gateway.log 2>/dev/null || echo "无日志"
        echo ""
        
        echo "=== Auto-Heal 日志 ==="
        tail -50 "$SCRIPT_DIR/logs"/health_*.log 2>/dev/null | tail -100 || echo "无日志"
        
    } > "$SNAPSHOT_PATH/recent_logs.txt"
    
    # 7. 活跃会话
    echo "📦 收集会话信息..."
    openclaw sessions list 2>&1 > "$SNAPSHOT_PATH/sessions.txt" || echo "无会话" > "$SNAPSHOT_PATH/sessions.txt"
    
    # 8. 模型状态
    echo "📦 收集模型状态..."
    openclaw models 2>&1 > "$SNAPSHOT_PATH/models.txt" || echo "无模型" > "$SNAPSHOT_PATH/models.txt"
    
    # 9. 创建摘要
    cat > "$SNAPSHOT_PATH/SUMMARY.md" << EOF
# 快照摘要

**快照 ID**: $SNAPSHOT_NAME
**创建时间**: $(date)
**触发原因**: $reason

## 文件列表

| 文件 | 说明 |
|------|------|
| system_status.txt | 系统状态快照 |
| doctor.txt | Doctor 检查输出 |
| health.txt | Health Check 输出 |
| config_summary.txt | 配置摘要 |
| health_data.json | 最近健康数据 |
| recent_logs.txt | 最近日志 |
| sessions.txt | 活跃会话 |
| models.txt | 模型状态 |

## 快速诊断

\`\`\`
$(grep -E "(ERROR|WARN|FAIL|Critical|Warning)" "$SNAPSHOT_PATH"/*.txt 2>/dev/null | head -20 || echo "无错误")
\`\`\`

---
*由 Auto-Heal 自动生成*
EOF
    
    # 10. 打包
    echo "📦 打包快照..."
    cd "$SNAPSHOT_DIR"
    tar -czf "${SNAPSHOT_NAME}.tar.gz" "$SNAPSHOT_NAME" 2>/dev/null
    
    local size=$(du -h "${SNAPSHOT_NAME}.tar.gz" 2>/dev/null | cut -f1)
    
    echo ""
    echo "✅ 快照创建完成"
    echo "   位置: $SNAPSHOT_DIR/${SNAPSHOT_NAME}.tar.gz"
    echo "   大小: $size"
    echo ""
    
    # 清理旧快照（保留最近10个）
    ls -t "$SNAPSHOT_DIR"/snapshot_*.tar.gz 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null
    
    # 返回路径
    echo "$SNAPSHOT_DIR/${SNAPSHOT_NAME}.tar.gz"
}

# 列出快照
list_snapshots() {
    echo "📸 已保存的快照"
    echo "=============================="
    
    local count=0
    for f in $(ls -t "$SNAPSHOT_DIR"/snapshot_*.tar.gz 2>/dev/null); do
        count=$((count + 1))
        local name=$(basename "$f" .tar.gz)
        local size=$(du -h "$f" | cut -f1)
        local time=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$f" 2>/dev/null || stat -c "%y" "$f" 2>/dev/null | cut -d. -f1)
        
        echo "$count. $name ($size) - $time"
    done
    
    if [[ $count -eq 0 ]]; then
        echo "暂无快照"
    fi
    
    echo ""
    echo "总计: $count 个快照"
}

# 恢复快照（查看）
view_snapshot() {
    local name="$1"
    local archive="$SNAPSHOT_DIR/${name}.tar.gz"
    
    if [[ ! -f "$archive" ]]; then
        echo "❌ 快照不存在: $name"
        return 1
    fi
    
    echo "📸 查看快照: $name"
    echo "=============================="
    
    # 解压到临时目录
    local tmp_dir=$(mktemp -d)
    tar -xzf "$archive" -C "$tmp_dir"
    
    # 显示摘要
    cat "$tmp_dir/$name/SUMMARY.md"
    
    # 清理
    rm -rf "$tmp_dir"
}

# 主入口
case "${1:-}" in
    create)
        create_snapshot "${2:-manual}"
        ;;
    list)
        list_snapshots
        ;;
    view)
        view_snapshot "$2"
        ;;
    latest)
        local latest=$(ls -t "$SNAPSHOT_DIR"/snapshot_*.tar.gz 2>/dev/null | head -1)
        if [[ -n "$latest" ]]; then
            view_snapshot "$(basename "$latest" .tar.gz)"
        else
            echo "暂无快照"
        fi
        ;;
    *)
        echo "快照管理"
        echo ""
        echo "用法:"
        echo "  $0 create [原因]   - 创建快照"
        echo "  $0 list            - 列出快照"
        echo "  $0 view <名称>     - 查看快照"
        echo "  $0 latest          - 查看最新快照"
        ;;
esac