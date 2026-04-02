# Decision Hub V2 - 不可绕过版本

## 🎯 核心设计原则

> **"所有模块都可以出错，但 Decision Hub 必须永远正确"**
> **"没有任何路径可以绕过 Decision Hub"**

---

## 🔒 防绕过机制

### 三层保护

```
Layer 1: Execution Gate
   ↓ 只接受 ExecutionRequest
Layer 2: ExecutionRequest
   ↓ 必须包含授权 Decision
Layer 3: Decision
   ↓ 必须来自 DecisionHub.evaluate()
```

### 强制规则

```python
# ❌ 错误：绕过 Hub
executor.execute_signal(...)

# ❌ 错误：伪造 Decision
decision = Decision(...)
request = ExecutionRequest(decision)  # 抛异常！

# ✅ 正确：唯一授权路径
decision = hub.evaluate(signal)
request = ExecutionRequest(decision)
gate.execute(request)
```

---

## 📐 系统架构

```
Signal → Decision Hub → Execution Gate → Execution Engine
           ↓               ↓
        授权决策        验证授权
        记录日志        拒绝未授权
```

---

## 🔑 关键组件

### 1. Decision（决策对象）

- `trace_id`: 唯一追踪 ID
- `decision_hash`: 防篡改哈希
- `authorized`: 授权标记

### 2. DecisionHub（决策中枢）

- 唯一决策入口
- 自动授权
- 记录日志

### 3. ExecutionRequest（执行请求）

- 必须包含授权 Decision
- 自动验证

### 4. ExecutionGate（执行门控）

- 只接受 ExecutionRequest
- 拒绝所有未授权执行

---

## ✅ 测试结果

```
✅ Decision Hub 已创建
✅ 授权决策通过: trace_id=20260320025759-d62cb6e0
✅ 正确拦截未授权决策
✅ 决策日志正常记录
```

---

_版本: V2 | 更新: 2026-03-20_