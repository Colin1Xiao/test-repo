# OpenClaw 最终技能策略清单
更新时间: 2026-03-14 07:36
生效范围: 所有会话
状态: 最终版

---

## 1) 常开

这些适合作为基础能力长期启用。

| 技能 | 分组 | 权限 | 使用限定 |
| ------------------------ | -- | ---- | ----------------------- |
| `skill-vetter` | 常开 | 只读 | 仅用于安装前审查，不得自动安装/删除技能 |
| `markdown-formatter` | 常开 | 只读 | 仅格式化文本，不改业务内容 |
| `summarize-pro` | 常开 | 只读 | 仅做摘要、提炼、改写，不触发外部动作 |
| `daily-digest` | 常开 | 只读 | 仅生成日报/摘要，不自动外发 |
| `chart-image` | 常开 | 只读 | 仅生成图表图片，不上传外部服务 |
| `json-render-table` | 常开 | 只读 | 仅渲染表格，不外发敏感数据 |
| `skill-mermaid-diagrams` | 常开 | 只读 | 仅生成图示，不访问外网 |
| `broken-link-checker` | 常开 | 只读 | 仅检查链接状态，不跟随登录态执行 |
| `openai-whisper` | 常开 | 本地只读 | 仅本地转写音频，不上传云端 |
| `lite-sqlite` | 常开 | 受限写入 | 仅允许写指定 `.db` 文件，不改系统数据库 |

---

## 2) 常开但只读

这些可以长期可用，但默认只读，不做写入型动作。

| 技能 | 分组 | 权限 | 使用限定 |
| ---------------------- | ----- | ---- | ------------------------------------ |
| `gcal-pro` | 常开但只读 | 只读 | 默认仅查看事件；创建/编辑/删除需单独授权 |
| `apple-calendar-macos` | 常开但只读 | 只读 | 默认仅读取日历，不批量改事件 |
| `apple-reminders` | 常开但只读 | 只读 | 默认仅查看提醒事项；新建/修改需确认 |
| `mineru-pdf-parser` | 常开但只读 | 本地只读 | 仅本地解析 PDF，不自动外发原文 |
| `repo-analyzer` | 常开但只读 | 只读 | 仅分析仓库，不提交改动 |
| `gitload` | 常开但只读 | 只读 | 仅加载/读取仓库内容，不推送远端 |
| `crypto-data` | 常开但只读 | 只读 | 仅读行情与市场数据，不触发交易 |
| `crypto-risk` | 常开但只读 | 只读 | 仅输出风控建议，不自动执行 |
| `crypto-signals` | 常开但只读 | 只读 | 仅生成信号/提醒，不直连下单 |
| `crypto-ta` | 常开但只读 | 只读 | 仅计算指标，不触发交易 |
| `google-workspace-mcp` | 常开但只读 | 只读 | 默认仅查 Gmail/Drive/Docs/Calendar，不做写操作 |

---

## 3) 按需开启

这些很有用，但只在明确任务下开启。

| 技能 | 分组 | 权限 | 使用限定 |
| ---------------------------- | ---- | ------- | ---------------------------------- |
| `notion` | 按需开启 | 受限写入 | 仅允许指定 workspace/database；批量改动需确认 |
| `discord` | 按需开启 | 受限写入 | 仅允许白名单服务器/频道；禁止大规模管理操作 |
| `slack` | 按需开启 | 受限写入 | 仅允许白名单频道；默认不做批量动作 |
| `telegram-bot-manager` | 按需开启 | 受限写入 | 仅管理指定 bot；不得暴露 token |
| `pg` | 按需开启 | 受限写入 | 仅允许指定 schema/database；禁止危险 DDL/DML |
| `pr-reviewer` | 按需开启 | 只读/受限写入 | 默认只审查 PR；发评论前建议人工确认 |
| `ai-ppt-generator` | 按需开启 | 外部写入 | 不上传敏感内容；仅用于公开或低敏材料 |
| `openai-whisper-api` | 按需开启 | 外部传输 | 仅在本地转写不足时使用，不传高敏音频 |
| `sag` | 按需开启 | 外部传输 | 仅做 TTS，不传密钥和敏感文本 |
| `browser-automation` | 按需开启 | 高风险 | 默认只读（浏览/抓取/截图）；登录、提交、支付、发帖均需确认 |
| `file-manager` | 按需开启 | 高风险 | 仅允许白名单目录；禁止全盘操作、批量删除覆盖 |
| `cron-scheduler` | 按需开启 | 高风险 | 仅调度白名单任务；禁止定时交易、批量删改、权限变更 |
| `afrexai-stakeholder-report` | 按需开启 | 只读 | 仅生成报告，不自动外发 |
| `backup` | 按需开启 | 高风险 | 仅备份白名单目录/配置；恢复操作必须人工确认 |
| `webhook` | 按需开启 | 外部写入 | 仅发往白名单域名；不得发送密钥、原文档、完整日志 |

