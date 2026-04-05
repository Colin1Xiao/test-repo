#!/bin/bash
# Phase 4.x Runtime - Local Production Deployment (3 instances)
# Gray 10% Deployment (Native Node.js, no Docker)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs/deploy"
PID_DIR="$PROJECT_DIR/pids"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Phase 4.x Runtime - Gray 10% Local Deployment   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Configuration
GRAY_RATIO="0.1"
INSTANCE_COUNT=3
BASE_PORT=3101
HEALTH_CHECK_RETRIES=10
HEALTH_CHECK_INTERVAL=3

# Step 0: Prepare directories
echo -e "${YELLOW}=== Step 0: Preparing Directories ===${NC}"
mkdir -p "$LOG_DIR"
mkdir -p "$PID_DIR"
mkdir -p "$PROJECT_DIR/data/shared"
mkdir -p "$PROJECT_DIR/data/instance-1"
mkdir -p "$PROJECT_DIR/data/instance-2"
mkdir -p "$PROJECT_DIR/data/instance-3"
echo -e "${GREEN}✓ Directories created${NC}"
echo ""

# Step 1: Build
echo -e "${YELLOW}=== Step 1: Building Runtime ===${NC}"
cd "$PROJECT_DIR"
npm run build
echo -e "${GREEN}✓ Build completed${NC}"
echo ""

# Step 2: Stop existing instances
echo -e "${YELLOW}=== Step 2: Stopping Existing Instances ===${NC}"
for i in $(seq 1 $INSTANCE_COUNT); do
    PID_FILE="$PID_DIR/instance-$i.pid"
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID" 2>/dev/null || true
            echo -e "${YELLOW}  Stopped instance-$i (PID: $PID)${NC}"
        fi
        rm -f "$PID_FILE"
    fi
done
echo -e "${GREEN}✓ Existing instances stopped${NC}"
echo ""

# Step 3: Start instances
echo -e "${YELLOW}=== Step 3: Starting 3 Instances ===${NC}"

for i in $(seq 1 $INSTANCE_COUNT); do
    PORT=$((BASE_PORT + i - 1))
    INSTANCE_ID="instance-$i"
    INSTANCE_NAME="runtime-local-$i"
    LOG_FILE="$LOG_DIR/instance-$i.log"
    PID_FILE="$PID_DIR/instance-$i.pid"
    
    echo -e "${BLUE}Starting $INSTANCE_NAME on port $PORT...${NC}"
    
    # Start instance
    NODE_ENV=production \
    INSTANCE_ID="$INSTANCE_ID" \
    INSTANCE_NAME="$INSTANCE_NAME" \
    PORT=$PORT \
    SHARED_DATA_DIR="$PROJECT_DIR/data/shared" \
    INSTANCE_DATA_DIR="$PROJECT_DIR/data/instance-$i" \
    GRAY_RATIO=$GRAY_RATIO \
    FEATURE_FLAGS_STALE_CLEANUP_ENABLED=true \
    FEATURE_FLAGS_AUTO_HEARTBEAT_ENABLED=true \
    FEATURE_FLAGS_METRICS_ENABLED=true \
    FEATURE_FLAGS_DIAGNOSTICS_ENABLED=true \
    node dist/server.js > "$LOG_FILE" 2>&1 &
    
    PID=$!
    echo $PID > "$PID_FILE"
    echo -e "${GREEN}  ✓ $INSTANCE_NAME started (PID: $PID, Port: $PORT)${NC}"
done

echo ""
echo -e "${GREEN}✓ All $INSTANCE_COUNT instances started${NC}"
echo ""

# Step 4: Wait for instances to be healthy
echo -e "${YELLOW}=== Step 4: Health Check ===${NC}"

