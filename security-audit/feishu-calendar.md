SKILL VETTING REPORT
═══════════════════════════════════════
Skill: feishu-calendar
Source: ClawHub
Author: autogame-17
Version: 1.0.0
───────────────────────────────────────
METRICS:
• Downloads/Stars: Not available
• Last Updated: 2026-03-13T04:07:18.408Z
• Files Reviewed: 1 (SKILL.md)
───────────────────────────────────────
RED FLAGS:
- Contains references to "Master's calendar" which suggests this skill may be designed for multi-agent/tenant environments with hierarchical access control
- Setup routine scripts that may run automatically without user intervention
- Security scan marked as SUSPICIOUS

PERMISSIONS NEEDED:
• Files: Read/write local state and sync data
• Network: Access to Feishu Open API (https://open.feishu.cn/)
• Commands: Node.js scripts using Feishu API
• Environment: Requires FEISHU_APP_ID and FEISHU_APP_SECRET in .env file
───────────────────────────────────────
RISK LEVEL: 🔴 HIGH

VERDICT: ❌ DO NOT INSTALL until further review

NOTES:
- Unusual "Master's calendar" terminology suggests this skill may have unexpected access control behavior
- Multiple automated routine scripts (sync_routine.js, setup_routine.js) that could modify calendar data without explicit user action
- Minimal documentation about authentication scopes and data handling
- Recommend finding a more transparent and well-documented Feishu calendar integration
═══════════════════════════════════════
