# 🐉 小龙 Control Tower v3

**V5.2 实时数据监控面板 | 公网访问版**

---

## 🚀 快速开始

### 本地访问（已就绪）
```bash
open http://localhost:8766/control-tower
```

### 公网访问（3种方案）

#### 方案 1: ngrok（最简单）
```bash
./start-public.sh ngrok
```

#### 方案 2: Cloudflare Tunnel（免费固定域名）
```bash
./start-public.sh cloudflare
```

#### 方案 3: frp（自有服务器）
```bash
# 配置 frpc.ini 后
./frpc -c frpc.ini
```

---

## 📊 功能特性

| 功能 | 状态 | 说明 |
|------|------|------|
| 🎯 实时裁决 | ✅ | SAFE/WARN/BLOCK 自动判定 |
| 📈 收益审计 | ✅ | Profit Factor, Expectancy, Drawdown |
| ⚡ 执行监控 | ✅ | Latency P50/P90, Error Rate |
| ⚖️ 决策差异 | ✅ | V5.2 vs V5.3 Shadow 对比 |
| 🛡️ 风控状态 | ✅ | AI Risk, Circuit, Capital |
| 🔔 WebSocket | ✅ | 实时数据推送 |
| 🌐 REST API | ✅ | 完整数据接口 |
| 📱 移动适配 | ✅ | 响应式设计 |

---

## 📡 API 端点

```bash
# 完整系统状态
curl http://localhost:8766/api/system/status

# 执行统计
curl http://localhost:8766/api/stats

# 收益审计
curl http://localhost:8766/api/audit

# 决策差异
curl http://localhost:8766/api/decision_diff

# 最近决策
curl http://localhost:8766/api/decision_diff/recent

# 风险状态
curl http://localhost:8766/api/risk
```

---

## 🎛️ 管理命令

```bash
# 查看状态
./start_control_tower.sh status

# 停止服务器
./start_control_tower.sh stop

# 重新启动
./start_control_tower.sh local
```

---

## 🔐 安全建议

1. **使用 HTTPS**: ngrok 和 Cloudflare 自动提供 HTTPS
2. **添加认证**: 在 ngrok.yml 中配置 basic_auth
3. **限制访问**: 配置防火墙规则
4. **定期更新**: 保持 token 和密钥安全

---

## 📁 文件结构

```
v53/
├── control_tower_server.py      # 主服务器
├── start_control_tower.sh       # 管理脚本
├── start-public.sh              # 一键公网启动
├── ngrok-control-tower.yml      # ngrok 配置
├── DEPLOY.md                    # 完整部署文档
├── README-ControlTower.md       # 本文件
└── logs/
    ├── control_tower.log        # 服务器日志
    └── decision_diff/           # 决策对比数据
```

---

## 🌐 访问地址

| 环境 | URL |
|------|-----|
| 本地 | http://localhost:8767/control-tower |
| 局域网 | http://192.168.1.65:8767/control-tower |
| ngrok | https://xxxx.ngrok-free.app/control-tower |
| Cloudflare | https://your-domain.your-site.com/control-tower |

---

## 📊 当前状态

```json
{
  "status": "🟢 RUNNING",
  "version": "5.2.0",
  "port": 8767,
  "mode": "shadow",
  "data_source": "V5.2 Live"
}
```

---

**更新时间**: 2026-03-20 06:44
**作者**: 小龙
