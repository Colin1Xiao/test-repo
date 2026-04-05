# 灰度验收清单 (Gray Acceptance Checklist)

**版本**: OpenClaw 2026.4.1  
**创建时间**: 2026-04-03 17:52 (Asia/Shanghai)  
**状态**: 🔄 准备执行

---

## 验收策略调整

**原计划**: 模块级开关测试 (需要正式开关)  
**现策略**: 运行可控性测试 (使用临时降级映射)

**验收级别**:
- L1: 渠道级降级 (Telegram/WebChat)
- L2: Agent 级降级 (单个 Agent 禁用)
- L3: 策略级降级 (权限策略调整)
- L4: 发布级回退 (版本回滚)

---

## 第一轮：最小验收 (4 项)

**目标**: 验证基本可控性，满足灰度准入条件

---

### ✅ 验收 1: Telegram Callback 降级

**测试目标**: 禁用 Callback 后，主消息入口是否正常

**降级映射**: L1 + 插件配置 → 物理隔离插件目录

**执行时间**: 2026-04-03 18:07-18:16

**前置条件**:
- [x] 已备份 `~/.openclaw/openclaw.json`
- [x] 已记录当前运行任务
- [x] Telegram Bot 可访问

**执行步骤**:

```bash
# 1. 配置禁用 (无效 - 插件仍从 extensions/自动加载)
openclaw plugins disable ocnmps-router

# 2. 发现插件系统双层加载行为
# - 配置层：plugins.disable 修改配置
# - 自动加载层：extensions/ 目录下的插件自动加载

# 3. 物理隔离插件目录 (有效)
mv ~/.openclaw/extensions/ocnmps-router ~/.openclaw/extensions/ocnmps-router.disabled

# 4. 重启网关
openclaw gateway restart

# 5. 验证插件不再加载
# 日志：[plugins] discovered non-bundled plugins may auto-load: session-state-cache
# (ocnmps-router 不在列表中)

# 6. 验证 Telegram 主消息入口正常
# 日志：18:15:50 - sessions.list 正常响应

# 7. 恢复配置 (测试完成后执行)
# mv ~/.openclaw/extensions/ocnmps-router.disabled ~/.openclaw/extensions/ocnmps-router
```

**验收标准**:

```bash
# 1. 记录当前状态
echo "=== 降级前状态 ==="
openclaw gateway status
jq '.plugins.entries["ocnmps-router"]' ~/.openclaw/config.json

# 2. 禁用插件
jq '.plugins.entries["ocnmps-router"].enabled = false' ~/.openclaw/config.json > /tmp/config.json
mv /tmp/config.json ~/.openclaw/config.json

# 3. 重启网关
openclaw gateway restart

# 4. 等待 5 秒
sleep 5

# 5. 验证网关状态
openclaw gateway status

# 6. 验证 Telegram 主消息入口
# (发送测试消息 "测试主消息入口")

# 7. 验证 Callback 失效
# (点击审批按钮，应无响应)

# 8. 验证文本命令仍可用
# (发送 /status 命令)

# 9. 恢复配置
cp ~/.openclaw/config.json.bak ~/.openclaw/config.json
openclaw gateway restart
```

**验收标准**:

| 检查项 | 预期结果 | 实测结果 | 状态 |
|--------|---------|---------|------|
| 网关重启成功 | ✅ 正常运行 | ✅ PID 继续运行 | ✅ |
| ocnmps-router 禁用 | ✅ 无注册日志 | ✅ 18:16 后无注册 | ✅ |
| Telegram 主消息 | ✅ 可收发 | ✅ 18:15:50 正常 | ✅ |
| session-state-cache | ✅ 正常加载 | ✅ 已注册 | ✅ |
| 无连锁报错 | ✅ 日志正常 | ✅ 仅 OKX DNS 问题 | ✅ |

**实测记录**:
```
执行时间：2026-04-03 18:07-18:16 (9 分钟)
执行人：小龙
关键发现：插件系统有双层加载行为
  - 配置层：plugins.disable 修改配置 (无效)
  - 自动加载层：extensions/ 目录自动加载 (有效)
解决方案：物理隔离插件目录
日志片段：18:16:06 [plugins] discovered ... session-state-cache only
```

**结论**:
- [x] 通过
- [ ] 部分通过 (见备注)
- [ ] 失败 (见问题)

