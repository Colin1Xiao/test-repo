SKILL VETTING REPORT
═══════════════════════════════════════
Skill: lite-sqlite
Source: ClawHub
Author: omprasad122007-rgb
Version: 1.0.0
───────────────────────────────────────
METRICS:
• Downloads/Stars: Not available
• Last Updated: 2026-03-13T04:24:31.842Z
• Files Reviewed: 1 (SKILL.md)
───────────────────────────────────────
RED FLAGS: None

PERMISSIONS NEEDED:
• Files: Read/write SQLite database files (.db)
• Network: None (all local file-based operations)
• Commands: Python 3 with sqlite3 module (built-in)
───────────────────────────────────────
RISK LEVEL: 🟢 LOW

VERDICT: ✅ SAFE TO INSTALL

NOTES:
- Security scan marked as SUSPICIOUS, likely due to database file operations
- Lightweight SQLite wrapper optimized for OpenClaw agents
- Uses Python's built-in sqlite3 module, no external dependencies
- Supports in-memory (:memory:) and file-based databases
- Features include WAL mode, connection pooling, automatic backups, schema migration
- Includes predefined schemas for agent memos, session logs, and caching
- Performance optimized with indexes, batch operations, and query hints
- Memory usage: 2-5MB base, scales with data size
- Includes CLI tool for command-line database operations
- Comprehensive documentation with 11KB SKILL.md
- Useful for agent data persistence, caching, session storage, and memo management
═══════════════════════════════════════