---

## 4) 默认禁用 / 测试环境限定

这些要么高风险，要么行为边界过大，不应在生产环境常开。

| 技能 | 分组 | 权限 | 使用限定 |
| ---------------- | --------- | ---- | ---------------------------------------------- |
| `crypto-execute` | 默认禁用/测试限定 | 极高风险 | 默认仅测试网；实盘必须人工确认；禁止与 signals/cron/browser 直连 |
| `self-improving` | 默认禁用/测试限定 | 极高风险 | 仅测试环境；不得改策略、装技能、改 cron、改数据库 schema |
| `docker-sandbox` | 默认禁用/测试限定 | 受控隔离 | 仅在运行高风险/不受信任 skill 时启用；禁止挂载敏感目录和 `docker.sock` |

---

# 全局使用限定

## A. 技能调用总原则

* 默认最小权限
* 默认只读优先
* 高风险动作必须人工确认
* 不允许多技能自动串联成高风险链路

## B. 明确禁止的链路

下面这些组合应直接禁止：

* `crypto-signals -> crypto-execute`
* `crypto-ta -> crypto-execute`
* `crypto-risk -> crypto-execute`
* `browser-automation -> crypto-execute`
* `cron-scheduler -> crypto-execute`
* `self-improving -> cron-scheduler`
* `self-improving -> backup restore`
* `self-improving -> file-manager`
* `mineru-pdf-parser -> webhook` 直接发送原文
* `google-workspace-mcp -> webhook` 批量外发文档/邮件内容
* `file-manager -> backup restore` 自动覆盖恢复

## C. 文件与目录白名单

建议只允许技能访问这些目录：

* OpenClaw 工作区: `~/.openclaw/workspace/`
* 技能配置目录: `~/.openclaw/skills/`
* 专用数据目录: `~/.openclaw/data/`
* 专用备份目录: `~/Backups/`
* 专用 SQLite 数据目录: `~/.openclaw/db/`

明确禁止访问：

* SSH 密钥目录: `~/.ssh/`
* 浏览器 Cookie / Profile 目录
* 系统配置目录: `/etc/`, `/usr/local/etc/`
* 钱包/私钥目录
* 整个用户主目录的无差别扫描

## D. 外发数据限制

以下内容默认禁止通过 `discord` / `slack` / `telegram-bot-manager` / `webhook` / `ai-ppt-generator` / `openai-whisper-api` / `sag` 外发：

* API keys
* Token / Cookie / Session
* 原始 PDF / 原始音频
* 完整数据库导出
* 全量日志
* 高敏业务文档原文

## E. 数据库限制

### `lite-sqlite`

* 仅指定单一 db 文件
* 只允许日志表、缓存表、分析结果表

### `pg`

* 禁止自动执行：
  * `DROP`
  * `TRUNCATE`
  * 大范围 `DELETE`
  * 未审阅的 `ALTER`
* 默认只允许 `SELECT` / 受限 `INSERT`

---

# 推荐运行状态

## 常开 (10个)

`skill-vetter`
`markdown-formatter`
`summarize-pro`
`daily-digest`
`chart-image`
`json-render-table`
`skill-mermaid-diagrams`
`broken-link-checker`
`openai-whisper`
`lite-sqlite`

## 常开但只读 (11个)

`gcal-pro`
`apple-calendar-macos`
`apple-reminders`
`mineru-pdf-parser`
`repo-analyzer`
`gitload`
`crypto-data`
`crypto-risk`
`crypto-signals`
`crypto-ta`
`google-workspace-mcp`

## 按需开启 (15个)

`notion`
`discord`
`slack`
`telegram-bot-manager`
`pg`
`pr-reviewer`
`ai-ppt-generator`
`openai-whisper-api`
`sag`
`browser-automation`
`file-manager`
`cron-scheduler`
`afrexai-stakeholder-report`
`backup`
`webhook`

## 默认禁用 / 测试环境限定 (3个)

`crypto-execute`
`self-improving`
`docker-sandbox`

---

# 最终一句话建议

**交易执行默认禁用，自动化写操作默认需确认，外发与恢复动作全部走白名单。**

---
*本策略由 Colin Xiao 制定，小龙执行监督*
