# 🚨 错误日志 (Errors)

_记录命令失败、异常、意外行为_

---

## 统计

| 状态 | 数量 |
|------|------|
| 待处理 | 0 |
| 已解决 | 0 |

---

## 条目

_暂无错误记录_

---

## 分类索引

| 类别 | 说明 |
|------|------|
| `command_failure` | 命令失败 |
| `exception` | 异常/崩溃 |
| `timeout` | 超时 |
| `connection` | 连接问题 |
| `permission` | 权限问题 |

---

## 使用说明

**添加新条目格式：**
```markdown
## [ERR-YYYYMMDD-XXX] 命令或技能名

**Logged**: ISO-8601 时间戳
**Priority**: high
**Status**: pending | resolved
**Area**: frontend | backend | infra | tests | docs | config

### Summary
简短描述

### Error
```
实际错误信息
```

### Context
- 尝试的命令
- 输入参数
- 环境信息

### Suggested Fix
可能的解决方案

### Metadata
- Reproducible: yes | no | unknown
- Related Files: 路径

---
```
