# OpenClaw 系统索引

**更新日期**: 2026-04-03  
**版本**: 1.0

---

## 一、核心系统

### 1.1 OpenClaw Gateway
| 项目 | 值 |
|------|-----|
| 位置 | `/usr/local/lib/node_modules/openclaw/` |
| 版本 | 2026.4.1 |
| 端口 | 18789 |
| 状态 | 🟢 运行中 |
| 配置 | `~/.openclaw/config.json` |

### 1.2 OCNMPS 智能路由系统
| 项目 | 值 |
|------|-----|
| 位置 | `~/.openclaw/plugins/ocnmps-router/` |
| 版本 | V3 (2026-04-03 升级) |
| 核心 | `ocnmps_core.js` (8.1KB) |
| 灰度 | 5% |
| 状态 | 🟢 已部署 |
| 功能 | 意图识别 + 模型路由 + 验证 + 审计 |

### 1.3 Memory Search 系统
| 项目 | 值 |
|------|-----|
| 位置 | `~/.openclaw/memory/` |
| 模型 | `embeddinggemma-300M-Q8_0.gguf` |
| 后端 | 本地向量检索 |
| 状态 | 🟢 已启用 |

---

## 二、业务系统

### 2.1 小龙智能交易系统 V5.4
| 项目 | 值 |
|------|-----|
| 位置 | `~/.openclaw/workspace/products/trading_v5_3_ref/` |
| 版本 | V5.4.0-verified |
| 状态 | 🟢 生产就绪 |
| 杠杆 | 100x |
| 交易所 | OKX |
| 配置 | `config/trader_config.json` |
| 日志 | `logs/state_store.json`, `logs/live_state.json` |

### 2.2 M3 Helix 驾驶舱
| 项目 | 值 |
|------|-----|
| 位置 | `~/.openclaw/workspace/products/helix_m3/` |
| 状态 | 🟡 开发中 |
| 端口 | 8000 |
| 功能 | FastAPI + WebSocket 实时监控 |

---

## 三、插件系统

### 已安装插件
| 插件 | 位置 | 状态 |
|------|------|------|
| ocnmps-router-v3 | `plugins/ocnmps-router/` | 🟢 V3 |
| session-state-cache | `plugins/session-state-cache/` | 🟢 运行中 |

### 隔离区插件
| 插件 | 位置 | 状态 | 原因 |
|------|------|------|------|
| repo-analyzer | `quarantine/repo-analyzer.*` | 🔴 隔离 | 命令注入风险 |

---

## 四、技能系统

### 已安装 Skills
| 位置 | 数量 |
|------|------|
| `~/.openclaw/skills/` | 36+ |
| `~/.openclaw/workspace/skills/` | 20+ |

### 核心 Skills
- clawhub
- coding-agent
- skill-vetter
- healthcheck
- weather
- ...

---

## 五、文档系统

### 核心文档
| 文档 | 位置 |
|------|------|
| SOUL.md | `~/.openclaw/workspace/SOUL.md` |
| USER.md | `~/.openclaw/workspace/USER.md` |
| MEMORY.md | `~/.openclaw/workspace/MEMORY.md` |
| AGENTS.md | `~/.openclaw/workspace/AGENTS.md` |
| TOOLS.md | `~/.openclaw/workspace/TOOLS.md` |
| HEARTBEAT.md | `~/.openclaw/workspace/HEARTBEAT.md` |

### 项目文档
| 文档 | 位置 |
|------|------|
| 系统索引 | `~/.openclaw/workspace/SYSTEMS_INDEX.md` |
| OCNMPS 报告 | `~/.openclaw/workspace/core/ocnmps/OCNMPS_V2_REPORT.md` |
| 里程碑报告 | `~/.openclaw/workspace/core/MILESTONE_REPORT.md` |
| 运行手册 | `~/.openclaw/workspace/core/RUNBOOK.md` |
| 策略文档 | `~/.openclaw/workspace/core/POLICY.md` |

---

## 六、配置系统

### 主配置
| 文件 | 用途 |
|------|------|
| `config.json` | Gateway/Agents/Channels/Plugins |
| `openclaw.json` | 用户偏好/Models/Auth |
| `.env` | 环境变量 |

### 子系统配置
| 系统 | 配置文件 |
|------|---------|
| OCNMPS | `plugins/ocnmps-router/ocnmps_plugin_config.json` |
| 交易系统 | `products/trading_v5_3_ref/config/trader_config.json` |
| 健康检查 | `openclaw-health-check.json` |

---

## 七、日志系统

### 核心日志
| 日志 | 位置 |
|------|------|
| Gateway | `~/.openclaw/cron/runs/` |
| OCNMPS | `plugins/ocnmps-router/ocnmps_v3.log` |
| 健康检查 | `openclaw-health-check.json` |

### 业务日志
| 日志 | 位置 |
|------|------|
| 交易日志 | `products/trading_v5_3_ref/logs/` |
| 执行审批 | `exec-approvals.json` |

---

## 八、备份与归档

### 归档目录
| 目录 | 内容 |
|------|------|
| `knowledge/archive/backups/` | 旧版本备份 |
| `archive/` | 历史数据 |

### 最近归档
- `ocnmps-python-v2/` — OCNMPS V2 Python 版
- `ocnmps-old-backup/` — OCNMPS 旧备份

---

## 九、清理建议

### 可删除目录
- [ ] `workspace/ocnmps/` (已删除)
- [ ] `extensions/ocnmps-router/` (已删除)
- [ ] 过期的 `.bak` 和 `.backup` 文件

### 可整理文件
- [ ] 合并多个 `ocnmps_plugin_config.json.bak.*`
- [ ] 清理 `exec-approvals.json` 旧记录

---

**下次审查**: 2026-04-10
