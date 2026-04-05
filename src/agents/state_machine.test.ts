/**
 * State Machine 测试
 * 
 * 验证状态转换的合法性和边界条件
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { SubagentTask, SubagentStatus, TeamContext } from "./types";
import {
  SUBAGENT_STATE_TRANSITIONS,
  TEAM_STATE_TRANSITIONS,
  canTransitionSubagent,
  canTransitionTeam,
  getNextStates,
  isTerminalState,
  isTerminalTeamState,
  transitionSubagent,
  transitionTeam,
  startTask,
  completeTask,
  failTask,
  timeoutTask,
  budgetExceededTask,
  cancelTask,
  retryTask,
  completeTeam,
  failTeam,
  cancelTeam,
  getTaskDuration,
  getTeamDuration,
  isRetryable,
  isRunning,
  isComplete,
  getActiveTasks,
  getSuccessfulTasks,
  getFailedTasks,
} from "./state_machine";

// ============================================================================
// 辅助函数：创建测试任务
// ============================================================================

function createTestTask(overrides?: Partial<SubagentTask>): SubagentTask {
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

function createTestTeamContext(overrides?: Partial<TeamContext>): TeamContext {
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

describe("State Machine", () => {
  describe("状态转换表", () => {
    it("应该定义正确的子代理状态转换", () => {
      expect(SUBAGENT_STATE_TRANSITIONS.queued).toEqual(["running", "cancelled"]);
      expect(SUBAGENT_STATE_TRANSITIONS.running).toEqual([
        "done",
        "failed",
        "timeout",
        "budget_exceeded",
        "cancelled",
      ]);
      expect(SUBAGENT_STATE_TRANSITIONS.done).toEqual([]);
      expect(SUBAGENT_STATE_TRANSITIONS.failed).toEqual(["queued"]);
      expect(SUBAGENT_STATE_TRANSITIONS.timeout).toEqual(["queued"]);
      expect(SUBAGENT_STATE_TRANSITIONS.budget_exceeded).toEqual([]);
      expect(SUBAGENT_STATE_TRANSITIONS.cancelled).toEqual([]);
    });

    it("应该定义正确的团队状态转换", () => {
      expect(TEAM_STATE_TRANSITIONS.active).toEqual([
        "completed",
        "failed",
        "cancelled",
      ]);
      expect(TEAM_STATE_TRANSITIONS.completed).toEqual([]);
      expect(TEAM_STATE_TRANSITIONS.failed).toEqual([]);
      expect(TEAM_STATE_TRANSITIONS.cancelled).toEqual([]);
    });
  });

  describe("canTransitionSubagent", () => {
    it("应该允许合法转换", () => {
      expect(canTransitionSubagent("queued", "running")).toBe(true);
      expect(canTransitionSubagent("running", "done")).toBe(true);
      expect(canTransitionSubagent("running", "failed")).toBe(true);
      expect(canTransitionSubagent("failed", "queued")).toBe(true);
      expect(canTransitionSubagent("timeout", "queued")).toBe(true);
    });

    it("应该拒绝非法转换", () => {
      expect(canTransitionSubagent("queued", "done")).toBe(false);
      expect(canTransitionSubagent("running", "queued")).toBe(false);
      expect(canTransitionSubagent("done", "running")).toBe(false);
      expect(canTransitionSubagent("failed", "done")).toBe(false);
      expect(canTransitionSubagent("budget_exceeded", "queued")).toBe(false);
    });

    it("应该拒绝从终态转换", () => {
      expect(canTransitionSubagent("done", "failed")).toBe(false);
      expect(canTransitionSubagent("cancelled", "queued")).toBe(false);
      expect(canTransitionSubagent("budget_exceeded", "running")).toBe(false);
    });
  });

  describe("isTerminalState", () => {
    it("应该正确识别终态", () => {
      expect(isTerminalState("done")).toBe(true);
      expect(isTerminalState("cancelled")).toBe(true);
      expect(isTerminalState("budget_exceeded")).toBe(true);
    });

    it("应该正确识别非终态", () => {
      expect(isTerminalState("queued")).toBe(false);
      expect(isTerminalState("running")).toBe(false);
      expect(isTerminalState("failed")).toBe(false);
      expect(isTerminalState("timeout")).toBe(false);
    });
  });

  describe("getNextStates", () => {
    it("应该返回所有合法的下一个状态", () => {
      expect(getNextStates("queued")).toEqual(["running", "cancelled"]);
      expect(getNextStates("running")).toEqual([
        "done",
        "failed",
        "timeout",
        "budget_exceeded",
        "cancelled",
      ]);
    });
  });
});

describe("transitionSubagent", () => {
  it("应该成功转换状态", () => {
    const task = createTestTask();
    
    const result = transitionSubagent(task, "running");
    
    expect(result.success).toBe(true);
    expect(result.task.status).toBe("running");
    expect(result.previousState).toBe("queued");
    expect(result.newState).toBe("running");
    expect(task.startedAt).toBeDefined();
  });

  it("应该拒绝非法转换", () => {
    const task = createTestTask();
    
    // 尝试从 queued 直接到 done（非法）
    const result = transitionSubagent(task, "done");
    
    expect(result.success).toBe(false);
    expect(result.error).toContain("Illegal state transition");
    expect(task.status).toBe("queued"); // 状态未变
  });

  it("应该记录错误信息", () => {
    const task = createTestTask({ status: "running" });
    
    const result = transitionSubagent(task, "failed", {
      error: "测试错误",
      reason: "测试原因",
    });
    
    expect(result.success).toBe(true);
    expect(task.lastError).toBe("测试错误");
  });

  it("应该设置 completedAt 当进入终态", () => {
    const task = createTestTask({ status: "running", startedAt: Date.now() - 1000 });
    
    transitionSubagent(task, "done");
    
    expect(task.completedAt).toBeDefined();
    expect(task.completedAt!).toBeGreaterThanOrEqual(task.startedAt!);
  });
});

describe("便捷方法", () => {
  describe("startTask", () => {
    it("应该从 queued 转换到 running", () => {
      const task = createTestTask();
      const result = startTask(task);
      
      expect(result.success).toBe(true);
      expect(task.status).toBe("running");
      expect(task.startedAt).toBeDefined();
    });

    it("应该拒绝从非 queued 状态启动", () => {
      const task = createTestTask({ status: "running" });
      const result = startTask(task);
      
      expect(result.success).toBe(false);
    });
  });

  describe("completeTask", () => {
    it("应该从 running 转换到 done", () => {
      const task = createTestTask({ status: "running" });
      const result = completeTask(task);
      
      expect(result.success).toBe(true);
      expect(task.status).toBe("done");
      expect(task.completedAt).toBeDefined();
    });
  });

  describe("failTask", () => {
    it("应该从 running 转换到 failed", () => {
      const task = createTestTask({ status: "running" });
      const result = failTask(task, "测试失败");
      
      expect(result.success).toBe(true);
      expect(task.status).toBe("failed");
      expect(task.lastError).toBe("测试失败");
    });
  });

  describe("timeoutTask", () => {
    it("应该从 running 转换到 timeout", () => {
      const task = createTestTask({ status: "running" });
      const result = timeoutTask(task, 60000, 5);
      
      expect(result.success).toBe(true);
      expect(task.status).toBe("timeout");
      expect(task.lastError).toContain("Timeout after 60000ms");
    });
  });

  describe("budgetExceededTask", () => {
    it("应该从 running 转换到 budget_exceeded", () => {
      const task = createTestTask({ status: "running" });
      const result = budgetExceededTask(task, "turns", 10, 15);
      
      expect(result.success).toBe(true);
      expect(task.status).toBe("budget_exceeded");
      expect(task.lastError).toContain("Budget exceeded: turns (15/10)");
    });
  });

  describe("cancelTask", () => {
    it("应该从任意非终态转换到 cancelled", () => {
      const task1 = createTestTask({ status: "queued" });
      const task2 = createTestTask({ status: "running" });
      const task3 = createTestTask({ status: "failed" });
      
      expect(cancelTask(task1, "用户取消").success).toBe(true);
      expect(cancelTask(task2, "用户取消").success).toBe(true);
      expect(cancelTask(task3, "用户取消").success).toBe(true);
      
      expect(task1.status).toBe("cancelled");
      expect(task2.status).toBe("cancelled");
      expect(task3.status).toBe("cancelled");
    });

    it("应该拒绝从终态取消", () => {
      const task = createTestTask({ status: "done" });
      const result = cancelTask(task, "用户取消");
      
      expect(result.success).toBe(false);
    });
  });

  describe("retryTask", () => {
    it("应该从 failed 重试到 queued", () => {
      const task = createTestTask({
        status: "failed",
        lastError: "测试失败",
        currentTurn: 5,
      });
      
      const result = retryTask(task);
      
      expect(result.success).toBe(true);
      expect(task.status).toBe("queued");
      expect(task.currentTurn).toBe(0); // 重置轮次
      expect(task.lastError).toBeUndefined(); // 清除错误
    });

    it("应该从 timeout 重试到 queued", () => {
      const task = createTestTask({ status: "timeout" });
      const result = retryTask(task);
      
      expect(result.success).toBe(true);
      expect(task.status).toBe("queued");
    });

    it("应该拒绝从非失败状态重试", () => {
      const task = createTestTask({ status: "running" });
      const result = retryTask(task);
      
      expect(result.success).toBe(false);
    });
  });
});

describe("团队状态转换", () => {
  describe("canTransitionTeam", () => {
    it("应该允许合法转换", () => {
      expect(canTransitionTeam("active", "completed")).toBe(true);
      expect(canTransitionTeam("active", "failed")).toBe(true);
      expect(canTransitionTeam("active", "cancelled")).toBe(true);
    });

    it("应该拒绝非法转换", () => {
      expect(canTransitionTeam("completed", "active")).toBe(false);
      expect(canTransitionTeam("failed", "active")).toBe(false);
      expect(canTransitionTeam("cancelled", "active")).toBe(false);
    });
  });

  describe("completeTeam", () => {
    it("应该从 active 转换到 completed", () => {
      const context = createTestTeamContext();
      const result = completeTeam(context);
      
      expect(result.success).toBe(true);
      expect(context.status).toBe("completed");
      expect(context.completedAt).toBeDefined();
    });
  });

  describe("failTeam", () => {
    it("应该从 active 转换到 failed", () => {
      const context = createTestTeamContext();
      const result = failTeam(context, "测试失败");
      
      expect(result.success).toBe(true);
      expect(context.status).toBe("failed");
      expect(context.completedAt).toBeDefined();
    });
  });

  describe("cancelTeam", () => {
    it("应该从 active 转换到 cancelled", () => {
      const context = createTestTeamContext();
      const result = cancelTeam(context, "用户取消");
      
      expect(result.success).toBe(true);
      expect(context.status).toBe("cancelled");
    });
  });
});

describe("查询工具", () => {
  describe("getTaskDuration", () => {
    it("应该计算任务运行时长", () => {
      const startTime = Date.now() - 5000;
      const endTime = Date.now();
      
      const task = createTestTask({
        status: "done",
        startedAt: startTime,
        completedAt: endTime,
      });
      
      const duration = getTaskDuration(task);
      
      expect(duration).toBeDefined();
      expect(duration!).toBeGreaterThanOrEqual(4900);
      expect(duration!).toBeLessThanOrEqual(5100);
    });

    it("应该返回 undefined 当未开始", () => {
      const task = createTestTask();
      const duration = getTaskDuration(task);
      
      expect(duration).toBeUndefined();
    });
  });

  describe("getTeamDuration", () => {
    it("应该计算团队运行时长", () => {
      const startTime = Date.now() - 10000;
      const endTime = Date.now();
      
      const context = createTestTeamContext({
        status: "completed",
        createdAt: startTime,
        completedAt: endTime,
      });
      
      const duration = getTeamDuration(context);
      
      expect(duration).toBeDefined();
      expect(duration!).toBeGreaterThanOrEqual(9900);
    });
  });

  describe("isRetryable", () => {
    it("应该识别可重试状态", () => {
      expect(isRetryable(createTestTask({ status: "failed" }))).toBe(true);
      expect(isRetryable(createTestTask({ status: "timeout" }))).toBe(true);
    });

    it("应该识别不可重试状态", () => {
      expect(isRetryable(createTestTask({ status: "queued" }))).toBe(false);
      expect(isRetryable(createTestTask({ status: "running" }))).toBe(false);
      expect(isRetryable(createTestTask({ status: "done" }))).toBe(false);
      expect(isRetryable(createTestTask({ status: "budget_exceeded" }))).toBe(false);
    });
  });

  describe("isRunning", () => {
    it("应该识别运行中状态", () => {
      expect(isRunning(createTestTask({ status: "running" }))).toBe(true);
      expect(isRunning(createTestTask({ status: "queued" }))).toBe(false);
      expect(isRunning(createTestTask({ status: "done" }))).toBe(false);
    });
  });

  describe("isComplete", () => {
    it("应该识别完成状态（终态）", () => {
      expect(isComplete(createTestTask({ status: "done" }))).toBe(true);
      expect(isComplete(createTestTask({ status: "cancelled" }))).toBe(true);
      expect(isComplete(createTestTask({ status: "budget_exceeded" }))).toBe(true);
    });

    it("应该识别未完成状态", () => {
      expect(isComplete(createTestTask({ status: "queued" }))).toBe(false);
      expect(isComplete(createTestTask({ status: "running" }))).toBe(false);
      expect(isComplete(createTestTask({ status: "failed" }))).toBe(false);
    });
  });

  describe("getActiveTasks", () => {
    it("应该返回所有活跃任务", () => {
      const tasks: SubagentTask[] = [
        createTestTask({ id: "t1", status: "queued" }),
        createTestTask({ id: "t2", status: "running" }),
        createTestTask({ id: "t3", status: "done" }),
        createTestTask({ id: "t4", status: "failed" }),
      ];
      
      const active = getActiveTasks(tasks);
      
      expect(active.length).toBe(2);
      expect(active.map(t => t.id)).toEqual(["t1", "t2"]);
    });
  });

  describe("getSuccessfulTasks", () => {
    it("应该返回所有成功任务", () => {
      const tasks: SubagentTask[] = [
        createTestTask({ id: "t1", status: "done" }),
        createTestTask({ id: "t2", status: "done" }),
        createTestTask({ id: "t3", status: "failed" }),
      ];
      
      const successful = getSuccessfulTasks(tasks);
      
      expect(successful.length).toBe(2);
      expect(successful.map(t => t.id)).toEqual(["t1", "t2"]);
    });
  });

  describe("getFailedTasks", () => {
    it("应该返回所有失败任务", () => {
      const tasks: SubagentTask[] = [
        createTestTask({ id: "t1", status: "done" }),
        createTestTask({ id: "t2", status: "failed" }),
        createTestTask({ id: "t3", status: "timeout" }),
        createTestTask({ id: "t4", status: "budget_exceeded" }),
      ];
      
      const failed = getFailedTasks(tasks);
      
      expect(failed.length).toBe(3);
      expect(failed.map(t => t.id)).toEqual(["t2", "t3", "t4"]);
    });
  });
});

describe("边界情况", () => {
  it("应该防止状态跳跃", () => {
    const task = createTestTask();
    
    // 尝试从 queued 直接跳到 done
    expect(transitionSubagent(task, "done").success).toBe(false);
    
    // 尝试从 queued 直接跳到 failed
    expect(transitionSubagent(task, "failed").success).toBe(false);
    
    // 尝试从 queued 直接跳到 timeout
    expect(transitionSubagent(task, "timeout").success).toBe(false);
  });

  it("应该防止终态后继续转换", () => {
    const task = createTestTask({ status: "done" });
    
    expect(transitionSubagent(task, "running").success).toBe(false);
    expect(transitionSubagent(task, "failed").success).toBe(false);
    expect(transitionSubagent(task, "cancelled").success).toBe(false);
  });

  it("应该防止 budget_exceeded 后重试", () => {
    const task = createTestTask({ status: "budget_exceeded" });
    
    expect(retryTask(task).success).toBe(false);
    expect(task.status).toBe("budget_exceeded"); // 状态未变
  });
});
