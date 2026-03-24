# OpenClaw Skill Metadata Standard

## Overview

This document defines the unified metadata format for all OpenClaw skills.

## Standard Format

All SKILL.md files must include a YAML frontmatter with the following structure:

```yaml
---
name: skill-name
description: A clear description of what this skill does.
metadata:
  openclaw:
    emoji: "🎨"
    version: "1.0.0"
    author: "Author Name"
    homepage: "https://example.com"
    changelog: "Brief description of latest changes"
    requires:
      bins:
        - binary1
        - binary2
      pip:
        - package1
        - package2
      env:
        - ENV_VAR1
        - ENV_VAR2
      tools:
        - tool1
        - tool2
      anyBins:
        - alt-binary1
        - alt-binary2
    primaryEnv: "MAIN_ENV_VAR"
    configPaths:
      - "~/.openclaw/skill-name/"
    os:
      - darwin
      - linux
      - win32
    install:
      - id: "brew"
        kind: "brew"
        formula: "formula-name"
        bins:
          - binary-name
        label: "Install via Homebrew"
    category: "tools"
    tags:
      - tag1
      - tag2
    provides:
      - capability: "feature-name"
        methods:
          - method1
          - method2
    userInvocable: true
---
```

## Field Descriptions

### Required Fields

- **name**: The skill name (lowercase, alphanumeric with hyphens)
- **description**: A clear, concise description of what the skill does

### Metadata Fields (all under `metadata.openclaw`)

| Field | Type | Description |
|-------|------|-------------|
| `emoji` | string | Emoji icon for the skill (optional but recommended) |
| `version` | string | Semantic version (e.g., "1.0.0") |
| `author` | string | Author name |
| `homepage` | string | URL to skill homepage or documentation |
| `changelog` | string | Brief changelog entry |
| `requires.bins` | array | Required binary executables |
| `requires.pip` | array | Required Python packages |
| `requires.env` | array | Required environment variables |
| `requires.tools` | array | Required OpenClaw tools |
| `requires.anyBins` | array | Alternative binaries (at least one required) |
| `primaryEnv` | string | Primary environment variable name |
| `configPaths` | array | Configuration directory paths |
| `os` | array | Supported operating systems (darwin, linux, win32) |
| `install` | array | Installation instructions |
| `category` | string | Skill category |
| `tags` | array | Tags for categorization |
| `provides` | array | Capabilities and methods provided |
| `userInvocable` | boolean | Whether users can directly invoke this skill |

## Format Rules

1. **Use YAML format**, not JSON
2. **Indentation**: Use 2 spaces for indentation
3. **Arrays**: Use YAML list format (`- item`) not JSON arrays
4. **Strings**: No quotes needed unless special characters present
5. **Keys**: Use camelCase for all keys

## Migration Notes

- All `clawdbot` metadata has been migrated to `openclaw`
- JSON metadata has been converted to YAML format
- Top-level fields like `version`, `slug`, `homepage`, `changelog` have been moved under `metadata.openclaw`
- `user-invocable` has been changed to `userInvocable` (camelCase)

## Example

```yaml
---
name: webhook
description: 通用HTTP请求技能，支持POST/GET/PUT/DELETE/PATCH，用于集成外部服务、发送通知、调用API。
metadata:
  openclaw:
    emoji: 🌐
    version: 1.0.0
    requires:
      bins:
        - curl
    configPaths:
      - ~/.openclaw/webhook/
---
```

## Validation

Skills should be validated against this standard before packaging or distribution.
