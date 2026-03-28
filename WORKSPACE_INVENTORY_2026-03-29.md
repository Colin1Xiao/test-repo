# 📦 OpenClaw 工作区完整清单

_最后更新：2026-03-29 04:30_  
_状态：全面检查与整理归类_

---

## 🗂️ 目录结构总览

```
~/.openclaw/workspace/
├── 📋 核心配置文件 (7 个)
├── 🤖 智能交易系统 (2 个版本)
├── 📚 文档库 (docs/)
├── 🔧 脚本工具 (scripts/)
├── 🧠 记忆系统 (memory/)
├── 🛠️ 技能库 (skills/)
├── 🗄️ 归档区 (archive/)
├── 📊 日志系统 (logs/)
├── 🌐 OCNMPS 路由系统
├── 💚 自动愈合系统 (autoheal/)
├── 📈 研究报告 (research/)
├── 🧪 测试套件 (tests/)
├── ⚙️ 配置文件 (config/)
├── 📁 数据目录 (data/)
├── 📑 报告输出 (reports/)
├── 💬 会话记录 (sessions/)
└── ⚡ Superpowers 扩展
```

---

## 📋 一、核心配置文件（工作区根目录）

### 身份与行为准则
| 文件 | 用途 | 状态 |
|------|------|------|
| `SOUL.md` | 小龙的性格与行为准则 | ✅ 活跃 |
| `IDENTITY.md` | AI 助手身份定义 | ✅ 活跃 |
| `USER.md` | 用户档案 (Colin) | ✅ 活跃 |
| `AGENTS.md` | 工作台操作准则 | ✅ 活跃 |
| `HEARTBEAT.md` | 心跳任务与监控策略 | ✅ 活跃 |
| `TOOLS.md` | 本地备忘录与配置 | ✅ 活跃 |
| `MEMORY.md` | 长期精选记忆 | ✅ 活跃 |

### 系统状态与报告
| 文件 | 用途 | 最后更新 |
|------|------|---------|
| `openclaw-health-check.json` | 实时健康状态 | 2026-03-29 |
| `error-budget.json` | 错误预算定义 | 2026-03-19 |
| `meta-system.json` | 元系统配置 | 2026-03-19 |
| `decision-arbiter.json` | 决策仲裁配置 | 2026-03-19 |
| `behavior-guard.json` | 行为护栏配置 | 2026-03-19 |
| `guardian_status.json` | 守护者状态 | 2026-03-12 |

### 历史版本文档（待归档）
- `README.md` - V3/V3.1 旧版说明（已过时）
- `CURRENT_VERSION.md` - 版本说明（需更新）
- `PRODUCTION_STATUS.md` - 生产状态
- `BASELINE_STATUS.md` - 基线状态

---

## 🤖 二、智能交易系统

### V5.4（生产就绪版本）✅
**路径：** `trading_system_v5_4/`  
**状态：** v5.4.0-verified - 生产就绪

**核心文档：**
| 文件 | 用途 |
|------|------|
| `V5_4_ARCHITECTURE.md` | 完整架构文档 (17.6KB) |
| `V5_4_TEST_REPORT.md` | 测试报告 (3.2KB) |
| `PRODUCTION_READINESS_CHECKLIST.md` | 生产验证清单 |
| `RELEASE_NOTES_V5.4.md` | 发布说明 |
| `INTEGRATION_GUIDE.md` / `V54_INTEGRATION_GUIDE.md` | 集成指南 |
| `DEPLOYMENT_STRATEGY.md` | 部署策略 |
| `DEPLOYMENT_LOG.md` | 部署日志 |
| `GRAYSCALE_PHASE2_READY.md` | 灰度 Phase 2 就绪 |
| `SIGNAL_OPTIMIZATION_PLAN.md` | 信号优化计划 |
| `STOPLOSS_DEBUG_CHECKLIST.md` | 止损调试清单 |
| `BACKLOG_V5.4.1.md` | 后续待办 |

**核心代码：**
- `core/` - 核心模块目录
- `config/` - 配置文件
- `logs/` - 运行日志
- `data/` - 数据目录
- `run_gray_phase2.py` - 灰度运行脚本
- `pre_flight_check.py` - 起飞前检查

### V5.3（历史版本）📦
**路径：** `trading_system_v5_3/`  
**状态：** 归档/参考

**主要文档：**
- `V41_4_RELEASE_NOTES.md`
- `V41_FINAL_REPORT.md`
- `PRODUCTION_MODE.md`

---

## 📚 三、文档库 (docs/)

**路径：** `~/.openclaw/workspace/docs/`

