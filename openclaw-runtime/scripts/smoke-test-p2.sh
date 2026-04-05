#!/bin/bash
# scripts/smoke-test-p2.sh
# P2 Production Smoke Tests (Advanced)
# 
# Usage:
#   ./scripts/smoke-test-p2.sh [BASE_PORT] [--full]
#   ./scripts/smoke-test-p2.sh 3101
#   ./scripts/smoke-test-p2.sh 3101 --full
#
# Exit codes:
#   0 - All tests passed
#   1 - One or more tests failed

set -e

# Configuration
BASE_PORT=${1:-3101}
INSTANCE_COUNT=3
TIMEOUT=10
FULL_MODE=false
LOG_FILE="logs/smoke-test-p2-$(date +%Y%m%d-%H%M%S).log"

# Parse arguments
if [ "$2" == "--full" ]; then
  FULL_MODE=true
fi

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

# Test 1: Concurrent Request Test
test_concurrent_requests() {
  local port=$1
  local instance_id=$2
  
  log_test "Testing instance-$instance_id concurrent requests (port $port)..."
  
  # Check if ab (Apache Bench) is available
  if ! command -v ab &> /dev/null; then
    log_skip "instance-$instance_id Apache Bench not installed, skipping concurrent test"
    return 0
  fi
  
  # Run concurrent requests (light load for Gray 10%)
  local ab_output
  ab_output=$(ab -n 100 -c 10 -q "http://localhost:$port/health" 2>&1)
  
  if [ $? -ne 0 ]; then
    log_fail "instance-$instance_id concurrent request test failed"
    return 1
  fi
  
  # Parse results
  local failed_requests
  failed_requests=$(echo "$ab_output" | grep "Failed requests:" | awk '{print $3}')
  
  local time_per_request
  time_per_request=$(echo "$ab_output" | grep "Time per request:" | head -1 | awk '{print $4}')
  
  local requests_per_second
  requests_per_second=$(echo "$ab_output" | grep "Requests per second:" | awk '{print $4}')
  
  if [ "$failed_requests" == "0" ]; then
    log_pass "instance-$instance_id concurrent test passed (failed: 0, req/s: $requests_per_second)"
    return 0
  else
    log_fail "instance-$instance_id concurrent test failed (failed: $failed_requests)"
    return 1
  fi
}

# Test 2: Rollback Health Re-verification
test_rollback_health() {
  local port=$1
  local instance_id=$2
  
  log_test "Testing instance-$instance_id rollback readiness (port $port)..."
  
  # Check if rollback script exists
  if [ ! -f "scripts/rollback-local.sh" ]; then
    log_fail "Rollback script not found"
    return 1
  fi
  
  # Check if rollback script is executable
  if [ ! -x "scripts/rollback-local.sh" ]; then
    log_warn "Rollback script not executable, fixing..."
    chmod +x scripts/rollback-local.sh
  fi
  
  # Check PID files exist
  local pid_count=0
  for i in $(seq 1 $INSTANCE_COUNT); do
    if [ -f "pids/instance-$i.pid" ]; then
      ((pid_count++))
    fi
  done
  
  if [ $pid_count -eq $INSTANCE_COUNT ]; then
    log_pass "instance-$instance_id rollback readiness verified (PIDs: $pid_count/$INSTANCE_COUNT)"
    return 0
  else
    log_warn "instance-$instance_id PID files incomplete ($pid_count/$INSTANCE_COUNT)"
    return 0  # Non-critical
  fi
}

# Test 3: Fault Injection Basic Test
test_fault_injection() {
  local port=$1
  local instance_id=$2
  
  log_test "Testing instance-$instance_id fault tolerance (port $port)..."
  
  # This is a basic test - just verify other instances are healthy
  # Full fault injection would require stopping an instance
  
  local healthy_neighbors=0
  
  for i in $(seq 1 $INSTANCE_COUNT); do
    if [ $i -ne $instance_id ]; then
      local neighbor_port=$((BASE_PORT + i - 1))
      local health
      health=$(NO_PROXY=localhost curl -s --connect-timeout $TIMEOUT "http://localhost:$neighbor_port/health" 2>/dev/null)
      
      if [ -n "$health" ]; then
        local ok
        ok=$(echo "$health" | jq -r '.ok' 2>/dev/null)
        if [ "$ok" == "true" ]; then
          ((healthy_neighbors++))
        fi
      fi
    fi
  done
  
  if [ $healthy_neighbors -eq $((INSTANCE_COUNT - 1)) ]; then
    log_pass "instance-$instance_id fault tolerance verified (healthy neighbors: $healthy_neighbors)"
    return 0
  else
    log_warn "instance-$instance_id fault tolerance partial (healthy neighbors: $healthy_neighbors/$((INSTANCE_COUNT - 1)))"
    return 0  # Non-critical for basic test
  fi
}

