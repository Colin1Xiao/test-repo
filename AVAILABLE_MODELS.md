# 📋 可用模型列表

**更新时间**: 2026-03-11 20:10

---

## 🎯 当前配置

**主模型**: `bailian/qwen3-max-2026-01-23` ⭐⭐⭐⭐  
**降级序列**: qwen3-coder-next → glm-5 → qwen3.5-plus → qwen-max

---

## 📊 完整模型列表

### 阿里云百炼 (bailian)

| 模型 ID | 名称 | 智力 | 速度 | 上下文 | 适合场景 |
|---------|------|------|------|--------|----------|
| **qwen3-max-2026-01-23** | Qwen3 Max | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 262K | **默认** - 复杂分析 |
| qwen3-coder-next | Qwen Coder Next | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 262K | 代码生成 |
| qwen3-coder-plus | Qwen Coder Plus | ⭐⭐⭐⭐ | ⭐⭐⭐ | 1M | 长代码项目 |
| qwen3.5-plus | Qwen3.5 Plus | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 1M | 日常对话 |
| MiniMax-M2.5 | MiniMax M2.5 | ⭐⭐⭐ | ⭐⭐⭐⭐ | 196K | 中文场景 |
| glm-5 | GLM-5 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 202K | 深度推理 |
| glm-4.7 | GLM-4.7 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 202K | 平衡使用 |
| kimi-k2.5 | Kimi K2.5 | ⭐⭐⭐⭐ | ⭐⭐⭐ | 262K | 长文本分析 |

---

### 阿里云国际 (aliyun-bailian)

| 模型 ID | 名称 | 智力 | 速度 | 上下文 | 适合场景 |
|---------|------|------|------|--------|----------|
| qwen-max | Qwen Max | ⭐⭐⭐⭐ | ⭐⭐⭐ | 32K | 高质量回答 |
| qwen-plus | Qwen Plus | ⭐⭐⭐ | ⭐⭐⭐⭐ | 32K | 性价比 |
| qwen-turbo | Qwen Turbo | ⭐⭐ | ⭐⭐⭐⭐⭐ | 32K | 快速响应 |

---

### Qwen Portal (qwen-portal)

| 模型 ID | 名称 | 智力 | 速度 | 上下文 | 适合场景 |
|---------|------|------|------|--------|----------|
| coder-model | Qwen Coder | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 128K | 代码专用 |
| vision-model | Qwen Vision | ⭐⭐⭐⭐ | ⭐⭐⭐ | 128K | 图片理解 |

---

### X.AI Grok (xai)

| 模型 ID | 名称 | 智力 | 速度 | 上下文 | 适合场景 |
|---------|------|------|------|--------|----------|
| grok-4 | Grok 4 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 131K | 最强推理 |
| grok-4-1-fast | Grok 4.1 Fast | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 131K | 快速响应 |
| grok-code-fast-1 | Grok Code Fast | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 131K | 快速代码 |
| grok-vision-beta | Grok Vision | ⭐⭐⭐⭐ | ⭐⭐⭐ | 131K | 图片理解 |

---

## 🎯 推荐用法

### 日常对话
```
/model bailian/qwen3.5-plus
```
- 速度快
- 成本低
- 够用

### 复杂分析
```
/model bailian/qwen3-max-2026-01-23
```
- 当前默认
- 深度分析
- 策略制定

### 代码生成
```
/model bailian/qwen3-coder-next
```
- 代码专用
- 准确率高
- 支持多语言

### 深度推理
```
/model bailian/glm-5
```
- 最强推理
- 数学计算
- 逻辑分析

### 长文本
```
/model bailian/qwen3-coder-plus
```
- 1M 上下文
- 超长文档
- 完整书籍

### 图片理解
```
/model qwen-portal/vision-model
```
- 图片识别
- 图表分析
- OCR

---

## 📈 智力排名

### 顶级模型 (⭐⭐⭐⭐⭐)
1. **grok-4** - 最强综合
2. **glm-5** - 推理最强

### 高端模型 (⭐⭐⭐⭐)
3. **qwen3-max-2026-01-23** - 默认推荐
4. **qwen3-coder-next** - 代码专用
5. **qwen3-coder-plus** - 长代码
6. **kimi-k2.5** - 长文本
7. **grok-4-1-fast** - 快速高质量

### 中端模型 (⭐⭐⭐)
8. **qwen3.5-plus** - 日常使用
9. **MiniMax-M2.5** - 中文优化
10. **glm-4.7** - 平衡
11. **qwen-max** - 国际版

### 快速模型 (⭐⭐)
12. **qwen-turbo** - 最快最便宜

---

## 💰 成本对比

| 模型 | 输入价 | 输出价 | 每次对话成本 |
|------|--------|--------|--------------|
| qwen3.5-plus | ¥0.002/1K | ¥0.005/1K | ¥0.01 |
| qwen3-max | ¥0.004/1K | ¥0.012/1K | ¥0.03 |
| glm-5 | ¥0.005/1K | ¥0.015/1K | ¥0.04 |
| qwen-turbo | ¥0.001/1K | ¥0.002/1K | ¥0.005 |

**注**: 每次对话约 1000 tokens

---

## 🔄 切换模型

### 方法 1: 对话中切换
```
/model bailian/glm-5
```

### 方法 2: 永久切换
编辑 `~/.openclaw/openclaw.json`:
```json
"primary": "bailian/glm-5"
```

### 方法 3: 临时使用
```
/model grok-4 分析这个策略
```

---

## 🏆 最佳实践

### 智能路由

```json
{
  "routing": {
    "chat": "bailian/qwen3.5-plus",
    "strategy": "bailian/qwen3-max-2026-01-23",
    "code": "bailian/qwen3-coder-next",
    "math": "bailian/glm-5",
    "vision": "qwen-portal/vision-model"
  }
}
```

### 降级策略

```json
{
  "fallback": [
    "bailian/qwen3-max-2026-01-23",
    "bailian/glm-5",
    "bailian/qwen3.5-plus",
    "aliyun-bailian/qwen-max"
  ]
}
```

---

## 📊 使用统计

### 当前配置
- **主模型**: qwen3-max-2026-01-23
- **备用**: qwen3-coder-next, glm-5, qwen3.5-plus
- **平均成本**: ¥0.03/对话

### 推荐配置
- **日常**: qwen3.5-plus (便宜快速)
- **重要**: qwen3-max (聪明准确)
- **代码**: qwen3-coder-next (专业)
- **推理**: glm-5 (最强)

---

## 🎯 快速参考

```bash
# 查看当前模型
openclaw status

# 切换到最强推理
/model bailian/glm-5

# 切换到代码专用
/model bailian/qwen3-coder-next

# 切换到日常模式
/model bailian/qwen3.5-plus

# 恢复默认
/model default
```

---

**完整列表已生成！** 📋🐉

文件位置：`/Users/colin/.openclaw/workspace/AVAILABLE_MODELS.md`
