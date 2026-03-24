SKILL VETTING REPORT
═══════════════════════════════════════
Skill: zhipu-web-search
Source: ClawHub
Author: whyhit2005
Version: 1.0.8
───────────────────────────────────────
METRICS:
• Downloads/Stars: Not available
• Last Updated: 2026-03-13T16:21:51.290Z
• Files Reviewed: 2 (SKILL.md, _meta.json)
───────────────────────────────────────
RED FLAGS: None

PERMISSIONS NEEDED:
• Files: None (uses curl directly, no file operations)
• Network: Access to Zhipu AI API (https://open.bigmodel.cn/api/paas/v4/web_search)
• Commands: curl, bash script
• Environment: Requires ZHIPU_API_KEY environment variable with user's own API key
───────────────────────────────────────
RISK LEVEL: 🟡 MEDIUM

VERDICT: ✅ SAFE TO INSTALL

NOTES:
- Security scan marked as CLEAN
- Lightweight implementation using curl only, no external dependencies
- Supports multiple search engines (Quark, Sogou, Zhipu Search) with time range filtering
- No hardcoded API keys - users must provide their own Zhipu API key
- Supports result count up to 50 with summary or detailed content options
- Wrapper script is only 1.3KB, very minimal and auditable
- Useful for retrieving up-to-date web information and current events
═══════════════════════════════════════
