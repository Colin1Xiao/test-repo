SKILL VETTING REPORT
═══════════════════════════════════════
Skill: repo-analyzer
Source: ClawHub
Author: Don-GBot
Version: 1.2.0
───────────────────────────────────────
METRICS:
• Downloads/Stars: Not available
• Last Updated: 2026-03-13T04:36:59.672Z
• Files Reviewed: 1 (SKILL.md)
───────────────────────────────────────
RED FLAGS: None

PERMISSIONS NEEDED:
• Files: Read local repo list files for batch mode
• Network: Access to GitHub API (api.github.com) via gh CLI or unauthenticated
• Commands: Node.js 18+, gh CLI (optional), git (optional)
• Environment: GITHUB_TOKEN recommended for full functionality
───────────────────────────────────────
RISK LEVEL: 🟡 MEDIUM

VERDICT: ✅ SAFE TO INSTALL

NOTES:
- Security scan marked as SUSPICIOUS, likely due to malware hash database and extensive GitHub API access
- Comprehensive GitHub repository trust scoring tool with 29 analysis modules across 14 categories
- Includes malware hash database (data/malware-hashes.json) for detecting known malicious packages
- Scores repos on commit health, contributors, code quality, AI authenticity, social signals, activity, crypto safety, dependencies, fork quality, README quality, maintainability, project health, originality, and agent safety
- Supports batch analysis, tweet URL extraction, and JSON output
- 151KB analyze.js script is comprehensive but should be reviewed before use
- Requires GITHUB_TOKEN for full functionality (rate limits apply without it)
- Useful for crypto/DeFi due diligence, trust scoring, and repository auditing
- No external dependencies beyond Node.js and optional gh CLI
═══════════════════════════════════════
