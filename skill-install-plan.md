# Skill Installation Plan & Security Audit Log

## Skills to Install (Grouped by Category)

### 📅 Calendar & Office Integration
- apple-calendar: macOS Apple Calendar.app integration (low risk, local only)
- apple-reminders: macOS Apple Reminders integration (low risk, local only)
- gcal-pro: Google Calendar integration (medium risk, API access)
- gog: Google Workspace full integration (medium risk, Google API access)
- clippy: Microsoft 365/Outlook integration (medium risk, Microsoft API access)
- feishu-calendar: Feishu/Lark calendar integration (medium risk, Feishu API access)

### 🔒 Security & Audit
- azhua-skill-vetter: Security skill vetting (high risk, scans code for vulnerabilities)
- heimdall: Pre-install malware scanning (high risk, analyzes code patterns)
- backup: OpenClaw configuration backup (medium risk, reads/writes workspace files)

### 🔗 Link & Content Tools
- broken-link-checker: Link availability checker (low risk, network access to external sites)
- summarize-pro: General content summarization (low risk, local processing)
- pdf-ocr: PDF OCR processing (low risk, local file processing)
- mineru-pdf-parser-clawdbot-skill: Local PDF parsing (low risk, local file processing)
- zhipu-web-search: Web search integration (medium risk, external API access)

### 💬 Notifications & Chat
- discord: Discord integration (medium risk, Discord API access)
- slack-extended: Extended Slack integration (medium risk, Slack API access)
- telegram-bot-manager: Telegram bot management (medium risk, Telegram API access)
- webhook-robot: Generic webhook integration (medium risk, custom HTTP requests)

### 💾 Database & Storage
- lite-sqlite: SQLite database integration (low risk, local file operations)
- postgres: PostgreSQL integration (medium risk, database access)
- mysql: MySQL integration (medium risk, database access)

### 🔧 Development & DevOps
- pr-reviewer: GitHub PR review (medium risk, GitHub API access)
- repo-analyzer: Repository analysis (medium risk, local file operations + GitHub API)
- docker-sandbox: Isolated code execution (high risk, runs Docker containers)

---

## Vetting Process
1. For each skill:
   - Run `clawhub inspect <skill-name>` to get metadata
   - Review all skill files for red flags
   - Create security audit report
   - Only install if passes vetting
2. Prioritize low-risk skills first
3. High-risk skills require explicit approval before installation
