# OCNMPS 统一迁移计划

**问题**: 本地 5 个 OCNMPS 版本并存，维护困难

---

## 当前状态

| 目录 | 版本 | 语言 | 状态 | 用途 |
|------|------|------|------|------|
| `plugins/ocnmps-router/` | V2 | Python | 🟢 生产 | OpenClaw 插件，灰度中 |
| `extensions/ocnmps-router/` | V2 | Python | 🟢 副本 | 插件备份 |
| `workspace/platform/ocnmps/` | V2 | Python | 🟡 开发 | Python 开发版 |
| `workspace/core/ocnmps/` | V3 | TypeScript | 🆕 新建 | Runtime 集成版 |
| `workspace/ocnmps/` | V1 | Python | 🔴 遗留 | 旧版，应删除 |

---

## 目标架构

```
~/.openclaw/
├── plugins/
│   └── ocnmps-router/        # 唯一生产插件入口
│       ├── plugin.js          # 导入 core/ocnmps
│       └── openclaw.plugin.json
│
├── workspace/core/
│   └── ocnmps/               # 唯一核心实现
│       ├── ocnmps_router.ts   # V3 Router
│       ├── entrance_integration.ts
│       └── verification_script.ts
│
└── workspace/platform/       # 归档（只读）
    └── ocnmps/               # Python 版备份
```

---

## 迁移步骤

### 第 1 步：清理遗留（立即）

```bash
# 删除 V1 旧版
rm -rf ~/.openclaw/workspace/ocnmps

# 删除 Extension 副本
rm -rf ~/.openclaw/extensions/ocnmps-router

# 归档 Platform 版（只读备份）
mv ~/.openclaw/workspace/platform/ocnmps \
   ~/.openclaw/workspace/knowledge/archive/backups/ocnmps-python-v2
```

**结果**: 只剩 2 个目录
- `plugins/ocnmps-router/` — 生产入口
- `workspace/core/ocnmps/` — 核心实现

---

### 第 2 步：Plugin 指向 Core（1 天）

**修改 `plugins/ocnmps-router/plugin.js`**:

```javascript
// 旧代码：直接实现路由逻辑
// 新代码：导入 core/ocnmps

const { createOCNMPSIntegrator } = require('../../workspace/core/ocnmps/ocnmps_router');

const integrator = createOCNMPSIntegrator({
  grayRatio: 0.05,
});

// Hook 注册
module.exports = {
  name: 'ocnmps-router',
  version: '3.0.0',
  hooks: {
    'message:preprocessed': async (event) => {
      const result = await integrator.handleMessage({
        text: event.message,
        sessionId: event.sessionId,
        defaultModel: 'modelstudio/qwen3.5-plus',
      });
      
      // 应用模型覆盖
      if (result.model) {
        applyModelOverride(event.sessionId, result.model);
      }
    },
  },
};
```

---

### 第 3 步：配置统一（1 天）

**单一配置文件**:
```bash
~/.openclaw/workspace/core/ocnmps/.env
```

**内容**:
```ini
# OCNMPS V3 配置

# 灰度比例
OCNMPS_GRAY_RATIO=0.05

# 模型映射
OCNMPS_MODEL_CODE=modelstudio/qwen3-coder-next
OCNMPS_MODEL_REASON=xai/grok-4-1-fast-reasoning
OCNMPS_MODEL_LONG=modelstudio/qwen3.5-plus
OCNMPS_MODEL_CN=modelstudio/qwen3.5-plus
OCNMPS_MODEL_FAST=modelstudio/qwen3-max-2026-01-23
OCNMPS_MODEL_MAIN=modelstudio/qwen3.5-plus

# 功能开关
OCNMPS_ENABLED=true
OCNMPS_VERIFICATION=true
OCNMPS_AUDIT=true
OCNMPS_MEMORY_WRITE=true

# 观测
OCNMPS_LOG_LEVEL=info
OCNMPS_LOG_FILE=~/.openclaw/runtime/logs/ocnmps.log
```

---

### 第 4 步：日志统一（1 天）

**单一日志文件**:
```bash
~/.openclaw/runtime/logs/ocnmps.log
```

**日志格式**:
```json
{
  "timestamp": "2026-04-03T03:24:00Z",
  "sessionId": "session_123",
  "routingTaskId": "w_1712145600000_abc",
  "input": "Fix the import error",
  "intent": "CODE",
  "recommendedModel": "modelstudio/qwen3-coder-next",
  "finalModel": "modelstudio/qwen3-coder-next",
  "grayHit": true,
  "hashBucket": 123,
  "threshold": 500,
  "verification": { "ok": true, "summary": "4 pass" }
}
```

---

### 第 5 步：验证脚本统一（1 天）

**单一验证入口**:
```bash
# 运行验证
node ~/.openclaw/workspace/core/ocnmps/verification_script.ts

# 输出
🧪 OCNMPS 路由验证
====================
✅ 灰度命中率：5.00% (预期 ~5%)
✅ 灰度命中模型切换：5/5 正确
✅ 路由验证通过率：100%
```

---

## 迁移后状态

| 功能 | 迁移前 | 迁移后 |
|------|--------|--------|
| 代码目录 | 5 个 | 1 个 (`core/ocnmps`) |
| 插件入口 | 2 个 | 1 个 (`plugins/ocnmps-router`) |
| 配置文件 | 3 个 | 1 个 (`core/ocnmps/.env`) |
| 日志文件 | 3 个 | 1 个 (`runtime/logs/ocnmps.log`) |
| 验证脚本 | 2 个 | 1 个 (`verification_script.ts`) |
| 文档 | 分散 | 统一 (`core/ocnmps/README.md`) |

---

## 回滚方案

```bash
# 紧急回滚到 Python V2
mv ~/.openclaw/workspace/core/ocnmps \
   ~/.openclaw/workspace/core/ocnmps.v3.disabled

# 恢复 Python 版
mv ~/.openclaw/workspace/knowledge/archive/backups/ocnmps-python-v2 \
   ~/.openclaw/workspace/platform/ocnmps

# 修改 plugin.js 指回 Python bridge
# 重启 OpenClaw
openclaw gateway restart
```

---

## 时间表

| 步骤 | 时间 | 负责人 |
|------|------|--------|
| 第 1 步：清理遗留 | 立即 | Colin |
| 第 2 步：Plugin 指向 Core | 1 天 | Colin |
| 第 3 步：配置统一 | 1 天 | Colin |
| 第 4 步：日志统一 | 1 天 | Colin |
| 第 5 步：验证统一 | 1 天 | Colin |
| 灰度验证 | 3-5 天 | Colin |
| 全量切换 | 7 天后 | Colin |

---

## 验收标准

- [ ] 只剩 1 个核心目录 (`core/ocnmps`)
- [ ] 只剩 1 个插件入口 (`plugins/ocnmps-router`)
- [ ] 只剩 1 个配置文件
- [ ] 只剩 1 个日志文件
- [ ] 验证脚本通过
- [ ] 灰度命中率 5% ±3%
- [ ] 模型切换正确率 100%
- [ ] 无路由幻觉

---

**迁移开始日期**: 2026-04-03  
**预计完成日期**: 2026-04-10
