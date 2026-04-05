#!/bin/bash
# scripts/smoke-test-p0.sh
# P0 Production Smoke Tests
# 
# Usage:
#   ./scripts/smoke-test-p0.sh [BASE_PORT]
#   ./scripts/smoke-test-p0.sh 3101
#
# Exit codes:
#   0 - All tests passed
#   1 - One or more tests failed

set -e

# Configuration
BASE_PORT=${1:-3101}
INSTANCE_COUNT=3
TIMEOUT=5
LOG_FILE="logs/smoke-test-p0-$(date +%Y%m%d-%H%M%S).log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TESTS_PASSED=0
TESTS_FAILED=0

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

log_warn() {
  log "${YELLOW}⚠${NC} $1"
}

# Test functions
test_health_check() {
  local port=$1
  local instance_id=$2
  
  log_test "Testing instance-$instance_id health check (port $port)..."
  
  local response
  response=$(NO_PROXY=localhost curl -s -w "\n%{http_code}" --connect-timeout $TIMEOUT "http://localhost:$port/health" 2>/dev/null)
  
  local http_code
  http_code=$(echo "$response" | tail -n1)
  local body
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" != "200" ]; then
    log_fail "instance-$instance_id health check failed (HTTP: $http_code)"
    return 1
  fi
  
  # Validate response structure
  local ok
  ok=$(echo "$body" | jq -r '.ok' 2>/dev/null)
  local status
  status=$(echo "$body" | jq -r '.status' 2>/dev/null)
  
  if [ "$ok" != "true" ]; then
    log_fail "instance-$instance_id health check returned ok=false"
    return 1
  fi
  
  if [ "$status" != "live" ]; then
    log_fail "instance-$instance_id health check returned status=$status (expected: live)"
    return 1
  fi
  
  log_pass "instance-$instance_id health check passed (HTTP: $http_code, status: $status)"
  return 0
}

test_feature_flags() {
  local port=$1
  local instance_id=$2
  
  log_test "Testing instance-$instance_id config endpoint (port $port)..."
  
  local config
  config=$(NO_PROXY=localhost curl -s --connect-timeout $TIMEOUT "http://localhost:$port/config" 2>/dev/null)
  
  if [ -z "$config" ]; then
    log_fail "instance-$instance_id config endpoint returned empty response"
    return 1
  fi
  
  # Validate basic config structure (environment variables format)
  local node_env
  node_env=$(echo "$config" | jq -r '.NODE_ENV' 2>/dev/null)
  local port_config
  port_config=$(echo "$config" | jq -r '.PORT' 2>/dev/null)
  
  if [ "$node_env" != "production" ]; then
    log_fail "instance-$instance_id NODE_ENV is not production: $node_env"
    return 1
  fi
  
  if [ "$port_config" != "$port" ]; then
    log_warn "instance-$instance_id PORT mismatch: $port_config (expected: $port)"
  fi
  
  # Check metrics enabled
  local metrics_enabled
  metrics_enabled=$(echo "$config" | jq -r '.METRICS_ENABLED' 2>/dev/null)
  
  if [ "$metrics_enabled" = "false" ]; then
    log_warn "instance-$instance_id METRICS_ENABLED is false"
  fi
  
  log_pass "instance-$instance_id config validated (NODE_ENV: $node_env, PORT: $port_config)"
  return 0
}

test_shared_storage() {
  local port=$1
  local instance_id=$2
  
  log_test "Testing instance-$instance_id shared storage access (port $port)..."
  
  # Check directories exist
  local storage_dirs=("data/shared/leases" "data/shared/items" "data/shared/suppression")
  
  for dir in "${storage_dirs[@]}"; do
    if [ ! -d "$dir" ]; then
      log_fail "Shared storage directory missing: $dir"
      return 1
    fi
    
    # Test write permission
    local test_file="$dir/.smoke_test_$$"
    if ! touch "$test_file" 2>/dev/null; then
      log_fail "Shared storage not writable: $dir"
      return 1
    fi
    rm -f "$test_file"
  done
  
  # Check health endpoint reports storage status
  local health
  health=$(NO_PROXY=localhost curl -s --connect-timeout $TIMEOUT "http://localhost:$port/health" 2>/dev/null)
  local storage_status
  storage_status=$(echo "$health" | jq -r '.storage // .components // empty' 2>/dev/null)
  
  if [ -z "$storage_status" ]; then
    log_warn "instance-$instance_id health endpoint does not report storage status (non-critical)"
  fi
  
  log_pass "instance-$instance_id shared storage validated (3/3 directories accessible)"
  return 0
}

