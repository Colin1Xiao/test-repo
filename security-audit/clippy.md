SKILL VETTING REPORT
═══════════════════════════════════════
Skill: clippy (Microsoft 365 CLI)
Source: ClawHub
Author: foeken
Version: 1.2.0
───────────────────────────────────────
METRICS:
• Downloads/Stars: Not available
• Last Updated: 2026-03-13T03:04:39.739Z
• Files Reviewed: 1 (SKILL.md)
───────────────────────────────────────
RED FLAGS: 
- Uses browser automation (Playwright) to interact with M365 web UI instead of official Graph API
- Maintains persistent browser session which could pose security risk if session files are compromised

PERMISSIONS NEEDED:
• Files: Read/write to ~/.config/clippy/ for browser session storage and configuration
• Network: Access to Microsoft 365 web interface (outlook.office.com)
• Commands: bun runtime, Playwright browser automation
───────────────────────────────────────
RISK LEVEL: 🔴 HIGH

VERDICT: ❌ DO NOT INSTALL until further review

NOTES:
- Security scan marked as SUSPICIOUS due to browser automation patterns
- Bypasses official Microsoft Graph API and uses web scraping/automation which violates most Microsoft 365 terms of service
- Persistent browser session storage contains full access to the user's M365 account
- Higher risk of being blocked by Microsoft's anti-bot systems
- Recommend using official Graph API-based Microsoft 365 integration instead
═══════════════════════════════════════
