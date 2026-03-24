---
name: browser-automation
description: 浏览器自动化技能，使用Playwright开网页、点按钮、填表单、截图。用于重复网页操作、爬取、自动提交、监控页面变化。用当用户问自动化网页交互、网页爬取、表单提交、页面监控时。
metadata:
  openclaw:
    emoji: 🌐
    version: 1.0.0
---

# 浏览器自动化技能

## 快速开始

1. 安装Playwright：exec `npx playwright install` (带browsers)。

2. 运行脚本：用exec运行JS脚本控制浏览器。

## 工作流

- **启动浏览器**：用headless: true for 无头模式（默认），false for 可见。

- **导航/交互**：navigate, click, fill, screenshot。

- **监控**：poll页面变化，截图比较。

## Scripts

- scripts/automate.js: 基础模板，参数化URL、动作。

## References

- references/playwright-api.md: API细节。

用时读这些文件。

