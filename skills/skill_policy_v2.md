# OpenClaw 技能使用策略 v2.0
更新时间: 2026-03-14 07:17
生效范围: 所有会话

## 一、技能调用总原则

1. **默认最小权限** - 技能只获得完成任务所需的最小权限
2. **默认只读优先** - 除非明确需要修改，否则优先使用只读模式
3. **高风险动作必须人工确认** - 任何可能影响系统、数据、资金的操作必须得到用户明确授权
4. **禁止技能链自动跨高风险** - 不允许一个技能链自动触发另一个高风险技能

## 二、目录与文件限定

### file-manager
- ✅ 仅允许操作指定工作区: `/Users/colin/.openclaw/workspace/`
- ❌ 禁止访问:
  - 用户主目录全盘 (`~/*`)
  - SSH 密钥目录 (`~/.ssh/`)
  - 系统配置目录 (`/etc/`, `/usr/local/etc/`)
  - 浏览器配置与 Cookie 目录
  - 钱包、密钥、凭证目录

### cron-scheduler
- 只能调度白名单脚本（位于 `~/scripts/allowed/`）
- 禁止调度系统级任务

### browser-automation
- 不得读取本地敏感文件上传到网页
- 不得访问本地文件系统（除指定下载目录外）

## 三、网络与账号限定

### browser-automation
- ❌ 不允许登录以下平台:
  - 银行网站
  - 交易所后台管理
  - 邮箱管理后台
  - 管理员控制台
- ✅ 允许: 公开信息查询、表单填写、数据爬取

### google-workspace-mcp
- 默认只读模式
- 写入操作需用户明确授权

### discord / slack / telegram-bot-manager
- 只允许发送到白名单频道/群组/bot
- 禁止向未授权频道发送消息

## 四、数据与交易限定

### crypto-execute
- **默认测试网** (`testnet: true`)
- ❌ 禁止自动实盘
- ❌ 禁止高杠杆默认值
- 必须设置:
  - 最大单笔金额
  - 最大仓位
  - 最大日亏损限额

### crypto-signals / crypto-risk / crypto-ta
- 不得直接触发 crypto-execute
- 只能输出分析结果和建议
- 交易执行必须由用户手动确认

## 五、自学习与自动化限定

### self-improving
- **仅限测试环境**（隔离会话）
- ❌ 不允许修改技能策略文件
- ❌ 不允许修改 cron 配置
- ❌ 不允许改数据库 schema
- ❌ 不允许安装新 skill
- ✅ 只能输出改进建议，不得自动执行改动

## 六、数据库存取限定

### lite-sqlite
- 只允许单独指定 db 文件
- 禁止自动执行:
  - `DROP`
  - `TRUNCATE`
  - 批量 `DELETE`
  - `ALTER` 大范围 schema 变更

### pg (PostgreSQL)
- 只允许指定 schema
- 分析技能只能写入:
  - 日志表
  - 缓存表
  - 结果表

## 七、技能分组配置

### 🟢 常开（默认启用）
- 🔒 **skill-vetter**: 安装/更新技能前自动安全审查
- 📝 **markdown-formatter**: Markdown格式化美化
- 📄 **summarize-pro**: 智能摘要生成
- 📮 **daily-digest**: 每日工作摘要自动生成
- 📊 **chart-image**: 图表生成
- 📋 **json-render-table**: 表格渲染
- 📈 **skill-mermaid-diagrams**: 技术图表生成
- 🔗 **broken-link-checker**: 链接可用性检查
- 🎙️ **openai-whisper**: 本地语音转文字
- 🗄️ **lite-sqlite**: 轻量级数据库（受限模式）

### 🔵 常开但只读
- 📅 **gcal-pro**: Google日历（只读）
- 📅 **apple-calendar-macos**: Apple日历（只读）
- ✅ **apple-reminders**: 提醒事项（只读）
- 📄 **mineru-pdf-parser**: PDF解析
- 📊 **repo-analyzer**: 仓库分析
- 📦 **gitload**: Git仓库加载
- 💹 **crypto-data**: 加密货币行情（只读）
- 🛡️ **crypto-risk**: 风险评估（只读）
- 🚨 **crypto-signals**: 交易信号（只读）
- 📈 **crypto-ta**: 技术指标（只读）
- 📧 **google-workspace-mcp**: Google Workspace（默认只读）

### 🟡 按需开启（需用户明确要求）
- 📝 **notion**: Notion文档管理
- 💬 **discord**: Discord操作
- 💬 **slack**: Slack操作
- 🤖 **telegram-bot-manager**: Telegram机器人管理
- 🗄️ **pg**: PostgreSQL数据库（受限模式）
- 👁️ **pr-reviewer**: PR代码审查
- 🎨 **ai-ppt-generator**: AI PPT生成
- ☁️ **openai-whisper-api**: 云端语音转文字
- 🗣️ **sag**: 文本转语音
- 🌐 **browser-automation**: 浏览器自动化
- 🗂️ **file-manager**: 文件管理（受限目录）
- ⏰ **cron-scheduler**: 定时任务（白名单）
- 📊 **afrexai-stakeholder-report**: 利益相关者报告

### 🔴 默认禁用 / 测试环境限定
- ⚡ **crypto-execute**: 交易执行（默认禁用，需显式启用测试网/实盘授权）
- 🧠 **self-improving**: 自改进代理（仅限隔离测试环境）

## 八、建议补充技能

根据当前技能库，建议再补充以下3类技能:

1. **backup** - 自动备份技能，支持文件、数据库、配置的定期备份
2. **docker-sandbox** - Docker沙箱环境，用于安全执行不可信代码
3. **webhook** - 通用HTTP请求技能，支持POST/GET/PUT/DELETE，用于集成外部服务

## 九、违规处理

- 任何违反上述策略的技能调用将被拒绝
- 高风险操作未获得授权将被记录并告警
- 连续违规将触发技能临时禁用

---
*本策略由 Colin Xiao 制定，小龙执行监督*
