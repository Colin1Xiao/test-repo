# UI-3 Lite 设计 Token

_轻量级前端规范 · 仅包含 Badge / 状态反馈 / 图表标题 / Hover 过渡_

_创建时间：2026-03-27_  
_适用范围：`/` (panel.html)、`/reports`、`/history`_

---

## 🎨 1. Badge

### 基础尺寸

```css
--badge-height: 24px;
--badge-radius: 6px;
--badge-padding-x: 10px;
--badge-padding-y: 4px;
--badge-font-size: 12px;
--badge-font-weight: 600;
--badge-line-height: 1.5;
```

### 状态色映射（语义化）

```css
/* 成功状态 */
--badge-success-bg: rgba(34, 197, 94, 0.15);
--badge-success-border: #22c55e;
--badge-success-color: #22c55e;

/* 警告状态 */
--badge-warning-bg: rgba(245, 158, 11, 0.15);
--badge-warning-border: #f59e0b;
--badge-warning-color: #f59e0b;

/* 危险状态 */
--badge-danger-bg: rgba(239, 68, 68, 0.15);
--badge-danger-border: #ef4444;
--badge-danger-color: #ef4444;

/* 信息状态 */
--badge-info-bg: rgba(59, 130, 246, 0.15);
--badge-info-border: #3b82f6;
--badge-info-color: #3b82f6;

/* 中性状态 */
--badge-neutral-bg: rgba(255, 255, 255, 0.05);
--badge-neutral-border: rgba(255, 255, 255, 0.1);
--badge-neutral-color: #b6c1d1;
```

### 标准 Badge HTML 结构

```html
<span class="badge badge-success">已开启</span>
<span class="badge badge-warning">待观察</span>
<span class="badge badge-danger">已关闭</span>
<span class="badge badge-info">处理中</span>
<span class="badge badge-neutral">未知</span>
```

### Badge CSS 模板

```css
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: var(--badge-height);
  padding: var(--badge-padding-y) var(--badge-padding-x);
  border-radius: var(--badge-radius);
  font-size: var(--badge-font-size);
  font-weight: var(--badge-font-weight);
  line-height: var(--badge-line-height);
  border: 1px solid;
  white-space: nowrap;
}

.badge-success {
  background: var(--badge-success-bg);
  border-color: var(--badge-success-border);
  color: var(--badge-success-color);
}

.badge-warning {
  background: var(--badge-warning-bg);
  border-color: var(--badge-warning-border);
  color: var(--badge-warning-color);
}

.badge-danger {
  background: var(--badge-danger-bg);
  border-color: var(--badge-danger-border);
  color: var(--badge-danger-color);
}

.badge-info {
  background: var(--badge-info-bg);
  border-color: var(--badge-info-border);
  color: var(--badge-info-color);
}

.badge-neutral {
  background: var(--badge-neutral-bg);
  border-color: var(--badge-neutral-border);
  color: var(--badge-neutral-color);
}
```

---

## 🔄 2. Loading / Empty / Error

### Loading Spinner

```css
--spinner-size: 40px;
--spinner-border-width: 3px;
--spinner-color: var(--info);
--spinner-animation-duration: 1s;
```

```css
.loading-spinner {
  width: var(--spinner-size);
  height: var(--spinner-size);
  border: var(--spinner-border-width) solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--spinner-color);
  border-radius: 50%;
  animation: spin var(--spinner-animation-duration) linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: var(--empty-min-height);
  color: var(--text-3);
  gap: 12px;
}

.loading-text {
  font-size: 13px;
  color: var(--text-3);
}
```

### Empty State

```css
--empty-min-height: 120px;
--empty-font-size: 13px;
--empty-color: var(--text-3);
--empty-padding: 20px;
```

```css
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: var(--empty-min-height);
  padding: var(--empty-padding);
  color: var(--empty-color);
  font-size: var(--empty-font-size);
  text-align: center;
}

.empty-state::before {
  content: '📭';
  font-size: 24px;
  margin-right: 8px;
}
```

### Error Banner

```css
--error-padding: 12px 16px;
--error-radius: 8px;
--error-border-left: 4px;
--error-icon-size: 18px;
--error-gap: 10px;
--error-auto-hide-delay: 5000ms;
```

```css
.error-banner {
  display: flex;
  align-items: center;
  gap: var(--error-gap);
  padding: var(--error-padding);
  background: linear-gradient(90deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05));
  border: 1px solid var(--danger);
  border-left: var(--error-border-left) solid var(--danger);
  border-radius: var(--error-radius);
  color: var(--danger);
  animation: fadeIn 0.3s ease;
}

.error-banner .icon {
  font-size: var(--error-icon-size);
  flex-shrink: 0;
}

.error-message {
  flex: 1;
  font-size: 13px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

---

## 📊 3. Chart Header

### 标题区尺寸

```css
--chart-title-size: 14px;
--chart-title-weight: 600;
--chart-subtitle-size: 12px;
--chart-subtitle-weight: 400;
--chart-title-color: var(--text-2);
--chart-subtitle-color: var(--text-3);
--chart-header-padding: 18px;
--chart-title-gap: 10px;
--chart-icon-size: 16px;
```

### 标准 Chart Card HTML 结构

```html
<div class="chart-card">
  <div class="chart-header">
    <h3 class="chart-title">
      <span class="chart-icon">📈</span>
      <span>图表标题</span>
    </h3>
    <div class="chart-actions">
      <!-- 右上角操作按钮 -->
    </div>
  </div>
  <div class="chart-subtitle">副标题或说明文字</div>
  <div class="chart-container">
    <!-- Chart.js canvas -->
  </div>
