# 🐉 小龙 Control UI 改造方案

OpenClaw Control UI 是一个基于 Lit 的现代化 SPA，直接修改打包文件困难。

## 推荐方案

### 方案 A：自定义主题 CSS（推荐）
通过覆盖 CSS 变量实现小龙主题，无需修改 JS。

### 方案 B：插件扩展
创建 OpenClaw 插件，添加自定义面板到 Control UI。

### 方案 C：完全自定义 UI
基于 OpenClaw API 构建全新的 Control UI（类似刚才的 dashboard）。

---

## 当前状态

原始 Control UI 位置：
```
/usr/local/lib/node_modules/openclaw/dist/control-ui/
├── index.html          # 入口
├── assets/             # JS/CSS 模块（已打包）
│   ├── index-xxx.js    # 主应用
│   └── index-xxx.css   # 样式
└── favicon.svg
```

---

## 请选择方案

1. **方案 A** - 小龙主题 CSS（快速，覆盖颜色/字体）
2. **方案 B** - 插件扩展（添加交易/路由/自愈面板）
3. **方案 C** - 完全自定义（替换 Control UI）

请告诉我你的选择，我立即开始实施！
