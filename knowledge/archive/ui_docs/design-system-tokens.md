# 小龙交易系统 - 设计系统 Token

_基于 ui-ux-pro-max 技能生成_

---

## 📐 设计模式

| 属性 | 值 |
|------|-----|
| **模式名称** | Minimal & Direct + Demo |
| **CTA 位置** | 首屏可见 |
| **页面结构** | Hero > Features > CTA |

---

## 🎨 视觉风格

| 属性 | 值 |
|------|-----|
| **风格名称** | Flat Design |
| **关键词** | 2D, 极简, 大胆色彩, 无阴影, 干净线条, 简单形状, 排版为主, 现代, 图标丰富 |
| **适用场景** | Web 应用, 移动应用, 跨平台, 初创 MVP, 用户友好, SaaS, 仪表盘, 企业级 |
| **性能** | ⚡ 优秀 |
| **无障碍** | ✓ WCAG AAA |

---

## 🌈 色彩系统

| 角色 | Token 名称 | Hex 值 | 用途 |
|------|-----------|--------|------|
| **主色** | `--color-primary` | `#6366F1` | 按钮、链接、强调 |
| **次要色** | `--color-secondary` | `#818CF8` | 次要按钮、标签 |
| **CTA 色** | `--color-cta` | `#10B981` | 主要行动按钮 |
| **背景色** | `--color-bg` | `#F5F3FF` | 页面背景 |
| **文字色** | `--color-text` | `#1E1B4B` | 主要文字 |

> 💡 **配色说明**: Indigo 主色 + Emerald CTA，专业且现代

---

## 🔤 字体系统

| 用途 | 字体 | 风格 |
|------|------|------|
| **标题** | Fira Code | 等宽、技术感 |
| **正文** | Fira Sans | 清晰、易读 |

### 字体氛围
- 仪表盘、数据、分析、代码、技术、精确

### 最佳适用
- 仪表盘、数据分析、数据可视化、管理面板

### CSS 引入
```css
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap');
```

### Google Fonts 链接
https://fonts.google.com/share?selection.family=Fira+Code:wght@400;500;600;700|Fira+Sans:wght@300;400;500;600;700

---

## 📏 间距系统 (建议)

| Token | 值 | 用途 |
|-------|-----|------|
| `--space-xs` | 4px | 图标内边距 |
| `--space-sm` | 8px | 紧凑间距 |
| `--space-md` | 16px | 标准间距 |
| `--space-lg` | 24px | 区块间距 |
| `--space-xl` | 32px | 大区块间距 |
| `--space-2xl` | 48px | 页面间距 |
| `--space-3xl` | 64px | 章节间距 |

---

## 🎯 圆角系统

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-sm` | 4px | 小按钮、标签 |
| `--radius-md` | 8px | 标准按钮、卡片 |
| `--radius-lg` | 12px | 大卡片、模态框 |
| `--radius-xl` | 16px | 特殊元素 |
| `--radius-full` | 9999px | 胶囊按钮 |

---

## ⚡ 动效规范

| 属性 | 值 |
|------|-----|
| **过渡时长** | 150-200ms |
| **缓动函数** | ease |
| **悬停效果** | 颜色/透明度变化 |
| **无渐变/阴影** | 保持扁平设计 |

---

## 🚫 反模式 (避免)

- ❌ 复杂的 onboarding 流程
- ❌ 杂乱的布局

---

## ✅ 交付前检查清单

- [ ] 不使用 emoji 作为图标（使用 SVG: Heroicons/Lucide）
- [ ] 所有可点击元素有 `cursor-pointer`
- [ ] 悬停状态有平滑过渡 (150-300ms)
- [ ] 浅色模式: 文字对比度至少 4.5:1
- [ ] 键盘导航的焦点状态可见
- [ ] 尊重 `prefers-reduced-motion` 设置
- [ ] 响应式断点: 375px, 768px, 1024px, 1440px

---

## 🛠️ Tailwind CSS 配置参考

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#6366F1',
        secondary: '#818CF8',
        cta: '#10B981',
        background: '#F5F3FF',
        text: '#1E1B4B',
      },
      fontFamily: {
        heading: ['Fira Code', 'monospace'],
        body: ['Fira Sans', 'sans-serif'],
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
        '2xl': '48px',
        '3xl': '64px',
      },
      borderRadius: {
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        'full': '9999px',
      },
      transitionDuration: {
        'fast': '150ms',
        'normal': '200ms',
      },
    },
  },
}
```

---

## 📝 CSS 变量版本

```css
:root {
  /* Colors */
  --color-primary: #6366F1;
  --color-secondary: #818CF8;
  --color-cta: #10B981;
  --color-bg: #F5F3FF;
  --color-text: #1E1B4B;
  
  /* Typography */
  --font-heading: 'Fira Code', monospace;
  --font-body: 'Fira Sans', sans-serif;
  
  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;
  
  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
  
  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
}
```

---

*生成时间: 2026-03-25*  
*技能: ui-ux-pro-max*
