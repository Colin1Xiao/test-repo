# 🦞 OpenClaw 基线状态报告
**生成时间**: 2026-03-17 02:30 (Asia/Shanghai)

## 📊 系统健康基线指标

### 核心服务状态
- **OpenClaw Gateway**: ✅ 运行中 (PID 89658)
- **OCNMPS 多模型系统**: ✅ 运行中 (PID 9862) 
- **Auto-Heal 自动修复**: ✅ 已加载并运行

### 通道状态
- **Telegram**: ✅ 配置正常
  - Bot: @AlanColin_Xiao_bot (ID: 8754562975)
  - 探测状态: 成功
  - 探测耗时: ~1276ms

### 代理与会话
- **主代理 (main)**: ✅ 活跃
  - 活跃会话数: 2
  - 心跳间隔: 30分钟

### Auto-Heal 健康基线
```json
{
  "critical_count": 0,
  "warn_count": 8,
  "repair_actions_detected": 0,
  "health_ok_before": true,
  "health_ok_after": true,
  "final_exit": 0
}
```

### 多模型支持基线
- **FAST**: `bailian/qwen3-max-2026-01-23` ✅
- **MAIN**: `bailian/kimi-k2.5` ✅  
- **LONG**: `bailian/qwen3.5-plus` ✅
- **CODE**: `bailian/qwen3-coder-next` ✅
- **CODE-PLUS**: `bailian/qwen3-coder-plus` ✅
- **REASON**: `xai/grok-4-1-fast-reasoning` ✅
- **GROK-CODE**: `xai/grok-code-fast-1` ✅
- **CN**: `bailian/MiniMax-M2.5` ✅

## 🚨 异常检测规则

当以下任一条件触发时，表示出现新问题：

1. **Critical 问题**: `critical_count > 0`
2. **健康检查失败**: `health_ok_after != true`
3. **会话异常**: 活跃会话数 = 0（非维护时段）
4. **通道故障**: Telegram 探测失败或超时 > 5000ms
5. **模型路由失效**: 任何模型别名无法正常使用
6. **服务崩溃**: OCNMPS 或 Gateway 进程停止
7. **Auto-Heal 异常**: `final_exit != 0` 且非人工复核场景

## 🔧 已知待修复问题
- [ ] Gateway 权限: 缺少 `operator.read` scope（需要重启后修复）

## 📋 系统架构快照
```
OpenClaw Gateway (PID 89658)
├── Telegram 通道
├── 主代理 (main)
│   ├── 活跃会话 x2
│   └── 心跳监控
└── OCNMPS 多模型系统 (PID 9862)
    ├── 多窗口管理
    ├── 多模型路由
    └── 并发控制
```

---
**基线用途**: 作为日常监控的参考标准，任何显著偏离此基线的状态都应被视为潜在问题。