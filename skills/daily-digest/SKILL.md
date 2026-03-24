---
name: daily-digest
description: Generate a daily digest from memory and interactions, stored as journals/digest/digest-YYYY-MM-DD.md. Extracts decisions, lessons, actions, and questions from memory files.
metadata:
  openclaw:
    emoji: 📰
    version: 1.0.0
---

# Daily Digest Skill

Generate a daily digest from memory and interactions, stored as journals/digest/digest-YYYY-MM-DD.md.

Usage:
- Run the digest_daily.py script to generate today's digest.
- Optional: integrate with OpenClaw to run automatically via a cron job or a scheduler.

Notes:
- The script reads memory/YYYY-MM-DD.md and optionally memory/YYYY-MM-DD.md from yesterday to extract decisions, lessons, actions, and questions.
- It also provides a placeholder summary when no structured entries exist in memory.
