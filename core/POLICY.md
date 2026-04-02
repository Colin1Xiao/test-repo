# POLICY.md - OpenClaw 权限与行为策略

**版本**: 1.0  
**最后更新**: 2026-04-03  
**生效日期**: 灰度上线日

---

## 一、默认权限规则

### 1.1 Allow（默认允许）

以下工具无需审批：

| 工具 | 说明 | 理由 |
|------|------|------|
| `fs.read` | 读取文件 | 只读操作，安全 |
| `grep.search` | 搜索文件内容 | 只读操作，安全 |
| `task.list` | 列出任务 | 只读操作，安全 |
| `task.output` | 读取任务输出 | 只读操作，安全 |
| `tool.search` | 搜索可用工具 | 只读操作，安全 |
| `todo.read` | 读取 todo 列表 | 只读操作，安全 |

### 1.2 Ask（默认审批）

以下工具需要用户审批：

| 工具 | 说明 | 理由 |
|------|------|------|
| `fs.write` | 写入文件 | 修改操作，需确认 |
| `exec.run` | 执行命令 | 可能产生副作用 |
| `memory.create` | 创建记忆 | 长期存储，需确认价值 |
| `memory.update` | 更新记忆 | 修改长期存储 |
| `todo.write` | 创建/更新 todo | 影响任务跟踪 |

### 1.3 Deny（默认拒绝）

以下操作被禁止：

| 模式 | 说明 | 理由 |
|------|------|------|
| `/etc/*` | 系统配置目录 | 系统安全 |
| `/usr/*` | 系统程序目录 | 系统安全 |
| `/var/*` | 系统数据目录 | 系统安全 |
| `/System/*` | macOS 系统目录 | 系统安全 |
| `rm -rf /*` | 删除根目录 | 灾难性操作 |
| `rm -rf ~/*` | 删除家目录 | 灾难性操作 |
| `git push --force*` | 强制推送 | 可能丢失提交 |
| `curl * \| *bash` | 管道执行 | 安全风险 |
| `wget * \| *sh` | 管道执行 | 安全风险 |
| `dd if=*` | 直接磁盘写入 | 灾难性操作 |
| `mkfs*` | 创建文件系统 | 灾难性操作 |
| `chmod -R *` | 递归权限修改 | 高风险 |
| `chown -R *` | 递归所有者修改 | 高风险 |
| `sudo *` | 提权命令 | 安全风险 |

---

## 二、Agent 级策略

### 2.1 code_reviewer（代码审查代理）

**职责**: 审查代码改动，评估风险

**权限**:
- ✅ 允许：fs.read, grep.search, task.list, task.output, tool.search, todo.read, diff.read
- ❌ 禁止：fs.write, exec.run, memory.update, memory.create

**行为**:
- 只读模式
- 不创建 worktree
- 不修改记忆

### 2.2 code_fixer（代码修复代理）

**职责**: 修复代码问题并验证

**权限**:
- ✅ 允许：fs.read, fs.write, exec.run, grep.search, task.list, task.output, todo.write, todo.read, todo.update
- ⚠️ 审批：fs.write, exec.run
- ❌ 禁止：git.push

**行为**:
- **默认启用 worktree 隔离**
- 修改后自动运行 task.verify
- 可写入项目记忆

### 2.3 ops_agent（运维代理）

**职责**: 系统排障、日志分析、状态检查

**权限**:
- ✅ 允许：exec.run, fs.read, grep.search, task.list, task.output, tool.search
- ⚠️ 审批：exec.run
- ❌ 禁止：fs.write, git.push

**行为**:
- 输出强制落盘
- 高风险命令需审批
- 可写入 ops 记忆

### 2.4 main_assistant（主要助手）

**职责**: 通用任务处理

**权限**:
- ✅ 允许：fs.read, grep.search, task.list, task.output, tool.search, todo.read
- ⚠️ 审批：fs.write, exec.run
- ❌ 禁止：无（遵循默认 deny 规则）

**行为**:
- 默认 agent
- 遵循通用策略

### 2.5 research_agent（研究代理）

**职责**: 信息搜集与研究

**权限**:
- ✅ 允许：grep.search, fs.read, fs.write, task.list, task.output, tool.search, todo.read, todo.write
- ❌ 禁止：exec.run

**行为**:
- 禁止执行命令
- 可写入研究记忆

---

## 三、Worktree 触发策略

### 3.1 自动触发条件

以下情况自动创建 worktree：

| 条件 | 说明 | 示例 |
|------|------|------|
| `agentName === 'code_fixer'` | 代码修复代理 | 修复 import 错误 |
| `filesToModify.length >= 3` | 多文件修改 | 同时修改 3+ 文件 |
| `safeModeRequested === true` | 用户要求安全模式 | "用安全模式运行" |
| `trustedSource === false` | 不可信来源 | 外部代码审查 |
| 命令包含 `git commit/push/rebase` | 版本控制操作 | 提交代码 |
| 命令包含 `npm/yarn publish` | 发布操作 | 发布包 |

