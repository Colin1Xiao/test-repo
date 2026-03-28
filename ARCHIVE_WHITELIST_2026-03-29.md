# 📦 归档白名单 (Archive Whitelist)

_最后更新：2026-03-29_  
_目的：明确可安全归档的历史文档，避免误删正在引用的文件_

---

## 🎯 归档原则

**三不归档**：
1. ❌ 正在被 README.md 引用的文件
2. ❌ 正在被脚本/代码引用的文件
3. ❌ 当前运行系统依赖的文件

**可以归档**：
1. ✅ 纯历史记录，无实际引用
2. ✅ 已被新版本替代的旧版文档
3. ✅ 临时性报告，已完成历史使命

---

## ✅ 白名单：可安全归档

### 第一组：V3/V3.1 历史文档（已过时）

| 文件 | 大小 | 说明 | 归档优先级 |
|------|------|------|-----------|
| `COMPLETE_PROJECT_REPORT.md` | 10.7KB | V3/V3.1 完整项目报告 | 🟢 高 |
| `CURRENT_VERSION.md` | 2.5KB | 当前版本说明（内容是 V3） | 🟢 高 |
| `BASELINE_STATUS.md` | 2.2KB | 基线状态（V3） | 🟢 高 |
| `BASELINE_stable_20260314.md` | 1.1KB | 20260314 基线 | 🟢 高 |
| `DAILY_REVIEW_TEMPLATE.md` | 3.2KB | V3 每日复盘表 | 🟡 中 |
| `FAULT_DRILL_RECORD.md` | 4.8KB | V3 故障演练记录 | 🟡 中 |
| `simulation_run_log.md` | 0.6KB | V3 模拟盘运行日志 | 🟡 中 |

**归档理由**：
- 内容全部指向 V3/V3.1，与当前 V5.4 无关
- README.md 已更新为 V5.4，不再引用这些文档
- 仅具历史参考价值

**归档路径**：`archive/v3_docs/`

---

### 第二组：旧版操作文档

| 文件 | 大小 | 说明 | 归档优先级 |
|------|------|------|-----------|
| `README_OPERATION.md` | 1.8KB | 旧版操作说明 | 🟡 中 |
| `WORKSPACE_FINAL_REPORT.md` | 8.1KB | 工作区最终报告（旧） | 🟡 中 |
| `WORKSPACE_INVENTORY_REPORT.md` | 6.4KB | 工作区清单（已被新清单替代） | 🟡 中 |
| `WORKSPACE_CLEANUP_SUMMARY.md` | 1.5KB | 清理总结 | 🟡 中 |

**归档理由**：
- 已被新文档替代（如 `WORKSPACE_INVENTORY_2026-03-29.md`）
- 内容过时，可能误导

**归档路径**：`archive/operation_docs/`

---

### 第三组：旧模型与路由文档

| 文件 | 大小 | 说明 | 归档优先级 |
|------|------|------|-----------|
| `ALL_MODELS_LIST.md` | 5.8KB | 全部模型列表（可能过时） | 🟡 中 |
| `AVAILABLE_MODELS.md` | 5.2KB | 可用模型 | 🟡 中 |
| `MODEL_CONFIG_UPDATED.md` | 3.2KB | 模型配置更新 | 🟡 中 |
| `MODEL_SWITCHED_GROK.md` | 2.8KB | 切换到 GROK | 🟡 中 |
| `MODEL_UPDATED_GROK.md` | 3.5KB | GROK 更新 | 🟡 中 |
| `MODEL_UPGRADED.md` | 2.9KB | 模型升级 | 🟡 中 |
| `SMART_MODEL_ROUTING.md` | 10KB | 智能模型路由 | 🟡 中 |
| `routing_policy_v2.md` | 4.4KB | 路由策略 V2 | 🟡 中 |
| `window_routing_policy.md` | 6.7KB | 窗口路由策略 | 🟡 中 |
| `session_schema.md` | 6.8KB | 会话 schema | 🟡 中 |

**注意**：需先检查 OCNMPS 系统是否仍引用这些文档。

**归档路径**：`archive/model_routing_docs/`

---

### 第四组：旧策略与研究

