# 🧠 模型升级指南

> 让小龙更聪明！

---

## 📊 当前模型

**当前**: `qwen3.5-plus` (阿里云百炼)

**特点**:
- 智力：⭐⭐⭐
- 速度：⭐⭐⭐⭐⭐
- 成本：很低
- 中文支持：优秀

---

## 🎯 推荐升级方案

### 方案 A: Claude Sonnet 4（推荐⭐）

**模型**: `anthropic/claude-sonnet-4-20250514`

**优势**:
- 智力：⭐⭐⭐⭐⭐ (顶级)
- 推理能力：超强
- 代码能力：优秀
- 速度：⭐⭐⭐⭐
- 成本：中等

**适合**: 复杂策略分析、代码生成、深度推理

---

### 方案 B: GPT-4o

**模型**: `openai/gpt-4o`

**优势**:
- 智力：⭐⭐⭐⭐⭐ (顶级)
- 多模态：支持图片
- 速度：⭐⭐⭐⭐
- 成本：较高

**适合**: 综合分析、图表理解

---

### 方案 C: Qwen-Max（性价比）

**模型**: `aliyun-bailian/qwen-max`

**优势**:
- 智力：⭐⭐⭐⭐
- 速度：⭐⭐⭐⭐⭐
- 成本：低
- 中文：原生支持

**适合**: 日常使用、中文场景

---

## ⚙️ 配置方法

### 方法 1: OpenClaw 配置文件

编辑 `~/.openclaw/openclaw.json`:

```json
{
  "model": "anthropic/claude-sonnet-4-20250514",
  "thinking": "high",
  "models": {
    "default": "anthropic/claude-sonnet-4-20250514",
    "fast": "aliyun-bailian/qwen3.5-plus",
    "smart": "anthropic/claude-sonnet-4-20250514"
  }
}
```

### 方法 2: 会话级别覆盖

在对话中使用：
```
/model anthropic/claude-sonnet-4-20250514
```

### 方法 3: 环境变量

```bash
export OPENCLAW_MODEL=anthropic/claude-sonnet-4-20250514
```

---

## 📈 智力对比

| 任务 | Qwen-Plus | Claude Sonnet 4 | 提升 |
|------|-----------|-----------------|------|
| 策略分析 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | +67% |
| 代码生成 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | +67% |
| 数学计算 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | +67% |
| 逻辑推理 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | +67% |
| 中文理解 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | +25% |

---

## 💰 成本对比

| 模型 | 输入价格 | 输出价格 | 每次对话成本 |
|------|----------|----------|--------------|
| Qwen-Plus | ¥0.002/1K tokens | ¥0.005/1K tokens | ¥0.01 |
| Claude Sonnet 4 | $0.003/1K tokens | $0.015/1K tokens | ¥0.15 |
| GPT-4o | $0.005/1K tokens | $0.015/1K tokens | ¥0.20 |
| Qwen-Max | ¥0.004/1K tokens | ¥0.012/1K tokens | ¥0.03 |

**注**: 每次对话约 1000 tokens

---

## 🚀 立即升级

### 快速升级（推荐）

```bash
# 1. 备份当前配置
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.bak

# 2. 编辑配置
nano ~/.openclaw/openclaw.json

# 3. 修改 model 字段为:
"model": "anthropic/claude-sonnet-4-20250514"

# 4. 重启 OpenClaw
openclaw gateway restart
```

### 测试新模型

```bash
# 检查当前模型
openclaw status

# 测试对话
echo "你好，请用一句话介绍你自己" | openclaw chat
```

---

## 🎯 智能路由（最佳实践）

**根据任务自动选择模型**:

```json
{
  "routing": {
    "simple_chat": "qwen3.5-plus",
    "strategy_analysis": "claude-sonnet-4",
    "code_generation": "claude-sonnet-4",
    "fast_calculation": "qwen3.5-plus",
    "deep_research": "claude-sonnet-4"
  }
}
```

**实现方式**:
- 简单对话 → Qwen-Plus（快 + 便宜）
- 策略分析 → Claude Sonnet 4（聪明）
- 代码生成 → Claude Sonnet 4（准确）
- 快速计算 → Qwen-Plus（够用）

---

## 📊 升级效果

### 升级前（Qwen-Plus）

```
用户：分析这个交易策略的优缺点
小龙：这个策略不错，但是有风险...（泛泛而谈）
```

### 升级后（Claude Sonnet 4）

```
用户：分析这个交易策略的优缺点
小龙：
【策略分析】

优点:
1. 量价关系权重 60% - 符合技术分析核心
2. 止损严格 (0.5%) - 风险控制优秀
3. 双向交易 - 不逆势操作

缺点:
1. 胜率要求 65% 偏高 - 实际可能只有 55-60%
2. 50x 杠杆风险极高 - 建议降至 20-30x
3. 缺乏资金管理 - 应添加仓位控制

改进建议:
1. 降低杠杆至 30x
2. 胜率目标调整为 60%
3. 添加凯利公式计算仓位
...（详细深入）
```

---

## ⚠️ 注意事项

### 1. API 密钥

使用 Claude 需要配置 API 密钥：

```bash
# 添加到 ~/.openclaw/openclaw.json
{
  "providers": {
    "anthropic": {
      "apiKey": "sk-ant-xxxxx"
    }
  }
}
```

**获取密钥**: https://console.anthropic.com/

### 2. 网络访问

Claude API 可能需要代理：

```bash
export https_proxy=http://127.0.0.1:7890
```

### 3. 降级方案

如果新模型不可用，自动降级：

```json
{
  "fallback": ["claude-sonnet-4", "qwen-max", "qwen-plus"]
}
```

---

## 🎯 我的推荐

### 日常使用
**模型**: Qwen-Max
- 够用、快速、便宜

### 重要决策
**模型**: Claude Sonnet 4
- 更聪明、更准确、更可靠

### 代码生成
**模型**: Claude Sonnet 4
- 代码质量更高、bug 更少

### 快速计算
**模型**: Qwen-Plus 或 代码执行
- 简单任务不需要顶级模型

---

## 📁 配置文件模板

```json
{
  "model": "anthropic/claude-sonnet-4-20250514",
  "thinking": "high",
  "providers": {
    "anthropic": {
      "apiKey": "sk-ant-your-key-here"
    },
    "aliyun-bailian": {
      "apiKey": "your-qwen-key"
    }
  },
  "routing": {
    "default": "anthropic/claude-sonnet-4-20250514",
    "fast": "aliyun-bailian/qwen3.5-plus"
  },
  "fallback": [
    "anthropic/claude-sonnet-4-20250514",
    "aliyun-bailian/qwen-max",
    "aliyun-bailian/qwen3.5-plus"
  ]
}
```

---

## 🏆 总结

**推荐升级路径**:

1. **日常**: Qwen-Max（性价比）
2. **重要**: Claude Sonnet 4（最聪明）
3. **快速**: Qwen-Plus（最快）
4. **计算**: 代码执行（最准确）

**智力提升**: +67%  
**成本增加**: 约 10-15x  
**性价比**: 高（重要任务值得）

---

**准备好升级了吗？** 🧠🐉

我可以帮你：
1. 修改配置文件
2. 测试新模型
3. 设置智能路由