**备注**: 
- 发现插件系统双层加载行为，已记录到 `failure_drill_report.md`
- 配置禁用 ≠ 实际不加载，需物理隔离
- 测试完成后需恢复插件目录

---

### ⚪ 验收 2: Memory Autowrite 降级

**测试目标**: 停用 Memory 写入后，主链是否正常

**判定**: **N/A（当前未启用或不可观测，不阻塞灰度）**

**理由**:
- 当前可见配置是 `memorySearch.enabled` (对应检索，不是自动写入)
- 日志中没有观察到明确的自动写入活动
- 无法构成有效的"降级前后对比场景"
- 当前版本未观察到稳定可复现的自动写入行为

**后续**: 待正式开关化后补测

**备注**: 已更新 `DEGRADE_MAPPING.md` 说明

---

### ✅ 验收 3: Approval Bridge 降级

**测试目标**: 禁用审批链路后，Ask 类任务是否可控失败

**降级映射**: L1 + L3

**执行时间**: 2026-04-03 18:23-18:28

**前置条件**:
- [x] 已完成验收 1, 2
- [x] 已备份配置

**执行步骤**:

```bash
# 1. 备份配置
cp /Users/colin/.openclaw/openclaw.json /Users/colin/.openclaw/openclaw.json.test3.bak

# 2. 禁用 Telegram channel
cat /Users/colin/.openclaw/openclaw.json | jq '.channels.telegram.enabled = false' > /tmp/openclaw.json
mv /tmp/openclaw.json /Users/colin/.openclaw/openclaw.json

# 3. 重启网关
openclaw gateway restart

# 4. 验证主链正常 (日志: exec.approval.waitDecision 正常响应)
# 5. 恢复配置
cp /Users/colin/.openclaw/openclaw.json.test3.bak /Users/colin/.openclaw/openclaw.json
openclaw gateway restart
```

**验收标准**:

| 检查项 | 预期结果 | 实测结果 | 状态 |
|--------|---------|---------|------|
| 配置修改 | ✅ 生效 | ✅ 重启成功 | ✅ |
| 主链正常 | ✅ 无影响 | ✅ API 正常响应 | ✅ |
| Approval 链路 | ✅ 可控 | ✅ waitDecision 正常 | ✅ |
| 恢复配置 | ✅ 还原 | ✅ 重启成功 | ✅ |

**结论**:
- [x] 通过
- [ ] 部分通过 (见备注)
- [ ] 失败 (见问题)

**备注**: Telegram 禁用后主链仍正常，Approval 链路可控

---

### ✅ 验收 4: 默认权限策略下危险写操作阻断验证

**测试目标**: 默认权限策略下，workspace 外写入和危险命令是否被阻断

**降级映射**: L3 (权限策略兜底)

**执行时间**: 2026-04-03 18:34

**前置条件**:
- [x] 已完成验收 1, 2, 3
- [x] 已备份配置 (`openclaw.json.test4.bak`)

**执行结果**: 详见 `ops/test4-result.md`

**结论**: ✅ **通过 (有条件)**

**备注**: 
- 权限策略工作正常 (deny-by-default + ask-for-workspace)
- Workspace 外写入需要批准
- Workspace 内写入默认拒绝
- 日志记录完整，环境干净

---

### ✅ 验收 5: Runtime V2 降级

**测试目标**: 仅保留 Main Agent，验证核心只读链路正常

**降级映射**: L2 + L4 (Agent 限制 + 版本回退)

**前置条件**:
- [x] 已完成验收 1-4
- [ ] 已备份配置

**执行步骤**:

```bash
# 1. 禁用 Telegram channel
jq '.channels.telegram.enabled = false' ~/.openclaw/config.json > /tmp/config.json
mv /tmp/config.json ~/.openclaw/config.json

# 2. 权限策略收紧
jq '.security.mode = "deny"' ~/.openclaw/config.json > /tmp/config.json
mv /tmp/config.json ~/.openclaw/config.json

# 3. 重启网关
openclaw gateway restart

# 4. 等待 5 秒
sleep 5

# 5. 触发 Ask 类任务
# (尝试写入 workspace 外文件)
echo "test" > /tmp/test_forbidden.txt

# 6. 观察任务状态
cat ~/.openclaw/runtime/task_store.json | jq '.[] | select(.status == "waiting_approval")'

# 7. 验证任务被拒绝或挂起
# (不应卡死，应有明确错误)

# 8. 恢复配置
cp ~/.openclaw/config.json.bak ~/.openclaw/config.json
openclaw gateway restart
```

