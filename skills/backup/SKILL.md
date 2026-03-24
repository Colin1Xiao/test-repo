---
name: backup
description: 自动备份技能，支持文件、数据库、配置的定期备份和恢复。支持增量备份、压缩、加密、云存储同步。
metadata:
  openclaw:
    emoji: 💾
    version: 1.0.0
    requires:
      bins:
        - rsync
        - tar
        - gzip
    configPaths:
      - ~/.openclaw/backup/
---

# Backup - 自动备份技能

自动备份文件、数据库、配置，支持增量备份、压缩、加密、云存储同步。

## 功能

- 📁 **文件备份** - 指定目录备份，支持增量和全量
- 🗄️ **数据库备份** - SQLite/PostgreSQL 数据库备份
- ⚙️ **配置备份** - OpenClaw 配置、技能配置备份
- 📦 **压缩加密** - gzip压缩 + AES加密
- ☁️ **云同步** - 支持 AWS S3、阿里云OSS、本地NAS
- 🔄 **定时任务** - 配合 cron-scheduler 自动执行

## 使用

```bash
# 备份工作区
backup workspace --dest ~/Backups/openclaw

# 备份数据库
backup database --name trading_db --dest ~/Backups/db

# 备份配置
backup config --include skills,cron,gateway

# 恢复备份
backup restore --from ~/Backups/openclaw/2026-03-14.tar.gz
```

## 配置

`~/.openclaw/backup/config.json`:
```json
{
  "sources": [
    "~/.openclaw/workspace/",
    "~/.openclaw/openclaw.json"
  ],
  "dest": "~/Backups/",
  "schedule": "0 2 * * *",
  "retention": 30,
  "compress": true,
  "encrypt": false
}
```
