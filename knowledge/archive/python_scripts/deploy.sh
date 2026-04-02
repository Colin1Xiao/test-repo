#!/bin/bash

# =============================================================================
# 预测性智能交易系统 - 部署脚本
# =============================================================================
# 用途：自动化部署交易系统到生产环境
# 支持：Docker Compose (单机) / Kubernetes (集群)
# =============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# =============================================================================
# 配置变量
# =============================================================================

# 部署模式：docker | k8s
DEPLOY_MODE="${DEPLOY_MODE:-docker}"

# 环境：dev | staging | production
ENVIRONMENT="${ENVIRONMENT:-staging}"

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Docker 配置
DOCKER_REGISTRY="${DOCKER_REGISTRY:-trading-system}"
DOCKER_TAG="${DOCKER_TAG:-latest}"

# Kubernetes 配置
K8S_NAMESPACE="${K8S_NAMESPACE:-trading}"
K8S_REPLICAS="${K8S_REPLICAS:-3}"

# 数据库配置
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-trading}"
DB_USER="${DB_USER:-trading}"
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -base64 32)}"

# Redis 配置
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD:-$(openssl rand -base64 32)}"

# InfluxDB 配置
INFLUXDB_HOST="${INFLUXDB_HOST:-localhost}"
INFLUXDB_PORT="${INFLUXDB_PORT:-8086}"
INFLUXDB_TOKEN="${INFLUXDB_TOKEN:-$(openssl rand -base64 32)}"

# API 配置
API_PORT="${API_PORT:-8000}"
API_HOST="${API_HOST:-0.0.0.0}"

# JWT 配置
JWT_SECRET="${JWT_SECRET:-$(openssl rand -base64 64)}"

# =============================================================================
# 前置检查
# =============================================================================

check_prerequisites() {
    log_info "检查前置依赖..."
    
    # 检查 Docker
    if command -v docker &> /dev/null; then
        log_success "Docker 已安装：$(docker --version)"
    else
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    # 检查 Docker Compose
    if command -v docker-compose &> /dev/null; then
        log_success "Docker Compose 已安装：$(docker-compose --version)"
    elif docker compose version &> /dev/null; then
        log_success "Docker Compose 已安装：$(docker compose version)"
    else
        log_error "Docker Compose 未安装"
        exit 1
    fi
    
    # 检查 Kubernetes (如果是 k8s 模式)
    if [ "$DEPLOY_MODE" = "k8s" ]; then
        if command -v kubectl &> /dev/null; then
            log_success "kubectl 已安装：$(kubectl version --client --short 2>/dev/null || kubectl version --client)"
        else
            log_error "kubectl 未安装"
            exit 1
        fi
        
        # 检查集群连接
        if kubectl cluster-info &> /dev/null; then
            log_success "Kubernetes 集群连接正常"
        else
            log_error "无法连接到 Kubernetes 集群"
            exit 1
        fi
    fi
    
    # 检查配置文件
    if [ -f "$PROJECT_ROOT/config.template.yaml" ]; then
        log_success "配置文件模板存在"
    else
        log_warning "配置文件模板不存在，将使用默认配置"
    fi
}

# =============================================================================
# 生成配置文件
# =============================================================================