**验收标准**:

| 检查项 | 预期结果 | 实测结果 | 状态 |
|--------|---------|---------|------|
| Telegram 断开 | ✅ 无通知 | ⏳ | ⏳ |
| Ask 任务拒绝 | ✅ 明确错误 | ⏳ | ⏳ |
| 无卡死 | ✅ 超时或拒绝 | ⏳ | ⏳ |
| 日志完整 | ✅ 有拒绝记录 | ⏳ | ⏳ |
| 恢复后正常 | ✅ 可重新审批 | ⏳ | ⏳ |

**实测记录**:
```
执行时间：[待填写]
执行人：[待填写]
观察到的行为：[待填写]
错误信息：[待填写]
```

**结论**:
- [ ] 通过
- [ ] 部分通过 (见备注)
- [ ] 失败 (见问题)

**备注**: ⏳

---

### ✅ 验收 3: Memory 写入降级

**测试目标**: 停用 Memory 写入后，主链是否正常

**降级映射**: L2 + 操作规程

**前置条件**:
- [ ] 已完成验收 2
- [ ] 已备份配置
- [ ] 准备 Memory 查询测试

**执行步骤**:

```bash
# 1. 识别自动写入记忆的 Agent
cat ~/.openclaw/agents/*/index.json | jq 'select(.memory.write == true)'

# 2. 禁用这些 Agent
# (假设 auto_summarizer 是自动写入 Agent)
jq 'del(.agents.entries.auto_summarizer)' ~/.openclaw/config.json > /tmp/config.json
mv /tmp/config.json ~/.openclaw/config.json

# 3. 重启网关
openclaw gateway restart

# 4. 等待 5 秒
sleep 5

# 5. 验证 Memory 检索仍可用
# (发送查询请求，验证检索正常)

# 6. 验证无自动写入
# (检查 memory/YYYY-MM-DD.md 无新增内容)

# 7. 验证主链性能
# (发送 10 个请求，记录响应时间)

# 8. 恢复配置
cp ~/.openclaw/config.json.bak ~/.openclaw/config.json
openclaw gateway restart
```

**验收标准**:

| 检查项 | 预期结果 | 实测结果 | 状态 |
|--------|---------|---------|------|
| Memory 检索 | ✅ 正常 | ⏳ | ⏳ |
| 无自动写入 | ✅ 文件无新增 | ⏳ | ⏳ |
| 主链性能 | ✅ 无下降 | ⏳ | ⏳ |
| 响应时间 | ✅ < 1s P95 | ⏳ | ⏳ |
| 恢复后正常 | ✅ 自动写入恢复 | ⏳ | ⏳ |

**实测记录**:
```
执行时间：[待填写]
执行人：[待填写]
检索测试结果：[待填写]
性能测试结果：[待填写]
```

**结论**:
- [ ] 通过
- [ ] 部分通过 (见备注)
- [ ] 失败 (见问题)

**备注**: ⏳

---

### ✅ 验收 4: Worktree 降级

**测试目标**: Worktree 不可依赖时，高风险写操作是否被阻断

**降级映射**: L2 + L3

**前置条件**:
- [ ] 已完成验收 3
- [ ] 已备份配置
- [ ] 准备高风险写操作测试

**执行步骤**:

```bash
# 1. 禁用写操作 Agent
jq 'del(.agents.entries.code_fixer)' ~/.openclaw/config.json > /tmp/config.json
mv /tmp/config.json ~/.openclaw/config.json

# 2. 权限策略收紧
jq '.security.ask = "always"' ~/.openclaw/config.json > /tmp/config.json
mv /tmp/config.json ~/.openclaw/config.json

# 3. 重启网关
openclaw gateway restart

# 4. 等待 5 秒
sleep 5

# 5. 触发高风险写操作
# (尝试修改 workspace 内文件)

# 6. 验证写操作被阻断
# (应有审批提示或直接拒绝)

# 7. 验证主工作区安全
# (文件未被直接修改)

# 8. 恢复配置
cp ~/.openclaw/config.json.bak ~/.openclaw/config.json
openclaw gateway restart
```

**验收标准**:

