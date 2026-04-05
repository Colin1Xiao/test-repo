#!/bin/bash
# scripts/collect-gate2-evidence.sh
# Gate 2 Evidence Collection Script
#
# Usage:
#   ./scripts/collect-gate2-evidence.sh
#   ./scripts/collect-gate2-evidence.sh --output-dir ./evidence/gate2
#
# Output:
#   Generates evidence package for Gate 2 decision

set -e

# Configuration
OUTPUT_DIR=${1:-"./evidence/gate2-$(date +%Y%m%d)"}
BASE_PORT=3101
INSTANCE_COUNT=3
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
DATE=$(date '+%Y-%m-%d')

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
  echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

log_pass() {
  echo -e "${GREEN}✓${NC} $1"
}

log_fail() {
  echo -e "${RED}✗${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

# Create output directory
setup_output_dir() {
  mkdir -p "$OUTPUT_DIR"
  mkdir -p "$OUTPUT_DIR/cluster"
  mkdir -p "$OUTPUT_DIR/metrics"
  mkdir -p "$OUTPUT_DIR/tests"
  mkdir -p "$OUTPUT_DIR/logs"
  mkdir -p "$OUTPUT_DIR/reports"
  log "Output directory: $OUTPUT_DIR"
}

# Collect cluster evidence
collect_cluster_evidence() {
  log "Collecting cluster evidence..."
  
  local output_file="$OUTPUT_DIR/cluster/status.json"
  
  # Simple status collection
  echo "{" > "$output_file"
  echo "  \"timestamp\": \"$TIMESTAMP\"," >> "$output_file"
  echo "  \"date\": \"$DATE\"," >> "$output_file"
  echo "  \"instances\": [" >> "$output_file"
  
  local first=true
  for i in $(seq 1 $INSTANCE_COUNT); do
    local port=$((BASE_PORT + i - 1))
    local pid_file="pids/instance-$i.pid"
    
    if [ "$first" = true ]; then
      first=false
    else
      echo "," >> "$output_file"
    fi
    
    echo "    {" >> "$output_file"
    echo "      \"id\": \"instance-$i\"," >> "$output_file"
    echo "      \"port\": $port," >> "$output_file"
    
    # Check if running
    if [ -f "$pid_file" ]; then
      local pid=$(cat "$pid_file" 2>/dev/null)
      if ps -p "$pid" > /dev/null 2>&1; then
        echo "      \"status\": \"running\"," >> "$output_file"
        echo "      \"pid\": $pid," >> "$output_file"
        
        # Memory
        local mem_kb=$(ps -o rss= -p "$pid" 2>/dev/null | tr -d ' ')
        local mem_mb=$((mem_kb / 1024))
        echo "      \"memory_mb\": $mem_mb," >> "$output_file"
        
        # Uptime
        local elapsed=$(($(date +%s) - $(stat -f%m "$pid_file" 2>/dev/null || stat -c%Y "$pid_file" 2>/dev/null || echo 0)))
        echo "      \"uptime_seconds\": $elapsed" >> "$output_file"
      else
        echo "      \"status\": \"stopped\"," >> "$output_file"
        echo "      \"pid\": null," >> "$output_file"
        echo "      \"memory_mb\": 0," >> "$output_file"
        echo "      \"uptime_seconds\": 0" >> "$output_file"
      fi
    else
      echo "      \"status\": \"unknown\"," >> "$output_file"
      echo "      \"pid\": null," >> "$output_file"
      echo "      \"memory_mb\": 0," >> "$output_file"
      echo "      \"uptime_seconds\": 0" >> "$output_file"
    fi
    
    echo "    }" >> "$output_file"
  done
  
  echo "  ]" >> "$output_file"
  echo "}" >> "$output_file"
  
  log_pass "Cluster evidence collected: $output_file"
}

# Collect health check evidence
collect_health_evidence() {
  log "Collecting health check evidence..."
  
  local output_file="$OUTPUT_DIR/cluster/health-checks.json"
  
  echo "{" > "$output_file"
  echo "  \"timestamp\": \"$TIMESTAMP\"," >> "$output_file"
  echo "  \"checks\": [" >> "$output_file"
  
  local first=true
  for i in $(seq 1 $INSTANCE_COUNT); do
    local port=$((BASE_PORT + i - 1))
    
    if [ "$first" = true ]; then
      first=false
    else
      echo "," >> "$output_file"
    fi
    
    echo "    {" >> "$output_file"
    echo "      \"instance\": \"instance-$i\"," >> "$output_file"
    echo "      \"port\": $port," >> "$output_file"
    
    # Health check
    local health_response=$(NO_PROXY=localhost curl -s --connect-timeout 5 "http://localhost:$port/health" 2>/dev/null || echo '{}')
    local health_ok=$(echo "$health_response" | jq -r '.ok // false')
    
    echo "      \"health\": {" >> "$output_file"
    echo "        \"ok\": $health_ok," >> "$output_file"
    echo "        \"response\": $(echo "$health_response" | jq -c '.')" >> "$output_file"
    echo "      }" >> "$output_file"
    echo "    }" >> "$output_file"
  done
  
  echo "  ]" >> "$output_file"
  echo "}" >> "$output_file"
  
  log_pass "Health evidence collected: $output_file"
}

# Collect test evidence
collect_test_evidence() {
  log "Collecting test evidence..."
  
  local output_dir="$OUTPUT_DIR/tests"
  
  # Run P0 test
  log "Running P0 smoke test..."
  bash scripts/smoke-test-p0.sh $BASE_PORT > "$output_dir/p0-test.log" 2>&1 || true
  
  # Run P1 test
  log "Running P1 smoke test..."
  bash scripts/smoke-test-p1.sh $BASE_PORT > "$output_dir/p1-test.log" 2>&1 || true
  
  # Run P2 test
  log "Running P2 smoke test..."
  bash scripts/smoke-test-p2.sh $BASE_PORT > "$output_dir/p2-test.log" 2>&1 || true
  
  log_pass "Test evidence collected"
}

# Collect log evidence
collect_log_evidence() {
  log "Collecting log evidence..."
  
  local output_dir="$OUTPUT_DIR/logs"
  
  # Copy recent logs
  for i in $(seq 1 $INSTANCE_COUNT); do
    local log_file="logs/deploy/instance-$i.log"
    if [ -f "$log_file" ]; then
      # Last 1000 lines
      tail -n 1000 "$log_file" > "$output_dir/instance-$i-recent.log" 2>/dev/null || true
    fi
  done
  
  # Copy smoke test logs
  cp logs/smoke-test-*.log "$output_dir/" 2>/dev/null || true
  
  log_pass "Log evidence collected"
}

# Collect report evidence
collect_report_evidence() {
  log "Collecting report evidence..."
  
  local output_dir="$OUTPUT_DIR/reports"
  
  # Copy daily reports
  cp docs/GRAY10_DAY*.md "$output_dir/" 2>/dev/null || true
  
  # Copy decision templates
  cp docs/GATE2_*.md "$output_dir/" 2>/dev/null || true
  
  log_pass "Report evidence collected"
}

# Generate evidence summary
generate_summary() {
  log "Generating evidence summary..."
  
  local summary_file="$OUTPUT_DIR/SUMMARY.md"
  
  cat > "$summary_file" << EOF
# Gate 2 Evidence Summary

**收集时间**: $TIMESTAMP  
**收集日期**: $DATE  
**证据目录**: $OUTPUT_DIR

---

## 证据清单

| 类别 | 文件 | 说明 |
|------|------|------|
| 集群状态 | cluster/status.json | 实例状态、内存、运行时长 |
| 健康检查 | cluster/health-checks.json | /health 端点响应 |
| P0 测试 | tests/p0-test.log | 基础健康检查 |
| P1 测试 | tests/p1-test.log | API/服务验证 |
| P2 测试 | tests/p2-test.log | 高级测试 |
| 日志 | logs/ | 最近日志和测试日志 |
| 报告 | reports/ | 日报和决策模板 |

---

## 使用方式

提交 Gate 2 决策时，将此证据包作为附件：

\`\`\`bash
# 打包证据
tar -czf gate2-evidence-$DATE.tar.gz $OUTPUT_DIR

# 提交到决策材料
cp gate2-evidence-$DATE.tar.gz docs/evidence/
\`\`\`

---

_证据包生成时间: $TIMESTAMP_
EOF

  log_pass "Evidence summary generated: $summary_file"
}

# Main
main() {
  echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║   Gate 2 Evidence Collector                        ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
  echo ""
  
  log "Output: $OUTPUT_DIR"
  log "Date: $DATE"
  echo ""
  
  setup_output_dir
  collect_cluster_evidence
  collect_health_evidence
  collect_test_evidence
  collect_log_evidence
  collect_report_evidence
  generate_summary
  
  echo ""
  log_pass "Evidence collection complete!"
  echo ""
  log "Evidence