# 🐉 小龙 Control Tower v3 - 公网部署指南

## 快速开始

### 1. 本地访问（已启动）

```bash
# 服务器已在运行
open http://localhost:8767/control-tower
```

**当前状态**: ✅ 运行中
- 本地: http://localhost:8767/control-tower
- API: http://localhost:8767/api/system/status

---

## 公网访问方案

### 方案 A: ngrok（推荐，最简单）

**步骤 1**: 安装 ngrok
```bash
brew install ngrok
# 或下载: https://ngrok.com/download
```

**步骤 2**: 配置 token
```bash
ngrok config add-authtoken YOUR_TOKEN
```

**步骤 3**: 启动隧道
```bash
cd /Users/colin/.openclaw/workspace/xiaolong_trading/v53
ngrok http 8767
```

**步骤 4**: 获取公网地址
```
Forwarding  https://xxxx.ngrok-free.app -> http://localhost:8767
```

访问: `https://xxxx.ngrok-free.app/control-tower`

---

### 方案 B: Cloudflare Tunnel（免费，固定域名）

**步骤 1**: 安装 cloudflared
```bash
brew install cloudflared
```

**步骤 2**: 登录 Cloudflare
```bash
cloudflared tunnel login
```

**步骤 3**: 创建隧道
```bash
cloudflared tunnel create control-tower
```

**步骤 4**: 配置路由
```bash
cloudflared tunnel route dns control-tower your-domain.your-site.com
```

**步骤 5**: 启动
```bash
cloudflared tunnel run control-tower --url http://localhost:8767
```

---

### 方案 C: frp（自有服务器）

**frps.ini** (服务器端)
```ini
[common]
bind_port = 7000
token = your_token
```

**frpc.ini** (本地)
```ini
[common]
server_addr = your-server-ip
server_port = 7000
token = your_token

[control-tower]
type = http
local_port = 8767
custom_domains = control-tower.your-domain.com
```

启动:
```bash
./frpc -c frpc.ini
```

---

## API 文档

### 系统状态
```bash
curl http://localhost:8767/api/system/status
```

响应:
```json
{
  "timestamp": "2026-03-19T22:38:16.073576",
  "version": "5.2.0",
  "mode": "shadow",
  "stats": {
    "errors": 0,
    "p50": 1039,
    "p90": 1343,
    "status": "HEALTHY"
  },
  "audit": {
    "profit_factor": 1.48,
    "expectancy": 0.0438,
    "drawdown": 0.006,
    "slippage_ratio": 58.9,
    "slippage_source": "ENTRY"
  },
  "diff": {
    "total": 0,
    "diff_rate": "0%",
    "recommendation": "NO_DATA",
    "distribution": {}
  },
  "risk": {
    "level": "LOW",
    "circuit": "NORMAL",
    "capital": "NORMAL"
  }
}
```

### 其他端点
- `/api/stats` - 执行统计
- `/api/audit` - 收益审计
- `/api/decision_diff` - 决策差异
- `/api/decision_diff/recent` - 最近决策
- `/api/risk` - 风险状态
- `/api/mode` - 当前模式
- `/ws` - WebSocket 实时推送

---

## 管理命令

```bash
# 启动
./start_control_tower.sh local

# 停止
./start_control_tower.sh stop

# 状态
./start_control_tower.sh status

# ngrok 公网
./start_control_tower.sh ngrok

# Cloudflare 公网
./start_control_tower.sh cloudflare
```

---

## 安全建议

1. **基本认证**: 使用 ngrok 或 nginx 添加密码保护
2. **HTTPS**: 优先使用 Cloudflare Tunnel 或 ngrok 的 HTTPS
3. **IP 限制**: 配置防火墙只允许特定 IP
4. **Token 保护**: 不要把 ngrok/cloudflare token 提交到 git

---

## 故障排查

### 端口被占用
```bash
# 查找占用 8767 的进程
lsof -i :8767

# 或杀掉所有 Python 服务器
pkill -f "python.*control_tower"
```

### 无法访问
```bash
# 检查服务器状态
./start_control_tower.sh status

# 查看日志
tail -f logs/control_tower.log

# 测试 API
curl http://localhost:8767/api/system/status
```

### 数据不更新
- 检查 V5.2 系统是否在运行
- 检查 logs/decision_diff/ 目录是否有新数据
- 重启服务器: `./start_control_tower.sh stop && ./start_control_tower.sh local`

---

## 架构图

```
┌─────────────────────────────────────────────────────────┐
│                     公网用户                              │
│              (手机/平板/电脑浏览器)                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              ngrok / Cloudflare / frp                   │
│                   (公网隧道)                              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│           Control Tower Server (port 8767)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Web UI     │  │   REST API   │  │  WebSocket   │  │
│  │  (实时面板)   │  │  (数据接口)   │  │  (实时推送)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              小龙交易系统 V5.2                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ 决策中心  │ │ 收益审计  │ │ 风控系统  │ │ 执行引擎  │  │
│  │ Decision │ │  Profit  │ │   Risk   │ │ Execution│  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 更新日志

### v3.0 (2026-03-20)
- ✅ 公网服务器支持
- ✅ WebSocket 实时推送
- ✅ REST API 完整开放
- ✅ ngrok/Cloudflare/frp 多方案支持
- ✅ CORS 跨域支持

---

**当前状态**: 🟢 运行中
**版本**: 5.2.0
**端口**: 8767
