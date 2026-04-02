# 📚 学习日志索引

_快速检索所有学习记录_

---

## 📊 总览

| 文件 | 条目数 | 待处理 | 最后更新 |
|------|--------|--------|----------|
| [LEARNINGS.md](./LEARNINGS.md) | 0 | 0 | - |
| [ERRORS.md](./ERRORS.md) | 0 | 0 | - |
| [FEATURE_REQUESTS.md](./FEATURE_REQUESTS.md) | 0 | 0 | - |

---

## 🔍 快速检索

### 按优先级
- 🔴 **Critical**: `grep "Priority\*\*: critical" *.md`
- 🟠 **High**: `grep "Priority\*\*: high" *.md`
- 🟡 **Medium**: `grep "Priority\*\*: medium" *.md`
- 🟢 **Low**: `grep "Priority\*\*: low" *.md`

### 按状态
- ⏳ **Pending**: `grep "Status\*\*: pending" *.md`
- 🔄 **In Progress**: `grep "Status\*\*: in_progress" *.md`
- ✅ **Resolved**: `grep "Status\*\*: resolved" *.md`
- 📈 **Promoted**: `grep "Status\*\*: promoted" *.md`

### 按领域
- `grep "Area\*\*: frontend" *.md`
- `grep "Area\*\*: backend" *.md`
- `grep "Area\*\*: infra" *.md`
- `grep "Area\*\*: tests" *.md`
- `grep "Area\*\*: docs" *.md`
- `grep "Area\*\*: config" *.md`

---

## 🎯 晋升追踪

**已晋升到 workspace 文件：**

| 原条目 | 晋升目标 | 日期 |
|--------|----------|------|
| - | - | - |

**晋升规则：**
- 同一模式出现 ≥3 次 → 晋升
- 跨 2+ 不同任务 → 晋升
- 30 天内重复 → 晋升

---

## 📅 最近活动

_暂无活动记录_

---

## 🧹 维护

**定期清理：**
- 90 天未用 → 归档
- 已解决条目 → 保留参考
- 重复条目 → 合并

**命令：**
```bash
# 统计待处理数量
grep -h "Status\*\*: pending" .learnings/*.md | wc -l

# 查找高优先级
grep -B5 "Priority\*\*: high" .learnings/*.md | grep "^## \["

# 查找相关条目
grep -l "Pattern-Key: xxx" .learnings/*.md
```
