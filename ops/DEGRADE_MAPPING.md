# 临时降级映射 (Degrade Mapping)

**版本**: OpenClaw 2026.4.1  
**创建时间**: 2026-04-03 17:50 (Asia/Shanghai)  
**状态**: 🟢 可执行

---

## 核心原则

**灰度前不补正式开关，只建立临时降级映射。**  
**灰度稳定后，再把已验证的降级动作固化为正式配置开关。**

---

## 降级级别

| 级别 | 名称 | 影响范围 | 恢复方式 |
|------|------|---------|---------|
| **L1** | 渠道级降级 | 单个入口 (如 Telegram) | 重启 channel |
| **L2** | Agent 级降级 | 单个 Agent | 禁用/启用 Agent |
| **L3** | 策略级降级 | 权限策略调整 | 修改 security.mode |
| **L4** | 发布级回退 | 整个系统 | 回滚 npm 包 |

---

## 1. Runtime V2 开关映射

### 目标降级能力
回退新 Runtime 主链

### 当前替代手段 (L2 + L4)

| 手段 | 操作 | 影响 | 恢复 |
|------|------|------|------|
| **L2: Agent 限制** | 仅开放 `main` Agent | 新 Agent 不可用 | 恢复 Agent 配置 |
| **L4: 版本回退** | `npm install -g openclaw@2026.3.12` | 完整回退 | `npm install -g openclaw@latest` |

### 执行步骤

```bash
# L2: Agent 级降级
# 1. 备份当前配置
cp ~/.openclaw/config.json ~/.openclaw/config.json.bak

# 2. 仅保留 main Agent
cat > ~/.openclaw/config.json << 'EOF'
{
  "agents": {
    "default": "main",
    "entries": {
      "main": {
        "dir": "/Users/colin/.openclaw/agents/main"
      }
    }
  }
}
EOF

# 3. 重启网关
openclaw gateway restart

# 4. 验证核心功能
openclaw gateway status

# L4: 发布级回退 (如需要)
npm install -g openclaw@2026.3.12
openclaw gateway restart
```

### 验收标准

- [ ] 仅 main Agent 可工作
- [ ] 新 Agent 调用被拒绝
- [ ] 核心只读链路正常
- [ ] 回退后可恢复

### 当前状态判断

> ⚠️ **这不是完整 Runtime 开关，是"发布级回退"**  
> 只能整体回退，不能进程内动态切换

---

## 2. Approval Bridge 开关映射

### 目标降级能力
出现审批链路异常时，系统仍可控

### 当前替代手段 (L1 + L3)

| 手段 | 操作 | 影响 | 恢复 |
|------|------|------|------|
| **L1: 禁用 Telegram** | `channels.telegram.enabled = false` | 无审批通知 | 重新启用 |
| **L3: 权限收紧** | `security.mode = "deny"` | 所有写操作拒绝 | 恢复 allowlist |

### 执行步骤

```bash
# L1: 渠道级降级
# 1. 编辑 config.json
jq '.channels.telegram.enabled = false' ~/.openclaw/config.json > /tmp/config.json
mv /tmp/config.json ~/.openclaw/config.json

# 2. 重启网关
openclaw gateway restart

# 3. 验证 Telegram 断开
# (检查 Bot 无响应)

# 4. 验证 WebChat 仍可用
# (发送测试消息)

# L3: 权限策略收紧
jq '.security.mode = "deny"' ~/.openclaw/config.json > /tmp/config.json
mv /tmp/config.json ~/.openclaw/config.json
openclaw gateway restart
```

### 验收标准

- [ ] Telegram 断开后系统不崩溃
- [ ] Ask 类任务被明确拒绝/挂起
- [ ] 不卡死，有明确错误信息
- [ ] WebChat 仍可用

### 当前状态判断

> ⚠️ **这是"渠道级降级"，不是"模块级关闭"**  
> 无法单独关闭 approval bridge，只能关闭整个 Telegram channel

---

## 3. Worktree 开关映射

### 目标降级能力
隔离执行异常时，不影响主工作区

### 当前替代手段 (L2 + L3)

| 手段 | 操作 | 影响 | 恢复 |
|------|------|------|------|
| **L2: 禁用高风险 Agent** | 禁用 `code_fixer` 等写操作 Agent | 无自动写操作 | 恢复 Agent |
| **L3: 权限收紧** | `security.ask = "always"` | 所有写操作需审批 | 恢复 ask=off |

### 执行步骤

```bash
# L2: Agent 级降级
# 1. 从配置中移除写操作 Agent
jq 'del(.agents.entries.code_fixer)' ~/.openclaw/config.json > /tmp/config.json
mv /tmp/config.json ~/.openclaw/config.json

# 2. 重启网关
openclaw gateway restart

# L3: 权限策略收紧
# 1. 所有写操作需审批
jq '.security.ask = "always"' ~/.openclaw/config.json > /tmp/config.json
mv /tmp/config.json ~/.openclaw/config.json

# 2. 重启网关
openclaw gateway restart
```

### 验收标准

- [ ] 高风险写操作被阻断
- [ ] 不会直接落主工作区
- [ ] 有明确拒绝或审批提示
- [ ] 只读操作不受影响

### 当前状态判断

> ⚠️ **当前没有"关闭 worktree 后自动切换安全策略"的正式逻辑**  
> 必须同步收紧权限策略，不能简单关功能

---

## 4. Memory Autowrite 开关映射

### 目标降级能力
记忆写入异常时，不拖垮主链

### 当前状态

**判定**: N/A（当前未启用或不可观测）

