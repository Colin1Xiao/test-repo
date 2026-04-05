# CircleCI 环境配置指南

**目标**: 配置 CircleCI 环境以测试 Phase 2B-3B CircleCI Connector

---

## Step 1: 获取 API Token

```
1. 访问 https://circleci.com/account/api
2. 登录 GitHub/Bitbucket 账号
3. 点击 "Create Token"
4. 输入描述（如 "OpenClaw Integration"）
5. 点击 Create
6. 复制 Token（只显示一次！）
```

---

## Step 2: 创建配置文件

```bash
# 复制模板
cp ~/.openclaw/workspace/.env.circleci.example ~/.openclaw/workspace/.env.circleci

# 编辑配置
vim ~/.openclaw/workspace/.env.circleci

# 填入 Token
CIRCLECI_TOKEN=your_real_token_here
```

---

## Step 3: 配置 Webhook

### 3.1 获取 Webhook URL

**使用 ngrok 暴露本地服务**:
```bash
ngrok http 3002
# 复制输出的 URL（如 https://xxx.ngrok.io）
```

**Webhook URL**: `https://xxx.ngrok.io/api/webhooks/circleci`

### 3.2 配置项目 Webhook

```
1. 访问 https://circleci.com/
2. 选择项目 → Project Settings
3. Webhooks → Add Webhook
4. 填入 URL: https://xxx.ngrok.io/api/webhooks/circleci
5. 勾选事件:
   - Workflow Completed
   - Job Completed
   - Approval Required
6. 点击 Save
```

---

## Step 4: 创建测试 Pipeline

**在项目根目录创建 `.circleci/config.yml`**:

```yaml
version: 2.1

jobs:
  build:
    docker:
      - image: cimg/node:18.0
    steps:
      - checkout
      - run: echo "Building..."
      - run: echo "Build completed"
  
  test:
    docker:
      - image: cimg/node:18.0
    steps:
      - checkout
      - run: echo "Testing..."
      # 故意失败用于测试
      - run: exit 1
  
  deploy:
    docker:
      - image: cimg/node:18.0
    steps:
      - checkout
      - run: echo "Deploying..."

workflows:
  build-and-test:
    jobs:
      - build
      - test:
          requires:
            - build
  
  deploy-with-approval:
    jobs:
      - build
      - deploy:
          requires:
            - build
          type: approval  # 审批节点
```

---

## Step 5: 验证配置

### 测试 API 连接

```bash
# 加载配置
source ~/.openclaw/workspace/.env.circleci

# 测试 API
curl -H "Circle-Token: $CIRCLECI_TOKEN" \
  "https://circleci.com/api/v2/me" | jq '.'
```

### 触发测试构建

```bash
# 方法 1: 在 CircleCI 网页触发
# 访问项目页面 → Start Pipeline

# 方法 2: 使用 API
curl -X POST \
  -H "Circle-Token: $CIRCLECI_TOKEN" \
  -H "Content-Type: application/json" \
  "https://circleci.com/api/v2/project/gh/YOUR_USERNAME/YOUR_REPO/pipeline" \
  -d '{"branch":"main"}'
```

---

## Step 6: 运行实盘测试

```bash
source ~/.openclaw/workspace/.env.circleci
~/.openclaw/workspace/scripts/circleci-live-test.sh
```

---

## 故障排查

### 问题 1: API 认证失败

**症状**: `401 Unauthorized`

**解决**:
- 检查 Token 是否正确
- Token 是否已过期（重新生成）
- 用户是否有项目访问权限

### 问题 2: Webhook 不触发

**症状**: CircleCI 构建成功，但 OpenClaw 未收到事件

**解决**:
- 检查 ngrok 是否运行
- 检查 Webhook URL 是否正确
- 查看 CircleCI Webhook 投递日志

### 问题 3: 审批节点不触发

**症状**: Workflow 直接完成，没有 Approval

**解决**:
- 检查 workflow 配置中是否有 `type: approval`
- 审批节点必须在 workflow 中正确配置

---

## 下一步

配置完成后，验证以下链路：

1. **Workflow Failure → Incident**
   - 触发失败构建
   - 检查 `/operator/incidents`

2. **Approval Pending → Approval**
   - 触发带审批的 workflow
   - 检查 `/operator/approvals`

3. **Approve → CircleCI Writeback**
   - 执行 approve 动作
   - 检查 CircleCI workflow 状态

---

**记录时间**: 2026-04-04 (Asia/Shanghai)
