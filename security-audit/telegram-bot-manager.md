SKILL VETTING REPORT
═══════════════════════════════════════
Skill: telegram-bot-manager
Source: ClawHub
Author: 362224222
Version: 1.0.0
───────────────────────────────────────
METRICS:
• Downloads/Stars: Not available
• Last Updated: 2026-03-13T03:27:13.914Z
• Files Reviewed: 1 (SKILL.md)
───────────────────────────────────────
RED FLAGS: None

PERMISSIONS NEEDED:
• Files: Read/write configuration files
• Network: Access to Telegram Bot API (https://api.telegram.org/)
• Commands: Python scripts for bot setup and testing
• Environment: Requires Telegram bot token
───────────────────────────────────────
RISK LEVEL: 🟡 MEDIUM

VERDICT: ✅ SAFE TO INSTALL

NOTES:
- Security scan marked as SUSPICIOUS, likely due to network access to Telegram API
- Manages Telegram bot configuration and setup for OpenClaw
- No hardcoded credentials - users provide their own bot tokens
- Supports webhook and polling modes
- Includes bot token validation and connectivity testing
- Python scripts for automated setup and testing
- Well-documented with multiple reference files
- Useful for setting up Telegram integrations with OpenClaw
- Bot tokens should be stored securely (environment variables, not version control)
═══════════════════════════════════════