**理由**:
- 当前可见配置是 `memorySearch.enabled` (对应检索，不是自动写入)
- 日志中没有观察到明确的自动写入活动
- 无法构成有效的"降级前后对比场景"

### 当前替代手段 (L2 + 操作规程)

| 手段 | 操作 | 影响 | 恢复 |
|------|------|------|------|
| **L2: 停用写操作 Agent** | 禁用自动写入记忆的 Agent | 无自动记忆 | 恢复 Agent |
| **规程**: 人工控制写入 | 仅手动调用 memory API | 写入频率降低 | 恢复自动 |

### 执行步骤

```bash
# L2: Agent 级降级
# 1. 识别并禁用自动写入记忆的 Agent
# (查看 Agent 配置，识别使用 memory.write 的 Agent)

# 2. 从配置中移除
jq 'del(.agents.entries.auto_summarizer)' ~/.openclaw/config.json > /tmp/config.json
mv /tmp/config.json ~/.openclaw/config.json

# 3. 重启网关
openclaw gateway restart

# 规程：验证 memory.search 仍可用
# 1. 发送查询请求
# 2. 验证检索正常
# 3. 验证无自动写入
```

### 验收标准

- [ ] Memory 写入降至最低
- [ ] Memory 检索仍可用
- [ ] 主链完全可运行
- [ ] 无性能下降

### 当前状态判断

> ✅ **这是最容易先用"操作规程"替代的**  
> 可以接受，风险最低

---

## 5. Telegram Callbacks 开关映射

### 目标降级能力
Callback 异常时保留主消息链路

### 当前替代手段 (L1 + 插件配置)

| 手段 | 操作 | 影响 | 恢复 |
|------|------|------|------|
| **L1: 禁用 Callback 插件** | 禁用 ocnmps-router 等插件 | 无回调处理 | 启用插件 |
| **插件配置**: 关闭回调 | 修改插件 config | 按钮失效 | 恢复配置 |

### 执行步骤

```bash
# L1: 插件级降级
# 1. 禁用插件
jq '.plugins.entries["ocnmps-router"].enabled = false' ~/.openclaw/config.json > /tmp/config.json
mv /tmp/config.json ~/.openclaw/config.json

# 2. 重启网关
openclaw gateway restart

# 插件配置：关闭回调
# 1. 编辑插件配置
# ~/.openclaw/plugins/ocnmps-router/ocnmps_plugin_config.json
# 设置 callbacks.enabled = false

# 2. 热加载或重启
openclaw gateway restart
```

### 验收标准

- [ ] Callback 相关配置关闭
- [ ] Telegram 主消息入口正常
- [ ] 审批可改用文本命令
- [ ] 无连锁报错

### 当前状态判断

> ✅ **这部分最接近正式开关替代**  
> 可以先作为临时降级方案使用

---

## 汇总表格

| 目标开关 | 降级级别 | 替代手段 | 可执行 | 风险 | 验收状态 |
|---------|---------|---------|--------|------|---------|
| Runtime V2 | L2 + L4 | Agent 限制 + 版本回退 | ✅ | 🟡 中 | ⏳ 待测 |
| Approval Bridge | L1 + L3 | 禁用 Telegram + 权限收紧 | ✅ | 🟡 中 | ⏳ 待测 |
| Worktree | L2 + L3 | 禁用写 Agent + 权限收紧 | ✅ | 🟡 中 | ⏳ 待测 |
| Memory Autowrite | L2 + 规程 | 停用写 Agent + 人工控制 | ✅ | 🟢 低 | ⏳ 待测 |
| Telegram Callbacks | L1 + 插件 | 禁用插件 + 配置修改 | ✅ | 🟢 低 | ⏳ 待测 |

---

## 执行顺序建议

**优先级从高到低** (风险从低到高)：

1. ✅ **Memory Autowrite** (风险最低，先测)
2. ✅ **Telegram Callbacks** (接近正式开关)
3. 🟡 **Approval Bridge** (影响中等)
4. 🟡 **Worktree** (影响中等)
5. 🟡 **Runtime V2** (影响最大，最后测)

---

## 回滚检查清单

执行任何降级前，先确认：

- [ ] 已备份 `~/.openclaw/config.json`
- [ ] 已记录当前运行任务
- [ ] 已通知相关用户 (如适用)
- [ ] 已准备恢复脚本
- [ ] 已设定观察时间 (如 10 分钟)

**回滚命令**:
```bash
# 快速回滚配置
cp ~/.openclaw/config.json.bak ~/.openclaw/config.json
openclaw gateway restart

# 验证恢复
openclaw gateway status
```

---

## 限制说明

### 当前降级映射的局限

| 局限 | 影响 | 缓解措施 |
|------|------|---------|
| 非原子化 | 降级可能影响多个模块 | 提前评估影响范围 |
| 非动态 | 需要重启网关 | 选择低峰期执行 |
| 非细粒度 | 无法精确控制单个功能 | 用权限策略补充 |
| 非自动 | 需要人工执行 | 准备操作脚本 |

### 正式开关产品化待办

灰度稳定后，需要固化成正式开关：

- [ ] `runtime.v2.enabled` - Runtime V2 开关
- [ ] `approvalBridge.enabled` - 审批桥开关
- [ ] `worktree.enabled` - Worktree 开关
- [ ] `memory.autowrite.enabled` - 记忆自写入开关
- [ ] `telegram.callbacks.enabled` - Telegram 回调开关

---

**状态**: 🟢 可执行  
**下次审查**: 灰度阶段 1 完成后

---

_临时降级映射，灰度期间有效。稳定后固化为正式开关。_
