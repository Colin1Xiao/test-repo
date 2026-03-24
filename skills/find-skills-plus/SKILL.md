---
name: find-skills
description: Search and list available skills in the current workspace. Use when you are unsure what tools are available.
metadata:
  example_query: Find all available skills
---

# Find Skills

This skill helps you discover and list installed skills in your current Trae workspace.

## Capabilities
- **Search**: Find skills by name or description keyword.
- **List**: Display all available skills.

## Typical Usage
1. **List all skills**:
   ```bash
   python3 scripts/find.py
   ```
2. **Search for a skill** (e.g., "scan"):
   ```bash
   python3 scripts/find.py scan
   ```

## Output Example
```text
Found 3 skills:
NAME                           DESCRIPTION
--------------------------------------------------------------------------------
api-auth-scan                  Scans API code for authentication issues...
config-sensitive-scan          Scans configuration files for sensitive info...
source-credential-scan         Scans source code for sensitive credentials...
```
