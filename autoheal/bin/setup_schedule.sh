#!/bin/bash
# OpenClaw vNext 定时任务配置
# 支持 macOS launchd 和通用 cron

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOHEAL_DIR="$(dirname "$SCRIPT_DIR")"
BIN_DIR="$AUTOHEAL_DIR/bin"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  OpenClaw vNext 定时任务配置${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
echo ""

# 检测系统
detect_system() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "launchd"
    else
        echo "cron"
    fi
}

SYSTEM=$(detect_system)
echo "检测到系统: $SYSTEM"
echo ""

# ============================================================
# Launchd 配置 (macOS)
# ============================================================

create_launchd_plists() {
    local launchagents="$HOME/Library/LaunchAgents"
    mkdir -p "$launchagents"
    
    # 1. 每日健康检查 (04:00)
    cat > "$launchagents/com.openclaw.autoheal.daily.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openclaw.autoheal.daily</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>cd ~/.openclaw/workspace/autoheal && ./bin/emit_event.sh health.check.started && ./autoheal.sh && ./bin/process_event.sh all && ./bin/run_policy.sh validate</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>4</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/openclaw/autoheal_daily.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/openclaw/autoheal_daily.err</string>
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
EOF
    
    # 2. 每日简报 (04:05)
    cat > "$launchagents/com.openclaw.autoheal.digest.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openclaw.autoheal.digest</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>cd ~/.openclaw/workspace/autoheal && ./autoheal.sh --digest && ./bin/generate_dashboard_data.sh</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>4</integer>
        <key>Minute</key>
        <integer>5</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/openclaw/autoheal_digest.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/openclaw/autoheal_digest.err</string>
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
EOF
    
    # 3. 每周报告 (周日 09:00)
    cat > "$launchagents/com.openclaw.autoheal.weekly.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openclaw.autoheal.weekly</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>cd ~/.openclaw/workspace/autoheal && ./reporter.sh --generate && ./bin/judge_stats.sh report && ./bin/archive_events.sh</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Weekday</key>
        <integer>0</integer>
        <key>Hour</key>
        <integer>9</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/openclaw/autoheal_weekly.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/openclaw/autoheal_weekly.err</string>
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
EOF
    
    # 4. 每4小时健康检查
    cat > "$launchagents/com.openclaw.autoheal.hourly.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openclaw.autoheal.hourly</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>cd ~/.openclaw/workspace/autoheal && ./autoheal.sh && ./bin/process_event.sh all</string>
    </array>
    <key>StartInterval</key>
    <integer>14400</integer>
    <key>StandardOutPath</key>
    <string>/tmp/openclaw/autoheal_hourly.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/openclaw/autoheal_hourly.err</string>
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
EOF
    
    echo -e "${GREEN}✅ Launchd plist 文件已创建${NC}"
    ls -la "$launchagents"/com.openclaw.autoheal*.plist 2>/dev/null
}

# 加载 launchd 任务
load_launchd() {
    local launchagents="$HOME/Library/LaunchAgents"
    
    echo ""
    echo "加载 Launchd 任务..."
    
    for plist in "$launchagents"/com.openclaw.autoheal*.plist; do
        if [[ -f "$plist" ]]; then
            local label=$(basename "$plist" .plist)
            
            # 先卸载（如果已加载）
            launchctl bootout gui/$UID/$label 2>/dev/null || true
            
            # 加载
            launchctl bootstrap gui/$UID "$plist"
            
            if [[ $? -eq 0 ]]; then
                echo -e "  ${GREEN}✅${NC} $label 已加载"
            else
                echo -e "  ${RED}❌${NC} $label 加载失败"
            fi
        fi
    done
}

# ============================================================
# Cron 配置 (Linux/其他)
# ============================================================

