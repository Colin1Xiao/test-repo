# Jenkins 环境配置指南

**目标**: 配置 Jenkins 环境以测试 Phase 2B-3A Jenkins Connector

---

## 方案 A: 使用现有 Jenkins 服务器（推荐）

如果你有现有的 Jenkins 服务器（公司/团队/个人）：

### Step 1: 生成 API Token

```
1. 登录 Jenkins
2. 点击右上角用户名 → Configure
3. 找到 "API Token" 部分
4. 点击 "Add new Token"
5. 输入描述（如 "OpenClaw Integration"）
6. 点击 Generate
7. 复制 Token（只显示一次！）
```

### Step 2: 安装 Webhook 插件

```
1. Jenkins → Manage Jenkins → Manage Plugins
2. Available 标签页
3. 搜索 "Generic Webhook Trigger"
4. 勾选 → Install without restart
5. 等待安装完成
```

### Step 3: 创建测试 Job

**方法 1: Freestyle Project**
```
1. New Item → 输入 "test-webhook" → Freestyle project
2. Build → Execute shell
3. 命令：echo "Hello from Jenkins"
4. Save
```

**方法 2: Pipeline Project（推荐）**
```
1. New Item → 输入 "test-pipeline" → Pipeline
2. Pipeline → Pipeline script
3. 输入以下脚本：
```

```groovy
pipeline {
    agent any
    
    stages {
        stage('Build') {
            steps {
                echo 'Building...'
                sh 'echo "Build completed"'
            }
        }
        
        stage('Test') {
            steps {
                echo 'Testing...'
                // 故意失败用于测试
                sh 'exit 1'
            }
        }
        
        stage('Deploy') {
            steps {
                echo 'Deploying...'
            }
        }
    }
    
    post {
        always {
            echo 'Pipeline completed'
        }
    }
}
```

### Step 4: 配置 Webhook

```
1. 进入 Job 配置页面
2. Build Triggers → 勾选 "Generic Webhook Trigger"
3. Token: 输入任意字符串（如 `test-secret`）
4. Post content parameters:
   - name: jobName
     Expression: $.job.fullName
   - name: buildNumber
     Expression: $.build.number
   - name: status
     Expression: $.build.status
5. Save
```

### Step 5: 添加 Webhook URL

**使用 ngrok 暴露本地服务**:
```bash
# 启动 ngrok
ngrok http 3000

# 复制输出的 URL（如 https://xxx.ngrok.io）
```

**在 Jenkins 中配置**:
```
1. Job 配置页面 → Generic Webhook Trigger
2. 或者使用全局配置
3. Webhook URL: https://xxx.ngrok.io/api/webhooks/jenkins
```

---

## 方案 B: 本地 Docker 安装（测试用）

如果你没有现有 Jenkins，可以用 Docker 快速搭建：

### Step 1: 启动 Jenkins 容器

```bash
docker run -d \
  -p 8080:8080 \
  -p 50000:50000 \
  -v jenkins-data:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --name jenkins-test \
  jenkins/jenkins:lts
```

### Step 2: 获取初始密码

```bash
docker exec jenkins-test cat /var/jenkins_home/secrets/initialAdminPassword
```

### Step 3: 访问 Jenkins

```
浏览器访问：http://localhost:8080
输入初始密码
选择 "Install suggested plugins"
创建管理员用户
```

### Step 4: 安装插件

```
Jenkins → Manage Jenkins → Manage Plugins
→ Available → 搜索并安装:
  - Generic Webhook Trigger Plugin
  - Pipeline Stage View Plugin
```

---

## 方案 C: 使用 Jenkins 公共测试服务器

有一些公开的 Jenkins 测试服务器可用于开发测试：

- https://ci.jenkins.io/ (Jenkins 官方 CI)
- 需要注册账号

**不推荐用于生产测试**，仅用于快速验证。

---

## 验证配置

### 测试 API 连接

```bash
# 替换为你的配置
JENKINS_BASE_URL=http://localhost:8080
JENKINS_USERNAME=admin
JENKINS_TOKEN=your_token

# 测试连接
curl -u "$JENKINS_USERNAME:$JENKINS_TOKEN" "$JENKINS_BASE_URL/api/json" | jq '.nodeDescription'
```

### 测试 Webhook

```bash
# 触发 Webhook
curl -X POST http://localhost:3000/api/webhooks/jenkins \
  -H "Content-Type: application/json" \
  -d '{
    "job": {
      "name": "test-job",
      "fullName": "test-job",
      "url": "http://localhost:8080/job/test-job"
    },
    "build": {
      "number": 1,
      "status": "FAILURE",
      "phase": "COMPLETED"
    }
  }'
```

---

## 故障排查

### 问题 1: API 认证失败

**症状**: `401 Unauthorized`

**解决**:
- 检查用户名和 Token 是否正确
- Token 是否已过期（重新生成）
- 用户是否有 API 访问权限

### 问题 2: Webhook 不触发

**症状**: Jenkins 构建成功，但 OpenClaw 未收到事件

**解决**:
- 检查 ngrok 是否运行
- 检查 Webhook URL 是否正确
- 检查 Generic Webhook Trigger 插件配置
- 查看 Jenkins 系统日志

### 问题 3: CORS 错误

**症状**: 浏览器控制台显示 CORS 错误

**解决**:
- Jenkins 默认不允许跨域
- 安装 "CORS Filter Plugin"
- 或直接在服务器端测试（绕过浏览器）

---

## 下一步

配置完成后，运行实盘测试脚本：

```bash
source ~/.openclaw/workspace/.env.jenkins
~/.openclaw/workspace/scripts/jenkins-live-test.sh
```

---

**记录时间**: 2026-04-04 04:10 (Asia/Shanghai)
