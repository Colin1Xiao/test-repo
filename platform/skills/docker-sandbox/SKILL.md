---
name: docker-sandbox
description: Docker沙箱环境，用于安全执行不可信代码、测试新技能、运行隔离任务。支持临时容器、资源限制、网络隔离。
metadata:
  openclaw:
    emoji: 🐳
    version: 1.0.0
    requires:
      bins:
        - docker
      env:
        - DOCKER_HOST
    primaryEnv: DOCKER_HOST
---

# Docker Sandbox - 安全沙箱环境

用于安全执行不可信代码、测试新技能、运行隔离任务。

## 功能

- 🔒 **安全隔离** - 代码在独立容器中运行，不影响主机
- 🧪 **技能测试** - 新技能先在沙箱验证再部署
- 📊 **资源限制** - CPU、内存、磁盘、网络限制
- 🌐 **网络隔离** - 可选禁止外网访问
- 📝 **日志审计** - 完整记录沙箱内操作
- ⏱️ **超时控制** - 自动终止超时任务

## 使用

```bash
# 运行代码沙箱
docker-sandbox run --image python:3.11 --code "print('hello')"

# 测试新技能
docker-sandbox test-skill --path ./new-skill --timeout 300

# 隔离运行任务
docker-sandbox exec --image node:18 --cmd "node script.js" --network none

# 查看沙箱日志
docker-sandbox logs --container sandbox-abc123
```

## 安全配置

```json
{
  "defaultLimits": {
    "cpu": "1.0",
    "memory": "512m",
    "disk": "1g",
    "timeout": 300
  },
  "networkPolicy": "isolated",
  "allowedImages": ["python:3.11", "node:18", "alpine:latest"],
  "volumeMounts": ["/tmp:/tmp:rw"]
}
```

## 安全原则

- 默认禁止访问主机文件系统
- 默认禁止外网访问（测试技能除外）
- 敏感操作需二次确认
- 自动清理过期容器
