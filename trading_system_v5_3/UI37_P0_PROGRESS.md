# UI-3.7 P0: 三页 stale/delayed 状态统一

**创建时间**: 2026-03-27 04:36  
**状态**: 进行中

---

## 📊 当前状态分析

| 页面 | 当前显示 | 问题 |
|------|---------|------|
| 主页 | 延迟：6s | ✅ 已有 freshness |
| 历史页 | 无显示 | ❌ 缺失 |
| 报表页 | ● 未知状态 | ⚠️ 文案不统一 |

---

## 🎯 目标状态

### 统一 Freshness Badge

```
🟢 数据新鲜 (≤30s)
🟡 数据延迟 (31s-60s)
🔴 数据陈旧 (>60s)
```

### 统一阈值

| 状态 | 阈值 | 颜色 | 图标 |
|------|------|------|------|
| fresh | ≤30s | 🟢 #22c55e | ● |
| delayed | 31-60s | 🟡 #f59e0b | ⚠️ |
| stale | >60s | 🔴 #ef4444 | 🔴 |

---

## 📋 执行计划

### Step 1: 创建 CSS 变量 (panel_v40.py)

```css
:root {
  --freshness-fresh: #22c55e;
  --freshness-delayed: #f59e0b;
  --freshness-stale: #ef4444;
  --freshness-threshold-fresh: 30;
  --freshness-threshold-delayed: 60;
}
```

### Step 2: 创建 FreshnessBadge 组件函数

```python
def render_freshness_badge(age_sec):
    if age_sec <= 30:
        return f'<span class="badge badge-fresh">● 数据新鲜 ({age_sec}s)</span>'
    elif age_sec <= 60:
        return f'<span class="badge badge-delayed">⚠️ 数据延迟 ({age_sec}s)</span>'
    else:
        return f'<span class="badge badge-stale">🔴 数据陈旧 ({age_sec}s)</span>'
```

### Step 3: 应用到三页

- `panel.html` → 替换现有"延迟：Xs"
- `history_analysis.html` → 添加 badge
- `reports_page.html` → 替换"● 未知状态"

---

## ✅ 验收标准

- [ ] 三页 header 显示统一 badge
- [ ] 颜色/图标/文案一致
- [ ] 阈值正确 (30s/60s)
- [ ] 自动更新（每 30s 刷新）
- [ ] 手动刷新重置计时

---

_执行中..._