generate_config() {
    log_info "生成配置文件..."
    
    CONFIG_DIR="$PROJECT_ROOT/config"
    mkdir -p "$CONFIG_DIR"
    
    # 生成 .env 文件
    cat > "$CONFIG_DIR/.env" << EOF
# 环境配置
ENVIRONMENT=$ENVIRONMENT
DEPLOY_MODE=$DEPLOY_MODE

# 数据库配置
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME

# Redis 配置
REDIS_HOST=$REDIS_HOST
REDIS_PORT=$REDIS_PORT
REDIS_PASSWORD=$REDIS_PASSWORD
REDIS_URL=redis://:$REDIS_PASSWORD@$REDIS_HOST:$REDIS_PORT

# InfluxDB 配置
INFLUXDB_HOST=$INFLUXDB_HOST
INFLUXDB_PORT=$INFLUXDB_PORT
INFLUXDB_TOKEN=$INFLUXDB_TOKEN
INFLUXDB_URL=http://$INFLUXDB_HOST:$INFLUXDB_PORT

# API 配置
API_HOST=$API_HOST
API_PORT=$API_PORT

# JWT 配置
JWT_SECRET=$JWT_SECRET
JWT_EXPIRATION=3600

# 日志配置
LOG_LEVEL=INFO
LOG_FORMAT=json

# 监控配置
PROMETHEUS_ENABLED=true
GRAFANA_ENABLED=true

# 交易配置
TRADING_ENABLED=false
AUTO_EXECUTE_ENABLED=false
PAPER_TRADING=true
EOF

    log_success "配置文件已生成：$CONFIG_DIR/.env"
    
    # 生成 config.yaml
    cat > "$CONFIG_DIR/config.yaml" << EOF
# 交易系统配置文件
environment: $ENVIRONMENT

# 数据源配置
data_sources:
  exchanges:
    okx:
      enabled: true
      api_url: https://www.okx.com
      ws_url: wss://ws.okx.com:8443/ws/v5/public
    binance:
      enabled: true
      api_url: https://fapi.binance.com
      ws_url: wss://fstream.binance.com/ws
  
  macro:
    enabled: true
    providers:
      - tradingeconomics
      - forex_factory
  
  sentiment:
    enabled: true
    providers:
      - twitter
      - newsapi
      - alternative_me

# 数据库配置
database:
  postgresql:
    host: $DB_HOST
    port: $DB_PORT
    name: $DB_NAME
    user: $DB_USER
    password: $DB_PASSWORD
    pool_size: 20
    max_overflow: 10
  
  influxdb:
    host: $INFLUXDB_HOST
    port: $INFLUXDB_PORT
    token: $INFLUXDB_TOKEN
    org: trading
    bucket: market_data
  
  redis:
    host: $REDIS_HOST
    port: $REDIS_PORT
    password: $REDIS_PASSWORD
    db: 0

# 分析引擎配置
analysis:
  ml_models:
    price_prediction:
      model_path: ./models/price_prediction_v1.pkl
      update_frequency: daily
    volatility_prediction:
      model_path: ./models/volatility_prediction_v1.pkl
      update_frequency: weekly
    trend_strength:
      model_path: ./models/trend_strength_v1.pkl
      update_frequency: weekly
  
  signal_weights:
    event: 0.25
    ml: 0.30
    sentiment: 0.25
    technical: 0.20
  
  min_confidence: 0.6

# 风险管理配置
risk:
  max_position_size: 0.20
  max_total_exposure: 0.50
  max_leverage: 10
  max_daily_loss: 0.05
  max_drawdown: 0.15
  circuit_breaker_loss: 0.03
  stop_loss_atr_multiplier: 2.5
  take_profit_levels:
    - 1.0
    - 2.0
    - 3.0

# 执行配置
execution:
  default_slippage: 0.001
  max_slippage: 0.005
  order_timeout: 300
  retry_attempts: 3
  smart_routing: true

# 监控配置
monitoring:
  prometheus:
    enabled: true
    port: 9090
  grafana:
    enabled: true
    port: 3000
  alerts:
    email:
      enabled: false
      smtp_host: smtp.gmail.com
      smtp_port: 587
    telegram:
      enabled: false
      bot_token: ""
      chat_id: ""

# 日志配置
logging:
  level: INFO
  format: json
  file: ./logs/trading.log
  max_size: 100
  backup_count: 10
EOF

    log_success "配置文件已生成：$CONFIG_DIR/config.yaml"
}

# =============================================================================
# Docker 部署
# =============================================================================

deploy_docker() {
    log_info "开始 Docker 部署..."
    
    cd "$PROJECT_ROOT"
    
    # 停止现有容器
    log_info "停止现有容器..."
    docker-compose down 2>/dev/null || true
    
    # 构建镜像
    log_info "构建 Docker 镜像..."
    docker-compose build
    
    # 启动服务
    log_info "启动服务..."
    docker-compose up -d
    
    # 等待服务就绪
    log_info "等待服务就绪..."
    sleep 30
    
    # 检查服务状态
    log_info "检查服务状态..."
    docker-compose ps
    
    # 运行数据库迁移
    log_info "运行数据库迁移..."
    docker-compose exec -T trading-service python -m alembic upgrade head 2>/dev/null || log_warning "数据库迁移跳过"
    
    # 初始化数据库
    log_info "初始化数据库..."
    docker-compose exec -T trading-service python -m scripts.init_db 2>/dev/null || log_warning "数据库初始化跳过"
    
    log_success "Docker 部署完成!"
    log_info "访问地址:"
    log_info "  API: http://localhost:$API_PORT"
    log_info "  Grafana: http://localhost:3000 (admin/admin)"
    log_info "  Prometheus: http://localhost:9090"
}

# =============================================================================
# Kubernetes 部署
# =============================================================================