test_metrics_endpoint() {
  local port=$1
  local instance_id=$2
  
  log_test "Testing instance-$instance_id metrics endpoint (port $port)..."
  
  local response
  response=$(NO_PROXY=localhost curl -s --connect-timeout $TIMEOUT "http://localhost:$port/metrics" 2>/dev/null)
  local http_code=$?
  
  # Metrics endpoint may return 404 if not implemented yet (non-critical for current version)
  if [ $http_code -ne 0 ]; then
    log_warn "instance-$instance_id metrics endpoint failed to connect"
    return 0  # Non-critical
  fi
  
  if [ -z "$response" ]; then
    log_warn "instance-$instance_id metrics endpoint returned empty (may not be implemented)"
    return 0  # Non-critical
  fi
  
  # If metrics exist, check for some content
  local line_count
  line_count=$(echo "$response" | wc -l | tr -d ' ')
  
  if [ "$line_count" -gt 0 ]; then
    log_pass "instance-$instance_id metrics endpoint responding ($line_count lines)"
  else
    log_warn "instance-$instance_id metrics endpoint empty"
  fi
  
  return 0
}

# Main test suite
main() {
  log "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
  log "${BLUE}║   P0 Production Smoke Tests                        ║${NC}"
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
  
  # Test 1: 3 实例健康检查
  log "${YELLOW}=== Test 1: 3 实例健康检查 ===${NC}"
  for i in $(seq 1 $INSTANCE_COUNT); do
    local port=$((BASE_PORT + i - 1))
    test_health_check $port $i || true
  done
  log ""
  
  # Test 2: Feature Flags 验证
  log "${YELLOW}=== Test 2: Feature Flags 验证 ===${NC}"
  for i in $(seq 1 $INSTANCE_COUNT); do
    local port=$((BASE_PORT + i - 1))
    test_feature_flags $port $i || true
  done
  log ""
  
  # Test 3: 共享存储验证
  log "${YELLOW}=== Test 3: 共享存储验证 ===${NC}"
  for i in $(seq 1 $INSTANCE_COUNT); do
    local port=$((BASE_PORT + i - 1))
    test_shared_storage $port $i || true
  done
  log ""
  
  # Test 4: 监控端点验证
  log "${YELLOW}=== Test 4: 监控端点验证 ===${NC}"
  for i in $(seq 1 $INSTANCE_COUNT); do
    local port=$((BASE_PORT + i - 1))
    test_metrics_endpoint $port $i || true
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
  log "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
  log "Tests Failed: ${RED}$TESTS_FAILED${NC}"
  log "Duration: ${duration}s"
  log ""
  
  if [ $TESTS_FAILED -gt 0 ]; then
    log "${RED}❌ P0 Smoke Tests FAILED${NC}"
    log ""
    log "Next steps:"
    log "  1. Check instance logs: tail -100 logs/deploy/instance-*.log"
    log "  2. Verify processes: ps aux | grep 'node dist/server'"
    log "  3. Check ports: lsof -i :$BASE_PORT"
    log "  4. Re-deploy if needed: ./scripts/deploy-local-prod.sh"
    exit 1
  else
    log "${GREEN}✅ P0 Smoke Tests PASSED${NC}"
    log ""
    log "Next steps:"
    log "  1. Run P1 tests: ./scripts/smoke-test-p1.sh"
    log "  2. Check Gray 10% observation: cat docs/GRAY10_OBSERVATION_PLAN.md"
    exit 0
  fi
}

# Run main
main "$@"
