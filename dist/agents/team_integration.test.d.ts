/**
 * Team Integration Tests - 集成测试
 *
 * 验证 Agent Teams 与 OpenClaw 主干的集成：
 * 1. ExecutionContext 成功转成 TeamContext
 * 2. 子代理继承但收缩父权限
 * 3. 子任务在 TaskStore 中正确建档与收敛
 * 4. Team/Subagent 事件进入统一 HookBus
 * 5. parent cancel / fail / approval block 能正确传导到 children
 */
export {};
