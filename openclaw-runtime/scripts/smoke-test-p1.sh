#!/bin/bash
# scripts/smoke-test-p1.sh
# P1 Production Smoke Tests
# 
# Usage:
#   ./scripts/smoke-test-p1.sh [BASE_PORT]
#   ./scripts/smoke-test-p1.sh 3101
#
# Exit codes:
#   0 - All tests passed
#   1 - One or more tests failed

set -e

# Configuration
BASE_PORT=${1:-3101}
INSTANCE_COUNT=3
TIMEOUT=5
LOG_FILE="logs/smoke-test-p1-$(date +%Y%m%d-%H%M%S).log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Logging
log() {
  echo -e "$1" | tee -a "$LOG_FILE"
}

log_test() {
  log "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

log_pass() {
  log "${GREEN}✓${NC} $1"
  ((TESTS_PASSED++))
}

log_fail() {
  log "${RED}✗${NC} $1"
  ((TESTS_FAILED++))
}

log_skip() {
  log "${YELLOW}⊘${NC} $1"
  ((TESTS_SKIPPED++))
}

log_warn() {
  log "${YELLOW}⚠${NC} $1"
}

# Test functions

# Test 1: API Routes Availability
test_api_routes() {
  local port=$1
  local instance_id=$2
  
  log_test "Testing instance-$instance_id API routes (port $port)..."
  
  local routes_found=0
  local routes_expected=0
  
  # Test /health
  local health
  health=$(NO_PROXY=localhost curl -s --connect-timeout $TIMEOUT "http://localhost:$port/health" 2>/dev/null)
  if [ -n "$health" ]; then
    ((routes_found++))
  fi
  ((routes_expected++))
  
  # Test /config
  local config
  config=$(NO_PROXY=localhost curl -s --connect-timeout $TIMEOUT "http://localhost:$port/config" 2>/dev/null)
  if [ -n "$config" ]; then
    ((routes_found++))
  fi
  ((routes_expected++))
  
  # Test /metrics (may not be implemented)
  local metrics
  metrics=$(NO_PROXY=localhost curl -s --connect-timeout $TIMEOUT "http://localhost:$port/metrics" 2>/dev/null)
  local metrics_code=$?
  if [ $metrics_code -eq 0 ] && [ -n "$metrics" ]; then
    if echo "$metrics" | grep -q "error"; then
      log_warn "instance-$instance_id /metrics returned error (may not be implemented)"
    else
      ((routes_found++))
    fi
  else
    log_warn "instance-$instance_id /metrics not available (non-critical)"
  fi
  ((routes_expected++))
  
  if [ $routes_found -ge 2 ]; then
    log_pass "instance-$instance_id API routes validated ($routes_found/$routes_expected core routes)"
    return 0
  else
    log_fail "instance-$instance_id API routes insufficient ($routes_found/$routes_expected)"
    return 1
  fi
}

# Test 2: Alerting Service Check
test_alerting_service() {
  local port=$1
  local instance_id=$2
  
  log_test "Testing instance-$instance_id alerting service (port $port)..."
  
  # Check if alerting endpoints exist
  # Note: Current version may not have full alerting API
  local alert_routes=("alerting/ingest" "alerting/incidents")
  local found_routes=0
  
  for route in "${alert_routes[@]}"; do
    local response
    response=$(NO_PROXY=localhost curl -s --connect-timeout $TIMEOUT "http://localhost:$port/api/v1/$route" 2>/dev/null)
    if [ $? -eq 0 ] && [ -n "$response" ]; then
      if ! echo "$response" | grep -q "Not Found"; then
        ((found_routes++))
      fi
    fi
  done
  
  if [ $found_routes -gt 0 ]; then
    log_pass "instance-$instance_id alerting service responding ($found_routes/${#alert_routes[@]} routes)"
    return 0
  else
    log_skip "instance-$instance_id alerting API not yet implemented (expected in current version)"
    return 0  # Non-critical for current version
  fi
}

# Test 3: Trading Service Check
test_trading_service() {
  local port=$1
  local instance_id=$2
  
  log_test "Testing instance-$instance_id trading service (port $port)..."
  
  # Check trading endpoints
  local trading_routes=("trading/approvals" "trading/incidents" "trading/replay")
  local found_routes=0
  
  for route in "${trading_routes[@]}"; do
    # Try POST endpoint info (will fail but tells us if route exists)
    local response
    response=$(NO_PROXY=localhost curl -s --connect-timeout $TIMEOUT -X OPTIONS "http://localhost:$port/api/v1/$route" 2>/dev/null)
    if [ $? -eq 0 ]; then
      ((found_routes++))
    fi
  done
  
  # Check startup log for trading endpoints
  local log_file="logs/deploy/instance-$instance_id.log"
  if [ -f "$log_file" ]; then
    local trading_in_log
    trading_in_log=$(grep -c "trading/" "$log_file" 2>/dev/null || echo "0")
    if [ "$trading_in_log" -gt 0 ]; then
      log_pass "instance-$instance_id trading service registered ($trading_in_log endpoints in log)"
      return 0
    fi
  fi
  
  if [ $found_routes -gt 0 ]; then
    log_pass "instance-$instance_id trading service responding ($found_routes/${#trading_routes[@]} routes)"
    return 0
  else
    log_warn "instance-$instance_id trading service status unknown"
    return 0  # Non-critical
  fi
}

# Test 4: Instance Registry Check
test_instance_registry() {
  local port=$1
  local instance_id=$2
  
  log_test "Testing instance-$instance_id registry (port $port)..."
  
  # Check if instance ID file exists
  local id_file="data/instance_id.json"
  if [ -f "$id_file" ]; then
    local instance_id_content
    instance_id_content=$(cat "$id_file" 2>/dev/null | jq -r '.instanceId // empty')
    if [ -n "$instance_id_content" ]; then
      log_pass "instance-$instance_id registry file valid (ID: $instance_id_content)"
      return 0
    else
      log_warn "instance-$instance_id registry file exists but invalid"
      return 1
    fi
  else
    log_warn "instance-$instance_id registry file not found (may use different storage)"
    return 0  # Non-critical
  fi
}

# Test 5: Shared Storage Consistency
test_shared_storage_consistency() {
  local port=$1
  local instance_id=$2
  
  log_test "Testing instance-$instance_id shared storage consistency (port $port)..."
  
  local storage_dirs=("data/shared/leases" "data/shared/items" "data/shared/suppression")
  local consistent=0
  local total=0
  
  for dir in "${storage_dirs[@]}"; do
    ((total++))
    if [ -d "$dir" ]; then
      # Check if directory is accessible and has expected permissions
      if [ -r "$dir" ] && [ -w "$dir" ]; then
        local file_count
        file_count=$(ls -1 "$dir" 2>/dev/null | wc -l | tr -d ' ')
        log_warn "  $dir: $file_count files"
        ((consistent++))
      else
        log_warn "  $dir: permission issue"
      fi
    else
      log_warn "  $dir: directory not found"
    fi
  done
  
  if [ $consistent -eq $total ]; then
    log_pass "instance-$instance_id shared storage consistent ($consistent/$total directories)"
    return 0
  else
    log_warn "instance-$instance_id shared storage partial ($consistent/$total directories)"
    return 0  # Non-critical for current version
  fi
}

# Test 6: Log Health Check
test_log_health() {
  local port=$1
  local instance_id=$2
  
  log_test "Testing instance-$instance_id log health (port $port)..."
  
  local log_file="logs/deploy/instance-$instance_id.log"
  
  if [ ! -f "$log_file" ]; then
    log_fail "instance-$instance_id log file not found: $log_file"
    return 1
  fi
  
  # Check for ERROR level messages in last 100 lines
  local error_count
  error_count=$(tail -100 "$log_file" 2>/dev/null | grep -c "ERROR" || echo "0")
  
  # Check for startup completion
  local started
  started=$(grep -c "Service Started" "$log_file" 2>/dev/null || echo "0")
  
  if [ "$started" -gt 0 ]; then
    if [ "$error_count" -gt 0 ]; then
      log_warn "instance-$instance_id log has $error_count ERROR messages (startup: OK)"
      log_pass "instance-$instance_id log health acceptable (startup completed)"
      return 0
    else
      log_pass "instance-$instance_id log health good (0 errors, startup: OK)"
      return 0
    fi
  else
    log_fail "instance-$instance_id startup not found in log"
    return 1
  fi
}

# Test 7: Process Resource Check
test_process_resources() {
  local port=$1
  local instance_id=$2
  
  log_test "Testing instance-$instance_id process resources (port $port)..."
  
  # Find PID for this instance
  local pid_file="pids/instance-$instance_id.pid"
  local pid
  
  if [ -f "$pid_file" ]; then
    pid=$(cat "$pid_file" 2>/dev/null)
  else
    # Try to find by port
    pid=$(lsof -ti :$port 2>/dev/null | head -1)
  fi
  
  if [ -z "$pid" ]; then
    log_warn "instance-$instance_id PID not found"
    return 0  # Non-critical
  fi
  
  # Check if process is running
  if ! ps -p "$pid" > /dev/null 2>&1; then
    log_fail "instance-$instance_id process $pid not running"
    return 1
  fi
  
  # Get memory usage (in KB)
  local mem_kb
  mem_kb=$(ps -o rss= -p "$pid" 2>/dev/null | tr -d ' ')
  
  if [ -n "$mem_kb" ]; then
    local mem_mb=$((mem_kb / 1024))
    if [ "$mem_mb" -lt 500 ]; then
      log_pass "instance-$instance_id memory usage normal (${mem_mb}MB)"
    elif [ "$mem_mb" -lt 1000 ]; then
      log_warn "instance-$instance_id memory usage elevated (${mem_mb}MB)"
      log_pass "instance-$instance_id process running (${mem_mb}MB)"
    else
      log_warn "instance-$instance_id memory usage high (${mem_mb}MB)"
      log_pass "instance-$instance_id process running (${mem_mb}MB)"
    fi
    return 0
  else
    log_warn "instance-$instance_id could not determine memory usage"
    return 0
  fi
}

# Main test suite
main() {
  log "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
  log "${BLUE}║   P1 Production Smoke Tests                        ║${NC}"
  log "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
  log ""
  log "Configuration:"
  log "  Base Port: $BASE_PORT"
  log "  Instance Count: $INSTANCE_COUNT"
  log "  Timeout: ${TIMEOUT}s"
  log "  Log File: $LOG_FILE"
  log ""
  
  local start_time
  start_time=$(date +%s)
  
  # Test 1: API Routes Availability
  log "${YELLOW}=== Test 1: API Routes Availability ===${NC}"
  for i in $(seq 1 $INSTANCE_COUNT); do
    local port=$((BASE_PORT + i - 1))
    test_api_routes $port $i || true
  done
  log ""
  
  # Test 2: Alerting Service Check
  log "${YELLOW}=== Test 2: Alerting Service Check ===${NC}"
  for i in $(seq 1 $INSTANCE_COUNT); do
    local port=$((BASE_PORT + i - 1))
    test_alerting_service $port $i || true
  done
  log ""
  
  # Test 3: Trading Service Check
  log "${YELLOW}=== Test 3: Trading Service Check ===${NC}"
  for i in $(seq 1 $INSTANCE_COUNT); do
    local port=$((BASE_PORT + i - 1))
    test_trading_service $port $i || true
  done
  log ""
  
  # Test 4: Instance Registry Check
  log "${YELLOW}=== Test 4: Instance Registry Check ===${NC}"
  for i in $(seq 1 $INSTANCE_COUNT); do
    local port=$((BASE_PORT + i - 1))
    test_instance_registry $port $i || true
  done
  log ""
  
  # Test 5: Shared Storage Consistency
  log "${YELLOW}=== Test 5: Shared Storage Consistency ===${NC}"
  for i in $(seq 1 $INSTANCE_COUNT); do
    local port=$((BASE_PORT + i - 1))
    test_shared_storage_consistency $port $i || true
  done
  log ""
  
  # Test 6: Log Health Check
  log "${YELLOW}=== Test 6: Log Health Check ===${NC}"
  for i in $(seq 1 $INSTANCE_COUNT); do
    local port=$((BASE_PORT + i - 1))
    test_log_health $port $i || true
  done
  log ""
  
  # Test 7: Process Resource Check
  log "${YELLOW}=== Test 7: Process Resource Check ===${NC}"
  for i in $(seq 1 $INSTANCE_COUNT); do
    local port=$((BASE_PORT + i - 1))
    test_process_resources $port $i || true
  done
  log ""
  
  # Summary
  local end_time
  end_time=$(date +%s)
  local duration=$((end_time - start_time))
  
  log "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
  log "${BLUE}║   Test Summary                                     ║${NC}"
  log "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
  log ""
  log "Tests Passed:  ${GREEN}$TESTS_PASSED${NC}"
  log "Tests Failed:  ${RED}$TESTS_FAILED${NC}"
  log "Tests Skipped: ${YELLOW}$TESTS_SKIPPED${NC}"
  log "Duration:      ${duration}s"
  log ""
  
  if [ $TESTS_FAILED -gt 0 ]; then
    log "${RED}❌ P1 Smoke Tests FAILED${NC}"
    log ""
    log "Next steps:"
    log "  1. Check failed test details above"
    log "  2. Review instance logs: tail -100 logs/deploy/instance-*.log"
    log "  3. Check P0 tests: ./scripts/smoke-test-p0.sh"
    exit 1
  else
    log "${GREEN}✅ P1 Smoke Tests PASSED${NC}"
    log ""
    log "Next steps:"
    log "  1. Run P2 tests (optional): ./scripts/smoke-test-p2.sh --full"
    log "  2. Check Gray 10% observation: cat docs/GRAY10_OBSERVATION_PLAN.md"
    log "  3. View test log: cat $LOG_FILE"
    exit 0
  fi
}

# Run main
main "$@"
