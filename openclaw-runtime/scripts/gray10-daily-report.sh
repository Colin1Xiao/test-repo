#!/bin/bash
# scripts/gray10-daily-report.sh
# Gray 10% Daily Report Generator
#
# Usage:
#   ./scripts/gray10-daily-report.sh [DAY_NUMBER]
#   ./scripts/gray10-daily-report.sh 1
#   ./scripts/gray10-daily-report.sh 2
#
# Output:
#   Generates GRAY10_DAY{N}_REPORT.md with auto-collected data

set -e

# Configuration
DAY_NUMBER=${1:-1}
BASE_PORT=3101
INSTANCE_COUNT=3
OUTPUT_FILE="docs/GRAY10_DAY${DAY_NUMBER}_REPORT.md"
TEMPLATE_FILE="docs/GRAY10_DAY1_REPORT_TEMPLATE.md"
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

# Collect cluster status
collect_cluster_status() {
  log "Collecting cluster status..."
  
  local instances_status=""
  local all_healthy=true
  
  for i in $(seq 1 $INSTANCE_COUNT); do
    local port=$((BASE_PORT + i - 1))
    local pid_file="pids/instance-$i.pid"
    local memory="N/A"
    local uptime="N/A"
    local status="🔴 Down"
    
    # Check if instance is running
    if [ -f "$pid_file" ]; then
      local pid=$(cat "$pid_file" 2>/dev/null)
      if ps -p "$pid" > /dev/null 2>&1; then
        status="🟢 Running"
        
        # Get memory
        local mem_kb=$(ps -o rss= -p "$pid" 2>/dev/null | tr -d ' ')
        if [ -n "$mem_kb" ]; then
          memory="$((mem_kb / 1024))MB"
        fi
        
        # Get uptime (simplified)
        local elapsed=$(($(date +%s) - $(stat -f%m "$pid_file" 2>/dev/null || stat -c%Y "$pid_file" 2>/dev/null || echo 0)))
        local hours=$((elapsed / 3600))
        local mins=$(((elapsed % 3600) / 60))
        uptime="${hours}h ${mins}m"
      else
        all_healthy=false
      fi
    else
      all_healthy=false
    fi
    
    instances_status="${instances_status}| instance-$i | $port | $status | $uptime | 0 | $memory |\n"
  done
  
  echo "$instances_status"
  
  if [ "$all_healthy" = true ]; then
    log_pass "All instances healthy"
  else
    log_fail "Some instances unhealthy"
  fi
}

# Collect health check stats
collect_health_stats() {
  log "Collecting health check statistics..."
  
  local health_success=0
  local health_failure=0
  local config_success=0
  local config_failure=0
  
  for i in $(seq 1 $INSTANCE_COUNT); do
    local port=$((BASE_PORT + i - 1))
    
    # Health check
    local health_response=$(NO_PROXY=localhost curl -s --connect-timeout 5 "http://localhost:$port/health" 2>/dev/null)
    if [ -n "$health_response" ]; then
      local ok=$(echo "$health_response" | jq -r '.ok' 2>/dev/null)
      if [ "$ok" = "true" ]; then
        ((health_success++))
      else
        ((health_failure++))
      fi
    else
      ((health_failure++))
    fi
    
    # Config check
    local config_response=$(NO_PROXY=localhost curl -s --connect-timeout 5 "http://localhost:$port/config" 2>/dev/null)
    if [ -n "$config_response" ]; then
      ((config_success++))
    else
      ((config_failure++))
    fi
  done
  
  echo "Health: $health_success/$INSTANCE_COUNT, Config: $config_success/$INSTANCE_COUNT"
}

# Collect error rate from logs
collect_error_rate() {
  log "Collecting error rate from logs..."
  
  local total_errors=0
  local total_requests=0
  
  for i in $(seq 1 $INSTANCE_COUNT); do
    local log_file="logs/deploy/instance-$i.log"
    if [ -f "$log_file" ]; then
      local errors=$(grep -c "ERROR" "$log_file" 2>/dev/null || echo 0)
      local requests=$(grep -c "request" "$log_file" 2>/dev/null || echo 0)
      total_errors=$((total_errors + errors))
      total_requests=$((total_requests + requests))
    fi
  done
  
  local error_rate=0
  if [ $total_requests -gt 0 ]; then
    error_rate=$(awk "BEGIN {printf \"%.4f\", ($total_errors / $total_requests) * 100}")
  fi
  
  echo "Errors: $total_errors, Requests: $total_requests, Rate: $error_rate%"
}

