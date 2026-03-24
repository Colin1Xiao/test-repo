# VPS Price Server 部署指南

## ⚠️ 重要：VPS 直连，不需要代理

```
❌ 错误理解：VPS 走你本地 127.0.0.1:7890 代理
✅ 正确理解：VPS 直连 OKX（新加坡/香港 VPS 可直连）
```

## 📋 概述

海外 VPS 部署 WebSocket 价格服务，本地系统通过 HTTP API 获取实时价格。

```
┌─────────────┐
│ OKX WS      │ (实时推送，直连)
└──────┬──────┘
       ↓
┌─────────────┐
│ VPS Server  │ (新加坡/香港，无代理)
│ - WebSocket │
│ - HTTP API  │
└──────┬──────┘
       ↓ (HTTP)
┌─────────────┐
│ 本地系统    │ (执行)
└─────────────┘
```

## 🚀 快速部署

### 0. 部署前检查（重要）

上传 `deploy_check.sh` 到 VPS 并运行：

```bash
chmod +x deploy_check.sh
./deploy_check.sh
```

**必须看到 `✅ WebSocket 连接成功` 才能继续部署。**

### 1. 购买 VPS

**推荐配置**：
- **地区：新加坡（首选）** 或 香港
- 配置：1核 1G 内存 20G 硬盘
- 带宽：1Mbps+（足够）
- 价格：约 $5/月

**为什么选新加坡**：
- 离 OKX 服务器最近
- 延迟最低（< 50ms）
- 可直连，不需要代理

**推荐供应商**：
- AWS Lightsail（新加坡）
- DigitalOcean（新加坡）
- Vultr（新加坡）
- 搬瓦工（CN2 GIA）

### 2. 连接 VPS

```bash
ssh root@your-vps-ip
```

### 3. 安装依赖

```bash
# 更新系统
apt update && apt upgrade -y

# 安装 Python 3
apt install python3 python3-pip -y

# 安装依赖
pip3 install aiohttp requests
```

### 4. 部署服务器

```bash
# 创建目录
mkdir -p /opt/price-server
cd /opt/price-server

# 上传 server.py（使用 scp 或其他方式）
# scp server.py root@your-vps-ip:/opt/price-server/

# 测试运行
python3 server.py
```

### 5. 配置系统服务

创建 `/etc/systemd/system/price-server.service`:

```ini
[Unit]
Description=VPS Price Server
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/price-server/server.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
systemctl daemon-reload
systemctl start price-server
systemctl enable price-server

# 检查状态
systemctl status price-server
```

### 6. 验证服务

```bash
# 健康检查
curl http://localhost:8080/health

# 获取价格
curl http://localhost:8080/price/ETH-USDT-SWAP
```

## 🔧 本地配置

### 1. 安装客户端

将 `client.py` 复制到本地系统：

```bash
cp client.py /path/to/xiaolong_trading_system_4.2/core/market_data/
```

### 2. 修改配置

在 `live_executor.py` 中：

```python
from core.market_data.vps_price_client import get_vps_client

# 初始化
vps_client = get_vps_client("http://your-vps-ip:8080")

# 获取价格
price = vps_client.get_price("ETH-USDT-SWAP")
if price:
    bid, ask, mid = price['bid'], price['ask'], price['mid']
```

## 📊 API 端点

| 端点 | 说明 |
|------|------|
| `GET /price/{symbol}` | 获取单个价格 |
| `GET /prices` | 获取所有价格 |
| `GET /health` | 健康检查 |
| `GET /stats` | 统计信息 |

### 响应示例

```json
// GET /price/ETH-USDT-SWAP
{
  "symbol": "ETH-USDT-SWAP",
  "bid": 2200.5,
  "ask": 2200.6,
  "mid": 2200.55,
  "last": 2200.55,
  "age_ms": 5.2,
  "ts": 1703275200.123
}
```

## 🔒 安全配置

### 防火墙

仅允许本地 IP 访问：

```bash
# 使用 ufw
ufw allow from your-local-ip to any port 8080
ufw enable
```

### HTTPS（可选）

使用 Nginx 反向代理 + Let's Encrypt：

```nginx
server {
    listen 443 ssl;
    server_name price.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://127.0.0.1:8080;
    }
}
```

## 📈 性能指标

- **延迟**：VPS 内部 < 10ms，HTTP 请求 < 50ms
- **可用性**：99.9%（自动重连）
- **并发**：支持多交易对

## 🚨 故障排查

### WebSocket 无法连接

```bash
# 检查网络
curl -I https://www.okx.com

# 检查日志
journalctl -u price-server -f
```

### 本地无法连接 VPS

```bash
# 检查防火墙
ufw status

# 检查服务
systemctl status price-server
```

## 💰 成本

- VPS：约 $5/月
- 流量：< 1GB/月
- 总计：约 $5/月

---

**部署完成后，系统将达到**：
- ✅ 实时价格（< 50ms 延迟）
- ✅ 稳定连接（无网络限制）
- ✅ 可扩展（多交易所支持）