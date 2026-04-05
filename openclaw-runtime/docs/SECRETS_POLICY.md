# OpenClaw V3 Secrets 管理规范

_Secrets 存储、轮换、审计的标准流程。_

---

## 核心原则

1. **不允许 secrets 硬编码到代码**
2. **不允许测试值进入 prod 配置**
3. **staging/prod secrets 必须分离**
4. **预留 rotation 机制**
5. **所有访问必须记录审计日志**

---

## Secrets 分类

### 基础设施 Secrets

| Secret | 用途 | 存储位置 | 轮换周期 |
|--------|------|---------|---------|
| `REDIS_PASSWORD` | Redis 认证 | 1Password / Vault | 90 天 |
| `DB_CONNECTION_STRING` | 数据库连接 | 1Password / Vault | 90 天 |
| `JWT_SECRET` | JWT 签名 | 1Password / Vault | 180 天 |

### 外部服务 Secrets

| Secret | 用途 | 存储位置 | 轮换周期 |
|--------|------|---------|---------|
| `OKX_API_KEY` | OKX 交易所 API | 1Password / Vault | 90 天 |
| `OKX_API_SECRET` | OKX 交易所 Secret | 1Password / Vault | 90 天 |
| `OKX_PASSPHRASE` | OKX 交易所密码 | 1Password / Vault | 90 天 |
| `GITHUB_TOKEN` | GitHub API | 1Password / Vault | 90 天 |
| `WEBHOOK_SECRET` | Webhook 签名验证 | 1Password / Vault | 180 天 |

### 加密 Keys

| Secret | 用途 | 存储位置 | 轮换周期 |
|--------|------|---------|---------|
| `ENCRYPTION_KEY` | 数据加密 | 1Password / Vault | 365 天 |
| `SIGNING_KEY` | 数据签名 | 1Password / Vault | 365 天 |

---

## 存储方式

### 开发环境 (dev)

- **位置**: `.env.dev`（本地文件，不提交到 git）
- **权限**: 仅开发者本地访问
- **审计**: 无强制要求

### 预发布环境 (staging)

- **位置**: 1Password / AWS Secrets Manager
- **权限**: 团队成员 + CI/CD
- **审计**: 访问日志保留 30 天

### 生产环境 (prod)

- **位置**: 1Password / AWS Secrets Manager / HashiCorp Vault
- **权限**: 仅限运维 + CI/CD
- **审计**: 访问日志保留 365 天

---

## Rotation 流程

### 计划内轮换

```
1. 生成新 secret
   └─ 使用安全随机数生成器
   └─ 长度符合最低要求（密码≥32 字符）

2. 更新 secrets 存储
   └─ 1Password / Vault / Secrets Manager
   └─ 记录变更审计日志

3. 滚动更新服务
   └─ 先 staging 验证
   └─ 再 prod 灰度更新

4. 验证功能正常
   └─ 运行健康检查
   └─ 验证关键路径

5. 废弃旧 secret
   └─ 保留 7 天观察期
   └─ 观察期后彻底删除
```

### 紧急轮换（泄露响应）

```
1. 立即禁用旧 secret
   └─ 撤销 API Key
   └─ 使旧密码失效

2. 生成并部署新 secret
   └─ 紧急流程，可跳过部分验证
   └─ 必须记录原因

3. 调查泄露原因
   └─ 审计日志分析
   └─ 修复漏洞

4. 事后复盘
   └─ 更新安全策略
   └─ 补充监控
```

---

## 审计要求

### 必须记录的事件

| 事件 | 记录内容 | 保留期 |
|------|---------|-------|
| Secret 创建 | 创建者、时间、用途 | 365 天 |
| Secret 访问 | 访问者、时间、服务 | 365 天 (prod) / 30 天 (staging) |
| Secret 轮换 | 轮换者、时间、原因 | 365 天 |
| Secret 删除 | 删除者、时间、原因 | 365 天 |
| 访问失败 | 访问者、时间、原因 | 90 天 |

### 审计日志格式

```json
{
  "event_type": "secret_access",
  "secret_name": "OKX_API_KEY",
  "accessor": "service:trading-engine",
  "timestamp": "2026-04-04T19:50:00Z",
  "environment": "production",
  "success": true,
  "ip_address": "10.0.1.100"
}
```

---

## 禁止行为

| 行为 | 风险级 | 说明 |
|------|--------|------|
| 硬编码 secrets 到代码 | 🔴 Critical | 绝对禁止 |
| 提交 secrets 到 git | 🔴 Critical | 使用.gitignore |
| 在日志中打印 secrets | 🔴 Critical | 自动脱敏 |
| 通过明文渠道传输 | 🔴 Critical | 使用加密通道 |
| 共享 prod secrets | 🟡 High | 按需授权 |
| 使用弱密码 | 🟡 High | 最低 32 字符 |

---

## 环境变量映射

```bash
# 基础设施
REDIS_PASSWORD=${REDIS_PASSWORD}  # 从 secrets manager 注入
DB_CONNECTION_STRING=${DB_CONNECTION_STRING}

# 外部服务
OKX_API_KEY=${OKX_API_KEY}
OKX_API_SECRET=${OKX_API_SECRET}
OKX_PASSPHRASE=${OKX_PASSPHRASE}
GITHUB_TOKEN=${GITHUB_TOKEN}
WEBHOOK_SECRET=${WEBHOOK_SECRET}

# 加密
ENCRYPTION_KEY=${ENCRYPTION_KEY}
JWT_SECRET=${JWT_SECRET}
```

---

## 检查清单

### 上线前检查

- [ ] 所有 secrets 已存入 secrets manager
- [ ] .env 文件已添加到.gitignore
- [ ] 日志脱敏已验证
- [ ] 审计日志已接入
- [ ] rotation 流程已文档化

### 定期检查（每季度）

- [ ] 审查所有 secrets 访问日志
- [ ] 验证 rotation 计划执行
- [ ] 更新过期 secrets
- [ ] 审查访问权限

---

_最后更新：2026-04-04 19:40_
