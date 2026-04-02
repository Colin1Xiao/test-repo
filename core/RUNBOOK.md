# RUNBOOK.md - OpenClaw 运行手册

**版本**: 1.0  
**最后更新**: 2026-04-03  
**适用环境**: 生产/灰度/预发布

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
