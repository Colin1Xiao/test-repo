"use strict";
/**
 * State Machine 测试
 *
 * 验证状态转换的合法性和边界条件
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const state_machine_1 = require("./state_machine");
// ============================================================================
// 辅助函数：创建测试任务
// ============================================================================
function createTestTask(overrides) {
    return {
        id: "task_test",
        parentTaskId: "parent_1",
        sessionId: "session_1",
        teamId: "team_1",
        agent: "planner",
        goal: "测试任务",
        inputs: {},
        allowedTools: ["fs.read"],
        budget: {
            maxTurns: 10,
            timeoutMs: 60000,
        },
        status: "queued",
        createdAt: Date.now(),
        currentTurn: 0,
        ...overrides,
    };
}
function createTestTeamContext(overrides) {
    return {
        teamId: "team_test",
        parentTaskId: "parent_1",
        sessionId: "session_1",
        agents: [],
        sharedState: {},
        allowedTools: [],
        totalBudget: { maxTurns: 30, timeoutMs: 300000 },
        usedBudget: { turns: 0, tokens: 0, elapsedMs: 0 },
        status: "active",
        createdAt: Date.now(),
        ...overrides,
    };
}
// ============================================================================
// 测试用例
// ============================================================================
(0, vitest_1.describe)("State Machine", () => {
    (0, vitest_1.describe)("状态转换表", () => {
        (0, vitest_1.it)("应该定义正确的子代理状态转换", () => {
            (0, vitest_1.expect)(state_machine_1.SUBAGENT_STATE_TRANSITIONS.queued).toEqual(["running", "cancelled"]);
            (0, vitest_1.expect)(state_machine_1.SUBAGENT_STATE_TRANSITIONS.running).toEqual([
                "done",
                "failed",
                "timeout",
                "budget_exceeded",
                "cancelled",
            ]);
            (0, vitest_1.expect)(state_machine_1.SUBAGENT_STATE_TRANSITIONS.done).toEqual([]);
            (0, vitest_1.expect)(state_machine_1.SUBAGENT_STATE_TRANSITIONS.failed).toEqual(["queued"]);
            (0, vitest_1.expect)(state_machine_1.SUBAGENT_STATE_TRANSITIONS.timeout).toEqual(["queued"]);
            (0, vitest_1.expect)(state_machine_1.SUBAGENT_STATE_TRANSITIONS.budget_exceeded).toEqual([]);
            (0, vitest_1.expect)(state_machine_1.SUBAGENT_STATE_TRANSITIONS.cancelled).toEqual([]);
        });
        (0, vitest_1.it)("应该定义正确的团队状态转换", () => {
            (0, vitest_1.expect)(state_machine_1.TEAM_STATE_TRANSITIONS.active).toEqual([
                "completed",
                "failed",
                "cancelled",
            ]);
            (0, vitest_1.expect)(state_machine_1.TEAM_STATE_TRANSITIONS.completed).toEqual([]);
            (0, vitest_1.expect)(state_machine_1.TEAM_STATE_TRANSITIONS.failed).toEqual([]);
            (0, vitest_1.expect)(state_machine_1.TEAM_STATE_TRANSITIONS.cancelled).toEqual([]);
        });
    });
    (0, vitest_1.describe)("canTransitionSubagent", () => {
        (0, vitest_1.it)("应该允许合法转换", () => {
            (0, vitest_1.expect)((0, state_machine_1.canTransitionSubagent)("queued", "running")).toBe(true);
            (0, vitest_1.expect)((0, state_machine_1.canTransitionSubagent)("running", "done")).toBe(true);
            (0, vitest_1.expect)((0, state_machine_1.canTransitionSubagent)("running", "failed")).toBe(true);
            (0, vitest_1.expect)((0, state_machine_1.canTransitionSubagent)("failed", "queued")).toBe(true);
            (0, vitest_1.expect)((0, state_machine_1.canTransitionSubagent)("timeout", "queued")).toBe(true);
        });
        (0, vitest_1.it)("应该拒绝非法转换", () => {
            (0, vitest_1.expect)((0, state_machine_1.canTransitionSubagent)("queued", "done")).toBe(false);
            (0, vitest_1.expect)((0, state_machine_1.canTransitionSubagent)("running", "queued")).toBe(false);
            (0, vitest_1.expect)((0, state_machine_1.canTransitionSubagent)("done", "running")).toBe(false);
            (0, vitest_1.expect)((0, state_machine_1.canTransitionSubagent)("failed", "done")).toBe(false);
            (0, vitest_1.expect)((0, state_machine_1.canTransitionSubagent)("budget_exceeded", "queued")).toBe(false);
        });
        (0, vitest_1.it)("应该拒绝从终态转换", () => {
            (0, vitest_1.expect)((0, state_machine_1.canTransitionSubagent)("done", "failed")).toBe(false);
            (0, vitest_1.expect)((0, state_machine_1.canTransitionSubagent)("cancelled", "queued")).toBe(false);
            (0, vitest_1.expect)((0, state_machine_1.canTransitionSubagent)("budget_exceeded", "running")).toBe(false);
        });
    });
    (0, vitest_1.describe)("isTerminalState", () => {
        (0, vitest_1.it)("应该正确识别终态", () => {
            (0, vitest_1.expect)((0, state_machine_1.isTerminalState)("done")).toBe(true);
            (0, vitest_1.expect)((0, state_machine_1.isTerminalState)("cancelled")).toBe(true);
            (0, vitest_1.expect)((0, state_machine_1.isTerminalState)("budget_exceeded")).toBe(true);
        });
        (0, vitest_1.it)("应该正确识别非终态", () => {
            (0, vitest_1.expect)((0, state_machine_1.isTerminalState)("queued")).toBe(false);
            (0, vitest_1.expect)((0, state_machine_1.isTerminalState)("running")).toBe(false);
            (0, vitest_1.expect)((0, state_machine_1.isTerminalState)("failed")).toBe(false);
            (0, vitest_1.expect)((0, state_machine_1.isTerminalState)("timeout")).toBe(false);
        });
    });
    (0, vitest_1.describe)("getNextStates", () => {
        (0, vitest_1.it)("应该返回所有合法的下一个状态", () => {
            (0, vitest_1.expect)((0, state_machine_1.getNextStates)("queued")).toEqual(["running", "cancelled"]);
            (0, vitest_1.expect)((0, state_machine_1.getNextStates)("running")).toEqual([
                "done",
                "failed",
                "timeout",
                "budget_exceeded",
                "cancelled",
            ]);
        });
    });
});
(0, vitest_1.describe)("transitionSubagent", () => {
    (0, vitest_1.it)("应该成功转换状态", () => {
        const task = createTestTask();
        const result = (0, state_machine_1.transitionSubagent)(task, "running");
        (0, vitest_1.expect)(result.success).toBe(true);
        (0, vitest_1.expect)(result.task.status).toBe("running");
        (0, vitest_1.expect)(result.previousState).toBe("queued");
        (0, vitest_1.expect)(result.newState).toBe("running");
        (0, vitest_1.expect)(task.startedAt).toBeDefined();
    });
    (0, vitest_1.it)("应该拒绝非法转换", () => {
        const task = createTestTask();
        // 尝试从 queued 直接到 done（非法）
        const result = (0, state_machine_1.transitionSubagent)(task, "done");
        (0, vitest_1.expect)(result.success).toBe(false);
        (0, vitest_1.expect)(result.error).toContain("Illegal state transition");
        (0, vitest_1.expect)(task.status).toBe("queued"); // 状态未变
    });
    (0, vitest_1.it)("应该记录错误信息", () => {
        const task = createTestTask({ status: "running" });
        const result = (0, state_machine_1.transitionSubagent)(task, "failed", {
            error: "测试错误",
            reason: "测试原因",
        });
        (0, vitest_1.expect)(result.success).toBe(true);
        (0, vitest_1.expect)(task.lastError).toBe("测试错误");
    });
    (0, vitest_1.it)("应该设置 completedAt 当进入终态", () => {
        const task = createTestTask({ status: "running", startedAt: Date.now() - 1000 });
        (0, state_machine_1.transitionSubagent)(task, "done");
        (0, vitest_1.expect)(task.completedAt).toBeDefined();
        (0, vitest_1.expect)(task.completedAt).toBeGreaterThanOrEqual(task.startedAt);
    });
});
(0, vitest_1.describe)("便捷方法", () => {
    (0, vitest_1.describe)("startTask", () => {
        (0, vitest_1.it)("应该从 queued 转换到 running", () => {
            const task = createTestTask();
            const result = (0, state_machine_1.startTask)(task);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(task.status).toBe("running");
            (0, vitest_1.expect)(task.startedAt).toBeDefined();
        });
        (0, vitest_1.it)("应该拒绝从非 queued 状态启动", () => {
            const task = createTestTask({ status: "running" });
            const result = (0, state_machine_1.startTask)(task);
            (0, vitest_1.expect)(result.success).toBe(false);
        });
    });
    (0, vitest_1.describe)("completeTask", () => {
        (0, vitest_1.it)("应该从 running 转换到 done", () => {
            const task = createTestTask({ status: "running" });
            const result = (0, state_machine_1.completeTask)(task);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(task.status).toBe("done");
            (0, vitest_1.expect)(task.completedAt).toBeDefined();
        });
    });
    (0, vitest_1.describe)("failTask", () => {
        (0, vitest_1.it)("应该从 running 转换到 failed", () => {
            const task = createTestTask({ status: "running" });
            const result = (0, state_machine_1.failTask)(task, "测试失败");
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(task.status).toBe("failed");
            (0, vitest_1.expect)(task.lastError).toBe("测试失败");
        });
    });
    (0, vitest_1.describe)("timeoutTask", () => {
        (0, vitest_1.it)("应该从 running 转换到 timeout", () => {
            const task = createTestTask({ status: "running" });
            const result = (0, state_machine_1.timeoutTask)(task, 60000, 5);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(task.status).toBe("timeout");
            (0, vitest_1.expect)(task.lastError).toContain("Timeout after 60000ms");
        });
    });
    (0, vitest_1.describe)("budgetExceededTask", () => {
        (0, vitest_1.it)("应该从 running 转换到 budget_exceeded", () => {
            const task = createTestTask({ status: "running" });
            const result = (0, state_machine_1.budgetExceededTask)(task, "turns", 10, 15);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(task.status).toBe("budget_exceeded");
            (0, vitest_1.expect)(task.lastError).toContain("Budget exceeded: turns (15/10)");
        });
    });
    (0, vitest_1.describe)("cancelTask", () => {
        (0, vitest_1.it)("应该从任意非终态转换到 cancelled", () => {
            const task1 = createTestTask({ status: "queued" });
            const task2 = createTestTask({ status: "running" });
            const task3 = createTestTask({ status: "failed" });
            (0, vitest_1.expect)((0, state_machine_1.cancelTask)(task1, "用户取消").success).toBe(true);
            (0, vitest_1.expect)((0, state_machine_1.cancelTask)(task2, "用户取消").success).toBe(true);
            (0, vitest_1.expect)((0, state_machine_1.cancelTask)(task3, "用户取消").success).toBe(true);
            (0, vitest_1.expect)(task1.status).toBe("cancelled");
            (0, vitest_1.expect)(task2.status).toBe("cancelled");
            (0, vitest_1.expect)(task3.status).toBe("cancelled");
        });
        (0, vitest_1.it)("应该拒绝从终态取消", () => {
            const task = createTestTask({ status: "done" });
            const result = (0, state_machine_1.cancelTask)(task, "用户取消");
            (0, vitest_1.expect)(result.success).toBe(false);
        });
    });
    (0, vitest_1.describe)("retryTask", () => {
        (0, vitest_1.it)("应该从 failed 重试到 queued", () => {
            const task = createTestTask({
                status: "failed",
                lastError: "测试失败",
                currentTurn: 5,
            });
            const result = (0, state_machine_1.retryTask)(task);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(task.status).toBe("queued");
            (0, vitest_1.expect)(task.currentTurn).toBe(0); // 重置轮次
            (0, vitest_1.expect)(task.lastError).toBeUndefined(); // 清除错误
        });
        (0, vitest_1.it)("应该从 timeout 重试到 queued", () => {
            const task = createTestTask({ status: "timeout" });
            const result = (0, state_machine_1.retryTask)(task);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(task.status).toBe("queued");
        });
        (0, vitest_1.it)("应该拒绝从非失败状态重试", () => {
            const task = createTestTask({ status: "running" });
            const result = (0, state_machine_1.retryTask)(task);
            (0, vitest_1.expect)(result.success).toBe(false);
        });
    });
});
(0, vitest_1.describe)("团队状态转换", () => {
    (0, vitest_1.describe)("canTransitionTeam", () => {
        (0, vitest_1.it)("应该允许合法转换", () => {
            (0, vitest_1.expect)((0, state_machine_1.canTransitionTeam)("active", "completed")).toBe(true);
            (0, vitest_1.expect)((0, state_machine_1.canTransitionTeam)("active", "failed")).toBe(true);
            (0, vitest_1.expect)((0, state_machine_1.canTransitionTeam)("active", "cancelled")).toBe(true);
        });
        (0, vitest_1.it)("应该拒绝非法转换", () => {
            (0, vitest_1.expect)((0, state_machine_1.canTransitionTeam)("completed", "active")).toBe(false);
            (0, vitest_1.expect)((0, state_machine_1.canTransitionTeam)("failed", "active")).toBe(false);
            (0, vitest_1.expect)((0, state_machine_1.canTransitionTeam)("cancelled", "active")).toBe(false);
        });
    });
    (0, vitest_1.describe)("completeTeam", () => {
        (0, vitest_1.it)("应该从 active 转换到 completed", () => {
            const context = createTestTeamContext();
            const result = (0, state_machine_1.completeTeam)(context);
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(context.status).toBe("completed");
            (0, vitest_1.expect)(context.completedAt).toBeDefined();
        });
    });
    (0, vitest_1.describe)("failTeam", () => {
        (0, vitest_1.it)("应该从 active 转换到 failed", () => {
            const context = createTestTeamContext();
            const result = (0, state_machine_1.failTeam)(context, "测试失败");
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(context.status).toBe("failed");
            (0, vitest_1.expect)(context.completedAt).toBeDefined();
        });
    });
    (0, vitest_1.describe)("cancelTeam", () => {
        (0, vitest_1.it)("应该从 active 转换到 cancelled", () => {
            const context = createTestTeamContext();
            const result = (0, state_machine_1.cancelTeam)(context, "用户取消");
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(context.status).toBe("cancelled");
        });
    });
});
(0, vitest_1.describe)("查询工具", () => {
    (0, vitest_1.describe)("getTaskDuration", () => {
        (0, vitest_1.it)("应该计算任务运行时长", () => {
            const startTime = Date.now() - 5000;
            const endTime = Date.now();
            const task = createTestTask({
                status: "done",
                startedAt: startTime,
                completedAt: endTime,
            });
            const duration = (0, state_machine_1.getTaskDuration)(task);
            (0, vitest_1.expect)(duration).toBeDefined();
            (0, vitest_1.expect)(duration).toBeGreaterThanOrEqual(4900);
            (0, vitest_1.expect)(duration).toBeLessThanOrEqual(5100);
        });
        (0, vitest_1.it)("应该返回 undefined 当未开始", () => {
            const task = createTestTask();
            const duration = (0, state_machine_1.getTaskDuration)(task);
            (0, vitest_1.expect)(duration).toBeUndefined();
        });
    });
    (0, vitest_1.describe)("getTeamDuration", () => {
        (0, vitest_1.it)("应该计算团队运行时长", () => {
            const startTime = Date.now() - 10000;
            const endTime = Date.now();
            const context = createTestTeamContext({
                status: "completed",
                createdAt: startTime,
                completedAt: endTime,
            });
            const duration = (0, state_machine_1.getTeamDuration)(context);
            (0, vitest_1.expect)(duration).toBeDefined();
            (0, vitest_1.expect)(duration).toBeGreaterThanOrEqual(9900);
        });
    });
    (0, vitest_1.describe)("isRetryable", () => {
        (0, vitest_1.it)("应该识别可重试状态", () => {
            (0, vitest_1.expect)((0, state_machine_1.isRetryable)(createTestTask({ status: "failed" }))).toBe(true);
            (0, vitest_1.expect)((0, state_machine_1.isRetryable)(createTestTask({ status: "timeout" }))).toBe(true);
        });
        (0, vitest_1.it)("应该识别不可重试状态", () => {
            (0, vitest_1.expect)((0, state_machine_1.isRetryable)(createTestTask({ status: "queued" }))).toBe(false);
            (0, vitest_1.expect)((0, state_machine_1.isRetryable)(createTestTask({ status: "running" }))).toBe(false);
            (0, vitest_1.expect)((0, state_machine_1.isRetryable)(createTestTask({ status: "done" }))).toBe(false);
            (0, vitest_1.expect)((0, state_machine_1.isRetryable)(createTestTask({ status: "budget_exceeded" }))).toBe(false);
        });
    });
    (0, vitest_1.describe)("isRunning", () => {
        (0, vitest_1.it)("应该识别运行中状态", () => {
            (0, vitest_1.expect)((0, state_machine_1.isRunning)(createTestTask({ status: "running" }))).toBe(true);
            (0, vitest_1.expect)((0, state_machine_1.isRunning)(createTestTask({ status: "queued" }))).toBe(false);
            (0, vitest_1.expect)((0, state_machine_1.isRunning)(createTestTask({ status: "done" }))).toBe(false);
        });
    });
    (0, vitest_1.describe)("isComplete", () => {
        (0, vitest_1.it)("应该识别完成状态（终态）", () => {
            (0, vitest_1.expect)((0, state_machine_1.isComplete)(createTestTask({ status: "done" }))).toBe(true);
            (0, vitest_1.expect)((0, state_machine_1.isComplete)(createTestTask({ status: "cancelled" }))).toBe(true);
            (0, vitest_1.expect)((0, state_machine_1.isComplete)(createTestTask({ status: "budget_exceeded" }))).toBe(true);
        });
        (0, vitest_1.it)("应该识别未完成状态", () => {
            (0, vitest_1.expect)((0, state_machine_1.isComplete)(createTestTask({ status: "queued" }))).toBe(false);
            (0, vitest_1.expect)((0, state_machine_1.isComplete)(createTestTask({ status: "running" }))).toBe(false);
            (0, vitest_1.expect)((0, state_machine_1.isComplete)(createTestTask({ status: "failed" }))).toBe(false);
        });
    });
    (0, vitest_1.describe)("getActiveTasks", () => {
        (0, vitest_1.it)("应该返回所有活跃任务", () => {
            const tasks = [
                createTestTask({ id: "t1", status: "queued" }),
                createTestTask({ id: "t2", status: "running" }),
                createTestTask({ id: "t3", status: "done" }),
                createTestTask({ id: "t4", status: "failed" }),
            ];
            const active = (0, state_machine_1.getActiveTasks)(tasks);
            (0, vitest_1.expect)(active.length).toBe(2);
            (0, vitest_1.expect)(active.map(t => t.id)).toEqual(["t1", "t2"]);
        });
    });
    (0, vitest_1.describe)("getSuccessfulTasks", () => {
        (0, vitest_1.it)("应该返回所有成功任务", () => {
            const tasks = [
                createTestTask({ id: "t1", status: "done" }),
                createTestTask({ id: "t2", status: "done" }),
                createTestTask({ id: "t3", status: "failed" }),
            ];
            const successful = (0, state_machine_1.getSuccessfulTasks)(tasks);
            (0, vitest_1.expect)(successful.length).toBe(2);
            (0, vitest_1.expect)(successful.map(t => t.id)).toEqual(["t1", "t2"]);
        });
    });
    (0, vitest_1.describe)("getFailedTasks", () => {
        (0, vitest_1.it)("应该返回所有失败任务", () => {
            const tasks = [
                createTestTask({ id: "t1", status: "done" }),
                createTestTask({ id: "t2", status: "failed" }),
                createTestTask({ id: "t3", status: "timeout" }),
                createTestTask({ id: "t4", status: "budget_exceeded" }),
            ];
            const failed = (0, state_machine_1.getFailedTasks)(tasks);
            (0, vitest_1.expect)(failed.length).toBe(3);
            (0, vitest_1.expect)(failed.map(t => t.id)).toEqual(["t2", "t3", "t4"]);
        });
    });
});
(0, vitest_1.describe)("边界情况", () => {
    (0, vitest_1.it)("应该防止状态跳跃", () => {
        const task = createTestTask();
        // 尝试从 queued 直接跳到 done
        (0, vitest_1.expect)((0, state_machine_1.transitionSubagent)(task, "done").success).toBe(false);
        // 尝试从 queued 直接跳到 failed
        (0, vitest_1.expect)((0, state_machine_1.transitionSubagent)(task, "failed").success).toBe(false);
        // 尝试从 queued 直接跳到 timeout
        (0, vitest_1.expect)((0, state_machine_1.transitionSubagent)(task, "timeout").success).toBe(false);
    });
    (0, vitest_1.it)("应该防止终态后继续转换", () => {
        const task = createTestTask({ status: "done" });
        (0, vitest_1.expect)((0, state_machine_1.transitionSubagent)(task, "running").success).toBe(false);
        (0, vitest_1.expect)((0, state_machine_1.transitionSubagent)(task, "failed").success).toBe(false);
        (0, vitest_1.expect)((0, state_machine_1.transitionSubagent)(task, "cancelled").success).toBe(false);
    });
    (0, vitest_1.it)("应该防止 budget_exceeded 后重试", () => {
        const task = createTestTask({ status: "budget_exceeded" });
        (0, vitest_1.expect)((0, state_machine_1.retryTask)(task).success).toBe(false);
        (0, vitest_1.expect)(task.status).toBe("budget_exceeded"); // 状态未变
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdGVfbWFjaGluZS50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2FnZW50cy9zdGF0ZV9tYWNoaW5lLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7O0FBRUgsbUNBQTBEO0FBRTFELG1EQTRCeUI7QUFFekIsK0VBQStFO0FBQy9FLGNBQWM7QUFDZCwrRUFBK0U7QUFFL0UsU0FBUyxjQUFjLENBQUMsU0FBaUM7SUFDdkQsT0FBTztRQUNMLEVBQUUsRUFBRSxXQUFXO1FBQ2YsWUFBWSxFQUFFLFVBQVU7UUFDeEIsU0FBUyxFQUFFLFdBQVc7UUFDdEIsTUFBTSxFQUFFLFFBQVE7UUFDaEIsS0FBSyxFQUFFLFNBQVM7UUFDaEIsSUFBSSxFQUFFLE1BQU07UUFDWixNQUFNLEVBQUUsRUFBRTtRQUNWLFlBQVksRUFBRSxDQUFDLFNBQVMsQ0FBQztRQUN6QixNQUFNLEVBQUU7WUFDTixRQUFRLEVBQUUsRUFBRTtZQUNaLFNBQVMsRUFBRSxLQUFLO1NBQ2pCO1FBQ0QsTUFBTSxFQUFFLFFBQVE7UUFDaEIsU0FBUyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7UUFDckIsV0FBVyxFQUFFLENBQUM7UUFDZCxHQUFHLFNBQVM7S0FDYixDQUFDO0FBQ0osQ0FBQztBQUVELFNBQVMscUJBQXFCLENBQUMsU0FBZ0M7SUFDN0QsT0FBTztRQUNMLE1BQU0sRUFBRSxXQUFXO1FBQ25CLFlBQVksRUFBRSxVQUFVO1FBQ3hCLFNBQVMsRUFBRSxXQUFXO1FBQ3RCLE1BQU0sRUFBRSxFQUFFO1FBQ1YsV0FBVyxFQUFFLEVBQUU7UUFDZixZQUFZLEVBQUUsRUFBRTtRQUNoQixXQUFXLEVBQUUsRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUU7UUFDaEQsVUFBVSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLEVB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QyxDQUFDO1lBQzVDLElBQUEsZUFBTSxFQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxTQUFTLENBQUMsZ0NBQWdDLENBQUMsQ0FBQztRQUNyRSxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBQSxpQkFBUSxFQUFDLFlBQVksRUFBRSxHQUFHLEVBQUU7UUFDMUIsSUFBQSxXQUFFLEVBQUMsdUJBQXVCLEVBQUUsR0FBRyxFQUFFO1lBQy9CLE1BQU0sS0FBSyxHQUFHLGNBQWMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBQ25ELE1BQU0sS0FBSyxHQUFHLGNBQWMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO1lBQ3BELE1BQU0sS0FBSyxHQUFHLGNBQWMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBRW5ELElBQUEsZUFBTSxFQUFDLElBQUEsMEJBQVUsRUFBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3JELElBQUEsZUFBTSxFQUFDLElBQUEsMEJBQVUsRUFBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3JELElBQUEsZUFBTSxFQUFDLElBQUEsMEJBQVUsRUFBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRXJELElBQUEsZUFBTSxFQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDdkMsSUFBQSxlQUFNLEVBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUN2QyxJQUFBLGVBQU0sRUFBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsSUFB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QztRQUMvRCxJQUFBLGVBQU0sRUFBQyxJQUFBLGtDQUFrQixFQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDcEUsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFBLFdBQUUsRUFBQywwQkFBMEIsRUFBRSxHQUFHLEVBQUU7UUFDbEMsTUFBTSxJQUFJLEdBQUcsY0FBYyxDQUFDLEVBQUUsTUFBTSxFQUFFLGlCQUFpQixFQUFFLENBQUMsQ0FBQztRQUUzRCxJQUFBLGVBQU0sRUFBQyxJQUFBLHlCQUFTLEVBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzVDLElBQUEsZUFBTSxFQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLE9BQU87SUFDdEQsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogU3RhdGUgTWFjaGluZSDmtYvor5VcbiAqIFxuICog6aqM6K+B54q25oCB6L2s5o2i55qE5ZCI5rOV5oCn5ZKM6L6555WM5p2h5Lu2XG4gKi9cblxuaW1wb3J0IHsgZGVzY3JpYmUsIGl0LCBleHBlY3QsIGJlZm9yZUVhY2ggfSBmcm9tIFwidml0ZXN0XCI7XG5pbXBvcnQgdHlwZSB7IFN1YmFnZW50VGFzaywgU3ViYWdlbnRTdGF0dXMsIFRlYW1Db250ZXh0IH0gZnJvbSBcIi4vdHlwZXNcIjtcbmltcG9ydCB7XG4gIFNVQkFHRU5UX1NUQVRFX1RSQU5TSVRJT05TLFxuICBURUFNX1NUQVRFX1RSQU5TSVRJT05TLFxuICBjYW5UcmFuc2l0aW9uU3ViYWdlbnQsXG4gIGNhblRyYW5zaXRpb25UZWFtLFxuICBnZXROZXh0U3RhdGVzLFxuICBpc1Rlcm1pbmFsU3RhdGUsXG4gIGlzVGVybWluYWxUZWFtU3RhdGUsXG4gIHRyYW5zaXRpb25TdWJhZ2VudCxcbiAgdHJhbnNpdGlvblRlYW0sXG4gIHN0YXJ0VGFzayxcbiAgY29tcGxldGVUYXNrLFxuICBmYWlsVGFzayxcbiAgdGltZW91dFRhc2ssXG4gIGJ1ZGdldEV4Y2VlZGVkVGFzayxcbiAgY2FuY2VsVGFzayxcbiAgcmV0cnlUYXNrLFxuICBjb21wbGV0ZVRlYW0sXG4gIGZhaWxUZWFtLFxuICBjYW5jZWxUZWFtLFxuICBnZXRUYXNrRHVyYXRpb24sXG4gIGdldFRlYW1EdXJhdGlvbixcbiAgaXNSZXRyeWFibGUsXG4gIGlzUnVubmluZyxcbiAgaXNDb21wbGV0ZSxcbiAgZ2V0QWN0aXZlVGFza3MsXG4gIGdldFN1Y2Nlc3NmdWxUYXNrcyxcbiAgZ2V0RmFpbGVkVGFza3MsXG59IGZyb20gXCIuL3N0YXRlX21hY2hpbmVcIjtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g6L6F5Yqp5Ye95pWw77ya5Yib5bu65rWL6K+V5Lu75YqhXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmZ1bmN0aW9uIGNyZWF0ZVRlc3RUYXNrKG92ZXJyaWRlcz86IFBhcnRpYWw8U3ViYWdlbnRUYXNrPik6IFN1YmFnZW50VGFzayB7XG4gIHJldHVybiB7XG4gICAgaWQ6IFwidGFza190ZXN0XCIsXG4gICAgcGFyZW50VGFza0lkOiBcInBhcmVudF8xXCIsXG4gICAgc2Vzc2lvbklkOiBcInNlc3Npb25fMVwiLFxuICAgIHRlYW1JZDogXCJ0ZWFtXzFcIixcbiAgICBhZ2VudDogXCJwbGFubmVyXCIsXG4gICAgZ29hbDogXCLmtYvor5Xku7vliqFcIixcbiAgICBpbnB1dHM6IHt9LFxuICAgIGFsbG93ZWRUb29sczogW1wiZnMucmVhZFwiXSxcbiAgICBidWRnZXQ6IHtcbiAgICAgIG1heFR1cm5zOiAxMCxcbiAgICAgIHRpbWVvdXRNczogNjAwMDAsXG4gICAgfSxcbiAgICBzdGF0dXM6IFwicXVldWVkXCIsXG4gICAgY3JlYXRlZEF0OiBEYXRlLm5vdygpLFxuICAgIGN1cnJlbnRUdXJuOiAwLFxuICAgIC4uLm92ZXJyaWRlcyxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlVGVzdFRlYW1Db250ZXh0KG92ZXJyaWRlcz86IFBhcnRpYWw8VGVhbUNvbnRleHQ+KTogVGVhbUNvbnRleHQge1xuICByZXR1cm4ge1xuICAgIHRlYW1JZDogXCJ0ZWFtX3Rlc3RcIixcbiAgICBwYXJlbnRUYXNrSWQ6IFwicGFyZW50XzFcIixcbiAgICBzZXNzaW9uSWQ6IFwic2Vzc2lvbl8xXCIsXG4gICAgYWdlbnRzOiBbXSxcbiAgICBzaGFyZWRTdGF0ZToge30sXG4gICAgYWxsb3dlZFRvb2xzOiBbXSxcbiAgICB0b3RhbEJ1ZGdldDogeyBtYXhUdXJuczogMzAsIHRpbWVvdXRNczogMzAwMDAwIH0sXG4gICAgdXNlZEJ1ZGdldDogeyB0dXJuczogMCwgdG9rZW5zOiAwLCBlbGFwc2VkTXM6IDAgfSxcbiAgICBzdGF0dXM6IFwiYWN0aXZlXCIsXG4gICAgY3JlYXRlZEF0OiBEYXRlLm5vdygpLFxuICAgIC4uLm92ZXJyaWRlcyxcbiAgfTtcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5rWL6K+V55So5L6LXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmRlc2NyaWJlKFwiU3RhdGUgTWFjaGluZVwiLCAoKSA9PiB7XG4gIGRlc2NyaWJlKFwi54q25oCB6L2s5o2i6KGoXCIsICgpID0+IHtcbiAgICBpdChcIuW6lOivpeWumuS5ieato+ehrueahOWtkOS7o+eQhueKtuaAgei9rOaNolwiLCAoKSA9PiB7XG4gICAgICBleHBlY3QoU1VCQUdFTlRfU1RBVEVfVFJBTlNJVElPTlMucXVldWVkKS50b0VxdWFsKFtcInJ1bm5pbmdcIiwgXCJjYW5jZWxsZWRcIl0pO1xuICAgICAgZXhwZWN0KFNVQkFHRU5UX1NUQVRFX1RSQU5TSVRJT05TLnJ1bm5pbmcpLnRvRXF1YWwoW1xuICAgICAgICBcImRvbmVcIixcbiAgICAgICAgXCJmYWlsZWRcIixcbiAgICAgICAgXCJ0aW1lb3V0XCIsXG4gICAgICAgIFwiYnVkZ2V0X2V4Y2VlZGVkXCIsXG4gICAgICAgIFwiY2FuY2VsbGVkXCIsXG4gICAgICBdKTtcbiAgICAgIGV4cGVjdChTVUJBR0VOVF9TVEFURV9UUkFOU0lUSU9OUy5kb25lKS50b0VxdWFsKFtdKTtcbiAgICAgIGV4cGVjdChTVUJBR0VOVF9TVEFURV9UUkFOU0lUSU9OUy5mYWlsZWQpLnRvRXF1YWwoW1wicXVldWVkXCJdKTtcbiAgICAgIGV4cGVjdChTVUJBR0VOVF9TVEFURV9UUkFOU0lUSU9OUy50aW1lb3V0KS50b0VxdWFsKFtcInF1ZXVlZFwiXSk7XG4gICAgICBleHBlY3QoU1VCQUdFTlRfU1RBVEVfVFJBTlNJVElPTlMuYnVkZ2V0X2V4Y2VlZGVkKS50b0VxdWFsKFtdKTtcbiAgICAgIGV4cGVjdChTVUJBR0VOVF9TVEFURV9UUkFOU0lUSU9OUy5jYW5jZWxsZWQpLnRvRXF1YWwoW10pO1xuICAgIH0pO1xuXG4gICAgaXQoXCLlupTor6XlrprkuYnmraPnoa7nmoTlm6LpmJ/nirbmgIHovazmjaJcIiwgKCkgPT4ge1xuICAgICAgZXhwZWN0KFRFQU1fU1RBVEVfVFJBTlNJVElPTlMuYWN0aXZlKS50b0VxdWFsKFtcbiAgICAgICAgXCJjb21wbGV0ZWRcIixcbiAgICAgICAgXCJmYWlsZWRcIixcbiAgICAgICAgXCJjYW5jZWxsZWRcIixcbiAgICAgIF0pO1xuICAgICAgZXhwZWN0KFRFQU1fU1RBVEVfVFJBTlNJVElPTlMuY29tcGxldGVkKS50b0VxdWFsKFtdKTtcbiAgICAgIGV4cGVjdChURUFNX1NUQVRFX1RSQU5TSVRJT05TLmZhaWxlZCkudG9FcXVhbChbXSk7XG4gICAgICBleHBlY3QoVEVBTV9TVEFURV9UUkFOU0lUSU9OUy5jYW5jZWxsZWQpLnRvRXF1YWwoW10pO1xuICAgIH0pO1xuICB9KTtcblxuICBkZXNjcmliZShcImNhblRyYW5zaXRpb25TdWJhZ2VudFwiLCAoKSA9PiB7XG4gICAgaXQoXCLlupTor6XlhYHorrjlkIjms5XovazmjaJcIiwgKCkgPT4ge1xuICAgICAgZXhwZWN0KGNhblRyYW5zaXRpb25TdWJhZ2VudChcInF1ZXVlZFwiLCBcInJ1bm5pbmdcIikpLnRvQmUodHJ1ZSk7XG4gICAgICBleHBlY3QoY2FuVHJhbnNpdGlvblN1YmFnZW50KFwicnVubmluZ1wiLCBcImRvbmVcIikpLnRvQmUodHJ1ZSk7XG4gICAgICBleHBlY3QoY2FuVHJhbnNpdGlvblN1YmFnZW50KFwicnVubmluZ1wiLCBcImZhaWxlZFwiKSkudG9CZSh0cnVlKTtcbiAgICAgIGV4cGVjdChjYW5UcmFuc2l0aW9uU3ViYWdlbnQoXCJmYWlsZWRcIiwgXCJxdWV1ZWRcIikpLnRvQmUodHJ1ZSk7XG4gICAgICBleHBlY3QoY2FuVHJhbnNpdGlvblN1YmFnZW50KFwidGltZW91dFwiLCBcInF1ZXVlZFwiKSkudG9CZSh0cnVlKTtcbiAgICB9KTtcblxuICAgIGl0KFwi5bqU6K+l5ouS57ud6Z2e5rOV6L2s5o2iXCIsICgpID0+IHtcbiAgICAgIGV4cGVjdChjYW5UcmFuc2l0aW9uU3ViYWdlbnQoXCJxdWV1ZWRcIiwgXCJkb25lXCIpKS50b0JlKGZhbHNlKTtcbiAgICAgIGV4cGVjdChjYW5UcmFuc2l0aW9uU3ViYWdlbnQoXCJydW5uaW5nXCIsIFwicXVldWVkXCIpKS50b0JlKGZhbHNlKTtcbiAgICAgIGV4cGVjdChjYW5UcmFuc2l0aW9uU3ViYWdlbnQoXCJkb25lXCIsIFwicnVubmluZ1wiKSkudG9CZShmYWxzZSk7XG4gICAgICBleHBlY3QoY2FuVHJhbnNpdGlvblN1YmFnZW50KFwiZmFpbGVkXCIsIFwiZG9uZVwiKSkudG9CZShmYWxzZSk7XG4gICAgICBleHBlY3QoY2FuVHJhbnNpdGlvblN1YmFnZW50KFwiYnVkZ2V0X2V4Y2VlZGVkXCIsIFwicXVldWVkXCIpKS50b0JlKGZhbHNlKTtcbiAgICB9KTtcblxuICAgIGl0KFwi5bqU6K+l5ouS57ud5LuO57uI5oCB6L2s5o2iXCIsICgpID0+IHtcbiAgICAgIGV4cGVjdChjYW5UcmFuc2l0aW9uU3ViYWdlbnQoXCJkb25lXCIsIFwiZmFpbGVkXCIpKS50b0JlKGZhbHNlKTtcbiAgICAgIGV4cGVjdChjYW5UcmFuc2l0aW9uU3ViYWdlbnQoXCJjYW5jZWxsZWRcIiwgXCJxdWV1ZWRcIikpLnRvQmUoZmFsc2UpO1xuICAgICAgZXhwZWN0KGNhblRyYW5zaXRpb25TdWJhZ2VudChcImJ1ZGdldF9leGNlZWRlZFwiLCBcInJ1bm5pbmdcIikpLnRvQmUoZmFsc2UpO1xuICAgIH0pO1xuICB9KTtcblxuICBkZXNjcmliZShcImlzVGVybWluYWxTdGF0ZVwiLCAoKSA9PiB7XG4gICAgaXQoXCLlupTor6XmraPnoa7or4bliKvnu4jmgIFcIiwgKCkgPT4ge1xuICAgICAgZXhwZWN0KGlzVGVybWluYWxTdGF0ZShcImRvbmVcIikpLnRvQmUodHJ1ZSk7XG4gICAgICBleHBlY3QoaXNUZXJtaW5hbFN0YXRlKFwiY2FuY2VsbGVkXCIpKS50b0JlKHRydWUpO1xuICAgICAgZXhwZWN0KGlzVGVybWluYWxTdGF0ZShcImJ1ZGdldF9leGNlZWRlZFwiKSkudG9CZSh0cnVlKTtcbiAgICB9KTtcblxuICAgIGl0KFwi5bqU6K+l5q2j56Gu6K+G5Yir6Z2e57uI5oCBXCIsICgpID0+IHtcbiAgICAgIGV4cGVjdChpc1Rlcm1pbmFsU3RhdGUoXCJxdWV1ZWRcIikpLnRvQmUoZmFsc2UpO1xuICAgICAgZXhwZWN0KGlzVGVybWluYWxTdGF0ZShcInJ1bm5pbmdcIikpLnRvQmUoZmFsc2UpO1xuICAgICAgZXhwZWN0KGlzVGVybWluYWxTdGF0ZShcImZhaWxlZFwiKSkudG9CZShmYWxzZSk7XG4gICAgICBleHBlY3QoaXNUZXJtaW5hbFN0YXRlKFwidGltZW91dFwiKSkudG9CZShmYWxzZSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKFwiZ2V0TmV4dFN0YXRlc1wiLCAoKSA9PiB7XG4gICAgaXQoXCLlupTor6Xov5Tlm57miYDmnInlkIjms5XnmoTkuIvkuIDkuKrnirbmgIFcIiwgKCkgPT4ge1xuICAgICAgZXhwZWN0KGdldE5leHRTdGF0ZXMoXCJxdWV1ZWRcIikpLnRvRXF1YWwoW1wicnVubmluZ1wiLCBcImNhbmNlbGxlZFwiXSk7XG4gICAgICBleHBlY3QoZ2V0TmV4dFN0YXRlcyhcInJ1bm5pbmdcIikpLnRvRXF1YWwoW1xuICAgICAgICBcImRvbmVcIixcbiAgICAgICAgXCJmYWlsZWRcIixcbiAgICAgICAgXCJ0aW1lb3V0XCIsXG4gICAgICAgIFwiYnVkZ2V0X2V4Y2VlZGVkXCIsXG4gICAgICAgIFwiY2FuY2VsbGVkXCIsXG4gICAgICBdKTtcbiAgICB9KTtcbiAgfSk7XG59KTtcblxuZGVzY3JpYmUoXCJ0cmFuc2l0aW9uU3ViYWdlbnRcIiwgKCkgPT4ge1xuICBpdChcIuW6lOivpeaIkOWKn+i9rOaNoueKtuaAgVwiLCAoKSA9PiB7XG4gICAgY29uc3QgdGFzayA9IGNyZWF0ZVRlc3RUYXNrKCk7XG4gICAgXG4gICAgY29uc3QgcmVzdWx0ID0gdHJhbnNpdGlvblN1YmFnZW50KHRhc2ssIFwicnVubmluZ1wiKTtcbiAgICBcbiAgICBleHBlY3QocmVzdWx0LnN1Y2Nlc3MpLnRvQmUodHJ1ZSk7XG4gICAgZXhwZWN0KHJlc3VsdC50YXNrLnN0YXR1cykudG9CZShcInJ1bm5pbmdcIik7XG4gICAgZXhwZWN0KHJlc3VsdC5wcmV2aW91c1N0YXRlKS50b0JlKFwicXVldWVkXCIpO1xuICAgIGV4cGVjdChyZXN1bHQubmV3U3RhdGUpLnRvQmUoXCJydW5uaW5nXCIpO1xuICAgIGV4cGVjdCh0YXNrLnN0YXJ0ZWRBdCkudG9CZURlZmluZWQoKTtcbiAgfSk7XG5cbiAgaXQoXCLlupTor6Xmi5Lnu53pnZ7ms5XovazmjaJcIiwgKCkgPT4ge1xuICAgIGNvbnN0IHRhc2sgPSBjcmVhdGVUZXN0VGFzaygpO1xuICAgIFxuICAgIC8vIOWwneivleS7jiBxdWV1ZWQg55u05o6l5YiwIGRvbmXvvIjpnZ7ms5XvvIlcbiAgICBjb25zdCByZXN1bHQgPSB0cmFuc2l0aW9uU3ViYWdlbnQodGFzaywgXCJkb25lXCIpO1xuICAgIFxuICAgIGV4cGVjdChyZXN1bHQuc3VjY2VzcykudG9CZShmYWxzZSk7XG4gICAgZXhwZWN0KHJlc3VsdC5lcnJvcikudG9Db250YWluKFwiSWxsZWdhbCBzdGF0ZSB0cmFuc2l0aW9uXCIpO1xuICAgIGV4cGVjdCh0YXNrLnN0YXR1cykudG9CZShcInF1ZXVlZFwiKTsgLy8g54q25oCB5pyq5Y+YXG4gIH0pO1xuXG4gIGl0KFwi5bqU6K+l6K6w5b2V6ZSZ6K+v5L+h5oGvXCIsICgpID0+IHtcbiAgICBjb25zdCB0YXNrID0gY3JlYXRlVGVzdFRhc2soeyBzdGF0dXM6IFwicnVubmluZ1wiIH0pO1xuICAgIFxuICAgIGNvbnN0IHJlc3VsdCA9IHRyYW5zaXRpb25TdWJhZ2VudCh0YXNrLCBcImZhaWxlZFwiLCB7XG4gICAgICBlcnJvcjogXCLmtYvor5XplJnor69cIixcbiAgICAgIHJlYXNvbjogXCLmtYvor5Xljp/lm6BcIixcbiAgICB9KTtcbiAgICBcbiAgICBleHBlY3QocmVzdWx0LnN1Y2Nlc3MpLnRvQmUodHJ1ZSk7XG4gICAgZXhwZWN0KHRhc2subGFzdEVycm9yKS50b0JlKFwi5rWL6K+V6ZSZ6K+vXCIpO1xuICB9KTtcblxuICBpdChcIuW6lOivpeiuvue9riBjb21wbGV0ZWRBdCDlvZPov5vlhaXnu4jmgIFcIiwgKCkgPT4ge1xuICAgIGNvbnN0IHRhc2sgPSBjcmVhdGVUZXN0VGFzayh7IHN0YXR1czogXCJydW5uaW5nXCIsIHN0YXJ0ZWRBdDogRGF0ZS5ub3coKSAtIDEwMDAgfSk7XG4gICAgXG4gICAgdHJhbnNpdGlvblN1YmFnZW50KHRhc2ssIFwiZG9uZVwiKTtcbiAgICBcbiAgICBleHBlY3QodGFzay5jb21wbGV0ZWRBdCkudG9CZURlZmluZWQoKTtcbiAgICBleHBlY3QodGFzay5jb21wbGV0ZWRBdCEpLnRvQmVHcmVhdGVyVGhhbk9yRXF1YWwodGFzay5zdGFydGVkQXQhKTtcbiAgfSk7XG59KTtcblxuZGVzY3JpYmUoXCLkvr/mjbfmlrnms5VcIiwgKCkgPT4ge1xuICBkZXNjcmliZShcInN0YXJ0VGFza1wiLCAoKSA9PiB7XG4gICAgaXQoXCLlupTor6Xku44gcXVldWVkIOi9rOaNouWIsCBydW5uaW5nXCIsICgpID0+IHtcbiAgICAgIGNvbnN0IHRhc2sgPSBjcmVhdGVUZXN0VGFzaygpO1xuICAgICAgY29uc3QgcmVzdWx0ID0gc3RhcnRUYXNrKHRhc2spO1xuICAgICAgXG4gICAgICBleHBlY3QocmVzdWx0LnN1Y2Nlc3MpLnRvQmUodHJ1ZSk7XG4gICAgICBleHBlY3QodGFzay5zdGF0dXMpLnRvQmUoXCJydW5uaW5nXCIpO1xuICAgICAgZXhwZWN0KHRhc2suc3RhcnRlZEF0KS50b0JlRGVmaW5lZCgpO1xuICAgIH0pO1xuXG4gICAgaXQoXCLlupTor6Xmi5Lnu53ku47pnZ4gcXVldWVkIOeKtuaAgeWQr+WKqFwiLCAoKSA9PiB7XG4gICAgICBjb25zdCB0YXNrID0gY3JlYXRlVGVzdFRhc2soeyBzdGF0dXM6IFwicnVubmluZ1wiIH0pO1xuICAgICAgY29uc3QgcmVzdWx0ID0gc3RhcnRUYXNrKHRhc2spO1xuICAgICAgXG4gICAgICBleHBlY3QocmVzdWx0LnN1Y2Nlc3MpLnRvQmUoZmFsc2UpO1xuICAgIH0pO1xuICB9KTtcblxuICBkZXNjcmliZShcImNvbXBsZXRlVGFza1wiLCAoKSA9PiB7XG4gICAgaXQoXCLlupTor6Xku44gcnVubmluZyDovazmjaLliLAgZG9uZVwiLCAoKSA9PiB7XG4gICAgICBjb25zdCB0YXNrID0gY3JlYXRlVGVzdFRhc2soeyBzdGF0dXM6IFwicnVubmluZ1wiIH0pO1xuICAgICAgY29uc3QgcmVzdWx0ID0gY29tcGxldGVUYXNrKHRhc2spO1xuICAgICAgXG4gICAgICBleHBlY3QocmVzdWx0LnN1Y2Nlc3MpLnRvQmUodHJ1ZSk7XG4gICAgICBleHBlY3QodGFzay5zdGF0dXMpLnRvQmUoXCJkb25lXCIpO1xuICAgICAgZXhwZWN0KHRhc2suY29tcGxldGVkQXQpLnRvQmVEZWZpbmVkKCk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKFwiZmFpbFRhc2tcIiwgKCkgPT4ge1xuICAgIGl0KFwi5bqU6K+l5LuOIHJ1bm5pbmcg6L2s5o2i5YiwIGZhaWxlZFwiLCAoKSA9PiB7XG4gICAgICBjb25zdCB0YXNrID0gY3JlYXRlVGVzdFRhc2soeyBzdGF0dXM6IFwicnVubmluZ1wiIH0pO1xuICAgICAgY29uc3QgcmVzdWx0ID0gZmFpbFRhc2sodGFzaywgXCLmtYvor5XlpLHotKVcIik7XG4gICAgICBcbiAgICAgIGV4cGVjdChyZXN1bHQuc3VjY2VzcykudG9CZSh0cnVlKTtcbiAgICAgIGV4cGVjdCh0YXNrLnN0YXR1cykudG9CZShcImZhaWxlZFwiKTtcbiAgICAgIGV4cGVjdCh0YXNrLmxhc3RFcnJvcikudG9CZShcIua1i+ivleWksei0pVwiKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoXCJ0aW1lb3V0VGFza1wiLCAoKSA9PiB7XG4gICAgaXQoXCLlupTor6Xku44gcnVubmluZyDovazmjaLliLAgdGltZW91dFwiLCAoKSA9PiB7XG4gICAgICBjb25zdCB0YXNrID0gY3JlYXRlVGVzdFRhc2soeyBzdGF0dXM6IFwicnVubmluZ1wiIH0pO1xuICAgICAgY29uc3QgcmVzdWx0ID0gdGltZW91dFRhc2sodGFzaywgNjAwMDAsIDUpO1xuICAgICAgXG4gICAgICBleHBlY3QocmVzdWx0LnN1Y2Nlc3MpLnRvQmUodHJ1ZSk7XG4gICAgICBleHBlY3QodGFzay5zdGF0dXMpLnRvQmUoXCJ0aW1lb3V0XCIpO1xuICAgICAgZXhwZWN0KHRhc2subGFzdEVycm9yKS50b0NvbnRhaW4oXCJUaW1lb3V0IGFmdGVyIDYwMDAwbXNcIik7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKFwiYnVkZ2V0RXhjZWVkZWRUYXNrXCIsICgpID0+IHtcbiAgICBpdChcIuW6lOivpeS7jiBydW5uaW5nIOi9rOaNouWIsCBidWRnZXRfZXhjZWVkZWRcIiwgKCkgPT4ge1xuICAgICAgY29uc3QgdGFzayA9IGNyZWF0ZVRlc3RUYXNrKHsgc3RhdHVzOiBcInJ1bm5pbmdcIiB9KTtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGJ1ZGdldEV4Y2VlZGVkVGFzayh0YXNrLCBcInR1cm5zXCIsIDEwLCAxNSk7XG4gICAgICBcbiAgICAgIGV4cGVjdChyZXN1bHQuc3VjY2VzcykudG9CZSh0cnVlKTtcbiAgICAgIGV4cGVjdCh0YXNrLnN0YXR1cykudG9CZShcImJ1ZGdldF9leGNlZWRlZFwiKTtcbiAgICAgIGV4cGVjdCh0YXNrLmxhc3RFcnJvcikudG9Db250YWluKFwiQnVkZ2V0IGV4Y2VlZGVkOiB0dXJucyAoMTUvMTApXCIpO1xuICAgIH0pO1xuICB9KTtcblxuICBkZXNjcmliZShcImNhbmNlbFRhc2tcIiwgKCkgPT4ge1xuICAgIGl0KFwi5bqU6K+l5LuO5Lu75oSP6Z2e57uI5oCB6L2s5o2i5YiwIGNhbmNlbGxlZFwiLCAoKSA9PiB7XG4gICAgICBjb25zdCB0YXNrMSA9IGNyZWF0ZVRlc3RUYXNrKHsgc3RhdHVzOiBcInF1ZXVlZFwiIH0pO1xuICAgICAgY29uc3QgdGFzazIgPSBjcmVhdGVUZXN0VGFzayh7IHN0YXR1czogXCJydW5uaW5nXCIgfSk7XG4gICAgICBjb25zdCB0YXNrMyA9IGNyZWF0ZVRlc3RUYXNrKHsgc3RhdHVzOiBcImZhaWxlZFwiIH0pO1xuICAgICAgXG4gICAgICBleHBlY3QoY2FuY2VsVGFzayh0YXNrMSwgXCLnlKjmiLflj5bmtohcIikuc3VjY2VzcykudG9CZSh0cnVlKTtcbiAgICAgIGV4cGVjdChjYW5jZWxUYXNrKHRhc2syLCBcIueUqOaIt+WPlua2iFwiKS5zdWNjZXNzKS50b0JlKHRydWUpO1xuICAgICAgZXhwZWN0KGNhbmNlbFRhc2sodGFzazMsIFwi55So5oi35Y+W5raIXCIpLnN1Y2Nlc3MpLnRvQmUodHJ1ZSk7XG4gICAgICBcbiAgICAgIGV4cGVjdCh0YXNrMS5zdGF0dXMpLnRvQmUoXCJjYW5jZWxsZWRcIik7XG4gICAgICBleHBlY3QodGFzazIuc3RhdHVzKS50b0JlKFwiY2FuY2VsbGVkXCIpO1xuICAgICAgZXhwZWN0KHRhc2szLnN0YXR1cykudG9CZShcImNhbmNlbGxlZFwiKTtcbiAgICB9KTtcblxuICAgIGl0KFwi5bqU6K+l5ouS57ud5LuO57uI5oCB5Y+W5raIXCIsICgpID0+IHtcbiAgICAgIGNvbnN0IHRhc2sgPSBjcmVhdGVUZXN0VGFzayh7IHN0YXR1czogXCJkb25lXCIgfSk7XG4gICAgICBjb25zdCByZXN1bHQgPSBjYW5jZWxUYXNrKHRhc2ssIFwi55So5oi35Y+W5raIXCIpO1xuICAgICAgXG4gICAgICBleHBlY3QocmVzdWx0LnN1Y2Nlc3MpLnRvQmUoZmFsc2UpO1xuICAgIH0pO1xuICB9KTtcblxuICBkZXNjcmliZShcInJldHJ5VGFza1wiLCAoKSA9PiB7XG4gICAgaXQoXCLlupTor6Xku44gZmFpbGVkIOmHjeivleWIsCBxdWV1ZWRcIiwgKCkgPT4ge1xuICAgICAgY29uc3QgdGFzayA9IGNyZWF0ZVRlc3RUYXNrKHtcbiAgICAgICAgc3RhdHVzOiBcImZhaWxlZFwiLFxuICAgICAgICBsYXN0RXJyb3I6IFwi5rWL6K+V5aSx6LSlXCIsXG4gICAgICAgIGN1cnJlbnRUdXJuOiA1LFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHJldHJ5VGFzayh0YXNrKTtcbiAgICAgIFxuICAgICAgZXhwZWN0KHJlc3VsdC5zdWNjZXNzKS50b0JlKHRydWUpO1xuICAgICAgZXhwZWN0KHRhc2suc3RhdHVzKS50b0JlKFwicXVldWVkXCIpO1xuICAgICAgZXhwZWN0KHRhc2suY3VycmVudFR1cm4pLnRvQmUoMCk7IC8vIOmHjee9rui9ruasoVxuICAgICAgZXhwZWN0KHRhc2subGFzdEVycm9yKS50b0JlVW5kZWZpbmVkKCk7IC8vIOa4hemZpOmUmeivr1xuICAgIH0pO1xuXG4gICAgaXQoXCLlupTor6Xku44gdGltZW91dCDph43or5XliLAgcXVldWVkXCIsICgpID0+IHtcbiAgICAgIGNvbnN0IHRhc2sgPSBjcmVhdGVUZXN0VGFzayh7IHN0YXR1czogXCJ0aW1lb3V0XCIgfSk7XG4gICAgICBjb25zdCByZXN1bHQgPSByZXRyeVRhc2sodGFzayk7XG4gICAgICBcbiAgICAgIGV4cGVjdChyZXN1bHQuc3VjY2VzcykudG9CZSh0cnVlKTtcbiAgICAgIGV4cGVjdCh0YXNrLnN0YXR1cykudG9CZShcInF1ZXVlZFwiKTtcbiAgICB9KTtcblxuICAgIGl0KFwi5bqU6K+l5ouS57ud5LuO6Z2e5aSx6LSl54q25oCB6YeN6K+VXCIsICgpID0+IHtcbiAgICAgIGNvbnN0IHRhc2sgPSBjcmVhdGVUZXN0VGFzayh7IHN0YXR1czogXCJydW5uaW5nXCIgfSk7XG4gICAgICBjb25zdCByZXN1bHQgPSByZXRyeVRhc2sodGFzayk7XG4gICAgICBcbiAgICAgIGV4cGVjdChyZXN1bHQuc3VjY2VzcykudG9CZShmYWxzZSk7XG4gICAgfSk7XG4gIH0pO1xufSk7XG5cbmRlc2NyaWJlKFwi5Zui6Zif54q25oCB6L2s5o2iXCIsICgpID0+IHtcbiAgZGVzY3JpYmUoXCJjYW5UcmFuc2l0aW9uVGVhbVwiLCAoKSA9PiB7XG4gICAgaXQoXCLlupTor6XlhYHorrjlkIjms5XovazmjaJcIiwgKCkgPT4ge1xuICAgICAgZXhwZWN0KGNhblRyYW5zaXRpb25UZWFtKFwiYWN0aXZlXCIsIFwiY29tcGxldGVkXCIpKS50b0JlKHRydWUpO1xuICAgICAgZXhwZWN0KGNhblRyYW5zaXRpb25UZWFtKFwiYWN0aXZlXCIsIFwiZmFpbGVkXCIpKS50b0JlKHRydWUpO1xuICAgICAgZXhwZWN0KGNhblRyYW5zaXRpb25UZWFtKFwiYWN0aXZlXCIsIFwiY2FuY2VsbGVkXCIpKS50b0JlKHRydWUpO1xuICAgIH0pO1xuXG4gICAgaXQoXCLlupTor6Xmi5Lnu53pnZ7ms5XovazmjaJcIiwgKCkgPT4ge1xuICAgICAgZXhwZWN0KGNhblRyYW5zaXRpb25UZWFtKFwiY29tcGxldGVkXCIsIFwiYWN0aXZlXCIpKS50b0JlKGZhbHNlKTtcbiAgICAgIGV4cGVjdChjYW5UcmFuc2l0aW9uVGVhbShcImZhaWxlZFwiLCBcImFjdGl2ZVwiKSkudG9CZShmYWxzZSk7XG4gICAgICBleHBlY3QoY2FuVHJhbnNpdGlvblRlYW0oXCJjYW5jZWxsZWRcIiwgXCJhY3RpdmVcIikpLnRvQmUoZmFsc2UpO1xuICAgIH0pO1xuICB9KTtcblxuICBkZXNjcmliZShcImNvbXBsZXRlVGVhbVwiLCAoKSA9PiB7XG4gICAgaXQoXCLlupTor6Xku44gYWN0aXZlIOi9rOaNouWIsCBjb21wbGV0ZWRcIiwgKCkgPT4ge1xuICAgICAgY29uc3QgY29udGV4dCA9IGNyZWF0ZVRlc3RUZWFtQ29udGV4dCgpO1xuICAgICAgY29uc3QgcmVzdWx0ID0gY29tcGxldGVUZWFtKGNvbnRleHQpO1xuICAgICAgXG4gICAgICBleHBlY3QocmVzdWx0LnN1Y2Nlc3MpLnRvQmUodHJ1ZSk7XG4gICAgICBleHBlY3QoY29udGV4dC5zdGF0dXMpLnRvQmUoXCJjb21wbGV0ZWRcIik7XG4gICAgICBleHBlY3QoY29udGV4dC5jb21wbGV0ZWRBdCkudG9CZURlZmluZWQoKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoXCJmYWlsVGVhbVwiLCAoKSA9PiB7XG4gICAgaXQoXCLlupTor6Xku44gYWN0aXZlIOi9rOaNouWIsCBmYWlsZWRcIiwgKCkgPT4ge1xuICAgICAgY29uc3QgY29udGV4dCA9IGNyZWF0ZVRlc3RUZWFtQ29udGV4dCgpO1xuICAgICAgY29uc3QgcmVzdWx0ID0gZmFpbFRlYW0oY29udGV4dCwgXCLmtYvor5XlpLHotKVcIik7XG4gICAgICBcbiAgICAgIGV4cGVjdChyZXN1bHQuc3VjY2VzcykudG9CZSh0cnVlKTtcbiAgICAgIGV4cGVjdChjb250ZXh0LnN0YXR1cykudG9CZShcImZhaWxlZFwiKTtcbiAgICAgIGV4cGVjdChjb250ZXh0LmNvbXBsZXRlZEF0KS50b0JlRGVmaW5lZCgpO1xuICAgIH0pO1xuICB9KTtcblxuICBkZXNjcmliZShcImNhbmNlbFRlYW1cIiwgKCkgPT4ge1xuICAgIGl0KFwi5bqU6K+l5LuOIGFjdGl2ZSDovazmjaLliLAgY2FuY2VsbGVkXCIsICgpID0+IHtcbiAgICAgIGNvbnN0IGNvbnRleHQgPSBjcmVhdGVUZXN0VGVhbUNvbnRleHQoKTtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGNhbmNlbFRlYW0oY29udGV4dCwgXCLnlKjmiLflj5bmtohcIik7XG4gICAgICBcbiAgICAgIGV4cGVjdChyZXN1bHQuc3VjY2VzcykudG9CZSh0cnVlKTtcbiAgICAgIGV4cGVjdChjb250ZXh0LnN0YXR1cykudG9CZShcImNhbmNlbGxlZFwiKTtcbiAgICB9KTtcbiAgfSk7XG59KTtcblxuZGVzY3JpYmUoXCLmn6Xor6Llt6XlhbdcIiwgKCkgPT4ge1xuICBkZXNjcmliZShcImdldFRhc2tEdXJhdGlvblwiLCAoKSA9PiB7XG4gICAgaXQoXCLlupTor6XorqHnrpfku7vliqHov5DooYzml7bplb9cIiwgKCkgPT4ge1xuICAgICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKSAtIDUwMDA7XG4gICAgICBjb25zdCBlbmRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICAgIFxuICAgICAgY29uc3QgdGFzayA9IGNyZWF0ZVRlc3RUYXNrKHtcbiAgICAgICAgc3RhdHVzOiBcImRvbmVcIixcbiAgICAgICAgc3RhcnRlZEF0OiBzdGFydFRpbWUsXG4gICAgICAgIGNvbXBsZXRlZEF0OiBlbmRUaW1lLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGR1cmF0aW9uID0gZ2V0VGFza0R1cmF0aW9uKHRhc2spO1xuICAgICAgXG4gICAgICBleHBlY3QoZHVyYXRpb24pLnRvQmVEZWZpbmVkKCk7XG4gICAgICBleHBlY3QoZHVyYXRpb24hKS50b0JlR3JlYXRlclRoYW5PckVxdWFsKDQ5MDApO1xuICAgICAgZXhwZWN0KGR1cmF0aW9uISkudG9CZUxlc3NUaGFuT3JFcXVhbCg1MTAwKTtcbiAgICB9KTtcblxuICAgIGl0KFwi5bqU6K+l6L+U5ZueIHVuZGVmaW5lZCDlvZPmnKrlvIDlp4tcIiwgKCkgPT4ge1xuICAgICAgY29uc3QgdGFzayA9IGNyZWF0ZVRlc3RUYXNrKCk7XG4gICAgICBjb25zdCBkdXJhdGlvbiA9IGdldFRhc2tEdXJhdGlvbih0YXNrKTtcbiAgICAgIFxuICAgICAgZXhwZWN0KGR1cmF0aW9uKS50b0JlVW5kZWZpbmVkKCk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKFwiZ2V0VGVhbUR1cmF0aW9uXCIsICgpID0+IHtcbiAgICBpdChcIuW6lOivpeiuoeeul+WboumYn+i/kOihjOaXtumVv1wiLCAoKSA9PiB7XG4gICAgICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpIC0gMTAwMDA7XG4gICAgICBjb25zdCBlbmRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICAgIFxuICAgICAgY29uc3QgY29udGV4dCA9IGNyZWF0ZVRlc3RUZWFtQ29udGV4dCh7XG4gICAgICAgIHN0YXR1czogXCJjb21wbGV0ZWRcIixcbiAgICAgICAgY3JlYXRlZEF0OiBzdGFydFRpbWUsXG4gICAgICAgIGNvbXBsZXRlZEF0OiBlbmRUaW1lLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGR1cmF0aW9uID0gZ2V0VGVhbUR1cmF0aW9uKGNvbnRleHQpO1xuICAgICAgXG4gICAgICBleHBlY3QoZHVyYXRpb24pLnRvQmVEZWZpbmVkKCk7XG4gICAgICBleHBlY3QoZHVyYXRpb24hKS50b0JlR3JlYXRlclRoYW5PckVxdWFsKDk5MDApO1xuICAgIH0pO1xuICB9KTtcblxuICBkZXNjcmliZShcImlzUmV0cnlhYmxlXCIsICgpID0+IHtcbiAgICBpdChcIuW6lOivpeivhuWIq+WPr+mHjeivleeKtuaAgVwiLCAoKSA9PiB7XG4gICAgICBleHBlY3QoaXNSZXRyeWFibGUoY3JlYXRlVGVzdFRhc2soeyBzdGF0dXM6IFwiZmFpbGVkXCIgfSkpKS50b0JlKHRydWUpO1xuICAgICAgZXhwZWN0KGlzUmV0cnlhYmxlKGNyZWF0ZVRlc3RUYXNrKHsgc3RhdHVzOiBcInRpbWVvdXRcIiB9KSkpLnRvQmUodHJ1ZSk7XG4gICAgfSk7XG5cbiAgICBpdChcIuW6lOivpeivhuWIq+S4jeWPr+mHjeivleeKtuaAgVwiLCAoKSA9PiB7XG4gICAgICBleHBlY3QoaXNSZXRyeWFibGUoY3JlYXRlVGVzdFRhc2soeyBzdGF0dXM6IFwicXVldWVkXCIgfSkpKS50b0JlKGZhbHNlKTtcbiAgICAgIGV4cGVjdChpc1JldHJ5YWJsZShjcmVhdGVUZXN0VGFzayh7IHN0YXR1czogXCJydW5uaW5nXCIgfSkpKS50b0JlKGZhbHNlKTtcbiAgICAgIGV4cGVjdChpc1JldHJ5YWJsZShjcmVhdGVUZXN0VGFzayh7IHN0YXR1czogXCJkb25lXCIgfSkpKS50b0JlKGZhbHNlKTtcbiAgICAgIGV4cGVjdChpc1JldHJ5YWJsZShjcmVhdGVUZXN0VGFzayh7IHN0YXR1czogXCJidWRnZXRfZXhjZWVkZWRcIiB9KSkpLnRvQmUoZmFsc2UpO1xuICAgIH0pO1xuICB9KTtcblxuICBkZXNjcmliZShcImlzUnVubmluZ1wiLCAoKSA9PiB7XG4gICAgaXQoXCLlupTor6Xor4bliKvov5DooYzkuK3nirbmgIFcIiwgKCkgPT4ge1xuICAgICAgZXhwZWN0KGlzUnVubmluZyhjcmVhdGVUZXN0VGFzayh7IHN0YXR1czogXCJydW5uaW5nXCIgfSkpKS50b0JlKHRydWUpO1xuICAgICAgZXhwZWN0KGlzUnVubmluZyhjcmVhdGVUZXN0VGFzayh7IHN0YXR1czogXCJxdWV1ZWRcIiB9KSkpLnRvQmUoZmFsc2UpO1xuICAgICAgZXhwZWN0KGlzUnVubmluZyhjcmVhdGVUZXN0VGFzayh7IHN0YXR1czogXCJkb25lXCIgfSkpKS50b0JlKGZhbHNlKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoXCJpc0NvbXBsZXRlXCIsICgpID0+IHtcbiAgICBpdChcIuW6lOivpeivhuWIq+WujOaIkOeKtuaAge+8iOe7iOaAge+8iVwiLCAoKSA9PiB7XG4gICAgICBleHBlY3QoaXNDb21wbGV0ZShjcmVhdGVUZXN0VGFzayh7IHN0YXR1czogXCJkb25lXCIgfSkpKS50b0JlKHRydWUpO1xuICAgICAgZXhwZWN0KGlzQ29tcGxldGUoY3JlYXRlVGVzdFRhc2soeyBzdGF0dXM6IFwiY2FuY2VsbGVkXCIgfSkpKS50b0JlKHRydWUpO1xuICAgICAgZXhwZWN0KGlzQ29tcGxldGUoY3JlYXRlVGVzdFRhc2soeyBzdGF0dXM6IFwiYnVkZ2V0X2V4Y2VlZGVkXCIgfSkpKS50b0JlKHRydWUpO1xuICAgIH0pO1xuXG4gICAgaXQoXCLlupTor6Xor4bliKvmnKrlrozmiJDnirbmgIFcIiwgKCkgPT4ge1xuICAgICAgZXhwZWN0KGlzQ29tcGxldGUoY3JlYXRlVGVzdFRhc2soeyBzdGF0dXM6IFwicXVldWVkXCIgfSkpKS50b0JlKGZhbHNlKTtcbiAgICAgIGV4cGVjdChpc0NvbXBsZXRlKGNyZWF0ZVRlc3RUYXNrKHsgc3RhdHVzOiBcInJ1bm5pbmdcIiB9KSkpLnRvQmUoZmFsc2UpO1xuICAgICAgZXhwZWN0KGlzQ29tcGxldGUoY3JlYXRlVGVzdFRhc2soeyBzdGF0dXM6IFwiZmFpbGVkXCIgfSkpKS50b0JlKGZhbHNlKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoXCJnZXRBY3RpdmVUYXNrc1wiLCAoKSA9PiB7XG4gICAgaXQoXCLlupTor6Xov5Tlm57miYDmnInmtLvot4Pku7vliqFcIiwgKCkgPT4ge1xuICAgICAgY29uc3QgdGFza3M6IFN1YmFnZW50VGFza1tdID0gW1xuICAgICAgICBjcmVhdGVUZXN0VGFzayh7IGlkOiBcInQxXCIsIHN0YXR1czogXCJxdWV1ZWRcIiB9KSxcbiAgICAgICAgY3JlYXRlVGVzdFRhc2soeyBpZDogXCJ0MlwiLCBzdGF0dXM6IFwicnVubmluZ1wiIH0pLFxuICAgICAgICBjcmVhdGVUZXN0VGFzayh7IGlkOiBcInQzXCIsIHN0YXR1czogXCJkb25lXCIgfSksXG4gICAgICAgIGNyZWF0ZVRlc3RUYXNrKHsgaWQ6IFwidDRcIiwgc3RhdHVzOiBcImZhaWxlZFwiIH0pLFxuICAgICAgXTtcbiAgICAgIFxuICAgICAgY29uc3QgYWN0aXZlID0gZ2V0QWN0aXZlVGFza3ModGFza3MpO1xuICAgICAgXG4gICAgICBleHBlY3QoYWN0aXZlLmxlbmd0aCkudG9CZSgyKTtcbiAgICAgIGV4cGVjdChhY3RpdmUubWFwKHQgPT4gdC5pZCkpLnRvRXF1YWwoW1widDFcIiwgXCJ0MlwiXSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKFwiZ2V0U3VjY2Vzc2Z1bFRhc2tzXCIsICgpID0+IHtcbiAgICBpdChcIuW6lOivpei/lOWbnuaJgOacieaIkOWKn+S7u+WKoVwiLCAoKSA9PiB7XG4gICAgICBjb25zdCB0YXNrczogU3ViYWdlbnRUYXNrW10gPSBbXG4gICAgICAgIGNyZWF0ZVRlc3RUYXNrKHsgaWQ6IFwidDFcIiwgc3RhdHVzOiBcImRvbmVcIiB9KSxcbiAgICAgICAgY3JlYXRlVGVzdFRhc2soeyBpZDogXCJ0MlwiLCBzdGF0dXM6IFwiZG9uZVwiIH0pLFxuICAgICAgICBjcmVhdGVUZXN0VGFzayh7IGlkOiBcInQzXCIsIHN0YXR1czogXCJmYWlsZWRcIiB9KSxcbiAgICAgIF07XG4gICAgICBcbiAgICAgIGNvbnN0IHN1Y2Nlc3NmdWwgPSBnZXRTdWNjZXNzZnVsVGFza3ModGFza3MpO1xuICAgICAgXG4gICAgICBleHBlY3Qoc3VjY2Vzc2Z1bC5sZW5ndGgpLnRvQmUoMik7XG4gICAgICBleHBlY3Qoc3VjY2Vzc2Z1bC5tYXAodCA9PiB0LmlkKSkudG9FcXVhbChbXCJ0MVwiLCBcInQyXCJdKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoXCJnZXRGYWlsZWRUYXNrc1wiLCAoKSA9PiB7XG4gICAgaXQoXCLlupTor6Xov5Tlm57miYDmnInlpLHotKXku7vliqFcIiwgKCkgPT4ge1xuICAgICAgY29uc3QgdGFza3M6IFN1YmFnZW50VGFza1tdID0gW1xuICAgICAgICBjcmVhdGVUZXN0VGFzayh7IGlkOiBcInQxXCIsIHN0YXR1czogXCJkb25lXCIgfSksXG4gICAgICAgIGNyZWF0ZVRlc3RUYXNrKHsgaWQ6IFwidDJcIiwgc3RhdHVzOiBcImZhaWxlZFwiIH0pLFxuICAgICAgICBjcmVhdGVUZXN0VGFzayh7IGlkOiBcInQzXCIsIHN0YXR1czogXCJ0aW1lb3V0XCIgfSksXG4gICAgICAgIGNyZWF0ZVRlc3RUYXNrKHsgaWQ6IFwidDRcIiwgc3RhdHVzOiBcImJ1ZGdldF9leGNlZWRlZFwiIH0pLFxuICAgICAgXTtcbiAgICAgIFxuICAgICAgY29uc3QgZmFpbGVkID0gZ2V0RmFpbGVkVGFza3ModGFza3MpO1xuICAgICAgXG4gICAgICBleHBlY3QoZmFpbGVkLmxlbmd0aCkudG9CZSgzKTtcbiAgICAgIGV4cGVjdChmYWlsZWQubWFwKHQgPT4gdC5pZCkpLnRvRXF1YWwoW1widDJcIiwgXCJ0M1wiLCBcInQ0XCJdKTtcbiAgICB9KTtcbiAgfSk7XG59KTtcblxuZGVzY3JpYmUoXCLovrnnlYzmg4XlhrVcIiwgKCkgPT4ge1xuICBpdChcIuW6lOivpemYsuatoueKtuaAgei3s+i3g1wiLCAoKSA9PiB7XG4gICAgY29uc3QgdGFzayA9IGNyZWF0ZVRlc3RUYXNrKCk7XG4gICAgXG4gICAgLy8g5bCd6K+V5LuOIHF1ZXVlZCDnm7TmjqXot7PliLAgZG9uZVxuICAgIGV4cGVjdCh0cmFuc2l0aW9uU3ViYWdlbnQodGFzaywgXCJkb25lXCIpLnN1Y2Nlc3MpLnRvQmUoZmFsc2UpO1xuICAgIFxuICAgIC8vIOWwneivleS7jiBxdWV1ZWQg55u05o6l6Lez5YiwIGZhaWxlZFxuICAgIGV4cGVjdCh0cmFuc2l0aW9uU3ViYWdlbnQodGFzaywgXCJmYWlsZWRcIikuc3VjY2VzcykudG9CZShmYWxzZSk7XG4gICAgXG4gICAgLy8g5bCd6K+V5LuOIHF1ZXVlZCDnm7TmjqXot7PliLAgdGltZW91dFxuICAgIGV4cGVjdCh0cmFuc2l0aW9uU3ViYWdlbnQodGFzaywgXCJ0aW1lb3V0XCIpLnN1Y2Nlc3MpLnRvQmUoZmFsc2UpO1xuICB9KTtcblxuICBpdChcIuW6lOivpemYsuatoue7iOaAgeWQjue7p+e7rei9rOaNolwiLCAoKSA9PiB7XG4gICAgY29uc3QgdGFzayA9IGNyZWF0ZVRlc3RUYXNrKHsgc3RhdHVzOiBcImRvbmVcIiB9KTtcbiAgICBcbiAgICBleHBlY3QodHJhbnNpdGlvblN1YmFnZW50KHRhc2ssIFwicnVubmluZ1wiKS5zdWNjZXNzKS50b0JlKGZhbHNlKTtcbiAgICBleHBlY3QodHJhbnNpdGlvblN1YmFnZW50KHRhc2ssIFwiZmFpbGVkXCIpLnN1Y2Nlc3MpLnRvQmUoZmFsc2UpO1xuICAgIGV4cGVjdCh0cmFuc2l0aW9uU3ViYWdlbnQodGFzaywgXCJjYW5jZWxsZWRcIikuc3VjY2VzcykudG9CZShmYWxzZSk7XG4gIH0pO1xuXG4gIGl0KFwi5bqU6K+l6Ziy5q2iIGJ1ZGdldF9leGNlZWRlZCDlkI7ph43or5VcIiwgKCkgPT4ge1xuICAgIGNvbnN0IHRhc2sgPSBjcmVhdGVUZXN0VGFzayh7IHN0YXR1czogXCJidWRnZXRfZXhjZWVkZWRcIiB9KTtcbiAgICBcbiAgICBleHBlY3QocmV0cnlUYXNrKHRhc2spLnN1Y2Nlc3MpLnRvQmUoZmFsc2UpO1xuICAgIGV4cGVjdCh0YXNrLnN0YXR1cykudG9CZShcImJ1ZGdldF9leGNlZWRlZFwiKTsgLy8g54q25oCB5pyq5Y+YXG4gIH0pO1xufSk7XG4iXX0=