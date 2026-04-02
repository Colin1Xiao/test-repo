#!/bin/bash
# 运维记忆库
# 存储 OpenClaw 运维经验、故障原因、修复方案

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MEMORY_DIR="$SCRIPT_DIR/ops_memory"

mkdir -p "$MEMORY_DIR"

# 记录类型
# - incidents/     故障记录
# - repairs/       修复动作
# - learnings/     经验教训
# - baselines/     基线配置
# - known_issues/  已知问题（可忽略）

# 添加记录
add_record() {
    local type="$1"
    local title="$2"
    local content="$3"
    
    local dir="$MEMORY_DIR/$type"
    mkdir -p "$dir"
    
    local file="$dir/$(date +%Y%m%d_%H%M%S)_$(echo "$title" | tr ' ' '_' | tr -cd 'a-zA-Z0-9_').md"
    
    cat > "$file" << EOF
# $title

**时间**: $(date '+%Y-%m-%d %H:%M:%S')
**类型**: $type

---

$content

---

**标签**: 
EOF
    
    echo "✅ 已记录: $file"
}

# 搜索记忆
search_memory() {
    local query="$1"
    
    echo "🔍 搜索: $query"
    echo "=============================="
    echo ""
    
    grep -r -l "$query" "$MEMORY_DIR" 2>/dev/null | while read -r file; do
        echo "📄 $file"
        echo "---"
        grep -A 5 -B 2 "$query" "$file" 2>/dev/null | head -20
        echo ""
    done
}

# 列出记录
list_records() {
    local type="${1:-all}"
    
    if [[ "$type" == "all" ]]; then
        find "$MEMORY_DIR" -name "*.md" -type f | sort -r
    else
        find "$MEMORY_DIR/$type" -name "*.md" -type f 2>/dev/null | sort -r
    fi
}

# 初始化示例数据
init_examples() {
    # 已知可忽略的问题
    mkdir -p "$MEMORY_DIR/known_issues"
    
    cat > "$MEMORY_DIR/known_issues/operator_read_false_positive.md" << 'EOF'
# operator.read 权限误报

**时间**: 2026-03-17
**类型**: known_issues

---

## 现象
doctor 检查时报告 `operator.read` 权限问题

## 原因
某些情况下，权限检查可能产生误报，实际不影响功能

## 解决方案
如果确认功能正常，可以忽略此警告

## 验证方法
```bash
openclaw doctor --verbose
```

如果其他检查都通过，此警告可安全忽略

---

**标签**: permissions, false-positive, doctor
EOF

    cat > "$MEMORY_DIR/known_issues/probe_failed_ignore.md" << 'EOF'
# probe_failed 可忽略的情况

**时间**: 2026-03-17
**类型**: known_issues

---

## 现象
健康检查显示 `probe_failed`

## 可忽略的场景
1. 网络临时波动
2. Telegram API 限流
3. 代理连接不稳定

## 何时需要关注
- 连续多次失败
- 影响实际功能（消息发不出去）

## 验证
```bash
curl -s https://api.telegram.org
```

---

**标签**: telegram, probe, network
EOF

    # 修复记录
    mkdir -p "$MEMORY_DIR/repairs"
    
    cat > "$MEMORY_DIR/repairs/gateway_restart_procedure.md" << 'EOF'
# Gateway 重启标准流程

**时间**: 2026-03-17
**类型**: repairs

---

## 场景
Gateway 无响应或状态异常

## 步骤

1. 检查状态
```bash
openclaw gateway status
```

2. 尝试优雅重启
```bash
openclaw gateway restart
```

3. 等待 3-5 秒后验证
```bash
sleep 5 && openclaw gateway status
```

4. 如果失败，强制重启
```bash
openclaw gateway stop
sleep 2
openclaw gateway start
```

5. 最终检查
```bash
openclaw health check
```

## 成功率
通常 95%+ 的 Gateway 问题可通过重启解决

---

**标签**: gateway, restart, troubleshooting
EOF

    # 故障记录模板
    mkdir -p "$MEMORY_DIR/incidents"
    
    cat > "$MEMORY_DIR/incidents/template.md" << 'EOF'
# 故障记录模板

**时间**: YYYY-MM-DD HH:MM
**类型**: incidents
**严重程度**: critical/warning/info

---

## 现象
描述观察到的异常行为

## 影响
- 影响范围
- 影响用户数
- 持续时间

## 根因
分析问题根本原因

## 解决方案
1. 步骤一
2. 步骤二

## 预防措施
如何避免类似问题

## 相关日志
```
粘贴关键日志
```

---

**标签**: incident, [相关组件]
EOF

    echo "✅ 已初始化示例数据"
}

# 生成记忆统计
stats() {
    echo "📊 运维记忆库统计"
    echo "=============================="
    echo ""
    
    for dir in incidents repairs learnings baselines known_issues; do
        count=$(find "$MEMORY_DIR/$dir" -name "*.md" 2>/dev/null | wc -l)
        printf "%-15s %d 条记录\n" "$dir:" "$count"
    done
    
    echo ""
    echo "总计: $(find "$MEMORY_DIR" -name "*.md" 2>/dev/null | wc -l) 条记录"
}

# 主入口
case "${1:-}" in
    add)
        add_record "$2" "$3" "$4"
        ;;
    search)
        search_memory "$2"
        ;;
    list)
        list_records "$2"
        ;;
    init)
        init_examples
        ;;
    stats)
        stats
        ;;
    *)
        echo "运维记忆库"
        echo ""
        echo "用法:"
        echo "  $0 add <类型> <标题> <内容>  - 添加记录"
        echo "  $0 search <关键词>           - 搜索记忆"
        echo "  $0 list [类型]               - 列出记录"
        echo "  $0 init                      - 初始化示例"
        echo "  $0 stats                     - 查看统计"
        echo ""
        echo "类型:"
        echo "  incidents    - 故障记录"
        echo "  repairs      - 修复动作"
        echo "  learnings    - 经验教训"
        echo "  baselines    - 基线配置"
        echo "  known_issues - 已知问题"
        ;;
esac