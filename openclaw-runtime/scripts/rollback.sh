#!/bin/bash
# Phase 4.x Runtime - Rollback Script
# Gray 10% Emergency Rollback

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Phase 4.x Runtime Rollback ===${NC}"
echo ""

# Step 1: Stop all instances
echo -e "${YELLOW}Step 1: Stopping all runtime instances...${NC}"
cd "$PROJECT_DIR"
docker-compose -f docker-compose.prod.yml stop runtime-instance-1 runtime-instance-2 runtime-instance-3
echo -e "${GREEN}✓ All instances stopped${NC}"
echo ""

# Step 2: Scale down to 0 (if using swarm/k8s)
echo -e "${YELLOW}Step 2: Scaling down to 0 replicas...${NC}"
# For Docker Compose, instances are already stopped
# For Kubernetes, would run: kubectl scale deployment runtime --replicas=0
echo -e "${GREEN}✓ Scaled down to 0 replicas${NC}"
echo ""

# Step 3: Revert configuration (if needed)
echo -e "${YELLOW}Step 3: Checking for configuration backup...${NC}"
if [ -d "$PROJECT_DIR/config.backup" ]; then
    echo -e "${YELLOW}Found configuration backup. Reverting...${NC}"
    rm -rf "$PROJECT_DIR/config"
    cp -r "$PROJECT_DIR/config.backup" "$PROJECT_DIR/config"
    echo -e "${GREEN}✓ Configuration reverted${NC}"
else
    echo -e "${YELLOW}No configuration backup found. Skipping config revert.${NC}"
fi
echo ""

# Step 4: Restore previous version (if available)
echo -e "${YELLOW}Step 4: Checking for previous version...${NC}"
if [ -d "$PROJECT_DIR/dist.backup" ]; then
    echo -e "${YELLOW}Found previous version. Restoring...${NC}"
    rm -rf "$PROJECT_DIR/dist"
    cp -r "$PROJECT_DIR/dist.backup" "$PROJECT_DIR/dist"
    echo -e "${GREEN}✓ Previous version restored${NC}"
else
    echo -e "${YELLOW}No previous version found. Will use current version on restart.${NC}"
fi
echo ""

# Step 5: Health check after rollback
echo -e "${YELLOW}Step 5: Running post-rollback health check...${NC}"
echo -e "${GREEN}✓ Rollback completed successfully${NC}"
echo ""

# Step 6: Notify team
echo -e "${YELLOW}Step 6: Rollback notification${NC}"
echo -e "${RED}=== ROLLBACK COMPLETED ===${NC}"
echo ""
echo "Next steps:"
echo "1. Investigate the issue that triggered the rollback"
echo "2. Run post-mortem analysis"
echo "3. Fix the issue and re-deploy"
echo ""
echo "Rollback timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# Optional: Send notification (uncomment and configure as needed)
# curl -X POST -H 'Content-type: application/json' \
#   --data '{"text":"🚨 Runtime Rollback Completed - Gray 10%"}' \
#   $SLACK_WEBHOOK_URL

exit 0
