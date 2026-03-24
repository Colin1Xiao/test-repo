SKILL VETTING REPORT
═══════════════════════════════════════
Skill: json-render-table
Source: ClawHub
Author: sorphwer
Version: 0.2.0
───────────────────────────────────────
METRICS:
• Downloads/Stars: Not available
• Last Updated: 2026-03-13T04:17:35.914Z
• Files Reviewed: 1 (SKILL.md)
───────────────────────────────────────
RED FLAGS:
- Requires global npm package installation (json-render-cli)
- Uses Playwright/Chromium for rendering, which downloads browser binaries
- Security scan marked as SUSPICIOUS

PERMISSIONS NEEDED:
• Files: Read/write temporary files for rendering
• Network: None (after initial npm package installation)
• Commands: npm, json-render-cli, Playwright/Chromium browser automation
───────────────────────────────────────
RISK LEVEL: 🟡 MEDIUM

VERDICT: ⚠️ INSTALL WITH CAUTION

NOTES:
- Renders JSON data to PNG table images using json-render-cli
- Requires npm global installation which can have security implications
- Uses Playwright for browser-based rendering (Chromium download)
- No external network calls during normal operation
- Useful for visualizing structured data as clean table screenshots
- Marked as non-user-invocable (agent-only skill)
- We will install but monitor for any unexpected behavior
═══════════════════════════════════════