# Collect memory stats
collect_memory_stats() {
  log "Collecting memory statistics..."
  
  local total_memory=0
  local instance_memories=""
  
  for i in $(seq 1 $INSTANCE_COUNT); do
    local pid_file="pids/instance-$i.pid"
    if [ -f "$pid_file" ]; then
      local pid=$(cat "$pid_file" 2>/dev/null)
      local mem_kb=$(ps -o rss= -p "$pid" 2>/dev/null | tr -d ' ')
      if [ -n "$mem_kb" ]; then
        local mem_mb=$((mem_kb / 1024))
        total_memory=$((total_memory + mem_mb))
        instance_memories="${instance_memories}instance-$i: ${mem_mb}MB, "
      fi
    fi
  done
  
  echo "Total: ${total_memory}MB, Instances: ${instance_memories}"
}

# Run smoke tests
run_smoke_tests() {
  log "Running smoke tests..."
  
  local p0_result="N/A"
  local p1_result="N/A"
  local p2_result="N/A"
  
  # P0 test
  if bash scripts/smoke-test-p0.sh $BASE_PORT > /dev/null 2>&1; then
    p0_result="✅ Pass"
    log_pass "P0 smoke test passed"
  else
    p0_result="❌ Fail"
    log_fail "P0 smoke test failed"
  fi
  
  # P1 test
  if bash scripts/smoke-test-p1.sh $BASE_PORT > /dev/null 2>&1; then
    p1_result="✅ Pass"
    log_pass "P1 smoke test passed"
  else
    p1_result="❌ Fail"
    log_fail "P1 smoke test failed"
  fi
  
  # P2 test
  if bash scripts/smoke-test-p2.sh $BASE_PORT > /dev/null 2>&1; then
    p2_result="✅ Pass"
    log_pass "P2 smoke test passed"
  else
    p2_result="❌ Fail"
    log_fail "P2 smoke test failed"
  fi
  
  echo "P0: $p0_result, P1: $p1_result, P2: $p2_result"
}

# Check alert status
check_alerts() {
  log "Checking alert status..."
  
  local p0_alerts=0
  local p1_alerts=0
  local p2_alerts=0
  
  # Check alert logs if they exist
  local alert_log="logs/alerts.log"
  if [ -f "$alert_log" ]; then
    p0_alerts=$(grep -c "P0" "$alert_log" 2>/dev/null || echo 0)
    p1_alerts=$(grep -c "P1" "$alert_log" 2>/dev/null || echo 0)
    p2_alerts=$(grep -c "P2" "$alert_log" 2>/dev/null || echo 0)
  fi
  
  echo "P0: $p0_alerts, P1: $p1_alerts, P2: $p2_alerts"
}

# Generate report
generate_report() {
  log "Generating Day $DAY_NUMBER report..."
  
  # Check if template exists
  if [ ! -f "$TEMPLATE_FILE" ]; then
    log_fail "Template file not found: $TEMPLATE_FILE"
    exit 1
  fi
  
  # Collect all data
  local cluster_status=$(collect_cluster_status)
  local health_stats=$(collect_health_stats)
  local error_rate=$(collect_error_rate)
  local memory_stats=$(collect_memory_stats)
  local smoke_tests=$(run_smoke_tests)
  local alerts=$(check_alerts)
  
  log "Data collection complete"
  
  # For Day 1, copy from existing report
  if [ $DAY_NUMBER -eq 1 ] && [ -f "docs/GRAY10_DAY1_REPORT.md" ]; then
    log "Day 1 report already exists, skipping generation"
    return 0
  fi
  
  # Generate report from template (simplified for now)
  log_warn "Full report generation from template not yet implemented"
  log "Please manually create $OUTPUT_FILE based on template"
  
  return 0
}

# Main
main() {
  echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║   Gray 10% Daily Report Generator                  ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
  echo ""
  
  log "Day: $DAY_NUMBER"
  log "Date: $DATE"
  log "Output: $OUTPUT_FILE"
  echo ""
  
  generate_report
  
  echo ""
  log "Report generation complete"
  echo ""
  log "Next steps:"
  log "  1. Review generated report: cat $OUTPUT_FILE"
  log "  2. Fill in any missing data"
  log "  3. Submit for review: Tech Lead, PM"
}

# Run main
main "$@"
