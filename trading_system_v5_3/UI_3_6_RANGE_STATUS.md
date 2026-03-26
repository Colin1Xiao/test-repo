# UI-3.6 范围与状态增强记录

**日期**: 2026-03-27  
**版本**: UI-3.6 Enhancement  
**提交范围**: `c497a96` → `9fc07cd`

---

## 1️⃣ 历史页 range-btn 功能化

### 目标

让 `/history` 支持：

* `7D / 30D / 90D` 时间范围切换
* URL 参数持久化
* active 态自动切换
* 切换范围后自动重新拉取数据
* 刷新按钮复用当前 range

### 改动文件

| 文件 | 行位置 | 说明 |
|------|--------|------|
| `history_analysis.html` | ~590 | header-controls 增加 range-btn 组 |
| `history_analysis.html` | ~695 | 新增 range 状态管理代码 |
| `history_analysis.html` | ~820 | 新增 fetchHistory 辅助函数 |
| `history_analysis.html` | ~895 | 初始化函数增强 |
| `history_analysis.html` | ~782/837/884 | API 请求路径修改 |

### 功能实现

#### HTML 结构
```html
<div class="header-controls">
  <div class="range-group">
    <button class="range-btn" data-days="7">7D</button>
    <button class="range-btn active" data-days="30">30D</button>
    <button class="range-btn" data-days="90">90D</button>
  </div>
  <button class="refresh-btn" onclick="loadAll()">...</button>
</div>
```

#### JS 状态管理
```javascript
const DEFAULT_RANGE_DAYS = 30;
let currentRangeDays = DEFAULT_RANGE_DAYS;

function getRangeDaysFromUrl() { /* 解析 URL 参数 */ }
function syncRangeDaysToUrl(days) { /* 更新 URL（不刷新） */ }
function updateRangeButtons(days) { /* 切换 active 态 */ }
function bindRangeButtons() { /* 绑定点击事件 */ }
function fetchHistory(endpoint) { /* 统一 API 请求 */ }
```

#### 初始化流程
```javascript
function initPage() {
  currentRangeDays = getRangeDaysFromUrl();
  bindRangeButtons();
  updateRangeButtons(currentRangeDays);
  loadAll();
}
document.addEventListener('DOMContentLoaded', initPage);
```

### CSS 样式
```css
.range-group {
  display: flex;
  gap: var(--space-xs);
  background: rgba(255,255,255,0.05);
  padding: var(--space-xs);
  border-radius: var(--radius-md);
}

.range-btn {
  padding: 8px 16px;
  border: 1px solid var(--border-1);
  background: transparent;
  color: var(--text-2);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  transition: all var(--hover-transition);
}

.range-btn.active {
  background: rgba(59,130,246,0.15);
  color: var(--info);
  border-color: var(--info);
}
```

### 后端支持

#### parse_days_arg helper
```python
def parse_days_arg(request_obj, default=30, allowed=(7, 30, 90)):
    """解析 days 参数（UI-3.6 新增）"""
    raw = request_obj.args.get("days", default)
    try:
        val = int(raw)
    except (TypeError, ValueError):
        return default
    return val if val in allowed else default
```

#### API 接口修改
- `/api/history/alerts`: 添加 days 参数
- `/api/history/control`: 添加 days 参数
- `/api/history/decisions`: 添加 days 参数

#### Storage 函数修改
- `list_alerts(days=None)`: 添加 days 过滤
- `list_control_audits(days=None)`: 添加 days 过滤
- `list_decision_events(days=None)`: 添加 days 过滤

### 交互流程

1. 用户打开 `/history?days=7` → 显示 7D 数据
2. 用户点击 `30D` 按钮 → URL 变为 `/history?days=30` → 重新拉取数据
3. 用户点击 `刷新` → 保留当前 days 参数 → 重新拉取数据
4. 后端接收到非法 days 参数（如 days=100）→ 自动回退到 30

### 验收清单

- [x] 默认 30D
- [x] `?days=7` 可直接打开 7D
- [x] `?days=90` 可直接打开 90D
- [x] 点击按钮 active 态正确
- [x] 点击按钮后自动重新拉取数据
- [x] 刷新按钮保留当前 days
- [x] 非法参数自动回退 30D

---

## 2️⃣ 三页状态反馈统一（待完成）

### 目标

统一三页的：

* loading
* error
* empty
* stale
* delayed

### 待办项

| 任务 | 文件 | 状态 |
|------|------|------|
| 统一 class 命名 | 三页 | 🔜 |
| 统一 HTML 骨架 | 三页 | 🔜 |
| 统一 CSS 样式 | 三页 | 🔜 |
| 统一 JS 状态管理 | 三页 | 🔜 |

### CSS 规范（建议）
```css
.state-panel {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  padding: var(--space-md);
  border: 1px solid var(--border-1);
  border-radius: 16px;
  background: rgba(255,255,255,0.03);
}

.state-panel.loading { }
.state-panel.error { border-color: rgba(239, 68, 68, 0.35); }
.state-panel.empty { border-style: dashed; }
.state-panel.delayed { border-color: rgba(245, 158, 11, 0.35); }
.state-panel.stale { border-color: rgba(239, 68, 68, 0.35); }
```

### 决策

 postponing UI-3.6 第二部分（状态统一）到后续迭代。

---

## 提交历史

| Commit | 哈希 | 说明 |
|--------|------|------|
| 1 | `c497a96` | 历史页支持 7D/30D/90D 时间范围切换 |
| 2 | `9fc07cd` | 统一历史接口 days 参数解析逻辑 |

---

## 回归测试

### 历史页 range-btn

| 测试场景 | 预期行为 |
|----------|----------|
| 默认打开 | 显示 30D 数据 |
| URL 直接 `?days=7` | 显示 7D 数据，按钮高亮 |
| 点击 `7D` 按钮 | URL 变为 `?days=7`，数据重新拉取 |
| 点击 `刷新` 按钮 | 保留当前 days 参数 |
| URL `?days=100` | 自动回退到 30D |

### API days 参数

| 测试场景 | 预期行为 |
|----------|----------|
| 无 days 参数 | 默认 30D |
| days=7 | 返回 7D 数据 |
| days=90 | 返回 90D 数据 |
| days=100 | 自动回退到 30D |
| days=invalid | 自动回退到 30D |

---

**下一步**: 状态统一组件开发（UI-3.6 Part 2）
