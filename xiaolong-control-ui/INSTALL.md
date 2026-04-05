# 🐉 小龙 Control UI 改造 - 安装指南

## 方案选择

### 方案 A：UserScript（推荐，最简单）
无需安装扩展，直接在浏览器中运行。

**安装步骤：**

1. **安装 Tampermonkey 扩展**
   - Chrome: [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - Firefox: [Tampermonkey](https://addons.mozilla.org/firefox/addon/tampermonkey/)
   - Safari: [Userscripts](https://apps.apple.com/app/userscripts/id1463298887)

2. **安装小龙脚本**
   - 打开 `xiaolong-ui.user.js` 文件
   - 复制全部内容
   - 在 Tampermonkey 中创建新脚本，粘贴内容
   - 保存 (Ctrl+S)

3. **访问 Control UI**
   ```
   http://localhost:18789/?token=YOUR_TOKEN
   ```
   或
   ```
   openclaw dashboard
   ```

4. **使用**
   - 右下角会出现 🐉 悬浮按钮
   - 点击打开小龙 Dashboard 面板
   - 支持 4 个 Tab：健康 / 交易 / 路由 / 自愈

---

### 方案 B：浏览器扩展
适合需要更深度定制的场景。

**安装步骤：**

1. **Chrome/Edge**
   ```bash
   cd /Users/colin/.openclaw/workspace/xiaolong-control-ui/extension
   # 加载已解压的扩展
   # 1. 打开 chrome://extensions/
   # 2. 开启"开发者模式"
   # 3. 点击"加载已解压的扩展"
   # 4. 选择 extension 文件夹
   ```

2. **Firefox**
   ```bash
   cd /Users/colin/.openclaw/workspace/xiaolong-control-ui/extension
   # 打包为 zip，在 about:debugging 中加载
   ```

---

### 方案 C：CSS 主题文件
仅修改颜色主题，不添加功能。

**使用方法：**

1. 打开 Control UI 设置
2. 找到"自定义 CSS"选项
3. 复制 `themes/xiaolong-theme.css` 内容
4. 粘贴到自定义 CSS 框中
5. 保存

---

## 功能说明

### 🐉 小龙 Dashboard 面板

点击右下角的 🐉 按钮打开面板：

| Tab | 功能 |
|-----|------|
| **健康** | Gateway / Telegram / Memory / Cron / 交易系统状态 |
| **交易** | 实时持仓、余额、盈亏统计 |
| **路由** | OCNMPS 请求统计、灰度命中率 |
| **自愈** | 自动恢复历史记录 |

### 🎨 主题效果

- 紫色渐变主题（#7c5cfc → #a78bfa）
- 翠绿状态指示器（#2dd4a0）
- 玻璃拟态面板
- 脉冲动画效果

---

## 故障排除

### 脚本不生效
1. 检查 Tampermonkey 是否启用
2. 检查脚本是否匹配当前 URL
3. 刷新页面 (F5)

### API 请求失败
1. 确保 URL 包含 `?token=xxx` 参数
2. 检查 `.env` 中的 token 是否正确
3. 查看浏览器控制台错误信息

### 样式异常
1. 清除浏览器缓存
2. 禁用其他可能冲突的扩展
3. 检查 Control UI 版本兼容性

---

## 文件说明

```
xiaolong-control-ui/
├── xiaolong-ui.user.js      # 主脚本（UserScript）
├── themes/
│   └── xiaolong-theme.css   # CSS 主题文件
├── extension/               # 浏览器扩展
│   ├── manifest.json
│   ├── content.js
│   └── ...
├── INSTALL.md               # 本文档
└── README.md
```

---

## 更新日志

### v1.0.0 (2026-04-05)
- ✅ 小龙主题 CSS
- ✅ Dashboard 悬浮面板
- ✅ 健康/交易/路由/自愈 4 个 Tab
- ✅ 实时数据刷新

---

_🐉 小龙 Control UI 改造完成！_
