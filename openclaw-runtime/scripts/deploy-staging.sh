#!/bin/bash
# Staging 环境部署脚本
# Phase 3A-4: Multi-instance Verification

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAGING_BASE="/tmp/openclaw-staging"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

echo "=== OpenClaw Staging 环境部署 ==="
echo ""

# 清理旧环境
echo "1. 清理旧环境..."
rm -rf "$STAGING_BASE"
mkdir -p "$STAGING_BASE"/{instance-1,instance-2,instance-3}/data
mkdir -p "$STAGING_BASE"/{instance-1,instance-2,instance-3}/audit
echo "  ✓ 目录创建完成"

# 检查 Redis
echo ""
echo "2. 检查 Redis 连接..."
if ! redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping > /dev/null 2>&1; then
    echo "  ✗ Redis 不可达 ($REDIS_HOST:$REDIS_PORT)"
    exit 1
fi
echo "  ✓ Redis 连接成功 ($REDIS_HOST:$REDIS_PORT)"

# 清理 staging key
echo ""
echo "3. 清理 staging Redis key..."
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" KEYS "staging:*" | xargs -r redis-cli DEL
echo "  ✓ Redis 清理完成"

# 创建环境配置
echo ""
echo "4. 创建实例配置..."

for i in 1 2 3; do
    cat > "$STAGING_BASE/instance-$i/.env" << EOF
NODE_ENV=staging
INSTANCE_ID=instance-$i
PORT=$((3000 + i - 1))
HOST=localhost
REDIS_HOST=$REDIS_HOST
REDIS_PORT=$REDIS_PORT
REDIS_KEY_PREFIX=staging:
PERSISTENCE_PATH=$STAGING_BASE/instance-$i/data
AUDIT_LOG_PATH=$STAGING_BASE/instance-$i/audit
ENABLE_DISTRIBUTED_LOCK=true
ENABLE_IDEMPOTENCY=true
ENABLE_REPLAY=true
ENABLE_RECOVERY_SCAN=true
STRICT_COORDINATION_REQUIRED=false
FALLBACK_ON_REDIS_DOWN=allow
LOG_LEVEL=debug
LOG_FORMAT=pretty
EOF
    echo "  ✓ instance-$i 配置创建完成"
done

# 启动实例
echo ""
echo "5. 启动实例..."

for i in 1 2; do
    echo "  启动 instance-$i (端口 $((3000 + i - 1)))..."
    cd "$STAGING_BASE/instance-$i"
    
    # 后台启动（模拟）
    nohup node "$SCRIPT_DIR/../dist/index.js" > "$STAGING_BASE/instance-$i/startup.log" 2>&1 &
    echo $! > "$STAGING_BASE/instance-$i/pid"
    
    sleep 2
    
    if kill -0 $(cat "$STAGING_BASE/instance-$i/pid") 2>/dev/null; then
        echo "    ✓ instance-$i 启动成功 (PID: $(cat "$STAGING_BASE/instance-$i/pid"))"
    else
        echo "    ✗ instance-$i 启动失败"
        cat "$STAGING_BASE/instance-$i/startup.log"
    fi
done

# 健康检查
echo ""
echo "6. 健康检查..."

for i in 1 2; do
    PORT=$((3000 + i - 1))
    echo -n "  检查 instance-$i (端口 $PORT)... "
    
    HEALTH=$(curl -s "http://localhost:$PORT/health" 2>/dev/null || echo '{"status": "failed"}')
    STATUS=$(echo "$HEALTH" | grep -o '"status"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
    
    if [ "$STATUS" = "healthy" ]; then
        echo "✓ 健康"
    else
        echo "✗ 不健康 ($STATUS)"
    fi
done

# 输出摘要
echo ""
echo "=== 部署完成 ==="
echo ""
echo "实例信息:"
echo "  instance-1: http://localhost:3000"
echo "  instance-2: http://localhost:3001"
echo ""
echo "Redis: $REDIS_HOST:$REDIS_PORT (prefix: staging:)"
echo ""
echo "停止命令:"
echo "  kill \$(cat $STAGING_BASE/instance-1/pid)"
echo "  kill \$(cat $STAGING_BASE/instance-2/pid)"
echo ""
