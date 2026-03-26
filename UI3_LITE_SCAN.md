# UI-3 Lite 现状扫描报告

_扫描时间：2026-03-27 00:20_  
_范围：`/` (panel.html)、`/reports` (reports_page_v2.html)、`/history` (history_analysis.html)_

---

## 📋 1. Badge 不统一

### 问题清单

| 页面 | Badge 类型 | 当前样式 | 问题 |
|------|----------|---------|------|
| **Panel** | `status-badge` | `padding: 4px 8px; border-radius: 4px; font-size: 0.75rem` | 圆角偏小，无描边 |
| **Panel** | `control-item-status` | `padding: 4px 8px; border-radius: 4px; background: rgba(255,255,255,0.1)` | 样式独立，无统一色映射 |
| **Reports** | `freshness-badge` | `padding: 4px 12px; border-radius: 999px; border: 1px solid` | Pill 形，有描边 |
| **Reports** | `rank-badge` | `width: 24px; height: 24px; border-radius: 50%` | 圆形奖牌样式 |
| **Reports** | `badge` (表格内) | 未定义 CSS 类，内联 | 样式散落 |
| **History** | `badge` | `padding: 4px 12px; border-radius: 999px; font-weight: 700; border: 1px solid` | Pill 形，有描边 |

### 色映射不一致

| 状态 | Panel | Reports | History |
|------|-------|---------|---------|
| **Success** | `--success-light` + `--success-color` | `--success-light` + `--success` | 无 |
| **Warning** | `--warning-light` + `--warning-color` | `--warning-light` + `--warning` | `--warning-light` + `--warning` |
| **Danger** | `--danger-light` + `--danger-color` | `--danger-light` + `--danger` | `--danger-light` + `--danger` |
| **Info** | `--info-light` + `--info-color` | `--info-light` + `--info` | `--info-light` + `--info` |

**问题**: Panel 使用 `-color` 后缀，Reports/History 使用无后缀变量名（实际指向相同值，但命名不一致）

---

## 📋 2. 空态 / 加载态 / 错误态

### 加载态

| 页面 | Spinner 样式 | 文案 | 问题 |
|------|-------------|------|------|
| **Panel** | ❌ 无 spinner | 无 | 无加载态 |
| **Reports** | ✅ `48px` 圆形 spinner，`border-top-color: --info` | "正在加载数据..." | 样式完整 |
| **History** | ❌ 无 spinner | "加载中..." (纯文本) | 无动画 |

**结论**: 仅 Reports 有完整加载态

### 空态（无数据）

| 页面 | 空态文案 | 样式 | 问题 |
|------|---------|------|------|
| **Panel** | ❌ 无空态处理 | - | 表格直接为空 |
| **Reports** | ✅ "暂无数据" | `text-align:center; color: --text-3; padding: 20px` | 样式完整 |
| **History** | ✅ "无告警记录"/"无控制变更记录" | `loading` 类复用 | 可接受 |

### 错误态

| 页面 | 错误条样式 | 图标 | 自动消失 |
|------|-----------|------|---------|
| **Panel** | ❌ 无错误态 | - | - |
| **Reports** | ✅ `error-banner`: 渐变背景 + 左边框 4px + 图标 | ⚠️ | ✅ 5 秒 |
| **History** | ✅ `error`: 纯色背景 + 边框 | ❌ | ❌ 不消失 |

**问题**: 
- Panel 完全缺失错误态
- History 错误条无图标、无自动消失

---

## 📋 3. 图表标题区

### 卡片标题样式对比

| 属性 | Panel | Reports | History |
|------|-------|---------|---------|
| **字号** | `1rem` (16px) | `14px` / `15px` | `15px` / `16px` |
| **字重** | `600` | `600` | `600` |
| **颜色** | `--text-primary` | `--text-2` | `--text-2` |
| **图标间距** | `gap: 10px` | `gap: --spacing-sm` (12px) | `gap: --space-sm` (12px) |
| **下边距** | `margin-bottom: 15px` | `margin-bottom: --spacing-md` (18px) | `margin-bottom: --space-md` (18px) |

### 图表容器留白

| 页面 | Padding | 最小高度 | 问题 |
|------|---------|---------|------|
| **Panel** | `20px` | `150px` (canvas height) | 固定高度 |
| **Reports** | `--spacing-md` (18px) | `220px` | 响应式 |
| **History** | `--space-lg` (24px) | 自适应 | 无最小高度 |