</div>
```

### Chart Card CSS 模板

```css
.chart-card {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01));
  border: 1px solid var(--border-2);
  border-radius: var(--radius-lg);
  padding: var(--chart-header-padding);
  transition: all var(--hover-transition);
}

.chart-card:hover {
  transform: var(--hover-transform);
  box-shadow: var(--shadow-md);
  border-color: var(--border-2);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.chart-title {
  display: flex;
  align-items: center;
  gap: var(--chart-title-gap);
  font-size: var(--chart-title-size);
  font-weight: var(--chart-title-weight);
  color: var(--chart-title-color);
}

.chart-icon {
  font-size: var(--chart-icon-size);
}

.chart-subtitle {
  font-size: var(--chart-subtitle-size);
  font-weight: var(--chart-subtitle-weight);
  color: var(--chart-subtitle-color);
  margin-bottom: 12px;
}

.chart-container {
  position: relative;
  min-height: var(--chart-min-height);
}
```

---

## 🎯 4. Hover / Transition

### 全局过渡

```css
--hover-transition: 0.2s ease;
--hover-transform: translateY(-2px);
--hover-shadow: var(--shadow-md);
```

### Card Hover

```css
.card {
  transition: all var(--hover-transition);
}

.card:hover {
  transform: var(--hover-transform);
  box-shadow: var(--hover-shadow);
  border-color: var(--border-2);
}
```

### Button Hover

```css
.btn {
  transition: all var(--hover-transition);
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.btn:active {
  transform: translateY(0);
}
```

### Tab Hover

```css
.tab-item {
  transition: all var(--hover-transition);
}

.tab-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.tab-item.active {
  background: linear-gradient(135deg, var(--info), #2563eb);
  color: white;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}
```

### Table Row Hover

```css
.data-table tr {
  transition: background var(--hover-transition);
}

.data-table tr:hover {
  background: rgba(255, 255, 255, 0.05);
}
```

---

## 📦 完整 Token 汇总（可直接复制）

```css
:root {
  /* ===== Badge ===== */
  --badge-height: 24px;
  --badge-radius: 6px;
  --badge-padding-x: 10px;
  --badge-padding-y: 4px;
  --badge-font-size: 12px;
  --badge-font-weight: 600;
  --badge-line-height: 1.5;
  
  --badge-success-bg: rgba(34, 197, 94, 0.15);
  --badge-success-border: #22c55e;
  --badge-success-color: #22c55e;
  
  --badge-warning-bg: rgba(245, 158, 11, 0.15);
  --badge-warning-border: #f59e0b;
  --badge-warning-color: #f59e0b;
  
  --badge-danger-bg: rgba(239, 68, 68, 0.15);
  --badge-danger-border: #ef4444;
  --badge-danger-color: #ef4444;
  
  --badge-info-bg: rgba(59, 130, 246, 0.15);
  --badge-info-border: #3b82f6;
  --badge-info-color: #3b82f6;
  
  --badge-neutral-bg: rgba(255, 255, 255, 0.05);
  --badge-neutral-border: rgba(255, 255, 255, 0.1);
  --badge-neutral-color: #b6c1d1;
  
  /* ===== Loading / Empty / Error ===== */
  --spinner-size: 40px;
  --spinner-border-width: 3px;
  --spinner-color: var(--info);
  --spinner-animation-duration: 1s;
  
  --empty-min-height: 120px;
  --empty-font-size: 13px;
  --empty-color: var(--text-3);
  --empty-padding: 20px;
  
  --error-padding: 12px 16px;
  --error-radius: 8px;
  --error-border-left: 4px;
  --error-icon-size: 18px;
  --error-gap: 10px;
  --error-auto-hide-delay: 5000ms;
  
  /* ===== Chart Header ===== */
  --chart-title-size: 14px;
  --chart-title-weight: 600;
  --chart-subtitle-size: 12px;
  --chart-subtitle-weight: 400;
  --chart-title-color: var(--text-2);
  --chart-subtitle-color: var(--text-3);
  --chart-header-padding: 18px;
  --chart-title-gap: 10px;
  --chart-icon-size: 16px;
  --chart-min-height: 220px;
  
  /* ===== Hover / Transition ===== */
  --hover-transition: 0.2s ease;
  --hover-transform: translateY(-2px);
  --hover-shadow: var(--shadow-md);
}
```

---

## ✅ 替换检查清单

### Badge 替换
- [ ] Panel: `status-badge` → 统一 `.badge`
- [ ] Panel: `control-item-status` → 统一 `.badge`
- [ ] Reports: `freshness-badge` → 保留但内部用新 token
- [ ] Reports: `rank-badge` → 保留（奖牌特殊样式）
- [ ] History: `badge` → 统一为新规范

### Loading / Error / Empty
- [ ] Panel: 添加 loading-state
- [ ] Panel: 添加 error-banner
- [ ] Panel: 添加 empty-state
- [ ] Reports: 更新 spinner 尺寸
- [ ] History: 添加 spinner 动画
- [ ] History: error-banner 加图标 + 自动消失

### Chart Header
- [ ] Panel: 标题字号 16px → 14px
- [ ] Panel: padding 20px → 18px
- [ ] Reports: 已符合，微调变量名
- [ ] History: 已符合，微调变量名

### Hover / Transition
- [ ] Panel: 添加边框变化
- [ ] Panel: 按钮 hover 改为位移 + 阴影
- [ ] Reports: 已符合
- [ ] History: 添加卡片 hover 边框变化
- [ ] 三页：统一 transition 为 0.2s

---

_下一步：按此规范批量替换三页 HTML。_