### OCNMPS 文档
| 文件 | 大小 | 用途 |
|------|------|------|
| `OCNMPS-DEVELOPMENT-LOG.md` | 21KB | 开发日志 |
| `OCNMPS-PROCESS-SUMMARY.md` | 3.8KB | 流程总结 |
| `OCNMPS-SUMMARY.md` | 8.1KB | 总体总结 |

### 子目录
- `api/` - API 文档
- `architecture/` - 架构文档
- `guides/` - 使用指南
- `reports/` - 报告文档
- `archive/` - 归档文档

---

## 🔧 四、脚本工具 (scripts/)

**路径：** `~/.openclaw/workspace/scripts/`  
**数量：** 22 个脚本

### 系统监控
| 脚本 | 用途 |
|------|------|
| `openclaw-health-check.sh` | 健康检查 |
| `behavior-guard.sh` | 行为守护 |
| `system-overview.sh` | 系统概览 |
| `process_monitor_api.py` | 进程监控 API |

### 恢复与自愈
| 脚本 | 用途 |
|------|------|
| `recovery-controller.sh` | V2.5 恢复控制器 |
| `recovery-controller-v3.sh` | V3.0 智能恢复 |
| `recovery-stats.sh` | 恢复统计 |
| `self-heal-advisor.sh` | 自愈顾问 |
| `predictive-engine.sh` | 预测引擎 |
| `predictive-stats.sh` | 预测统计 |

### 报告与日志
| 脚本 | 用途 |
|------|------|
| `daily-report.sh` | 每日报告 |
| `decision-arbiter.sh` | 决策仲裁 |
| `decision-explainer.sh` | 决策解释 |
| `silent-anomaly-logger.sh` | 静默异常记录 |

### 控制面板
| 脚本 | 用途 |
|------|------|
| `check_panel_access.sh` | 面板访问检查 |
| `control-layer.sh` | 控制层统计 |
| `control-stats.sh` | 控制统计 |

### 测试
- `test-health-check.sh` - 健康检查测试
- `test_all_strategies.py` - 策略测试
- `add_pm_monitor.py` - 监控添加

---

## 🧠 五、记忆系统 (memory/)

**路径：** `~/.openclaw/workspace/memory/`  
**文件数：** 20 个

### 每日记忆
| 文件 | 内容 |
|------|------|
| `2026-03-12.md` | 系统搭建记录 |
| `2026-03-17.md` | Memory Search 配置 |
| `2026-03-18.md` | V5.2 启动 |
| `2026-03-19.md` | 自愈系统完成 |
| `2026-03-20.md` | 运行记录 |
| `2026-03-21.md` | 首笔交易审计 |
| `2026-03-22.md` | V5.4 修复开始 |
| `2026-03-26.md` | V5.4 文档化 |
| `2026-03-27.md` | UI-3.x 完成 |

### 专项任务
| 文件 | 用途 |
|------|------|
| `CAPITAL_READ_PATH_FIX_TASK.md` | 资本读取修复任务 |
| `CAPITAL_READ_FIX_CHECKLIST.md` | 修复检查清单 |
| `phase05_verification.md` | Phase 5 验证 |
| `monitor-data-source-issue.md` | 监控数据源问题 |
| `routing-test-batch5.md` | 路由测试批次 5 |
| `test-results.md` | 测试结果 |
| `badminton_referee_guidance.md` | 羽毛球裁判指南 |

### 状态文件
- `heartbeat-state.json` - 心跳状态追踪

---

## 🛠️ 六、技能库 (skills/)

**路径：** `~/.openclaw/workspace/skills/`  
**数量：** 67 个技能目录

### 核心技能
| 技能 | 用途 |
|------|------|
| `clawhub` | 技能市场 CLI |
| `coding-agent` | 编码代理 |
| `skill-vetter` | 技能审查 |
| `skill-mermaid-diagrams` | Mermaid 图表 |
| `self-improving` | 自我改进 |
| `validate-agent` | 代理验证 |

### 交易相关
| 技能 | 用途 |
|------|------|
| `crypto-data` | 加密货币数据 |
| `crypto-execute` | 交易执行 |
| `crypto-risk` | 风险管理 |
| `crypto-signals` | 信号生成 |
| `crypto-ta` | 技术分析 |

### 工具类
| 技能 | 用途 |
|------|------|
| `browser-automation` | 浏览器自动化 |
| `chart-image` | 图表生成 |
| `file-manager` | 文件管理 |
| `backup` | 备份系统 |
| `broken-link-checker` | 链接检查 |

