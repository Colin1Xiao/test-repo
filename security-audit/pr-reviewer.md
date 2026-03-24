SKILL VETTING REPORT
═══════════════════════════════════════
Skill: pr-reviewer
Source: ClawHub
Author: briancolinger
Version: 1.0.1
───────────────────────────────────────
METRICS:
• Downloads/Stars: Not available
• Last Updated: 2026-03-13T03:21:35.120Z
• Files Reviewed: 2 (SKILL.md, scripts/pr-review.sh)
───────────────────────────────────────
RED FLAGS: None

PERMISSIONS NEEDED:
• Files: Read/write review state (./data/pr-reviews.json) and reports (./data/pr-reviews/)
• Network: Access to GitHub API (via gh CLI)
• Commands: bash, gh CLI, python3, optional golangci-lint/ruff
• Environment: PR_REVIEW_REPO, PR_REVIEW_DIR, PR_REVIEW_STATE, PR_REVIEW_OUTDIR
───────────────────────────────────────
RISK LEVEL: 🟡 MEDIUM

VERDICT: ✅ SAFE TO INSTALL

NOTES:
- Security scan marked as SUSPICIOUS, likely due to shell script execution and GitHub API access
- 18KB bash script for automated GitHub PR code review
- Analyzes diffs for security issues, error handling gaps, style problems, and test coverage
- Supports Go, Python, and JavaScript/TypeScript
- Detects hardcoded credentials, AWS keys, private keys, error handling issues, style violations
- Runs local lint (golangci-lint for Go, ruff for Python) when available
- Smart re-review: tracks HEAD SHA, only re-reviews when new commits pushed
- Generates markdown reports with findings summary and verdict
- Can post reviews as GitHub PR comments
- Supports heartbeat/cron integration for automated PR monitoring
- No external dependencies beyond gh CLI and optional linters
- Well-structured script with clear command structure: check, review, post, status, list-unreviewed
═══════════════════════════════════════