# Test 4: Memory Leak Quick Check
test_memory_leak() {
  local port=$1
  local instance_id=$2
  
  log_test "Testing instance-$instance_id memory usage (port $port)..."
  
  # Get current memory
  local pid_file="pids/instance-$instance_id.pid"
  local pid
  
  if [ -f "$pid_file" ]; then
    pid=$(cat "$pid_file" 2>/dev/null)
  else
    pid=$(lsof -ti :$port 2>/dev/null | head -1)
  fi
  
  if [ -z "$pid" ]; then
    log_warn "instance-$instance_id PID not found"
    return 0  # Non-critical
  fi
  
  # Get memory in KB
  local mem_kb
  mem_kb=$(ps -o rss= -p "$pid" 2>/dev/null | tr -d ' ')
  
  if [ -n "$mem_kb" ]; then
    local mem_mb=$((mem_kb / 1024))
    
    # Check against thresholds
    if [ "$mem_mb" -lt 100 ]; then
      log_pass "instance-$instance_id memory excellent (${mem_mb}MB)"
      return 0
    elif [ "$mem_mb" -lt 500 ]; then
      log_pass "instance-$instance_id memory normal (${mem_mb}MB)"
      return 0
    elif [ "$mem_mb" -lt 1000 ]; then
      log_warn "instance-$instance_id memory elevated (${mem_mb}MB)"
      log_pass "instance-$instance_id memory acceptable (${mem_mb}MB)"
      return 0
    else
      log_fail "instance-$instance_id memory high (${mem_mb}MB) - possible leak"
      return 1
    fi
  else
    log_warn "instance-$instance_id could not determine memory usage"
    return 0
  fi
}

# Test 5: Shared Storage Write Test (Full Mode Only)
test_shared_storage_write() {
  local port=$1
  local instance_id=$2
  
  log_test "Testing instance-$instance_id shared storage write (port $port)..."
  
  if [ "$FULL_MODE" != "true" ]; then
    log_skip "instance-$instance_id storage write test (full mode only)"
    return 0
  fi
  
  local test_file="data/shared/leases/.smoke_test_$$"
  
  # Test write
  if echo "test" > "$test_file" 2>/dev/null; then
    # Test read
    local content
    content=$(cat "$test_file" 2>/dev/null)
    
    # Cleanup
    rm -f "$test_file"
    
    if [ "$content" == "test" ]; then
      log_pass "instance-$instance_id storage write/read verified"
      return 0
    else
      log_fail "instance-$instance_id storage read mismatch"
      return 1
    fi
  else
    log_fail "instance-$instance_id storage write failed"
    return 1
  fi
}

# Test 6: Log Rotation Check
test_log_rotation() {
  local port=$1
  local instance_id=$2
  
  log_test "Testing instance-$instance_id log rotation (port $port)..."
  
  local log_file="logs/deploy/instance-$instance_id.log"
  
  if [ ! -f "$log_file" ]; then
    log_fail "instance-$instance_id log file not found"
    return 1
  fi
  
  # Check log file size
  local size_kb
  size_kb=$(du -k "$log_file" 2>/dev/null | cut -f1)
  
  if [ -n "$size_kb" ]; then
    if [ "$size_kb" -lt 10240 ]; then  # < 10MB
      log_pass "instance-$instance_id log size normal (${size_kb}KB)"
      return 0
    elif [ "$size_kb" -lt 102400 ]; then  # < 100MB
      log_warn "instance-$instance_id log size elevated (${size_kb}KB)"
      log_pass "instance-$instance_id log size acceptable (${size_kb}KB)"
      return 0
    else
      log_fail "instance-$instance_id log size too large (${size_kb}KB)"
      return 1
    fi
  else
    log_warn "instance-$instance_id could not determine log size"
    return 0
  fi
}