setup_cron() {
    local cron_file="/tmp/openclaw_cron_$$"
    
    # 保存现有 crontab
    crontab -l > "$cron_file" 2>/dev/null || true
    
    # 移除旧的 OpenClaw 任务
    grep -v "openclaw.*autoheal" "$cron_file" > "${cron_file}.new" 2>/dev/null || true
    mv "${cron_file}.new" "$cron_file"
    
    # 添加新任务
    echo "" >> "$cron_file"
    echo "# OpenClaw vNext 定时任务" >> "$cron_file"
    
    # 每4小时健康检查
    echo "0 */4 * * * cd $AUTOHEAL_DIR && ./autoheal.sh && ./bin/process_event.sh all >> $AUTOHEAL_DIR/logs/cron.log 2>&1" >> "$cron_file"
    
    # 每日 04:00 健康检查 + 事件处理
    echo "0 4 * * * cd $AUTOHEAL_DIR && ./bin/emit_event.sh health.check.started && ./autoheal.sh && ./bin/process_event.sh all >> $AUTOHEAL_DIR/logs/cron.log 2>&1" >> "$cron_file"
    
    # 每日 04:05 日报 + Telegram + Dashboard 刷新
    echo "5 4 * * * cd $AUTOHEAL_DIR && ./autoheal.sh --digest && ./bin/generate_dashboard_data.sh >> $AUTOHEAL_DIR/logs/cron.log 2>&1" >> "$cron_file"
    
    # 每周日 09:00 周报 + Judge 统计 + 事件归档
    echo "0 9 * * 0 cd $AUTOHEAL_DIR && ./reporter.sh --generate && ./bin/judge_stats.sh report && ./bin/archive_events.sh >> $AUTOHEAL_DIR/logs/cron.log 2>&1" >> "$cron_file"
    
    # 安装 crontab
    crontab "$cron_file"
    rm "$cron_file"
    
    echo -e "${GREEN}✅ Cron 任务已配置${NC}"
    echo ""
    echo "当前任务:"
    crontab -l | grep -E "(openclaw|autoheal)" || echo "无"
}

# ============================================================
# Dashboard 数据生成脚本
# ============================================================

create_dashboard_generator() {
    cat > "$BIN_DIR/generate_dashboard_data.sh" << 'DASHBOARD'
#!/bin/bash
# 生成 Dashboard 所需数据

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOHEAL_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$AUTOHEAL_DIR/data"
EVENTS_PROCESSED="$AUTOHEAL_DIR/events/processed"

mkdir -p "$DATA_DIR"

# 生成事件时间线数据
echo "生成事件时间线..."
python3 << EOF
import json
import os
import glob

events = []
processed_dir = "$EVENTS_PROCESSED"

for f in glob.glob(f"{processed_dir}/*.json"):
    try:
        with open(f) as fp:
            event = json.load(fp)
            events.append(event)
    except:
        pass

# 按时间排序
events.sort(key=lambda x: x.get('ts', ''), reverse=True)

# 保存最近 20 条
with open(f"{processed_dir}/../dashboard/data/events_timeline.json", 'w') as f:
    json.dump(events[:20], f, indent=2)

print(f"已生成 {len(events[:20])} 条事件")
EOF

# 生成健康数据摘要
echo "生成健康数据摘要..."
if [[ -f "$DATA_DIR/health_$(date +%Y-%m-%d).json" ]]; then
    cp "$DATA_DIR/health_$(date +%Y-%m-%d).json" "$AUTOHEAL_DIR/dashboard/data/health_latest.json"
fi

# 生成 Judge 统计摘要
echo "生成 Judge 统计摘要..."
"$BIN_DIR/judge_stats.sh" analyze 7 > "$DATA_DIR/judge_summary_raw.txt" 2>/dev/null || true

python3 << 'PYEOF'
import json
import os

stats_file = "$AUTOHEAL_DIR/data/judge_summary.json"

# 读取或创建默认统计
stats = {
    "total": 0,
    "auto_repair": 0,
    "manual_review": 0,
    "alert_only": 0,
    "avg_confidence": 0.85,
    "low_confidence_count": 0
}

# 尝试从实际数据计算
judge_stats_dir = "$AUTOHEAL_DIR/data/judge_stats"
if os.path.exists(judge_stats_dir):
    total = 0
    auto_repair = 0
    manual_review = 0
    confidence_sum = 0
    
    for f in os.listdir(judge_stats_dir):
        if f.endswith('.jsonl'):
            with open(os.path.join(judge_stats_dir, f)) as fp:
                for line in fp:
                    try:
                        record = json.loads(line)
                        total += 1
                        if record.get('decision') == 'auto_repair':
                            auto_repair += 1
                        elif record.get('decision') == 'manual_review':
                            manual_review += 1
                        confidence_sum += record.get('confidence', 0)
                    except:
                        pass
    
    if total > 0:
        stats['total'] = total
        stats['auto_repair'] = auto_repair
        stats['manual_review'] = manual_review
        stats['avg_confidence'] = round(confidence_sum / total, 2)

with open(stats_file, 'w') as f:
    json.dump(stats, f, indent=2)

print(f"Judge 统计已生成: {stats}")
PYEOF

echo "✅ Dashboard 数据生成完成"
DASHBOARD
    
    chmod +x "$BIN_DIR/generate_dashboard_data.sh"
    echo -e "${GREEN}✅ Dashboard 数据生成脚本已创建${NC}"
}