| 文件 | 大小 | 说明 | 归档优先级 |
|------|------|------|-----------|
| `TRADING_PLAN_500_TO_100K.md` | 8.2KB | 500 到 100K 交易计划 | 🟢 高 |
| `1PCT_WAVE_STRATEGY.md` | 10.5KB | 1% 波动策略 | 🟡 中 |
| `1PCT_FUSION_CHECK.md` | 7KB | 1% 融合检查 | 🟡 中 |
| `BIDIRECTIONAL_TRADING.md` | 10.3KB | 双向交易 | 🟡 中 |
| `BIDIRECTIONAL_FUSION_CHECK.md` | 6.7KB | 双向融合检查 | 🟡 中 |
| `adaptive_strategy.md` | 11.2KB | 自适应策略 | 🟡 中 |
| `ml_prediction_model.md` | 18KB | ML 预测模型 | 🟡 中 |
| `sentiment_analysis.md` | 16KB | 情感分析 | 🟡 中 |

**说明**：这些是策略研究文档，虽不直接使用，但有参考价值。建议保留但归档。

**归档路径**：`archive/strategy_research/`

---

### 第五组：旧系统集成文档

| 文件 | 大小 | 说明 | 归档优先级 |
|------|------|------|-----------|
| `INTEGRATED_TRADING_SYSTEM.md` | 16KB | 集成交易系统 | 🟡 中 |
| `SYSTEM_FUSION_REPORT.md` | 11.6KB | 系统融合报告 | 🟡 中 |
| `AUTO_MONITOR_SYSTEM.md` | 19KB | 自动监控系统 | 🟡 中 |
| `CRYPTO_TRADING_SYSTEM_DELIVERY.md` | 12KB | 交易系统交付 | 🟡 中 |
| `LIVE_TRADING_ACTIVATED.md` | 4.9KB | 实盘交易激活 | 🟡 中 |
| `PRODUCTION_STATUS.md` | 2.5KB | 生产状态 | 🟡 中 |

**说明**：这些是 V3-V4 时期的系统集成文档，已被 V5.4 文档替代。

**归档路径**：`archive/system_integration/`

---

### 第六组：旧 UI 文档

| 文件 | 大小 | 说明 | 归档优先级 |
|------|------|------|-----------|
| `UI3_LITE_COMPLETE.md` | 5.4KB | UI-3 Lite 完成 | 🟡 中 |
| `UI3_LITE_SCAN.md` | 7.1KB | UI-3 Lite 扫描 | 🟡 中 |
| `ui-tokens-lite.md` | 10.4KB | UI Token 定义 | 🟡 中 |
| `design-system-tokens.md` | 4.7KB | 设计系统 Token | 🟡 中 |

**说明**：UI-3.x 已完成到 UI-3.9/3.10，这些是中间版本文档。

**归档路径**：`archive/ui_docs/`

---

### 第七组：临时报告与测试

| 文件 | 大小 | 说明 | 归档优先级 |
|------|------|------|-----------|
| `7day_completion_report.md` | 4.2KB | 7 天完成报告 | 🟢 高 |
| `7day_execution_plan.md` | 4KB | 7 天执行计划 | 🟢 高 |
| `acceptance_test_final_report.md` | 5KB | 验收测试报告 | 🟡 中 |
| `acceptance_test_results.md` | 4.6KB | 验收测试结果 | 🟡 中 |
| `skill-install-plan.md` | 2.5KB | 技能安装计划 | 🟢 高 |
| `skill-install-summary.md` | 2.7KB | 技能安装总结 | 🟢 高 |
| `skill-install-summary-batch2.md` | 3.3KB | 技能安装总结批次 2 | 🟢 高 |
| `skill_chain_test_report.md` | 1.4KB | 技能链测试报告 | 🟢 高 |

**说明**：一次性任务报告，已完成历史使命。

**归档路径**：`archive/temp_reports/`

---

### 第八组：旧配置与检查

| 文件 | 大小 | 说明 | 归档优先级 |
|------|------|------|-----------|
| `RISK_STRATEGY_CHECK.md` | 9.6KB | 风控策略检查 | 🟡 中 |
| `alert_rules.md` | 4.6KB | 告警规则 | 🟡 中 |
| `SYMBOLS_UPDATE_SUMMARY.md` | 3.3KB | 交易对更新总结 | 🟢 高 |
| `TOP_LEVERAGE_SYMBOLS.md` | 5.1KB | 高杠杆交易对 | 🟡 中 |
| `TRADING_SYMBOLS.md` | 4.6KB | 交易对列表 | 🟡 中 |
| `TELEGRAM_CONFIGURED.md` | 2.7KB | Telegram 配置完成 | 🟢 高 |

