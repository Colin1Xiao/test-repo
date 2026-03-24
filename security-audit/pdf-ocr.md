SKILL VETTING REPORT
═══════════════════════════════════════
Skill: pdf-ocr
Source: ClawHub
Author: dadaniya99
Version: 1.0.0
───────────────────────────────────────
METRICS:
• Downloads/Stars: Not available
• Last Updated: 2026-03-13T05:30:16.856Z
• Files Reviewed: 1 (SKILL.md)
───────────────────────────────────────
RED FLAGS:
- Hardcoded Baidu OCR API keys included in the skill documentation
- API keys are shared among all users of this skill, which poses privacy and security risks
- Security scan marked as SUSPICIOUS

PERMISSIONS NEEDED:
• Files: Read local PDF files, write output DOCX files
• Network: Access to Baidu OCR API (https://aip.baidubce.com/)
• Commands: Python scripts with pymupdf, python-docx, pillow dependencies
───────────────────────────────────────
RISK LEVEL: 🔴 HIGH

VERDICT: ❌ DO NOT INSTALL

NOTES:
- Hardcoded API keys in publicly available skill are a major security issue
- Using shared API keys means all OCR requests are sent through the same Baidu account, exposing user's document content to the skill author and other users
- Baidu OCR API is located in China and subject to Chinese data privacy laws
- Recommend using a self-hosted OCR solution or one that requires users to provide their own API keys
- We will search for a more secure PDF OCR skill that doesn't include hardcoded credentials
═══════════════════════════════════════
