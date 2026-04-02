# OpenClaw 配置汇总

**更新日期**: 2026-04-03

---

## 一、主配置文件

### config.json
```
位置：~/.openclaw/config.json
用途：Gateway/Agents/Channels/Plugins 主配置
关键配置:
- Gateway: 127.0.0.1:18789
- Telegram: 已启用
- Plugins: ocnmps-router-v3, session-state-cache
- Memory Search: 已启用 (本地模型)
```

### openclaw.json
```
位置：~/.openclaw/openclaw.json
用途：用户偏好/Models/Auth 配置
关键配置:
- Models: XAI/ModelStudio 等
- Auth Profiles: OpenAI/ModelStudio
```

### .env
```
位置：~/.openclaw/.env
用途：环境变量（密钥等敏感信息）
```

---

## 二、子系统配置

### OCNMPS 路由
| 配置项 | 值 |
|--------|-----|
| 文件 | `plugins/ocnmps-router/ocnmps_plugin_config.json` |
| 灰度比例 | 5% |
| 启用意图 | CODE, REASON, LONG, CN, FAST, MAIN |
| 模型映射 | CODE→qwen3-coder-next, REASON→grok-4-1-fast-reasoning |

### 交易系统 V5.4
| 配置项 | 值 |
|--------|-----|
| 文件 | `products/trading_v5_3_ref/config/trader_config.json` |
| 交易所 | OKX |
| 杠杆 | 100x |
| 止损 | -0.5% |
| 止盈 | 0.2% |
| Phase | 1 (3 USD) |

### 健康检查
| 配置项 | 值 |
|--------|-----|
| 文件 | `openclaw-health-check.json` |
| 脚本 | `scripts/openclaw-health-check.sh` |
| 频率 | 每次心跳 |

---

## 三、配置备份

### 归档位置
`plugins/ocnmps-router/archive/` — OCNMPS 配置备份

### 备份策略
- 主配置变更时手动备份
- 重大升级前自动备份
- 保留最近 3 个版本

---

## 四、配置变更日志

| 日期 | 变更 | 影响 |
|------|------|------|
| 2026-04-03 | OCNMPS V3 升级 | 插件 ID 改为 ocnmps-router-v3 |
| 2026-04-02 | OpenClaw 升级到 2026.4.1 | 健康检查脚本更新 |
| 2026-03-26 | 交易系统 V5.4 验证完成 | 生产就绪 |

---

**下次审查**: 2026-04-10
