# Session State - 上下文压缩缓存设计

_问题：OpenClaw 每轮都把完整历史、工具输出、检索结果重新喂给模型，导致变慢变笨。_

---

## 核心思路

**三层记忆架构：**

```
┌─────────────────────────────────────────┐
│  Layer 3: 长期记忆 (MEMORY.md)           │ ← 跨会话持久化
│  - 环境基线 / 用户偏好 / 项目约定         │
└─────────────────────────────────────────┘
              ↑
┌─────────────────────────────────────────┐
│  Layer 2: 工作记忆 (session_state.json)  │ ← 会话内持久化
│  - goal / facts / attempts / pending     │
└─────────────────────────────────────────┘
              ↑
┌─────────────────────────────────────────┐
│  Layer 1: 原始层 (*.jsonl)               │ ← 完整档案，不默认注入
│  - 完整对话 / 工具输出 / 检索结果          │
└─────────────────────────────────────────┘
```

---

## Session State Schema (最小可用版本)

```json
{
  "version": "1.0",
  "sessionId": "abc123",
  "updatedAt": "2026-03-29T04:31:00Z",
  
  "task": {
    "goal": "修复 OpenClaw healthcheck 重复报警",
    "subtasks": [
      "检查 launchd plist 配置",
      "检查 healthcheck.sh 是否有 cooldown",
      "添加状态文件记录上次告警时间"
    ],
    "constraints": [
      "不能禁用 Telegram 通知",
      "必须保留完整日志",
      "修改后需要手动验证"
    ]
  },
  
  "context": {
    "confirmedFacts": [
      "launchd 每分钟触发一次",
      "Telegram 发送成功",
      "没有 cooldown 机制"
    ],
    "assumptions": [
      "状态文件可以写在 ~/.openclaw/workspace/"
    ],
    "openQuestions": [
      "是否已有去重状态文件",
      "用户是否接受增加文件 IO"
    ]
  },
  
  "progress": {
    "attempted": [
      {
        "action": "检查 plist",
        "result": "确认每分钟触发",
        "timestamp": "2026-03-29T04:26:00Z"
      },
      {
        "action": "检查 healthcheck.sh",
        "result": "没有 cooldown 逻辑",
        "timestamp": "2026-03-29T04:27:00Z"
      }
    ],
    "failed": [],
    "pending": [
      "检查是否已有状态文件",
      "实现 cooldown 逻辑"
    ]
  },
  
  "artifacts": {
    "files": [
      {
        "path": "~/.openclaw/workspace/openclaw-health-check.json",
        "role": "健康状态输出",
        "updatedAt": "2026-03-29T04:26:59Z"
      }
    ],
    "commands": [
      {
        "cmd": "cat ~/Library/LaunchAgents/com.openclaw.gateway.plist",
        "purpose": "检查 launchd 配置"
      }
    ],
    "keyValues": {
      "healthcheck_interval": "60s",
      "last_alert": "2026-03-29T04:26:59Z"
    }
  },
  
  "meta": {
    "turns": 5,
    "tokensIn": 12500,
    "tokensOut": 3200,
    "compactionCount": 0,
    "lastCompactionAt": null
  }
}
```

---

## 注入策略

### 当前行为（问题）
```
每轮 Prompt = System + 完整历史 + 完整工具输出 + 完整检索结果
Token 用量：~15,000-50,000 tokens/轮
```

### 目标行为（优化后）
```
每轮 Prompt = System + session_state(摘要) + 最近 3 轮原文 + 按需展开的引用块
Token 用量：~3,000-8,000 tokens/轮（预计下降 60-80%）
```

---

## 引用式展开机制

**默认只放摘要，模型需要时再展开原文。**

### 示例

**Session State 中的引用：**
```json
{
  "context": {
    "confirmedFacts": [
      "日志显示端口 18789 被占用 [ref: logs_tail_1]",
      "ps 输出显示 openclaw 进程在运行 [ref: ps_output_1]"
    ]
  },
  "artifacts": {
    "references": {
      "logs_tail_1": {
        "type": "tool_output",
        "cmd": "tail -n 80 ~/.openclaw/logs/gateway.log",
        "summary": "最后 80 行日志显示端口绑定成功",
        "fullPath": "~/.openclaw/workspace/.session_state/artifacts/logs_tail_1.txt"
      },
      "ps_output_1": {
        "type": "tool_output",
        "cmd": "ps aux | grep openclaw",
        "summary": "openclaw 进程 PID 12345 正在运行",
        "fullPath": "~/.openclaw/workspace/.session_state/artifacts/ps_output_1.txt"
      }
    }
  }
}
```

**模型需要时，通过工具调用展开：**
```
用户：帮我看看具体日志
→ 调用 read_file: ~/.openclaw/workspace/.session_state/artifacts/logs_tail_1.txt
```

---

## 更新时机

### 每轮结束后自动更新