# 创建事件归档脚本
create_archive_script() {
    cat > "$BIN_DIR/archive_events.sh" << 'ARCHIVE'
#!/bin/bash
# 事件归档脚本

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOHEAL_DIR="$(dirname "$SCRIPT_DIR")"
EVENTS_PROCESSED="$AUTOHEAL_DIR/events/processed"
EVENTS_ARCHIVE="$AUTOHEAL_DIR/events/archive"

mkdir -p "$EVENTS_ARCHIVE"

# 归档 7 天前的事件
echo "归档事件..."

find "$EVENTS_PROCESSED" -name "*.json" -mtime +7 -exec mv {} "$EVENTS_ARCHIVE/" \; 2>/dev/null

# 删除 30 天前的归档
find "$EVENTS_ARCHIVE" -name "*.json" -mtime +30 -delete 2>/dev/null

local archived=$(ls "$EVENTS_ARCHIVE"/*.json 2>/dev/null | wc -l)
echo "归档目录: $archived 个事件"
ARCHIVE
    
    chmod +x "$BIN_DIR/archive_events.sh"
    echo -e "${GREEN}✅ 事件归档脚本已创建${NC}"
}

# ============================================================
# 主流程
# ============================================================

echo "配置步骤:"
echo "  1. 创建脚本"
echo "  2. 配置定时任务"
echo "  3. 启动任务"
echo ""

# 1. 创建辅助脚本
echo -e "${YELLOW}[步骤 1]${NC} 创建辅助脚本..."
create_dashboard_generator
create_archive_script

# 2. 配置定时任务
echo ""
echo -e "${YELLOW}[步骤 2]${NC} 配置定时任务..."

if [[ "$SYSTEM" == "launchd" ]]; then
    create_launchd_plists
else
    setup_cron
fi

# 3. 启动任务
echo ""
echo -e "${YELLOW}[步骤 3]${NC} 启动任务..."

read -p "是否立即启动定时任务? (y/N): " confirm
if [[ "$confirm" == "y" || "$confirm" == "Y" ]]; then
    if [[ "$SYSTEM" == "launchd" ]]; then
        load_launchd
    fi
    echo -e "${GREEN}✅ 定时任务已启动${NC}"
else
    echo "跳过启动。稍后可手动执行:"
    if [[ "$SYSTEM" == "launchd" ]]; then
        echo "  launchctl bootstrap gui/\$UID ~/Library/LaunchAgents/com.openclaw.autoheal.*.plist"
    fi
fi

# 4. 验证
echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  配置完成${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
echo ""
echo "定时任务列表:"
echo "  • 每4小时: 健康检查 + 事件处理"
echo "  • 每日 04:00: 完整检查 + 状态刷新"
echo "  • 每日 04:05: 日报 + Telegram + Dashboard"
echo "  • 每周日 09:00: 周报 + Judge 统计 + 事件归档"
echo ""
echo "验证方法:"
echo "  ./manage.sh check                 # 手动测试健康检查"
echo "  ./bin/generate_dashboard_data.sh  # 手动测试 Dashboard 数据"
echo "  ./bin/judge_stats.sh analyze 7    # 查看 Judge 统计"
echo ""
echo "日志位置:"
echo "  /tmp/openclaw/autoheal_*.log"
echo "  $AUTOHEAL_DIR/logs/"