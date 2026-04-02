# 🚀 Helix 交易驾驶舱

加密货币量化交易系统的驾驶舱 API 服务，基于 FastAPI 构建。

## ✨ 功能特性

- **实时监控** - 系统状态、市场数据、持仓信息
- **事件驱动** - WebSocket 实时推送
- **管理控制** - 策略控制、风险控制、系统管理
- **RESTful API** - 标准化的 API 接口
- **健康检查** - 全面的系统健康监控

## 🏗️ 架构

```
helix_crypto_trading_platform/
├── app/                    # FastAPI 应用
│   ├── main.py            # 应用入口
│   ├── core/              # 核心模块
│   │   ├── config.py      # 配置管理
│   │   ├── logger.py      # 日志配置
│   │   └── events.py      # 事件总线
│   ├── api/               # API 路由
│   │   └── v1/            # API v1
│   │       ├── endpoints/ # 端点实现
│   │       └── __init__.py
│   ├── schemas/           # 数据模型
│   ├── services/          # 业务逻辑
│   └── ws/                # WebSocket 模块
├── scripts/               # 脚本工具
├── tests/                 # 测试
├── data/                  # 数据存储
├── logs/                  # 日志文件
├── requirements.txt       # Python 依赖
└── Dockerfile            # 容器配置
```

## 🚀 快速开始

### 1. 环境准备

```bash
# 克隆项目
git clone <repository-url>
cd helix_crypto_trading_platform

# 创建虚拟环境
python3.14 -m venv .venv
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 2. 启动服务

```bash
# 使用启动脚本
chmod +x scripts/start_cockpit.sh
./scripts/start_cockpit.sh

# 或直接启动
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. 访问服务

- **API 文档**: http://localhost:8000/docs
- **健康检查**: http://localhost:8000/health
- **系统状态**: http://localhost:8000/api/v1/system/status
- **WebSocket**: ws://localhost:8000/ws

## 📡 API 端点

### 健康检查
- `GET /health` - 基础健康检查
- `GET /health/detailed` - 详细健康检查

### 系统状态
- `GET /api/v1/system/status` - 系统整体状态
- `GET /api/v1/system/info` - 系统信息
- `GET /api/v1/system/services` - 服务状态
- `GET /api/v1/system/metrics` - 系统指标

### 市场数据 (开发中)
- `GET /api/v1/market/overview` - 市场概览
- `GET /api/v1/market/tickers` - 行情数据

### 持仓管理 (开发中)
- `GET /api/v1/positions` - 持仓列表
- `GET /api/v1/positions/{id}` - 持仓详情

### 订单管理 (开发中)
- `GET /api/v1/orders/active` - 活动订单
- `GET /api/v1/orders/{id}` - 订单详情

### 策略管理 (开发中)
- `GET /api/v1/strategies` - 策略列表
- `GET /api/v1/strategies/{id}` - 策略详情

## 🔧 配置

### 环境变量

```bash
# 服务器配置
HOST=0.0.0.0
PORT=8000
LOG_LEVEL=INFO

# CORS 配置
CORS_ORIGINS=["http://localhost:3000"]

# 数据库 (预留)
DATABASE_URL=postgresql://user:pass@localhost/dbname

# M2 验证
M2_PAPER_MODE=true
M2_LIVE_VALIDATION=false
```

### 配置文件

- `.env` - 环境变量文件
- `app/core/config.py` - 配置类定义

## 🧪 测试

```bash
# 运行测试
pytest tests/

# 带覆盖率
pytest --cov=app tests/

# 代码检查
ruff check app/
black --check app/
mypy app/
```

## 📦 容器化部署

```bash
# 构建镜像
docker build -t helix-cockpit:latest .

# 运行容器
docker run -d \
  -p 8000:8000 \
  --name helix-cockpit \
  -e LOG_LEVEL=INFO \
  helix-cockpit:latest
```

## 🔌 集成

### 现有 cockpit widgets

```python
# 示例: 集成现有 cockpit 组件
from app.services.cockpit_integration import CockpitIntegration

cockpit = CockpitIntegration()
status = cockpit.get_system_status()
```

### WebSocket 事件

```javascript
// 前端 WebSocket 连接
const ws = new WebSocket('ws://localhost:8000/ws');

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('事件:', data);
};
```

## 📈 监控

- **日志**: `logs/helix_cockpit.log`
- **指标**: `/api/v1/system/metrics`
- **健康检查**: `/health/detailed`

## 🛠️ 开发

### 添加新端点

1. 在 `app/api/v1/endpoints/` 创建新模块
2. 定义路由和业务逻辑
3. 在 `app/api/v1/__init__.py` 注册路由
4. 添加测试用例

### 添加新数据模型

1. 在 `app/schemas/` 创建 Pydantic 模型
2. 定义字段和验证规则
3. 在端点中使用

## 📄 许可证

MIT License

## 🤝 贡献

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 创建 Pull Request

## 📞 支持

- 问题: GitHub Issues
- 讨论: GitHub Discussions
- 文档: `/docs` 端点