for i in $(seq 1 $INSTANCE_COUNT); do
    PORT=$((BASE_PORT + i - 1))
    INSTANCE_NAME="instance-$i"
    echo -e "${BLUE}Checking $INSTANCE_NAME (port $PORT)...${NC}"
    
    for retry in $(seq 1 $HEALTH_CHECK_RETRIES); do
        HTTP_CODE=$(NO_PROXY=localhost curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/health" 2>/dev/null || echo "000")
        
        if [ "$HTTP_CODE" = "200" ]; then
            echo -e "${GREEN}  ✓ $INSTANCE_NAME is healthy${NC}"
            break
        else
            if [ $retry -eq $HEALTH_CHECK_RETRIES ]; then
                echo -e "${RED}  ✗ $INSTANCE_NAME health check failed (HTTP: $HTTP_CODE)${NC}"
                echo -e "${YELLOW}  Last 10 log lines:${NC}"
                tail -10 "$LOG_FILE" 2>/dev/null || true
                exit 1
            fi
            sleep $HEALTH_CHECK_INTERVAL
        fi
    done
done

echo ""

# Step 5: Verify cluster status
echo -e "${YELLOW}=== Step 5: Cluster Status ===${NC}"
echo ""
echo -e "${BLUE}Instance Status:${NC}"

for i in $(seq 1 $INSTANCE_COUNT); do
    PORT=$((BASE_PORT + i - 1))
    PID_FILE="$PID_DIR/instance-$i.pid"
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo -e "  ${GREEN}✓${NC} instance-$i: PID $PID, Port $PORT [Running]"
        else
            echo -e "  ${RED}✗${NC} instance-$i: PID $PID [Dead]"
            exit 1
        fi
    fi
done

echo ""
echo -e "${BLUE}Health Endpoints:${NC}"
for i in $(seq 1 $INSTANCE_COUNT); do
    PORT=$((BASE_PORT + i - 1))
    echo "  instance-$i: http://localhost:$PORT/health"
done

echo ""
echo -e "${BLUE}Metrics Endpoints:${NC}"
for i in $(seq 1 $INSTANCE_COUNT); do
    PORT=$((BASE_PORT + i - 1))
    echo "  instance-$i: http://localhost:$PORT/metrics"
done

echo ""

# Step 6: Verify shared storage
echo -e "${YELLOW}=== Step 6: Shared Storage Verification ===${NC}"

if [ -d "$PROJECT_DIR/data/shared" ]; then
    echo -e "${GREEN}✓ Shared storage directory exists${NC}"
    
    # Check subdirectories
    for dir in leases items suppression; do
        if [ -d "$PROJECT_DIR/data/shared/$dir" ]; then
            echo -e "${GREEN}  ✓ $dir/ directory exists${NC}"
        else
            mkdir -p "$PROJECT_DIR/data/shared/$dir"
            echo -e "${YELLOW}  Created $dir/ directory${NC}"
        fi
    done
else
    echo -e "${RED}✗ Shared storage directory not found${NC}"
    exit 1
fi

echo ""

# Step 7: Quick health check
echo -e "${YELLOW}=== Step 7: Quick Health Check ===${NC}"

for i in $(seq 1 $INSTANCE_COUNT); do
    PORT=$((BASE_PORT + i - 1))
    echo -e "${BLUE}instance-$i health:${NC}"
    NO_PROXY=localhost curl -s "http://localhost:$PORT/health" 2>/dev/null | head -c 200 || echo "Failed"
    echo ""
done

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Local Deployment Completed Successfully!        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Deployment Summary:${NC}"
echo "  Gray Ratio: $GRAY_RATIO (10%)"
echo "  Instances: $INSTANCE_COUNT"
echo "  Ports: $BASE_PORT - $((BASE_PORT + INSTANCE_COUNT - 1))"
echo "  Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Verify health: curl http://localhost:3101/health"
echo "  2. Check metrics: curl http://localhost:3101/metrics"
echo "  3. Run rollback drill: ./scripts/rollback-local.sh"
echo "  4. Schedule Gate 1 meeting"
echo ""

exit 0