```python
# 伪代码：每轮 agent 响应后
def update_session_state(response):
    state = load_session_state()
    
    # 提取关键信息
    state.task.goal = extract_goal(response)
    state.context.confirmedFacts = extract_facts(response)
    state.progress.attempted.append({
        "action": response.action,
        "result": response.result,
        "timestamp": now()
    })
    
    # 清理过期的 pending
    state.progress.pending = filter_completed(state.progress.pending)
    
    # 保存
    save_session_state(state)
```

### 触发条件

| 事件 | 更新内容 |
|------|---------|
| 用户发送新消息 | 检查 goal 是否变化 |
| 工具调用完成 | 更新 artifacts + progress.attempted |
| 检索完成 | 更新 context.confirmedFacts |
| 子任务完成 | 标记 subtasks 完成 + 更新 pending |
| 轮次结束 | 更新 meta 统计 |

---

## 与现有机制集成

### 1. Compaction 集成

**当前：** compaction 触发时，模型生成摘要 → 写入 transcript

**改进：** compaction 触发前，先读取 session_state → 作为摘要基础 → 减少 compaction 负担

```json
// openclaw.json
{
  "agents": {
    "defaults": {
      "compaction": {
        "memoryFlush": {
          "enabled": true,
          "softThresholdTokens": 4000,
          "prompt": "请更新 session_state.json 记录当前任务状态...",
          "systemPrompt": "优先更新工作记忆，而不是写 MEMORY.md"
        }
      }
    }
  }
}
```

### 2. Plugin Hook 集成

**在 `message:preprocessed` hook 中注入 session_state：**

```javascript
// ~/.openclaw/plugins/session-state-cache/plugin.js
module.exports = {
  name: 'session-state-cache',
  version: '1.0.0',
  
  hooks: {
    'message:preprocessed': async (ctx) => {
      const state = await loadSessionState(ctx.sessionKey);
      
      // 注入到 system prompt
      ctx.systemPrompt += `\n\n## Current Task State\n${JSON.stringify(state, null, 2)}`;
      
      // 裁剪原始历史（只保留最近 N 轮）
      ctx.messages = ctx.messages.slice(-5);
      
      return ctx;
    },
    
    'response:completed': async (ctx) => {
      // 更新 session_state
      await updateSessionState(ctx.sessionKey, ctx.response);
    }
  }
};
```

---

## 预期收益

### Token 用量对比

| 场景 | 当前 | 优化后 | 降幅 |
|------|------|--------|------|
| 简单问答 | ~5,000 | ~2,000 | 60% |
| 代码调试 | ~15,000 | ~5,000 | 67% |
| 多轮运维诊断 | ~30,000 | ~8,000 | 73% |
| 长对话 (>20 轮) | ~50,000+ | ~10,000 | 80% |

### 质量提升

| 指标 | 当前 | 目标 |
|------|------|------|
| 重复建议率 | ~15% | <5% |
| 遗忘关键约束 | ~10% | <2% |
| 长对话成功率 | ~70% | >90% |
| 平均响应时间 | 3-8s | 1-3s |

---

## 实施路线图

### Phase 1: 最小可用版本 (MVP)
- [ ] 定义 session_state schema
- [ ] 实现每轮自动更新逻辑
- [ ] 在 prompt 中注入 session_state
- [ ] 验证 token 用量下降

### Phase 2: 引用式展开
- [ ] 实现 artifacts 存储机制
- [ ] 添加引用标记语法 `[ref: xxx]`
- [ ] 实现按需展开工具调用
- [ ] 验证模型能正确使用引用

### Phase 3: 智能压缩
- [ ] 工具输出自动摘要（而非原文）
- [ ] 检索结果去重 + 提炼
- [ ] 对话历史分层（近 N 轮原文 + 早期摘要）
- [ ] 代码上下文按需加载

### Phase 4: 学习优化
- [ ] 记录哪些字段最有用
- [ ] 自动调整 session_state 结构
- [ ] 预测哪些信息可以丢弃
- [ ] 个性化压缩策略

---

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| session_state 更新错误导致信息丢失 | 保留完整 jsonl 档案，可随时回滚 |
| 模型过度依赖摘要，忽略细节 | 引用式展开机制，按需拉取原文 |
| 更新 session_state 增加延迟 | 异步更新，不阻塞响应 |
| schema 设计不合理 | 先 MVP 验证，快速迭代 |

---

## 下一步

1. **确认 schema** — Colin 审阅 session_state 字段是否够用
2. **选择实现方式** — Plugin Hook vs 配置注入
3. **实现 MVP** — 先跑通最小版本，验证 token 下降
4. **灰度测试** — 在单会话中试用，收集数据
5. **迭代优化** — 根据实际效果调整 schema 和注入策略

---

_设计目标：让 OpenClaw 从"记住所有内容"升级为"持续维护干净的任务状态"。_
