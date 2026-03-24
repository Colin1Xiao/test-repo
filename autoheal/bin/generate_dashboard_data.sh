#!/bin/bash
# 生成 Dashboard 所需数据

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOHEAL_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$AUTOHEAL_DIR/data"
EVENTS_PROCESSED="$AUTOHEAL_DIR/events/processed"
DASHBOARD_DATA="$AUTOHEAL_DIR/dashboard/data"

mkdir -p "$DATA_DIR" "$DASHBOARD_DATA"

echo "📊 生成 Dashboard 数据..."

# 1. 生成事件时间线数据
echo "1. 生成事件时间线..."

python3 - "$EVENTS_PROCESSED" "$DASHBOARD_DATA" << 'EOF'
import json, sys, glob, os

processed_dir = sys.argv[1]
output_dir = sys.argv[2]

events = []
for f in glob.glob(os.path.join(processed_dir, "*.json")):
    try:
        with open(f) as fp:
            events.append(json.load(fp))
    except:
        pass

events.sort(key=lambda x: x.get('ts', ''), reverse=True)

output_file = os.path.join(output_dir, "events_timeline.json")
with open(output_file, 'w') as f:
    json.dump(events[:20], f, indent=2, ensure_ascii=False)

print(f"  已生成 {len(events[:20])} 条事件")
EOF

# 2. 复制健康数据
echo "2. 生成健康数据摘要..."

TODAY=$(date +%Y-%m-%d)
HEALTH_FILE="$DATA_DIR/health_$TODAY.json"

if [[ -f "$HEALTH_FILE" ]]; then
    cp "$HEALTH_FILE" "$DASHBOARD_DATA/health_latest.json"
    echo "  已复制 health_latest.json"
else
    echo '{"timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "date": "'$TODAY'", "exit_code": 0, "critical_count": 0, "warning_count": 0}' > "$DASHBOARD_DATA/health_latest.json"
    echo "  已创建默认健康数据"
fi

# 3. 生成 Judge 统计摘要
echo "3. 生成 Judge 统计摘要..."

JUDGE_STATS_DIR="$AUTOHEAL_DIR/data/judge_stats"
JUDGE_SUMMARY="$DASHBOARD_DATA/judge_summary.json"

python3 - "$JUDGE_STATS_DIR" "$JUDGE_SUMMARY" << 'PYEOF'
import json, sys, os

stats_dir = sys.argv[1]
output_file = sys.argv[2]

stats = {"total": 0, "auto_repair": 0, "manual_review": 0, "alert_only": 0, "avg_confidence": 0.85}

if os.path.exists(stats_dir):
    total = 0
    auto_repair = 0
    manual_review = 0
    confidence_sum = 0.0
    
    for f in os.listdir(stats_dir):
        if f.endswith('.jsonl'):
            try:
                with open(os.path.join(stats_dir, f)) as fp:
                    for line in fp:
                        try:
                            r = json.loads(line)
                            total += 1
                            if r.get('decision') == 'auto_repair':
                                auto_repair += 1
                            elif r.get('decision') == 'manual_review':
                                manual_review += 1
                            confidence_sum += float(r.get('confidence', 0.85))
                        except:
                            pass
            except:
                pass
    
    if total > 0:
        stats['total'] = total
        stats['auto_repair'] = auto_repair
        stats['manual_review'] = manual_review
        stats['avg_confidence'] = round(confidence_sum / total, 2)

with open(output_file, 'w') as f:
    json.dump(stats, f, indent=2)

print(f"  Judge 统计: {stats}")
PYEOF

# 4. 生成趋势数据
echo "4. 生成趋势数据..."

TRENDS_FILE="$DASHBOARD_DATA/trends.json"

python3 - "$DATA_DIR" "$TRENDS_FILE" << 'EOF'
import json, sys, os
from datetime import datetime, timedelta

data_dir = sys.argv[1]
output_file = sys.argv[2]

days = []
for i in range(7):
    date = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
    health_file = os.path.join(data_dir, f"health_{date}.json")
    
    warning, critical = 0, 0
    if os.path.exists(health_file):
        try:
            with open(health_file) as f:
                d = json.load(f)
                warning = d.get('warning_count', 0)
                critical = d.get('critical_count', 0)
        except:
            pass
    
    days.append({"date": date, "warning": warning, "critical": critical})

days.reverse()

with open(output_file, 'w') as f:
    json.dump({"updated": datetime.now().isoformat(), "days": days}, f, indent=2)

print(f"  已生成 7 天趋势数据")
EOF

echo ""
echo "✅ Dashboard 数据生成完成"
ls -la "$DASHBOARD_DATA/"