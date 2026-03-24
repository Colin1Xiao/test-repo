# 🌐 小龙 Control Tower V5.3 - 公网访问信息

## 当前访问地址

| 类型 | 地址 |
|------|------|
| **公网 (ngrok)** | https://unpersonal-currently-amberly.ngrok-free.dev/ |
| 本地 | http://localhost:8780/ |

## 生成时间

2026-03-20 13:19

## 功能模块

顶部导航切换：
- 📊 主面板
- 🧬 演化引擎
- 📊 市场结构
- 🎯 决策追踪
- 🎮 控制中心

## 启动命令

```bash
# 启动服务器
cd /Users/colin/.openclaw/workspace/xiaolong_trading/v53
python3 integrated_server.py 8780

# 启动 ngrok
~/.local/bin/ngrok http 8780
```

## 核心文件

| 文件 | 说明 |
|------|------|
| `integrated_server.py` | 统一服务器 |
| `state_store.py` | 状态存储 |
| `control_flags.py` | 权重推进 |
| `PANELS.md` | 功能说明 |

---

**注意**: ngrok 免费版 URL 每次启动会变化，需要重新获取。