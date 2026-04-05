# 降级开关检查清单 (Degrade Switch Checklist)

**创建时间**: 2026-04-03 17:45 (Asia/Shanghai)  
**执行人**: 小龙  
**状态**: 🔄 测试中

---

## 测试方法

对每个开关执行：

1. **记录默认值** → 当前配置状态
2. **关闭开关** → 修改配置，重启/热加载
3. **验证预期影响** → 功能确实被禁用
4. **检查连锁反应** → 是否有意外报错
5. **恢复开关** → 回到默认状态
6. **验证恢复** → 功能正常

---

## 开关 1: Runtime V2

### 基本信息

| 项目 | 值 |
|------|-----|
| **配置项** | `runtime.v2.enabled` |
| **默认值** | `true` |
| **位置** | `~/.openclaw/config.json` |
| **影响范围** | 新 Agent Runtime 核心 |

### 预期影响

关闭后：
- 回退到旧版执行器
- 新 buildSkill 工厂不可用
- ExecutionContext 不可用
- 任务状态机不可用

### 测试步骤

```bash
# 1. 记录当前状态
cat ~/.openclaw/config.json | jq '.runtime.v2.enabled'

# 2. 关闭开关
# (编辑 config.json，设置 runtime.v2.enabled = false)

# 3. 重启网关
openclaw gateway restart

# 4. 验证功能
openclaw gateway status

# 5. 执行测试任务
# (发送一个简单任务，观察是否回退到旧版)

# 6. 恢复开关
# (编辑 config.json，设置 runtime.v2.enabled = true)

# 7. 重启并验证
openclaw gateway restart
```

### 实测结果

| 项目 | 结果 |
|------|------|
| 默认值 | ⏳ 待测 |
| 关闭后预期影响 | ⏳ 待验证 |
| 实测结果 | ⏳ 待测 |
| 连锁报错 | ⏳ 待检查 |
| 可作为降级手段 | ⏳ 待判定 |

### 备注

⏳ 待执行测试

---

## 开关 2: Approval Bridge

### 基本信息

| 项目 | 值 |
|------|-----|
| **配置项** | `approvalBridge.enabled` |
| **默认值** | `true` |
| **位置** | `~/.openclaw/config.json` |
| **影响范围** | Telegram 远程审批 |

### 预期影响

关闭后：
- Telegram 审批通知不发送
- 需要审批的任务会卡住
- 本地 WebChat 审批仍可用

### 测试步骤

```bash
# 1. 记录当前状态
cat ~/.openclaw/config.json | jq '.approvalBridge.enabled'

# 2. 关闭开关
# (编辑 config.json)

# 3. 触发货审批任务
# (尝试执行需要审批的命令)

# 4. 验证 Telegram 无通知
# (检查 Telegram Bot)

# 5. 验证任务状态
# (任务应该处于 waiting_approval 状态)

# 6. 恢复开关
# (编辑 config.json)

# 7. 验证恢复
# (再次触发审批，确认 Telegram 收到通知)
```

### 实测结果

| 项目 | 结果 |
|------|------|
| 默认值 | ⏳ 待测 |
| 关闭后预期影响 | ⏳ 待验证 |
| 实测结果 | ⏳ 待测 |
| 连锁报错 | ⏳ 待检查 |
| 可作为降级手段 | ⏳ 待判定 |

### 备注

⏳ 待执行测试

---

## 开关 3: Worktree

### 基本信息

| 项目 | 值 |
|------|-----|
| **配置项** | `worktree.enabled` |
| **默认值** | `true` |
| **位置** | `~/.openclaw/config.json` |
| **影响范围** | 隔离工作区功能 |

### 预期影响

关闭后：
- 高风险任务直接在主工作区执行
- 无 diff 隔离
- 无自动 cleanup

### 测试步骤

```bash
# 1. 记录当前状态
cat ~/.openclaw/config.json | jq '.worktree.enabled'

# 2. 关闭开关
# (编辑 config.json)

# 3. 触发高风险任务
# (尝试执行文件写入操作)

# 4. 验证无 worktree 创建
ls -la ~/.openclaw/workspace/worktrees/

# 5. 验证任务仍在主区执行
# (检查文件是否直接写入 workspace)

# 6. 恢复开关
# (编辑 config.json)

# 7. 验证恢复
# (再次触发高风险任务，确认 worktree 创建)
```

### 实测结果