deploy_k8s() {
    log_info "开始 Kubernetes 部署..."
    
    cd "$PROJECT_ROOT/k8s"
    
    # 创建命名空间
    log_info "创建命名空间..."
    kubectl create namespace $K8S_NAMESPACE 2>/dev/null || true
    
    # 应用配置
    log_info "应用配置..."
    kubectl apply -f configmap.yaml -n $K8S_NAMESPACE
    kubectl apply -f secrets.yaml -n $K8S_NAMESPACE
    
    # 部署数据库
    log_info "部署数据库..."
    kubectl apply -f postgres.yaml -n $K8S_NAMESPACE
    kubectl apply -f influxdb.yaml -n $K8S_NAMESPACE
    kubectl apply -f redis.yaml -n $K8S_NAMESPACE
    
    # 等待数据库就绪
    log_info "等待数据库就绪..."
    kubectl wait --for=condition=available deployment/postgres -n $K8S_NAMESPACE --timeout=300s
    kubectl wait --for=condition=available deployment/influxdb -n $K8S_NAMESPACE --timeout=300s
    kubectl wait --for=condition=available deployment/redis -n $K8S_NAMESPACE --timeout=300s
    
    # 部署应用服务
    log_info "部署应用服务..."
    kubectl apply -f trading-service.yaml -n $K8S_NAMESPACE
    kubectl apply -f analysis-service.yaml -n $K8S_NAMESPACE
    kubectl apply -f execution-service.yaml -n $K8S_NAMESPACE
    kubectl apply -f monitoring-service.yaml -n $K8S_NAMESPACE
    
    # 部署 Worker
    log_info "部署 Worker..."
    kubectl apply -f celery-worker.yaml -n $K8S_NAMESPACE
    kubectl apply -f celery-beat.yaml -n $K8S_NAMESPACE
    
    # 部署 API 网关
    log_info "部署 API 网关..."
    kubectl apply -f api-gateway.yaml -n $K8S_NAMESPACE
    
    # 部署监控
    log_info "部署监控..."
    kubectl apply -f prometheus.yaml -n $K8S_NAMESPACE
    kubectl apply -f grafana.yaml -n $K8S_NAMESPACE
    
    # 等待所有服务就绪
    log_info "等待所有服务就绪..."
    kubectl wait --for=condition=available deployment --all -n $K8S_NAMESPACE --timeout=600s
    
    # 获取访问地址
    log_info "获取访问地址..."
    kubectl get ingress -n $K8S_NAMESPACE
    
    log_success "Kubernetes 部署完成!"
}

# =============================================================================
# 健康检查
# =============================================================================

health_check() {
    log_info "执行健康检查..."
    
    # API 健康检查
    log_info "检查 API 服务..."
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:$API_PORT/health | grep -q "200"; then
        log_success "API 服务正常"
    else
        log_error "API 服务异常"
        return 1
    fi
    
    # 数据库连接检查
    log_info "检查数据库连接..."
    if [ "$DEPLOY_MODE" = "docker" ]; then
        docker-compose exec -T postgres pg_isready -U $DB_USER 2>/dev/null && log_success "PostgreSQL 连接正常" || log_error "PostgreSQL 连接失败"
    fi
    
    # Redis 连接检查
    log_info "检查 Redis 连接..."
    if [ "$DEPLOY_MODE" = "docker" ]; then
        docker-compose exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG" && log_success "Redis 连接正常" || log_error "Redis 连接失败"
    fi
    
    # InfluxDB 连接检查
    log_info "检查 InfluxDB 连接..."
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:$INFLUXDB_PORT/health | grep -q "200"; then
        log_success "InfluxDB 连接正常"
    else
        log_warning "InfluxDB 连接检查跳过"
    fi
    
    log_success "健康检查完成!"
}

# =============================================================================
# 日志查看
# =============================================================================

view_logs() {
    SERVICE="${1:-all}"
    
    log_info "查看日志 (服务：$SERVICE)..."
    
    if [ "$DEPLOY_MODE" = "docker" ]; then
        if [ "$SERVICE" = "all" ]; then
            docker-compose logs -f
        else
            docker-compose logs -f "$SERVICE"
        fi
    else
        if [ "$SERVICE" = "all" ]; then
            kubectl logs -f -l app=trading -n $K8S_NAMESPACE
        else
            kubectl logs -f deployment/$SERVICE -n $K8S_NAMESPACE
        fi
    fi
}

# =============================================================================
# 停止服务
# =============================================================================

stop_services() {
    log_info "停止服务..."
    
    if [ "$DEPLOY_MODE" = "docker" ]; then
        docker-compose down
        log_success "Docker 服务已停止"
    else
        kubectl delete namespace $K8S_NAMESPACE
        log_success "Kubernetes 服务已停止"
    fi
}

# =============================================================================
# 清理资源
# =============================================================================

cleanup() {
    log_warning "清理所有资源 (包括数据)..."
    read -p "确定要清理所有资源吗？此操作不可逆! (yes/no): " confirm
    
    if [ "$confirm" = "yes" ]; then
        if [ "$DEPLOY_MODE" = "docker" ]; then
            docker-compose down -v
            docker system prune -f
            log_success "Docker 资源已清理"
        else
            kubectl delete namespace $K8S_NAMESPACE
            log_success "Kubernetes 资源已清理"
        fi
    else
        log_info "清理操作已取消"
    fi
}

