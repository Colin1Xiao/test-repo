#!/bin/bash
# Phase 4.x Runtime - Local Rollback Script
# Gray 10% Emergency Rollback (Native Node.js)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_DIR="$PROJECT_DIR/pids"
LOG_DIR="$PROJECT_DIR/logs/deploy"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== Phase 4.x Runtime Local Rollback ===${NC}"
echo ""

# Step 1: Stop all instances
echo -e "${YELLOW}Step 1: Stopping all runtime instances...${NC}"

INSTANCE_COUNT=3
STOPPED_COUNT=0

for i in $(seq 1 $INSTANCE_COUNT); do
    PID_FILE="$PID_DIR/instance-$i.pid"
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID" 2>/dev/null || true
            echo -e "${GREEN}  ✓ Stopped instance-$i (PID: $PID)${NC}"
            STOPPED_COUNT=$((STOPPED_COUNT + 1))
        else
            echo -e "${YELLOW}  ! instance-$i (PID: $PID) not running${NC}"
        fi
        rm -f "$PID_FILE"
    else
        echo -e "${YELLOW}  ! No PID file for instance-$i${NC}"
    fi
done

echo -e "${GREEN}✓ Stopped $STOPPED_COUNT instances${NC}"
echo ""

# Step 2: Clean up PID directory
echo -e "${YELLOW}Step 2: Cleaning up PID files...${NC}"
rm -rf "$PID_DIR"
mkdir -p "$PID_DIR"
echo -e "${GREEN}✓ PID directory cleaned${NC}"
echo ""

# Step 3: Preserve logs
echo -e "${YELLOW}Step 3: Preserving deployment logs...${NC}"
if [ -d "$LOG_DIR" ]; then
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_DIR="$PROJECT_DIR/logs/rollback-backup-$TIMESTAMP"
    mkdir -p "$BACKUP_DIR"
    cp -r "$LOG_DIR" "$BACKUP_DIR/"
    echo -e "${GREEN}✓ Logs backed up to $BACKUP_DIR${NC}"
else
    echo -e "${YELLOW}! No log directory found${NC}"
fi
echo ""

# Step 4: Health check after rollback
echo -e "${YELLOW}Step 4: Post-rollback health check...${NC}"

ALL_STOPPED=true
for i in $(seq 1 $INSTANCE_COUNT); do
    PORT=$((3101 + i - 1))
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/health" 2>/dev/null || echo "000")
    
    if [ "$HTTP_CODE" = "000" ]; then
        echo -e "${GREEN}  ✓ instance-$i is stopped (no response)${NC}"
    else
        echo -e "${RED}  ✗ instance-$i still responding (HTTP: $HTTP_CODE)${NC}"
        ALL_STOPPED=false
    fi
done

if [ "$ALL_STOPPED" = true ]; then
    echo -e "${GREEN}✓ All instances confirmed stopped${NC}"
else
    echo -e "${YELLOW}! Some instances may still be running${NC}"
fi

echo ""

# Step 5: Summary
echo -e "${GREEN}=== ROLLBACK COMPLETED ===${NC}"
echo ""
echo "Next steps:"
echo "1. Investigate the issue that triggered the rollback"
echo "2. Run post-mortem analysis"
echo "3. Fix the issue and re-deploy"
echo ""
echo "Rollback timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

exit 0