### 3.2 Worktree 保留策略

| 状态 | 保留时间 | 自动清理 |
|------|---------|---------|
| active | 永久 | 否 |
| completed | 7 天 | 是 |
| destroyed | 立即 | - |

---

## 四、Task Verify 触发策略

### 4.1 自动验证条件

以下情况自动运行 task.verify：

| 条件 | 说明 |
|------|------|
| `hasCodeChanges === true` | 有代码修改 |
| `agentName === 'code_fixer'` | 代码修复代理 |
| `filesModified.length >= 1` | 有文件修改 |
| `execCommands.length >= 1` | 有命令执行 |

### 4.2 验证检查项

| 检查项 | 失败条件 | 处理 |
|--------|---------|------|
| Todo items completed | 有待完成 todo | warn |
| Output log exists | 输出为空 | warn |
| Task status | 状态非 completed | fail |
| Code changes have test | 有修改无测试 | warn |
| High-risk operations approved | 高风险未审批 | fail |

---

## 五、Memory 自动写入策略

### 5.1 自动写入范围

**仅写入高价值内容**:

| 类型 | 触发条件 | 示例 |
|------|---------|------|
| `project_structure` | 项目分析完成 | 模块职责文档 |
| `common_commands` | 常用命令识别 | 启动/测试命令 |
| `user_preferences` | 用户显式要求 | "记住这个偏好" |
| `risk_operations` | 高风险操作识别 | 禁止的命令列表 |
| `phase_plan` | 阶段计划变更 | 当前目标与中断点 |
| `fix_experience` | 修复经验总结 | 踩坑记录 |

### 5.2 不写入的内容

| 类型 | 说明 |
|------|------|
| 临时日志 | 执行过程日志 |
| 低价值对话 | 闲聊内容 |
| 短期状态碎片 | 临时状态信息 |
| 重复内容 | 已存在的记忆 |

### 5.3 Memory 清理策略

| Scope | 保留策略 |
|-------|---------|
| preferences | 永久保留 |
| project | 项目周期内保留 |
| ops | 30 天 |
| session | 7 天 |
| user | 永久保留 |

---

## 六、变更控制

### 6.1 策略变更流程

1. 提出变更请求（GitHub Issue）
2. 安全审查（风险评估）
3. 测试验证（回归测试）
4. 文档更新（POLICY.md 修订）
5. 灰度发布（单用户验证）
6. 全量发布

### 6.2 紧急变更

紧急情况下可直接修改，但必须：
- 记录变更原因
- 24 小时内补充文档
- 72 小时内完成回归测试

---

## 七、例外处理

### 7.1 临时豁免

特殊情况下可申请临时豁免：

| 豁免类型 | 审批人 | 有效期 |
|---------|--------|--------|
| 单命令豁免 | 用户直接批准 | 单次 |
| 会话级豁免 | 运维负责人 | 24 小时 |
| Agent 级豁免 | 开发负责人 | 7 天 |

### 7.2 豁免记录

所有豁免必须记录：
```json
{
  "type": "command_exemption",
  "command": "npm publish",
  "approvedBy": "user_123",
  "approvedAt": "2026-04-03T12:00:00Z",
  "reason": "发布新版本",
  "expiresAt": "2026-04-03T12:30:00Z"
}
```

---

## 八、审计与合规

### 8.1 审计日志

所有权限决策记录到：
```
~/.openclaw/runtime/audit.log
```

格式：
```json
{
  "timestamp": 1712145600000,
  "sessionId": "session_123",
  "taskId": "task_456",
  "eventType": "tool.denied",
  "tool": "exec.run",
  "risk": "high",
  "details": "Blocked: dangerous command pattern",
  "ok": false
}
```

### 8.2 合规审查

- 每周审查 audit.log
- 每月审查策略有效性
- 每季度进行安全审计

---

## 九、附录：完整规则列表

### A.1 完整 Allow 列表
```
fs.read
grep.search
task.list
task.output
tool.search
todo.read
```

### A.2 完整 Ask 列表
```
fs.write
exec.run
memory.create
memory.update
todo.write
```

### A.3 完整 Deny 列表
```
/workspace 外写入（/etc/*, /usr/*, /var/*, /System/*）
rm -rf /*
rm -rf ~/*
git push --force*
curl * | *bash
curl * | *sh
wget * | *bash
wget * | *sh
dd if=*
mkfs*
chmod -R *
chown -R *
sudo *
```

---

**下次审查日期**: 2026-04-10（上线后一周）

**审批人**: @Colin_Xiao  
**生效日期**: 灰度上线日
