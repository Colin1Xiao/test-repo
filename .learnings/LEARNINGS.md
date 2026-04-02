# 🧠 学习日志 (Learnings)

_记录纠正、知识缺口、最佳实践_

---

## 统计

| 状态 | 数量 |
|------|------|
| 待处理 | 0 |
| 进行中 | 0 |
| 已解决 | 0 |
| 已晋升 | 0 |

---

## 条目

## [LRN-20260331-606D] workflow

**Logged**: 2026-03-31T18:20:57+0800
**Priority**: high
**Status**: resolved
**Area**: config

### Summary
升级后自动检查脚本 - 自动化环境验证和修复

### Details
**问题**: 每次完成工具升级后，需要手动检查 brew 链接/PATH 配置/Python 版本等。

**解决方案**: 创建 `post-upgrade-check.sh` 脚本自动完成所有检查和修复。

**功能**:
1. brew 链接检查 + 自动修复
2. PATH 配置验证 + 自动添加
3. Python/pip3 版本验证
4. npm 版本验证
5. brew/npm 缓存清理

**文件**: `~/.openclaw/workspace/scripts/post-upgrade-check.sh`

### Suggested Action
每次升级后运行：
```bash
~/.openclaw/workspace/scripts/post-upgrade-check.sh
```

### Metadata
- Source: user_feedback
- Related Files: ~/.openclaw/workspace/scripts/post-upgrade-check.sh, AGENTS.md
- Tags: automation, maintenance, upgrade
- Pattern-Key: upgrade.post-check
- Recurrence-Count: 1

---


_暂无学习记录_

---

## 分类索引

| 类别 | 说明 |
|------|------|
| `correction` | 用户纠正 |
| `knowledge_gap` | 知识缺口 |
| `best_practice` | 最佳实践 |
| `workflow` | 工作流改进 |
| `tool_gotcha` | 工具陷阱 |

---

## 使用说明

**添加新条目格式：**
```markdown
## [LRN-YYYYMMDD-XXX] 类别

**Logged**: ISO-8601 时间戳
**Priority**: low | medium | high | critical
**Status**: pending | in_progress | resolved | promoted
**Area**: frontend | backend | infra | tests | docs | config

### Summary
一句话描述

### Details
完整上下文

### Suggested Action
具体改进行动

### Metadata
- Source: conversation | error | user_feedback
- Related Files: 路径
- Tags: 标签
- Pattern-Key: 模式键 (可选)
- Recurrence-Count: 1 (可选)

---
```

**晋升目标：**
- 行为模式 → `SOUL.md`
- 工作流改进 → `AGENTS.md`
- 工具陷阱 → `TOOLS.md`
- 通用知识 → `MEMORY.md`
