# UI-3.5 收口记录

**日期**: 2026-03-27  
**版本**: UI-3.5 Consolidation  
**提交范围**: `9e986d8` → `f2af8a1` (5 commits)

---

## 目标

> 以报表页为标准模板，统一三页 header 语义、token 命名、响应式规则，为后续组件化做准备。

---

## 改动范围

| 文件 | 改动内容 |
|------|----------|
| `panel_v40.py` | Header 语义 + CSS + 响应式 |
| `history_analysis.html` | Header 语义 + CSS + 响应式 |
| `reports_page.html` | Token 命名统一 |

---

## Header 标准骨架

三页统一使用以下结构：

```html
<div class="header">
  <div class="header-main">
    <div class="header-title">
      <span class="icon">🐉</span>
      <span>页面标题</span>
    </div>
    <div class="header-subtitle">
      <span>副标题描述</span>
      <!-- 首页专属：状态组 -->
      <span class="status-group">
        <span class="badge">状态 1</span>
        <span class="badge">状态 2</span>
      </span>
    </div>
  </div>
  <div class="header-controls">
    <!-- 控制按钮 / 观测信息 -->
  </div>
</div>
```

### 语义说明

| Class | 用途 |
|-------|------|
| `.header` | 根容器 (grid 布局) |
| `.header-main` | 标题区容器 (flex 纵向) |
| `.header-title` | 主标题 (icon + 文本) |
| `.header-subtitle` | 副标题 (支持 flex 换行) |
| `.status-group` | 状态 badges 分组（首页专用） |
| `.header-controls` | 控制区（按钮/观测信息） |

---

## Token 命名统一

三页统一使用：

```css
--space-xs: 8px;
--space-sm: 12px;
--space-md: 18px;
--space-lg: 24px;
--space-xl: 32px;
```

**决策**: 保留首页/历史页的 `--space-*` 命名，修改报表页对齐。

**原因**:
- 首页是主入口，改动风险大
- 历史页已稳定
- 报表页是独立 HTML，改动成本最低

---

## 响应式策略

### 断点

| 断点 | 宽度 | 布局 |
|------|------|------|
| 桌面 | >= 1280px | 标准双列 |
| 平板 | 768-1279px | 双列压缩 |
| 手机 | < 768px | 单列 |

### 核心规则

#### 1280px 以下
```css
.header {
  gap: var(--space-md);
}

.header-controls {
  justify-content: flex-start;
}
```

#### 768px 以下
```css
.header {
  grid-template-columns: 1fr;
}

.header-title {
  font-size: 22px;  /* 28px → 22px */
}

.header-subtitle {
  flex-direction: column;
}

.header-controls {
  flex-direction: column;
}

.status-group {
  margin-left: 0;
  padding-left: 0;
  border-left: none;
  margin-top: var(--space-xs);
}
```

---

## 首页专属：状态组

首页 header 包含系统状态 badges，使用 `.status-group` 分组：

```html
<div class="header-subtitle">
  <span>实时交易监控与决策分析系统</span>
  <span class="status-group">
    <span class="badge state-ok">系统启用</span>
    <span class="badge state-error">冻结</span>
    <span class="badge state-ok">OK</span>
  </span>
</div>
```

### 样式特点

- 左边框分隔（桌面）
- 小屏去边框，改上边距
- badges 保持原有语义色

---

## 提交历史

| Commit | 哈希 | 说明 |
|--------|------|------|
| 1 | `9e986d8` | 统一首页与历史页 header 语义结构 |
| 2 | `2893bf2` | 统一三页 header 样式与状态分组 |
| 3 | `60d71dc` | 收口三页响应式规则 |
| 4 | `f2af8a1` | 统一报表页 spacing token 命名 |

---

## 验收清单

- [x] 三页 header 结构一致
- [x] 三页 token 命名一致
- [x] 三页响应式行为一致
- [x] 首页状态 badges 分组清晰
- [x] 历史页 controls 区完整
- [x] 报表页保持标准模板
- [x] 无 CSS 报错
- [x] 三页 active 态一致

---

## 下一步建议

### 短期（可选）
- [ ] 历史页添加 range-btn 功能（需 JS 支持）
- [ ] 首页 header 信息层级再优化
- [ ] 三页 loading / error / empty 状态统一

### 中期（组件化）
- [ ] 提炼 Flask templates/base.html
- [ ] 提取 partials/top_nav.html
- [ ] 提取 partials/page_header.html
- [ ] 统一 JS 工具函数

---

## 回归测试

### 桌面端 (>= 1280px)
- [ ] 导航栏完整显示
- [ ] header 双列布局
- [ ] status-group 左边框可见
- [ ] controls 右对齐

### 平板端 (768-1279px)
- [ ] header 间距缩小
- [ ] controls 左对齐
- [ ] 内容无挤压

### 手机端 (< 768px)
- [ ] header 单列
- [ ] title 字号缩小
- [ ] subtitle 纵向排列
- [ ] controls 纵向排列
- [ ] status-group 无边框

---

**状态**: ✅ 已完成，待部署验证