### 集成类
| 技能 | 用途 |
|------|------|
| `telegram-bot-manager` | Telegram 机器人 |
| `apple-calendar-macos` | 苹果日历 |
| `email-management` | 邮件管理 |
| `notion` | Notion 集成 |
| `slack` | Slack 集成 |

### 文档与报告
| 技能 | 用途 |
|------|------|
| `summarize-pro` | 内容摘要 |
| `markdown-formatter` | Markdown 格式化 |
| `json-render-table` | JSON 表格渲染 |

### 其他技能（部分）
- `agent-browser` - 代理浏览器
- `ai-ppt-generator` - PPT 生成
- `cron-scheduler` - 定时任务
- `daily-digest` - 每日摘要
- `discord` - Discord 集成
- `docker-sandbox` - Docker 沙箱
- `frontend-design-3` - 前端设计
- `gcal-pro` - Google 日历
- `gitload` - GitHub 下载
- `idea-coach` - 创意教练
- `lite-sqlite` - SQLite 数据库
- `mineru-pdf-parser-clawdbot-skill` - PDF 解析
- `multi-search-engine` - 多搜索引擎
- `openclaw-tavily-search` - Tavily 搜索
- `react-best-practices` - React 最佳实践
- `skill-creator` - 技能创建
- `startup-idea-validation` - 创业想法验证
- `ui-ux-pro-max` - UI/UX 设计
- `web-design` - Web 设计
- `webhook` - Webhook 请求
- `weather` - 天气查询

---

## 🗄️ 七、归档区 (archive/)

**路径：** `~/.openclaw/workspace/archive/`

### 归档内容
| 文件/目录 | 用途 |
|----------|------|
| `auto_monitor_fixed.py` | 修复版监控（旧） |
| `auto_monitor_v4-v7.py` | 监控历史版本 |
| `okx_api_client.py` | OKX API 客户端（旧） |
| `old_servers/` | 旧服务器配置 |
| `old_versions_20260314.tar.gz` | 旧版本备份 (17.7MB) |
| `backups/` | 备份目录 |
| `xiaolong_trading_system_analysis.md` | 系统分析（旧） |
| `xiaolong_trading_system_4.0.tar.gz` | V4.0 备份 |

---

## 📊 八、日志系统 (logs/)

**路径：** `~/.openclaw/workspace/logs/`  
**子目录：** 8 个

### 主要日志
| 日志 | 用途 |
|------|------|
| `guardian.log` | 守护者日志 |
| `monitor_alerts.log` | 监控告警 |
| `monitor_live.log` | 实时监控 |
| `ocnmps_routing.log` | OCNMPS 路由日志 |

---

## 🌐 九、OCNMPS 智能路由系统

**路径：** `~/.openclaw/workspace/ocnmps/`

### 核心文件
| 文件 | 用途 |
|------|------|
| `ocnmps_bridge.py` | Python 桥接 (6.7KB) |
| `ocnmps_bridge_v2.py` | V2 桥接 (22KB) |
| `ocnmps_integration.py` | 集成脚本 |
| `ocnmps_integration_config.py` | 灰度配置 |
| `ocnmps_daily_report.py` | 日报生成 |
| `ocnmps_weekly_report.py` | 周报生成 |
| `ocnmps_routing_logger.py` | 路由日志 |
| `ocnmps_validation.py` | 验证脚本 |
| `ocnmps_stats.json` | 统计数据 |

### 备份
- `ocnmps-old-backup/` - 旧版本备份

---

## 💚 十、自动愈合系统 (autoheal/)

**路径：** `~/.openclaw/workspace/autoheal/`  
**状态：** V3.6 收敛阶段

### 核心文件
| 文件 | 用途 |
|------|------|
| `self-heal-db.json` | 自愈数据库 |
| `recovery-strategies.json` | 恢复策略库 |
| `recovery-history.json` | 恢复历史 |
| `recovery-log.json` | 恢复日志 |
| `predictive-log.json` | 预测日志 |
| `error-budget.json` | 错误预算 |
| `silent-anomalies.json` | 静默异常 |

---

## 📈 十一、研究报告 (research/)

**路径：** `~/.openclaw/workspace/research/`

### 交易研究
| 文件 | 用途 |
|------|------|
| `crypto_trading_research.md` | 加密货币交易研究 |
| `CRYPTO_TRADING_SUMMARY.md` | 交易总结 |

---

## 🧪 十二、测试套件 (tests/)

**路径：** `~/.openclaw/workspace/tests/`  
**子目录：** 5 个