# Test 7: Graceful Shutdown Test (Full Mode Only)
test_graceful_shutdown() {
  local port=$1
  local instance_id=$2
  
  log_test "Testing instance-$instance_id graceful shutdown (port $port)..."
  
  if [ "$FULL_MODE" != "true" ]; then
    log_skip "instance-$instance_id graceful shutdown test (full mode only)"
    return 0
  fi
  
  # Get PID
  local pid_file="pids/instance-$instance_id.pid"
  local pid
  
  if [ -f "$pid_file" ]; then
    pid=$(cat "$pid_file" 2>/dev/null)
  else
    log_warn "instance-$instance_id PID file not found"
    return 0
  fi
  
  if [ -z "$pid" ]; then
    log_warn "instance-$instance_id PID not found"
    return 0
  fi
  
  # Send SIGTERM
  kill -TERM "$pid" 2>/dev/null
  
  # Wait for graceful shutdown (max 10s)
  local timeout=10
  local elapsed=0
  
  while [ $elapsed -lt $timeout ]; do
    if ! ps -p "$pid" > /dev/null 2>&1; then
      log_pass "instance-$instance_id graceful shutdown verified"
      
      # Restart the instance
      log_warn "Restarting instance-$instance_id..."
      bash scripts/deploy-local-prod.sh > /dev/null 2>&1
      
      return 0
    fi
    sleep 1
    ((elapsed++))
  done
  
  log_fail "instance-$instance_id graceful shutdown timeout"
  
  # Force kill and restart
  kill -9 "$pid" 2>/dev/null
  bash scripts/deploy-local-prod.sh > /dev/null 2>&1
  
  return 1
}

# Main test suite
main() {
  log "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
  log "${BLUE}║   P2 Production Smoke Tests (Advanced)             ║${NC}"
  log "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
  log ""
  log "Configuration:"
  log "  Base Port: $BASE_PORT"
  log "  Instance Count: $INSTANCE_COUNT"
  log "  Timeout: ${TIMEOUT}s"
  log "  Full Mode: $FULL_MODE"
  log "  Log File: $LOG_FILE"
  log ""
  
  local start_time
  start_time=$(date +%s)
  
  # Test 1: Concurrent Request Test
  log "${YELLOW}=== Test 1: Concurrent Request Test ===${NC}"
  for i in $(seq 1 $INSTANCE_COUNT); do
    local port=$((BASE_PORT + i - 1))
    test_concurrent_requests $port $i || true
  done
  log ""
  
  # Test 2: Rollback Health Re-verification
  log "${YELLOW}=== Test 2: Rollback Health Re-verification ===${NC}"
  for i in $(seq 1 $INSTANCE_COUNT); do
    local port=$((BASE_PORT + i - 1))
    test_rollback_health $port $i || true
  done
  log ""
  
  # Test 3: Fault Injection Basic Test
  log "${YELLOW}=== Test 3: Fault Injection Basic Test ===${NC}"
  for i in $(seq 1 $INSTANCE_COUNT); do
    local port=$((BASE_PORT + i - 1))
    test_fault_injection $port $i || true
  done
  log ""
  
  # Test 4: Memory Leak Quick Check
  log "${YELLOW}=== Test 4: Memory Leak Quick Check ===${NC}"
  for i in $(seq 1 $INSTANCE_COUNT); do
    local port=$((BASE_PORT + i - 1))
    test_memory_leak $port $i || true
  done
  log ""
  
  # Test 5: Shared Storage Write Test (Full Mode Only)
  log "${YELLOW}=== Test 5: Shared Storage Write Test ===${NC}"
  for i in $(seq 1 $INSTANCE_COUNT); do
    local port=$((BASE_PORT + i - 1))
    test_shared_storage_write $port $i || true
  done
  log ""
  
  # Test 6: Log Rotation Check
  log "${YELLOW}=== Test 6: Log Rotation Check ===${NC}"
  for i in $(seq 1 $INSTANCE_COUNT); do
    local port=$((BASE_PORT + i - 1))
    test_log_rotation $port $i || true
  done
  log ""
  
  # Test 7: Graceful Shutdown Test (Full Mode Only)
  log "${YELLOW}=== Test 7: Graceful Shutdown Test ===${NC}"
  for i in $(seq 1 $INSTANCE_COUNT); do
    local port=$((BASE_PORT + i - 1))
    test_graceful_shutdown $port $i || true
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
    log "${RED}❌ P2 Smoke Tests FAILED${NC}"
    log ""
    log "Next steps:"
    log "  1. Check failed test details above"
    log "  2. Review instance logs: tail -100 logs/deploy/instance-*.log"
    log "  3. Check resources: ps aux | grep 'node dist/server'"
    exit 1
  else
    log "${GREEN}✅ P2 Smoke Tests PASSED${NC}"
    log ""
    log "Next steps:"
    log "  1. Review Gray 10% observation: cat docs/GRAY10_OBSERVATION_PLAN.md"
    log "  2. Check Day 1 report: cat docs/GRAY10_DAY1_REPORT_TEMPLATE.md"
    log "  3. View test log: cat $LOG_FILE"
    exit 0
  fi
}

# Run main
main "$@"
