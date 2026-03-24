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

# Webhook - HTTP请求技能

通用HTTP请求，支持REST API调用、webhook发送、服务集成。

## 功能

- 🚀 **全方法支持** - GET/POST/PUT/DELETE/PATCH/HEAD/OPTIONS
- 📋 **数据格式** - JSON、Form、Multipart、Raw
- 🔐 **认证支持** - Bearer Token、Basic Auth、API Key、OAuth2
- 📤 **文件上传** - 支持文件作为multipart发送
- ⏱️ **超时控制** - 可配置超时和重试
- 📊 **响应处理** - JSON解析、状态码检查、错误处理
- 🔒 **安全限制** - URL白名单、禁止访问内网敏感地址

## 使用

```bash
# POST JSON
webhook post --url https://api.example.com/data --json '{"key":"value"}'

# GET 请求
webhook get --url https://api.example.com/status

# 带认证
webhook post --url https://api.example.com/webhook --token $API_TOKEN --json '{"event":"test"}'

# 发送文件
webhook post --url https://api.example.com/upload --file ./report.pdf

# 调用 Slack webhook
webhook post --url $SLACK_WEBHOOK_URL --json '{"text":"Hello from OpenClaw"}'
```

## 配置

`~/.openclaw/webhook/config.json`:
```json
{
  "timeout": 30,
  "retry": 3,
  "allowlist": [
    "https://api.openai.com/*",
    "https://hooks.slack.com/*",
    "https://discord.com/api/*"
  ],
  "denylist": [
    "http://localhost:*",
    "http://127.0.0.1:*",
    "http://192.168.*",
    "http://10.*"
  ],
  "defaultHeaders": {
    "User-Agent": "OpenClaw-Webhook/1.0"
  }
}
```

## 安全原则

- 默认禁止访问本地地址 (localhost/127.0.0.1/内网IP)
- 敏感API需配置token，禁止明文存储
- 大额/重要操作需人工确认
- 记录所有请求日志用于审计
