# RUNBOOK.md - OpenClaw 运行手册

**版本**: 2.0 (灰度版)  
**最后更新**: 2026-04-03  
**适用环境**: 生产/灰度/预发布

---

# 灰度上线执行清单 v1

**文档定位**
用于 OpenClaw Agent Runtime System 进入生产灰度阶段时的统一执行、检查、降级与复盘。
本清单适用于当前版本能力边界：

* runtime v2
* approval bridge
* worktree
* memory autowrite
* telegram callbacks
* health_report
* recovery
* worktree_cleanup

**灰度期纪律**

1. 不扩新功能
2. 不改 runtime 主链
3. 只允许：
 * bugfix
 * 策略微调
 * 监控补充
 * 渠道接线
 * 运维修复
4. 任何异常优先通过开关降级，不现场改大逻辑
5. 灰度期间所有异常必须形成 task、原因、处理、结论闭环

---

## 一、角色分工

### 1. 发布负责人

负责上线动作、版本确认、开关切换、回退决策。

### 2. 运行观察负责人

负责监控面板、告警确认、失败任务抽样、指标记录。

### 3. 审批链路负责人

负责 approval bridge、TelegramBridge、callback 可用性与审批恢复链路。

### 4. 隔离执行负责人

负责 worktree 生命周期、残留清理、patch 产物检查。

### 5. 记录负责人

负责灰度日志、复盘表、异常归档、结论沉淀到 RUNBOOK/POLICY。

> 小团队可由 1 人兼任多角色，但职责不能省略。

---

## 二、灰度目标

### 核心目标

验证新 runtime 在真实入口、真实任务、真实审批链路下可稳定运行，并具备可降级、可恢复、可观测能力。

### 成功判定

满足以下条件可视为灰度通过：

* 任务成功率持续高于 95%
* 审批延迟稳定低于 5 分钟
* QueryGuard 冲突接近 0，且无连续异常
* 无高风险未隔离执行事故
* worktree 残留处于可控范围
* recovery 可正常恢复 ask / interrupted / pending task
* 无不可解释 deny / 卡死 / silent failure
* 无因 memory autowrite 导致明显污染或错误行为放大

---

## 三、灰度开关表

| 开关 | 默认状态 | 作用 | 降级策略 |
| ------------------ | --------: | --------------- | ------------------- |
| runtime v2 | ON | 启用统一 runtime 主链 | 关闭后回退旧执行链 |
| approval bridge | ON | ask 权限走审批闭环 | 关闭后 ask 改为拒绝或人工本地执行 |
| worktree | ON | 高风险任务隔离执行 | 关闭后禁止高风险写操作，不允许裸跑 |
| memory autowrite | OFF/灰度小流量 | 自动记忆写入 | 关闭后只保留显式写入 |
| telegram callbacks | ON | 远程审批与交互恢复 | 关闭后改轮询或临时停用审批远程恢复 |
| health_report | ON | 健康度输出与状态汇总 | 不建议关闭 |
| recovery | ON | 恢复中断任务/审批 | 不建议关闭 |
| worktree_cleanup | ON | 清理隔离环境残留 | 不建议关闭，但异常时可切手动清理 |

> 当前建议：`memory autowrite` 不要从第一天就全量开启，应采用保守灰度。

---

## 一、快速启动

### 1.1 环境检查

```bash
# 检查 OpenClaw 版本
openclaw --version

# 检查网关状态
openclaw gateway status

# 检查健康状态
cat ~/.openclaw/workspace/openclaw-health-check.json | jq
```

### 1.2 启动 Runtime V2

```bash
# 设置环境变量
export OPENCLAW_RUNTIME_V2=true
export OPENCLAW_APPROVAL_BRIDGE=true
export OPENCLAW_WORKTREE_ENABLED=true
export OPENCLAW_MEMORY_AUTOWRITE=true
export OPENCLAW_TELEGRAM_CALLBACKS=true

# 启动网关
openclaw gateway start

# 验证启动
openclaw status
```

### 1.3 验证启动成功

```bash
# 应返回 healthy
curl http://127.0.0.1:18789/health

# 应返回 runtime 版本
curl http://127.0.0.1:18789/api/runtime/status
```

---

## 二、健康检查

### 2.1 查看健康报告

```bash
# 生成健康报告
node -e "
const { HealthReporter } = require('./core/maintenance');
const reporter = new HealthReporter();
console.log(reporter.getReportText());
"
```

### 2.2 关键指标

| 指标 | 正常值 | 告警阈值 |
|------|--------|---------|
| 任务成功率 | >95% | <90% |
| 审批延迟 | <5 分钟 | >30 分钟 |
| QueryGuard 冲突 | 0 | >5/小时 |
| Worktree 残留 | <10 | >50 |
| Memory 写入 | <100/天 | >500/天 |
| Verify 警告率 | <20% | >50% |