### 副标题/辅助信息

| 页面 | 副标题位置 | 辅助信息位置 |
|------|-----------|-------------|
| **Panel** | 无副标题 | 右上角 `card-header-actions` |
| **Reports** | header-subtitle (主标题下方) | 右上角 `header-controls` |
| **History** | header-subtitle (主标题下方) | 无 |

**问题**: 
- Panel 字号偏大 (16px vs 14-15px)
- Panel 无副标题区域
- 三页 padding 不统一 (20px / 18px / 24px)

---

## 📋 4. Hover / 过渡

### 卡片 Hover

| 页面 | Transform | Shadow | 边框变化 |
|------|-----------|--------|---------|
| **Panel** | `translateY(-2px)` | `0 4px 12px rgba(0,0,0,0.3)` | ❌ |
| **Reports** | `translateY(-2px)` | `--shadow-md` | ✅ `border-color: --border-2` |
| **History** | `translateY(-2px)` | `--shadow-md` | ❌ |

**问题**: 仅 Reports 有边框变化反馈

### 按钮 Hover

| 页面 | 效果 | 过渡时长 |
|------|------|---------|
| **Panel** | `background: --primary-dark` | `0.3s` |
| **Reports** | `transform: translateY(-1px) + box-shadow` | `0.2s` |
| **History** | `transform: translateY(-1px) + box-shadow` | `0.2s` |

**问题**: Panel 使用背景变化，Reports/History 使用位移 + 阴影（更现代）

### Tab 切换

| 页面 | Active 样式 | 过渡 |
|------|------------|------|
| **Panel** | `background: --primary-dark + border-left: 4px` | `0.3s` |
| **Reports** | `background: gradient + box-shadow` | `0.2s` |
| **History** | ❌ 无 Tab | - |

### 表格行 Hover

| 页面 | Hover 效果 |
|------|-----------|
| **Panel** | `background: rgba(255,255,255,0.1)` |
| **Reports** | ❌ 无 |
| **History** | ❌ 无 |

---

## 📊 汇总：需要统一的项目

### P0（必须统一）

| 项目 | 当前状态 | 目标 |
|------|---------|------|
| **Badge 圆角** | 4px / 999px 混用 | 统一为 `6px` 或 `999px` |
| **Badge 高度** | 未定义 / 隐式 | 统一为 `24px` |
| **Loading Spinner** | 仅 Reports 有 | 三页统一样式 |
| **错误条** | Panel 缺失 | 三页统一样式 |
| **卡片 Hover 边框** | 仅 Reports 有 | 三页统一 |

### P1（建议统一）

| 项目 | 当前状态 | 目标 |
|------|---------|------|
| **图表标题字号** | 16px / 14px / 15px | 统一为 `14px` |
| **图表容器 Padding** | 20px / 18px / 24px | 统一为 `18px` |
| **按钮 Hover 效果** | 背景变化 / 位移+阴影 | 统一为位移 + 阴影 |
| **Badge 色映射命名** | `-color` / 无前缀 | 统一为无前缀 |

### P2（可选优化）

| 项目 | 建议 |
|------|------|
| **空态文案** | 统一为"暂无数据" + 图标 |
| **表格行 Hover** | 三页统一添加 |
| **过渡时长** | 统一为 `0.2s` (更干脆) |

---

## 📐 推荐 Token 定义

```css
/* UI-3 Lite Tokens */
:root {
  /* Badge */
  --badge-height: 24px;
  --badge-radius: 6px;
  --badge-padding: 4px 10px;
  --badge-font-size: 12px;
  --badge-font-weight: 600;
  
  /* Loading */
  --spinner-size: 40px;
  --spinner-border-width: 3px;
  
  /* Error Banner */
  --error-padding: 12px 16px;
  --error-radius: 8px;
  --error-border-left: 4px;
  
  /* Chart Card */
  --chart-title-size: 14px;
  --chart-title-weight: 600;
  --chart-padding: 18px;
  --chart-min-height: 220px;
  
  /* Hover */
  --hover-translate-y: -2px;
  --hover-transition: 0.2s ease;
}
```

---

_下一步：基于此清单创建 `ui-tokens-lite.md`，然后批量替换。_