### 测试脚本（根目录）
| 文件 | 用途 |
|------|------|
| `test_okx_api.py` | OKX API 测试 |
| `test_okx_volume.py` | OKX 交易量测试 |
| `test_alerting_system.py` | 告警系统测试 |
| `test_risk_control.py` | 风控测试 |
| `test_dragon_system.py` | 小龙系统测试 |
| `test_multi_window_system.py` | 多窗口系统测试 |
| `test_state_machine.py` | 状态机测试 |
| `test_execution_chain.py` | 执行链测试 |

---

## ⚙️ 十三、配置文件 (config/)

**路径：** `~/.openclaw/workspace/config/`  
**子目录：** 7 个

### 主要配置
| 文件 | 用途 |
|------|------|
| `config.template.yaml` | 配置模板 (22KB) |
| `monitor_config.yaml` | 监控配置 |

---

## 📁 十四、数据目录 (data/)

**路径：** `~/.openclaw/workspace/data/`  
**子目录：** 4 个

### 数据文件
| 文件 | 用途 |
|------|------|
| `symbols_history.json` | 交易对历史 (65KB) |
| `top_leverage_symbols.json` | 高杠杆交易对 |
| `suggested_symbols.json` | 推荐交易对 |
| `engine_state.json` | 引擎状态 |
| `system_status.json` | 系统状态 |
| `health_report.json` | 健康报告 |
| `diagnosis_report.json` | 诊断报告 |

---

## 📑 十五、报告输出 (reports/)

**路径：** `~/.openclaw/workspace/reports/`  
**子目录：** 23 个

### 主要报告
| 文件 | 用途 |
|------|------|
| `WORKSPACE_FINAL_REPORT.md` | 工作区最终报告 |
| `WORKSPACE_INVENTORY_REPORT.md` | 工作区清单 |
| `COMPLETE_PROJECT_REPORT.md` | 完整项目报告 |
| `7day_completion_report.md` | 7 天完成报告 |
| `TRADING_WEB_PANELS_REPORT.md` | 交易面板报告 |
| `acceptance_test_final_report.md` | 验收测试报告 |

---

## 💬 十六、会话记录 (sessions/)

**路径：** `~/.openclaw/workspace/sessions/`  
**子目录：** 47 个

用于存储历史会话记录和上下文。

---

## ⚡ 十七、Superpowers 扩展

**路径：** `~/.openclaw/workspace/superpowers/`  
**子目录：** 24 个

扩展功能和增强模块。

---

## 📋 十八、其他重要文件（根目录）

### 交易策略与计划
| 文件 | 用途 |
|------|------|
| `TRADING_PLAN_500_TO_100K.md` | 500 到 100K 交易计划 |
| `1PCT_WAVE_STRATEGY.md` | 1% 波动策略 |
| `1PCT_FUSION_CHECK.md` | 1% 融合检查 |
| `BIDIRECTIONAL_TRADING.md` | 双向交易 |
| `BIDIRECTIONAL_FUSION_CHECK.md` | 双向融合检查 |

### 模型与路由
| 文件 | 用途 |
|------|------|
| `SMART_MODEL_ROUTING.md` | 智能模型路由 |
| `routing_policy_v2.md` | 路由策略 V2 |
| `window_routing_policy.md` | 窗口路由策略 |
| `ALL_MODELS_LIST.md` | 全部模型列表 |
| `AVAILABLE_MODELS.md` | 可用模型 |
| `MODEL_CONFIG_UPDATED.md` | 模型配置更新 |
| `MODEL_SWITCHED_GROK.md` | 切换到 GROK |
| `MODEL_UPDATED_GROK.md` | GROK 更新 |
| `MODEL_UPGRADED.md` | 模型升级 |

### 系统集成
| 文件 | 用途 |
|------|------|
| `INTEGRATED_TRADING_SYSTEM.md` | 集成交易系统 |
| `SYSTEM_FUSION_REPORT.md` | 系统融合报告 |
| `adaptive_strategy.md` | 自适应策略 |
| `ml_prediction_model.md` | ML 预测模型 |
| `sentiment_analysis.md` | 情感分析 |

### 告警与风控
| 文件 | 用途 |
|------|------|
| `alert_rules.md` | 告警规则 |
| `RISK_STRATEGY_CHECK.md` | 风控策略检查 |
| `FAULT_DRILL_RECORD.md` | 故障演练记录 |
| `DAILY_REVIEW_TEMPLATE.md` | 每日复盘模板 |

### 符号与交易对
| 文件 | 用途 |
|------|------|
| `TRADING_SYMBOLS.md` | 交易对列表 |
| `TOP_LEVERAGE_SYMBOLS.md` | 高杠杆交易对 |
| `SYMBOLS_UPDATE_SUMMARY.md` | 交易对更新总结 |