| 项目 | 结果 |
|------|------|
| 默认值 | ⏳ 待测 |
| 关闭后预期影响 | ⏳ 待验证 |
| 实测结果 | ⏳ 待测 |
| 连锁报错 | ⏳ 待检查 |
| 可作为降级手段 | ⏳ 待判定 |

### 备注

⏳ 待执行测试

---

## 开关 4: Memory Autowrite

### 基本信息

| 项目 | 值 |
|------|-----|
| **配置项** | `memory.autowrite.enabled` |
| **默认值** | `true` |
| **位置** | `~/.openclaw/config.json` |
| **影响范围** | 自动记忆写入 |

### 预期影响

关闭后：
- 不自动写入 MEMORY.md
- 不自动创建 daily memory 文件
- 手动记忆 API 仍可用

### 测试步骤

```bash
# 1. 记录当前状态
cat ~/.openclaw/config.json | jq '.memory.autowrite.enabled'

# 2. 关闭开关
# (编辑 config.json)

# 3. 执行会产生记忆的任务
# (例如：完成一个重要任务)

# 4. 验证无自动记忆写入
cat ~/.openclaw/workspace/memory/$(date +%Y-%m-%d).md

# 5. 验证手动 API 仍可用
# (调用 memory.write API)

# 6. 恢复开关
# (编辑 config.json)

# 7. 验证恢复
# (再次执行任务，确认记忆自动写入)
```

### 实测结果

| 项目 | 结果 |
|------|------|
| 默认值 | ⏳ 待测 |
| 关闭后预期影响 | ⏳ 待验证 |
| 实测结果 | ⏳ 待测 |
| 连锁报错 | ⏳ 待检查 |
| 可作为降级手段 | ⏳ 待判定 |

### 备注

⏳ 待执行测试

---

## 开关 5: Telegram Callbacks

### 基本信息

| 项目 | 值 |
|------|-----|
| **配置项** | `telegram.callbacks.enabled` |
| **默认值** | `true` |
| **位置** | `~/.openclaw/config.json` |
| **影响范围** | Telegram 按钮回调 |

### 预期影响

关闭后：
- Telegram 消息按钮点击无效
- 审批按钮不响应
- 需改用文本命令审批

### 测试步骤

```bash
# 1. 记录当前状态
cat ~/.openclaw/config.json | jq '.telegram.callbacks.enabled'

# 2. 关闭开关
# (编辑 config.json)

# 3. 发送带按钮的 Telegram 消息
# (触发审批通知)

# 4. 验证按钮点击无响应
# (点击批准/拒绝按钮)

# 5. 验证文本命令仍可用
# (发送 /approve <task_id>)

# 6. 恢复开关
# (编辑 config.json)

# 7. 验证恢复
# (再次发送消息，确认按钮可点击)
```

### 实测结果

| 项目 | 结果 |
|------|------|
| 默认值 | ⏳ 待测 |
| 关闭后预期影响 | ⏳ 待验证 |
| 实测结果 | ⏳ 待测 |
| 连锁报错 | ⏳ 待检查 |
| 可作为降级手段 | ⏳ 待判定 |

### 备注

⏳ 待执行测试

---

## 汇总表格

| 开关 | 默认值 | 关闭影响 | 连锁报错 | 可降级 | 测试状态 |
|------|--------|---------|---------|--------|---------|
| Runtime V2 | true | 回退旧版执行器 | ⏳ | ⏳ | ⏳ 待测 |
| Approval Bridge | true | Telegram 审批失效 | ⏳ | ⏳ | ⏳ 待测 |
| Worktree | true | 无隔离工作区 | ⏳ | ⏳ | ⏳ 待测 |
| Memory Autowrite | true | 无自动记忆 | ⏳ | ⏳ | ⏳ 待测 |
| Telegram Callbacks | true | 按钮失效 | ⏳ | ⏳ | ⏳ 待测 |

---

## 测试计划

**执行顺序**:
1. Memory Autowrite (影响最小)
2. Telegram Callbacks (影响有限)
3. Approval Bridge (影响中等)
4. Worktree (影响中等)
5. Runtime V2 (影响最大，最后测)

**预计耗时**: 每个开关 10-15 分钟，总计 1-1.5 小时

**风险等级**: 🟡 中等 (可能影响正在运行的任务)

**建议执行时间**: 低峰期 (凌晨或工作日白天)

---

**状态**: 🔄 准备执行测试  
**下次更新**: 测试完成后