**说明**：配置检查文档，已完成。

**归档路径**：`archive/config_checks/`

---

### 第九组：旧测试输出

| 文件 | 大小 | 类型 | 归档优先级 |
|------|------|------|-----------|
| `test-bar-chart.png` | 13.5KB | 图片 | 🟢 高 |
| `test-line-chart.png` | 10.3KB | 图片 | 🟢 高 |
| `test-pie-chart.png` | 16.5KB | 图片 | 🟢 高 |
| `skill_analysis_report.png` | 201KB | 图片 | 🟢 高 |

**说明**：临时测试输出，无长期价值。

**归档路径**：`archive/test_outputs/`

---

## ⚠️ 灰名单：需进一步检查

### 需检查引用后再决定

| 文件 | 检查项 | 建议 |
|------|--------|------|
| `fallback_matrix.md` | 检查是否被 fallback_handler.py 引用 | 如引用则保留 |
| `runbook.md` | 检查是否被运维脚本引用 | 如引用则保留 |
| `session_schema.md` | 检查 OCNMPS 是否引用 | 如引用则保留 |
| `multi_window_*.md` | 检查多窗口系统是否仍在使用 | 如使用则保留 |

**检查方法**：
```bash
grep -r "fallback_matrix" ~/.openclaw/workspace/*.py
grep -r "runbook" ~/.openclaw/workspace/*.sh
grep -r "session_schema" ~/.openclaw/workspace/ocnmps/
```

---

## ❌ 黑名单：禁止归档

### 当前活跃文件

| 文件 | 原因 |
|------|------|
| `SOUL.md` | 核心身份定义 |
| `IDENTITY.md` | AI 助手身份 |
| `USER.md` | 用户档案 |
| `AGENTS.md` | 工作台准则 |
| `HEARTBEAT.md` | 心跳任务 |
| `TOOLS.md` | 本地备忘录 |
| `MEMORY.md` | 长期记忆 |
| `README.md` | 刚更新的主文档 |
| `WORKSPACE_INVENTORY_2026-03-29.md` | 最新工作区清单 |
| `docs/NAMING_CONVENTIONS.md` | 刚创建的命名规范 |

### 当前运行依赖

| 路径 | 原因 |
|------|------|
| `trading_system_v5_3/` | 运行目录，包含所有运行时资产 |
| `trading_system_v5_4/` | V5.4 版本文档 |
| `ocnmps/` | OCNMPS 路由系统 |
| `autoheal/` | 自动愈合系统 |
| `scripts/` | 运维脚本 |
| `memory/` | 记忆系统 |
| `skills/` | 技能库 |
| `logs/` | 运行日志 |

---

## 📋 执行计划

### 阶段 1：立即执行（今天）
- [x] 更新 README.md
- [x] 创建命名规范
- [x] 创建归档白名单
- [ ] 创建归档目录结构
- [ ] 移动第一组（V3/V3.1 文档）

### 阶段 2：检查后执行（明天）
- [ ] 检查灰名单文件引用
- [ ] 移动第二至第九组
- [ ] 更新引用（如有）

### 阶段 3：清理（后天）
- [ ] 验证归档后系统正常
- [ ] 清理空目录
- [ ] 更新 git 历史

---

## 🔧 归档脚本

```bash
#!/bin/bash
# archive_v3_docs.sh

ARCHIVE_DIR="~/.openclaw/workspace/archive"
V3_DOCS=(
    "COMPLETE_PROJECT_REPORT.md"
    "CURRENT_VERSION.md"
    "BASELINE_STATUS.md"
    "BASELINE_stable_20260314.md"
    "DAILY_REVIEW_TEMPLATE.md"
    "FAULT_DRILL_RECORD.md"
    "simulation_run_log.md"
)

# 创建归档目录
mkdir -p "$ARCHIVE_DIR/v3_docs"

# 移动文件
for doc in "${V3_DOCS[@]}"; do
    if [ -f "$doc" ]; then
        echo "Archiving: $doc"
        mv "$doc" "$ARCHIVE_DIR/v3_docs/"
    fi
done

echo "Archive complete!"
```

---

## ✅ 验证清单

归档后验证：
- [ ] README.md 不再指向归档文件
- [ ] 脚本不再引用归档文件
- [ ] 运行系统正常
- [ ] 归档目录结构清晰
- [ ] git 提交记录完整

---

_归档是为了更好的组织，不是删除历史。所有归档文件都可追溯。_