### Telegram 与通知
| 文件 | 用途 |
|------|------|
| `TELEGRAM_CONFIGURED.md` | Telegram 配置完成 |
| `telegram_alert.py` | Telegram 告警脚本 |
| `telegram_alert_bot.py` | Telegram 告警机器人 |

### UI 与设计
| 文件 | 用途 |
|------|------|
| `UI3_LITE_COMPLETE.md` | UI-3 Lite 完成 |
| `UI3_LITE_SCAN.md` | UI-3 Lite 扫描 |
| `ui-tokens-lite.md` | UI Token 定义 |
| `design-system-tokens.md` | 设计系统 Token |

### 审查与验证
| 文件 | 用途 |
|------|------|
| `self-improving-agent-review.md` | 自我改进代理审查 |
| `using-superpowers-review.md` | Superpowers 使用审查 |
| `validate-idea-skills-review.md` | 想法验证技能审查 |

### 运营文档
| 文件 | 用途 |
|------|------|
| `LIVE_TRADING_ACTIVATED.md` | 实盘交易激活 |
| `CRYPTO_TRADING_SYSTEM_DELIVERY.md` | 交易系统交付 |
| `WORKSPACE_CLEANUP_SUMMARY.md` | 工作区清理总结 |
| `skill-install-plan.md` | 技能安装计划 |
| `skill-install-summary.md` | 技能安装总结 |
| `skill-install-summary-batch2.md` | 技能安装总结批次 2 |
| `skill_chain_test_report.md` | 技能链测试报告 |

### 基线与版本
| 文件 | 用途 |
|------|------|
| `CURRENT_VERSION.md` | 当前版本 |
| `BASELINE_STATUS.md` | 基线状态 |
| `BASELINE_stable_20260314.md` | 20260314 基线 |
| `baseline_rc1.md` | RC1 基线 |

### 操作与部署
| 文件 | 用途 |
|------|------|
| `README_OPERATION.md` | 操作说明 |
| `deploy.sh` | 部署脚本 |
| `openclaw-start.sh` | OpenClaw 启动脚本 |
| `start_trading_system.py` | 交易系统启动 |
| `start_24h_trading.py` | 24 小时交易启动 |

### 测试输出
| 文件 | 用途 |
|------|------|
| `test-bar-chart.png` | 柱状图测试 |
| `test-line-chart.png` | 线图测试 |
| `test-pie-chart.png` | 饼图测试 |
| `skill_analysis_report.png` | 技能分析报告图 |

---

## 🗂️ 整理建议

### 高优先级
1. ✅ **更新 README.md** - 当前指向 V3/V3.1，应更新到 V5.4
2. ⚠️ **归档历史版本文档** - 将过时的模型/路由文档移至 archive/
3. ⚠️ **统一文档命名** - 部分文档命名不一致（如 V5_4 vs V5.4）

### 中优先级
4. 📝 **清理重复文件** - 如 `INTEGRATION_GUIDE.md` 和 `V54_INTEGRATION_GUIDE.md`
5. 📝 **整理根目录** - 将临时测试文件移至 tests/ 或 archive/
6. 📝 **更新 CURRENT_VERSION.md** - 反映最新 V5.4 状态

### 低优先级
7. 🗂️ **技能库分类** - 67 个技能可按功能分组
8. 🗂️ **报告目录整理** - reports/ 下 23 个子目录可进一步归类
9. 🗂️ **会话记录归档** - sessions/ 定期清理旧会话

---

## 📊 统计摘要

| 类别 | 数量 |
|------|------|
| 核心配置文件 | 7 |
| 交易系统版本 | 2 |
| 文档库子目录 | 5 |
| 脚本工具 | 22 |
| 记忆文件 | 20 |
| 技能目录 | 67 |
| 日志子目录 | 8 |
| 配置子目录 | 7 |
| 数据子目录 | 4 |
| 报告子目录 | 23 |
| 会话子目录 | 47 |
| Superpowers 子目录 | 24 |
| **总计** | **~250+ 文件/目录** |

---

## ✅ 检查完成

- [x] 核心配置文件审查
- [x] 交易系统文档审查
- [x] 脚本工具清单
- [x] 记忆系统审查
- [x] 技能库清单
- [x] 归档区审查
- [x] 日志系统审查
- [x] OCNMPS 系统审查
- [x] 自动愈合系统审查
- [x] 研究报告审查
- [x] 测试套件审查
- [x] 配置文件审查
- [x] 数据目录审查
- [x] 报告输出审查

---

_小龙整理完成。工作区健康，结构清晰。_ 🐉