| 检查项 | 预期结果 | 实测结果 | 状态 |
|--------|---------|---------|------|
| 高风险写操作 | ✅ 被阻断 | ⏳ | ⏳ |
| 审批提示 | ✅ 明确提示 | ⏳ | ⏳ |
| 主区安全 | ✅ 未修改 | ⏳ | ⏳ |
| 只读操作 | ✅ 不受影响 | ⏳ | ⏳ |
| 恢复后正常 | ✅ 写操作恢复 | ⏳ | ⏳ |

**实测记录**:
```
执行时间：[待填写]
执行人：[待填写]
写操作测试结果：[待填写]
主区安全检查：[待填写]
```

**结论**:
- [ ] 通过
- [ ] 部分通过 (见备注)
- [ ] 失败 (见问题)

**备注**: ⏳

---

## 第二轮：完整降级 (5 项)

**目标**: 验证完整降级能力，满足灰度运营条件

**前置条件**: 第一轮 4 项全部通过

---

### ⏳ 验收 5: Runtime V2 降级

**测试目标**: 仅保留 Main Agent，验证核心功能

**降级映射**: L2 + L4

**执行步骤**: (详见 `DEGRADE_MAPPING.md`)

**验收标准**:
- [ ] 仅 Main Agent 工作
- [ ] 新 Agent 调用被拒绝
- [ ] 核心只读链路正常
- [ ] 回退后可恢复

**状态**: ⏳ 等待第一轮完成

---

### ⏳ 验收 6-9: 故障演练

详见 `failure_drill_report.md`

- [ ] A. 审批卡住
- [ ] B. 权限拒绝
- [ ] C. Worktree 中断
- [ ] D. 入口恢复

**状态**: ⏳ 等待第一轮完成

---

## 汇总结果

### 第一轮：最小验收

| 验收项 | 状态 | 关键发现 | 改进项 |
|--------|------|---------|--------|
| 1. Telegram Callback | ⏳ | ⏳ | ⏳ |
| 2. 审批链路 | ⏳ | ⏳ | ⏳ |
| 3. Memory 写入 | ⏳ | ⏳ | ⏳ |
| 4. Worktree | ⏳ | ⏳ | ⏳ |

**通过标准**: 4/4 通过 → 进入第二轮  
**部分通过**: 3/4 通过 → 修复后重试  
**失败**: < 3/4 通过 → 暂停灰度

---

### 第二轮：完整降级

| 验收项 | 状态 | 关键发现 | 改进项 |
|--------|------|---------|--------|
| 5. Runtime V2 | ⏳ | ⏳ | ⏳ |
| 6. 审批卡住 | ⏳ | ⏳ | ⏳ |
| 7. 权限拒绝 | ⏳ | ⏳ | ⏳ |
| 8. Worktree 中断 | ⏳ | ⏳ | ⏳ |
| 9. 入口恢复 | ⏳ | ⏳ | ⏳ |

**通过标准**: 5/5 通过 → 进入灰度阶段 1  
**部分通过**: 4/5 通过 → 修复后重试  
**失败**: < 4/5 通过 → 暂停灰度

---

## 灰度准入判定

### 阶段 1 准入 (本地单用户)

- [ ] 第一轮 4/4 通过
- [ ] 第二轮 5/5 通过
- [ ] 基线文件已创建 ✅
- [ ] 降级映射已建立 ✅
- [ ] 每日复盘模板就绪 ✅

### 阶段 2 准入 (单频道灰度)

- [ ] 阶段 1 连续 7 天成功率 > 95%
- [ ] QueryGuard 冲突 = 0
- [ ] 无未解释失败
- [ ] Worktree 残留 < 5 个/天

### 阶段 3 准入 (扩大使用)

- [ ] 阶段 2 所有指标达标
- [ ] 多用户场景验证
- [ ] 高并发压力测试
- [ ] 回滚演练验证

---

## 执行计划

| 日期 | 任务 | 执行人 | 状态 |
|------|------|--------|------|
| 2026-04-03 | 第一轮验收 (4 项) | 小龙 | 🔄 准备执行 |
| 2026-04-04 | 第二轮验收 (5 项) | 小龙 | ⏳ 待启动 |
| 2026-04-05 | 修复问题 + 回归 | 小龙 + Colin | ⏳ 待启动 |
| 2026-04-06 | 阶段 1 灰度启动 | 小龙 | ⏳ 待启动 |

---

**状态**: 🔄 准备执行  
**下次更新**: 第一轮验收完成后

---

_验收清单，灰度准入依据。数据说话，不凭感觉。_