### 2.3 查看待审批列表

```bash
# Telegram 命令
/pending

# 或查看审批存储
cat ~/.openclaw/runtime/approvals/store.json | jq '.[] | select(.status=="pending")'
```

---

## 三、常见问题处理

### 3.1 审批失联

**症状**: 用户批准了但任务没恢复

**排查步骤**:
```bash
# 1. 检查审批状态
cat ~/.openclaw/runtime/approvals/store.json | jq '.[] | select(.id=="<requestId>")'

# 2. 检查任务状态
cat ~/.openclaw/runtime/tasks/<task-id>/task.json

# 3. 检查 hook 日志
grep "approval.resolved" ~/.openclaw/runtime/logs/hook.log
```

**修复**:
```bash
# 手动恢复任务
node -e "
const { TaskStore } = require('./core/runtime');
const tasks = new TaskStore();
tasks.update('<task-id>', { status: 'running' });
"
```

---

### 3.2 Worktree 泄漏

**症状**: worktree 目录持续增长

**排查**:
```bash
# 查看活跃 worktree 数量
ls -d ~/.openclaw/runtime/worktrees/wt_* | wc -l

# 查看超过 7 天的 worktree
find ~/.openclaw/runtime/worktrees -name "metadata.json" -mtime +7
```

**清理**:
```bash
# 自动清理（保留 7 天）
node -e "
const { WorktreeCleaner } = require('./core/maintenance');
const cleaner = new WorktreeCleaner({ retainDays: 7 });
cleaner.cleanup();
"

# 或手动删除
rm -rf ~/.openclaw/runtime/worktrees/wt_<id>
```

---

### 3.3 Orphaned Task 恢复

**症状**: 任务状态为 running 但实际已中断

**排查**:
```bash
# 查找运行超过 1 小时的任务
node -e "
const { TaskRecovery } = require('./core/maintenance');
const recovery = new TaskRecovery();
const orphaned = recovery.getOrphanedTasks();
console.log(orphaned);
"
```

**恢复**:
```bash
# 自动恢复
node -e "
const { TaskRecovery } = require('./core/maintenance');
const recovery = new TaskRecovery({ autoRecover: true });
recovery.recover();
"

# 或手动标记为 failed
node -e "
const { TaskStore } = require('./core/runtime');
const tasks = new TaskStore();
tasks.update('<task-id>', { 
  status: 'failed', 
  error: 'Task orphaned - recovered by runbook' 
});
"
```

---

### 3.4 Memory 写入过度

**症状**: MEMORY.md 增长过快

**排查**:
```bash
# 查看 memory 条目数量
cat ~/.openclaw/workspace/.openclaw/MEMORY.md | jq '.entries | length'

# 查看最近写入
cat ~/.openclaw/workspace/.openclaw/memory/*/mem_*.md | head -50
```

**修复**:
```bash
# 临时禁用自动写入
export OPENCLAW_MEMORY_AUTOWRITE=false

# 清理低价值记忆
node -e "
const { MemDir } = require('./core/memory');
const memDir = new MemDir();
const entries = memDir.list({ limit: 100 });
// 手动删除低价值条目
entries.forEach(e => {
  if (e.scope === 'session' && e.tags.length === 0) {
    memDir.delete(e.id);
  }
});
"
```

---

## 四、降级开关

### 4.1 Runtime V2 降级

```bash
# 降级到旧 runtime
export OPENCLAW_RUNTIME_V2=false

# 重启网关
openclaw gateway restart
```

### 4.2 关闭 Approval Bridge

```bash
export OPENCLAW_APPROVAL_BRIDGE=false
# 所有 exec.run 将默认 ask（通过 PermissionEngine）
```

### 4.3 关闭 Worktree

```bash
export OPENCLAW_WORKTREE_ENABLED=false
# code_fixer 将不再自动创建 worktree
```

### 4.4 关闭 Memory Auto-write

```bash
export OPENCLAW_MEMORY_AUTOWRITE=false
# 仅用户显式"记住这个"时写入
```

### 4.5 关闭 Telegram Callbacks

```bash
export OPENCLAW_TELEGRAM_CALLBACKS=false
# 审批只能通过 /approve /reject 命令
```

---

## 五、紧急联系人

| 角色 | 联系方式 |
|------|---------|
| 运维负责人 | @Colin_Xiao |
| 开发负责人 | @Colin_Xiao |
| 备份负责人 | TBD |

---

## 六、变更日志

| 日期 | 变更 | 影响 |
|------|------|------|
| 2026-04-03 | 初始版本 | 首次生产发布 |

---

**下次审查日期**: 2026-04-10（上线后一周）