# =============================================================================
# 备份数据
# =============================================================================

backup_data() {
    log_info "备份数据..."
    
    BACKUP_DIR="$PROJECT_ROOT/backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    if [ "$DEPLOY_MODE" = "docker" ]; then
        # 备份 PostgreSQL
        log_info "备份 PostgreSQL..."
        docker-compose exec -T postgres pg_dump -U $DB_USER $DB_NAME > "$BACKUP_DIR/postgres.sql"
        
        # 备份 InfluxDB
        log_info "备份 InfluxDB..."
        docker-compose exec -T influxdb influxctl backup --org trading --bucket market_data "$BACKUP_DIR/influxdb" 2>/dev/null || log_warning "InfluxDB 备份跳过"
        
        # 备份 Redis
        log_info "备份 Redis..."
        docker-compose exec -T redis redis-cli BGSAVE 2>/dev/null || log_warning "Redis 备份跳过"
        cp -r ~/.openclaw/workspace/docker/redis-data/* "$BACKUP_DIR/redis/" 2>/dev/null || log_warning "Redis 数据备份跳过"
    else
        log_warning "Kubernetes 备份需要手动执行 kubectl 命令"
    fi
    
    log_success "备份完成：$BACKUP_DIR"
}

# =============================================================================
# 恢复数据
# =============================================================================

restore_data() {
    BACKUP_DIR="$1"
    
    if [ -z "$BACKUP_DIR" ]; then
        log_error "请指定备份目录"
        exit 1
    fi
    
    if [ ! -d "$BACKUP_DIR" ]; then
        log_error "备份目录不存在：$BACKUP_DIR"
        exit 1
    fi
    
    log_info "从备份恢复数据：$BACKUP_DIR"
    
    if [ "$DEPLOY_MODE" = "docker" ]; then
        # 恢复 PostgreSQL
        if [ -f "$BACKUP_DIR/postgres.sql" ]; then
            log_info "恢复 PostgreSQL..."
            cat "$BACKUP_DIR/postgres.sql" | docker-compose exec -T postgres psql -U $DB_USER $DB_NAME
        fi
        
        # 恢复 InfluxDB
        if [ -d "$BACKUP_DIR/influxdb" ]; then
            log_info "恢复 InfluxDB..."
            docker-compose exec -T influxdb influxctl restore --org trading --bucket market_data "$BACKUP_DIR/influxdb" 2>/dev/null || log_warning "InfluxDB 恢复跳过"
        fi
    fi
    
    log_success "数据恢复完成"
}

# =============================================================================
# 显示帮助
# =============================================================================

show_help() {
    cat << EOF
预测性智能交易系统 - 部署脚本

用法：$0 [命令] [选项]

命令:
  deploy          部署系统
  stop            停止服务
  restart         重启服务
  status          查看服务状态
  logs            查看日志
  health          健康检查
  backup          备份数据
  restore         恢复数据
  cleanup         清理资源
  help            显示帮助

选项:
  --mode MODE     部署模式：docker | k8s (默认：docker)
  --env ENV       环境：dev | staging | production (默认：staging)
  --service NAME  指定服务名称 (用于 logs 命令)

示例:
  $0 deploy --mode docker --env production
  $0 logs --service trading-service
  $0 backup
  $0 restore ./backups/20260311_120000

环境变量:
  DEPLOY_MODE     部署模式
  ENVIRONMENT     环境
  DB_PASSWORD     数据库密码
  REDIS_PASSWORD  Redis 密码
  JWT_SECRET      JWT 密钥

EOF
}

# =============================================================================
# 主函数
# =============================================================================

main() {
    COMMAND="${1:-help}"
    shift || true
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --mode)
                DEPLOY_MODE="$2"
                shift 2
                ;;
            --env)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --service)
                SERVICE="$2"
                shift 2
                ;;
            *)
                log_error "未知选项：$1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 执行命令
    case $COMMAND in
        deploy)
            check_prerequisites
            generate_config
            if [ "$DEPLOY_MODE" = "k8s" ]; then
                deploy_k8s
            else
                deploy_docker
            fi
            health_check
            ;;
        stop)
            stop_services
            ;;
        restart)
            stop_services
            sleep 5
            if [ "$DEPLOY_MODE" = "k8s" ]; then
                deploy_k8s
            else
                deploy_docker
            fi
            ;;
        status)
            if [ "$DEPLOY_MODE" = "docker" ]; then
                docker-compose ps
            else
                kubectl get all -n $K8S_NAMESPACE
            fi
            ;;
        logs)
            view_logs "${SERVICE:-all}"
            ;;
        health)
            health_check
            ;;
        backup)
            backup_data
            ;;
        restore)
            restore_data "$1"
            ;;
        cleanup)
            cleanup
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知命令：$COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"
