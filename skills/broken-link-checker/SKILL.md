---
name: broken-link-checker
description: Verify external URLs (http/https) for availability (200-399 status code).
metadata:
  openclaw:
    emoji: 🔗
    version: 1.0.0
    requires:
      bins:
        - node
---

# Broken Link Checker

Verify external URLs for availability. Useful for checking documentation links or external references.

## Usage

```bash
node skills/broken-link-checker/index.js <url1> [url2...]
```

## Output

JSON array of results:
```json
[
  {
    "url": "https://example.com",
    "valid": true,
    "status": 200
  },
  {
    "url": "https://example.com/broken",
    "valid": false,
    "status": 404
  }
]
```
