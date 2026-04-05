#!/bin/bash
# Phase 4.x Runtime - Production Deployment Script
# Gray 10% Deployment (3 instances)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Phase 4.x Runtime - Gray 10% Deployment         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Configuration
GRAY_RATIO="0.1"
INSTANCE_COUNT=3
HEALTH_CHECK_RETRIES=5
HEALTH_CHECK_INTERVAL=10

# Step 1: Pre-deployment checks
echo -e "${YELLOW}=== Step 1: Pre-deployment Checks ===${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is available${NC}"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose is available${NC}"

# Check Node.js build
if [ ! -d "$PROJECT_DIR/dist" ]; then
    echo -e "${YELLOW}Building runtime...${NC}"
    cd "$PROJECT_DIR"
    npm run build
    echo -e "${GREEN}✓ Build completed${NC}"
else
    echo -e "${GREEN}✓ Build artifacts found${NC}"
fi
echo ""

# Step 2: Create data directories
echo -e "${YELLOW}=== Step 2: Creating Data Directories ===${NC}"
mkdir -p "$PROJECT_DIR/data/shared"
mkdir -p "$PROJECT_DIR/data/instance-1"
mkdir -p "$PROJECT_DIR/data/instance-2"
mkdir -p "$PROJECT_DIR/data/instance-3"
mkdir -p "$PROJECT_DIR/data/prometheus"
mkdir -p "$PROJECT_DIR/data/grafana"
echo -e "${GREEN}✓ Data directories created${NC}"
echo ""

# Step 3: Stop existing instances (if any)
echo -e "${YELLOW}=== Step 3: Stopping Existing Instances ===${NC}"
cd "$PROJECT_DIR"
docker-compose -f docker-compose.prod.yml stop 2>/dev/null || true
echo -e "${GREEN}✓ Existing instances stopped${NC}"
echo ""

# Step 4: Start new instances
echo -e "${YELLOW}=== Step 4: Starting Production Cluster ===${NC}"
docker-compose -f docker-compose.prod.yml up -d
echo -e "${GREEN}✓ All services started${NC}"
echo ""

# Step 5: Wait for instances to be healthy
echo -e "${YELLOW}=== Step 5: Health Check ===${NC}"
for i in $(seq 1 $INSTANCE_COUNT); do
    PORT=$((3000 + i))
    echo -e "${BLUE}Checking instance-$i (port $PORT)...${NC}"
    
    for retry in $(seq 1 $HEALTH_CHECK_RETRIES); do
        if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/health" | grep -q "200"; then
            echo -e "${GREEN}  ✓ Instance-$i is healthy${NC}"
            break
        else
            if [ $retry -eq $HEALTH_CHECK_RETRIES ]; then
                echo -e "${RED}  ✗ Instance-$i health check failed after $HEALTH_CHECK_RETRIES retries${NC}"
                exit 1
            fi
            echo -e "${YELLOW}  Waiting ${HEALTH_CHECK_INTERVAL}s for retry...${NC}"
            sleep $HEALTH_CHECK_INTERVAL
        fi
    done
done
echo ""

# Step 6: Verify cluster status
echo -e "${YELLOW}=== Step 6: Cluster Status ===${NC}"
echo ""
echo -e "${BLUE}Instance Status:${NC}"
docker-compose -f docker-compose.prod.yml ps
echo ""

echo -e "${BLUE}Health Endpoints:${NC}"
for i in $(seq 1 $INSTANCE_COUNT); do
    PORT=$((3000 + i))
    echo "  Instance-$i: http://localhost:$PORT/health"
done
echo ""

echo -e "${BLUE}Metrics Endpoints:${NC}"
for i in $(seq 1 $INSTANCE_COUNT); do
    PORT=$((3000 + i))
    echo "  Instance-$i: http://localhost:$PORT/metrics"
done
echo ""

echo -e "${BLUE}Monitoring:${NC}"
echo "  Prometheus: http://localhost:9090"
echo "  Grafana: http://localhost:3000 (admin/admin123)"
echo ""

# Step 7: Post-deployment verification
echo -e "${YELLOW}=== Step 7: Post-deployment Verification ===${NC}"

# Check all instances are running
RUNNING_COUNT=$(docker-compose -f docker-compose.prod.yml ps | grep -c "runtime-instance" || true)
if [ "$RUNNING_COUNT" -eq "$INSTANCE_COUNT" ]; then
    echo -e "${GREEN}✓ All $INSTANCE_COUNT instances are running${NC}"
else
    echo -e "${RED}✗ Expected $INSTANCE_COUNT instances, found $RUNNING_COUNT${NC}"
    exit 1
fi

# Check shared storage
if [ -d "$PROJECT_DIR/data/shared" ]; then
    echo -e "${GREEN}✓ Shared storage is accessible${NC}"
else
    echo -e "${RED}✗ Shared storage is not accessible${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Deployment Completed Successfully!              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Deployment Summary:${NC}"
echo "  Gray Ratio: $GRAY_RATIO (10%)"
echo "  Instances: $INSTANCE_COUNT"
echo "  Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Verify metrics in Prometheus: http://localhost:9090"
echo "  2. Configure Grafana dashboards: http://localhost:3000"
echo "  3. Run rollback drill: ./scripts/rollback.sh"
echo "  4. Schedule Gate 1 meeting"
echo ""

exit 0
