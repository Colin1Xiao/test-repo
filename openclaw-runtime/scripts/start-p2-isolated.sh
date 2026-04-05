#!/bin/bash
# scripts/start-p2-isolated.sh
# Start isolated environment for Full Mode P2 testing
#
# Usage:
#   ./scripts/start-p2-isolated.sh
#   ./scripts/stop-p2-isolated.sh

set -e

# Configuration
BASE_PORT=3201
INSTANCE_COUNT=3
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$PROJECT_ROOT/pids-p2-test"
LOG_DIR="$PROJECT_ROOT/logs-p2-test"
STORAGE_DIR="$PROJECT_ROOT/storage-p2-test"
CONFIG_FILE="$PROJECT_ROOT/config/p2-test.json"

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

# Create directories
setup_directories() {
  log "Setting up isolated environment..."
  
  mkdir -p "$PID_DIR"
  mkdir -p "$LOG_DIR"
  mkdir -p "$STORAGE_DIR"
  
  for i in $(seq 1 $INSTANCE_COUNT); do
    mkdir -p "$STORAGE_DIR/instance-$i"
  done
  
  log_pass "Directories created"
}

# Create test config
create_config() {
  log "Creating test configuration..."
  
  cat > "$CONFIG_FILE" << EOF
{
  "runtime": {
    "port": $BASE_PORT,
    "host": "0.0.0.0",
    "log_level": "debug",
    "config_file": "$CONFIG_FILE"
  },
  "core": {
    "health": {
      "enabled": true,
      "interval_seconds": 30,
      "endpoint": "/health"
    },
    "event-bus": {
      "enabled": true,
      "queue_size": 10000,
      "persist": false
    },
    "config": {
      "enabled": true,
      "hot_reload": true
    },
    "logger": {
      "enabled": true,
      "level": "debug",
      "format": "json",
      "output": "$LOG_DIR/app.log"
    }
  },
  "modules": {
    "module-a": {
      "enabled": true,
      "port": $BASE_PORT,
      "log_level": "debug"
    },
    "module-b": {
      "enabled": true,
      "port": $((BASE_PORT + 1)),
      "log_level": "debug"
    }
  },
  "test_mode": {
    "enabled": true,
    "isolate": true,
    "description": "Full Mode P2 isolated test environment"
  }
}
EOF
  
  log_pass "Configuration created: $CONFIG_FILE"
}

# Start instances
start_instances() {
  log "Starting $INSTANCE_COUNT instances..."
  
  for i in $(seq 1 $INSTANCE_COUNT); do
    local port=$((BASE_PORT + i - 1))
    local pid_file="$PID_DIR/instance-$i.pid"
    local log_file="$LOG_DIR/instance-$i.log"
    local storage_path="$STORAGE_DIR/instance-$i"
    
    log "Starting instance-$i on port $port..."
    
    RUNTIME_PORT=$port \
    RUNTIME_LOG_LEVEL=debug \
    RUNTIME_CONFIG_FILE="$CONFIG_FILE" \
    RUNTIME_STORAGE_PATH="$storage_path" \
    NODE_ENV=test \
    node dist/server.js > "$log_file" 2>&1 &
    
    echo $! > "$pid_file"
    
    log_pass "instance-$i started (PID: $!)"
  done
}

# Wait for health
wait_for_health() {
  log "Waiting for instances to be healthy..."
  
  local max_attempts=30
  local attempt=1
  
  for i in $(seq 1 $INSTANCE_COUNT); do
    local port=$((BASE_PORT + i - 1))
    local healthy=false
    
    while [ $attempt -le $max_attempts ]; do
      local response=$(NO_PROXY=localhost curl -s --connect-timeout 2 "http://localhost:$port/health" 2>/dev/null || echo '{}')
      local ok=$(echo "$response" | jq -r '.ok // false' 2>/dev/null || echo 'false')
      
      if [ "$ok" = "true" ]; then
        log_pass "instance-$i healthy on port $port"
        healthy=true
        break
      fi
      
      attempt=$((attempt + 1))
      sleep 1
    done
    
    if [ "$healthy" = false ]; then
      log_fail "instance-$i failed health check"
      return 1
    fi
  done
  
  log_pass "All instances healthy"
}

# Main
main() {
  echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║   Full Mode P2 Isolated Environment                ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
  echo ""
  
  log "Project root: $PROJECT_ROOT"
  log "Base port: $BASE_PORT"
  log "Instances: $INSTANCE_COUNT"
  echo ""
  
  setup_directories
  create_config
  start_instances
  wait_for_health
  
  echo ""
  log_pass "Full Mode P2 isolated environment ready!"
  echo ""
  log "Next steps:"
  log "  1. Run tests: bash scripts/smoke-test-p2.sh --full"
  log "  2. Monitor logs: tail -f $LOG_DIR/*.log"
  log "  3. Stop environment: bash scripts/stop-p2-isolated.sh"
}

# Run main
main "$@"
