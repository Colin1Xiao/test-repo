#!/bin/bash
# scripts/stop-p2-isolated.sh
# Stop isolated environment for Full Mode P2 testing

set -e

# Configuration
BASE_PORT=3201
INSTANCE_COUNT=3
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$PROJECT_ROOT/pids-p2-test"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
  echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

log_pass() {
  echo -e "${GREEN}✓${NC} $1"
}

# Stop instances
stop_instances() {
  log "Stopping $INSTANCE_COUNT instances..."
  
  for i in $(seq 1 $INSTANCE_COUNT); do
    local pid_file="$PID_DIR/instance-$i.pid"
    
    if [ -f "$pid_file" ]; then
      local pid=$(cat "$pid_file" 2>/dev/null)
      
      if [ -n "$pid" ] && ps -p "$pid" > /dev/null 2>&1; then
        log "Stopping instance-$i (PID: $pid)..."
        kill -TERM "$pid" 2>/dev/null || true
        sleep 2
        
        # Force kill if still running
        if ps -p "$pid" > /dev/null 2>&1; then
          kill -9 "$pid" 2>/dev/null || true
        fi
        
        log_pass "instance-$i stopped"
      else
        log "instance-$i not running"
      fi
      
      rm "$pid_file" 2>/dev/null || true
    else
      log "instance-$i PID file not found"
    fi
  done
}

# Main
main() {
  echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║   Stop Full Mode P2 Isolated Environment           ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
  echo ""
  
  stop_instances
  
  echo ""
  log_pass "Full Mode P2 isolated environment stopped"
}

# Run main
main "$@"
