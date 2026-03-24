SKILL VETTING REPORT
═══════════════════════════════════════
Skill: ai-ppt-generator
Source: ClawHub
Author: ide-rea
Version: 1.1.3
───────────────────────────────────────
METRICS:
• Downloads/Stars: Not available
• Last Updated: 2026-03-03T10:01:15.308Z
• Files Reviewed: 2 (SKILL.md, scripts/generate_ppt.py)
───────────────────────────────────────
RED FLAGS: None

PERMISSIONS NEEDED:
• Files: None (no local file operations)
• Network: Access to Baidu Qianfan API (https://qianfan.baidubce.com/v2/tools/ai_ppt/)
• Commands: Python 3 with requests library
• Environment: Requires BAIDU_API_KEY environment variable
───────────────────────────────────────
RISK LEVEL: 🟡 MEDIUM

VERDICT: ✅ SAFE TO INSTALL

NOTES:
- Security scan marked as CLEAN
- Uses Baidu Qianfan AI PPT API for generating presentations
- No hardcoded API keys - users must provide their own BAIDU_API_KEY
- Supports intelligent template selection based on content type
- Python scripts are clean with no suspicious patterns
- Generates PPT via streaming API, outputs download URL
- No local file storage, all processing happens on Baidu's servers
- Useful for quickly generating presentations from topics
- Timeout of 300 seconds recommended as generation takes 2-5 minutes
- API endpoint is official Baidu Qianfan service
═══════════════════════════════════════
