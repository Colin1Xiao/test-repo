SKILL VETTING REPORT
═══════════════════════════════════════
Skill: gitload
Source: ClawHub
Author: waldekmastykarz
Version: 1.0.0
───────────────────────────────────────
METRICS:
• Downloads/Stars: Not available
• Last Updated: 2026-02-27T03:02:08.659Z
• Files Reviewed: 1 (SKILL.md)
───────────────────────────────────────
RED FLAGS: None

PERMISSIONS NEEDED:
• Files: Write downloaded files/folders to local directory
• Network: Access to GitHub API (api.github.com) for downloading content
• Commands: npx gitload-cli or globally installed gitload-cli
• Environment: Optional GITHUB_TOKEN for private repos or rate limit handling
───────────────────────────────────────
RISK LEVEL: 🟡 MEDIUM

VERDICT: ✅ SAFE TO INSTALL

NOTES:
- Security scan marked as SUSPICIOUS, likely due to GitHub API access
- Downloads files, folders, or entire repos from GitHub without cloning
- Uses gitload-cli via npx (no install needed) or can be installed globally
- Supports downloading specific folders, single files, or entire repos
- Can create ZIP archives of GitHub content
- Supports authentication via gh CLI, explicit token, or environment variable
- No git history preserved (use git clone if history is needed)
- Downloads via GitHub API, not git protocol
- Useful for scaffolding from templates, grabbing example code, or fetching specific files
- Author waldekmastykarz is a Microsoft employee and well-known developer
═══════════════════════════════════════
