/**
 * Subagent Runner 测试
 * 
 * 验证执行器的核心功能：
 * - 任务执行
 * - 预算控制
 * - Hook 触发
 * - 错误处理
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SubagentRunner, NoOpHookBus } from "./subagent_runner";
import type { SubagentTask, TeamContext, BudgetSpec } from "./types";
import { AgentTeamHookBus } from "./hooks";

// ============================================================================
// 辅助函数
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

describe("SubagentRunner", () => {
  let runner: SubagentRunner;
  let hookBus: AgentTeamHookBus;

  beforeEach(() => {
    hookBus = new AgentTeamHookBus();
    runner = new SubagentRunner(hookBus);
  });

  describe("run", () => {
    it("应该成功执行任务并返回结果", async () => {
      const task = createTestTask();
      const context = createTestTeamContext();

      const result = await runner.run(task, context);

      expect(result.subagentTaskId).toBe(task.id);
      expect(result.agent).toBe("planner");
      expect(result.summary).toBeDefined();
      expect(result.turnsUsed).toBe(1);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(task.status).toBe("done");
    });

    it("应该为不同角色返回不同结果", async () => {
      const roles: Array<SubagentTask["agent"]> = [
        "planner",
        "repo_reader",
        "code_fixer",
        "code_reviewer",
        "verify_agent",
        "release_agent",
      ];

      for (const role of roles) {
        const task = createTestTask({ agent: role, id: `task_${role}` });
        const context = createTestTeamContext();

        const result = await runner.run(task, context);

        expect(result.agent).toBe(role);
        expect(result.summary).toBeDefined();
      }
    });

    it("应该触发 SubagentStart Hook", async () => {
      let startEventCaptured = false;

      hookBus.on("SubagentStart", (event) => {
        startEventCaptured = true;
        expect(event.agent).toBe("planner");
        expect(event.goal).toBe("测试任务");
      });

      const task = createTestTask();
      const context = createTestTeamContext();

      await runner.run(task, context);

      expect(startEventCaptured).toBe(true);
    });

    it("应该触发 SubagentStop Hook", async () => {
      let stopEventCaptured = false;

      hookBus.on("SubagentStop", (event) => {
        stopEventCaptured = true;
        expect(event.reason).toBe("completed");
        expect(event.result).toBeDefined();
      });

      const task = createTestTask();
      const context = createTestTeamContext();

      await runner.run(task, context);

      expect(stopEventCaptured).toBe(true);
    });

    it("应该设置 startedAt 和 completedAt", async () => {
      const task = createTestTask();
      const context = createTestTeamContext();

      await runner.run(task, context);

      expect(task.startedAt).toBeDefined();
      expect(task.completedAt).toBeDefined();
      expect(task.completedAt!).toBeGreaterThanOrEqual(task.startedAt!);
    });
  });

  describe("预算控制", () => {
    it("应该检测 turns 超限", async () => {
      // 创建一个 mock runner 返回超限结果
      class TestRunner extends SubagentRunner {
        protected async executeRole(): Promise<any> {
          return {
            subagentTaskId: "task_test",
            parentTaskId: "parent_1",
            teamId: "team_1",
            agent: "planner",
            summary: "测试",
            turnsUsed: 15, // 超过 maxTurns=10
            tokensUsed: 1000,
            durationMs: 100,
          };
        }
      }

      const runner = new TestRunner(hookBus);
      const task = createTestTask({
        budget: { maxTurns: 10, timeoutMs: 60000 },
      });
      const context = createTestTeamContext();

      const result = await runner.run(task, context);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("Budget exceeded: turns");
      expect(task.status).toBe("budget_exceeded");
    });

    it("应该检测 tokens 超限", async () => {
      class TestRunner extends SubagentRunner {
        protected async executeRole(): Promise<any> {
          return {
            subagentTaskId: "task_test",
            parentTaskId: "parent_1",
            teamId: "team_1",
            agent: "planner",
            summary: "测试",
            turnsUsed: 1,
            tokensUsed: 200000, // 超过 maxTokens=100000
            durationMs: 100,
          };
        }
      }

      const runner = new TestRunner(hookBus);
      const task = createTestTask({
        budget: { maxTurns: 10, maxTokens: 100000, timeoutMs: 60000 },
      });
      const context = createTestTeamContext();

      const result = await runner.run(task, context);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("Budget exceeded: tokens");
      expect(task.status).toBe("budget_exceeded");
    });

    it("应该检测 timeout 超限", async () => {
      class TestRunner extends SubagentRunner {
        protected async executeRole(): Promise<any> {
          return {
            subagentTaskId: "task_test",
            parentTaskId: "parent_1",
            teamId: "team_1",
            agent: "planner",
            summary: "测试",
            turnsUsed: 1,
            tokensUsed: 1000,
            durationMs: 120000, // 超过 timeoutMs=60000
          };
        }
      }

      const runner = new TestRunner(hookBus);
      const task = createTestTask({
        budget: { maxTurns: 10, timeoutMs: 60000 },
      });
      const context = createTestTeamContext();

      const result = await runner.run(task, context);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("Budget exceeded: timeout");
      expect(task.status).toBe("budget_exceeded");
    });
  });

  describe("错误处理", () => {
    it("应该捕获执行错误并返回失败结果", async () => {
      class TestRunner extends SubagentRunner {
        protected async executeRole(): Promise<any> {
          throw new Error("模拟执行错误");
        }
      }

      const runner = new TestRunner(hookBus);
      const task = createTestTask();
      const context = createTestTeamContext();

      const result = await runner.run(task, context);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("模拟执行错误");
      expect(task.status).toBe("failed");
    });

    it("应该触发 SubagentFail Hook", async () => {
      let failEventCaptured = false;

      hookBus.on("SubagentFail", (event) => {
        failEventCaptured = true;
        expect(event.error.message).toBe("模拟错误");
        expect(event.recoverable).toBe(true);
      });

      class TestRunner extends SubagentRunner {
        protected async executeRole(): Promise<any> {
          throw new Error("模拟错误");
        }
      }

      const runner = new TestRunner(hookBus);
      const task = createTestTask();
      const context = createTestTeamContext();

      await runner.run(task, context);

      expect(failEventCaptured).toBe(true);
    });

    it("应该区分 recoverable 和 unrecoverable 错误", async () => {
      class TestRunner extends SubagentRunner {
        protected async executeRole(recoverable = true): Promise<any> {
          throw new Error(recoverable ? "可恢复错误" : "不可恢复错误");
        }
      }

      // 注意：当前实现默认 recoverable=true
      // 后续可根据错误类型自动判断
    });
  });

  describe("stop", () => {
    it("应该停止运行中的任务", async () => {
      const task = createTestTask();
      const context = createTestTeamContext();

      // 先启动任务
      const runPromise = runner.run(task, context);

      // 停止任务
      await runner.stop(task.id, "用户停止");

      // 等待执行完成
      await runPromise;

      expect(task.status).toBe("cancelled");
      expect(task.lastError).toBe("用户停止");
    });

    it("应该抛出错误当任务不存在", async () => {
      await expect(runner.stop("nonexistent_task")).rejects.toThrow(
        "Task not found: nonexistent_task"
      );
    });
  });

  describe("getStatus", () => {
    it("应该返回任务状态", async () => {
      const task = createTestTask();
      const context = createTestTeamContext();

      await runner.run(task, context);

      const status = await runner.getStatus(task.id);

      expect(status.id).toBe(task.id);
      expect(status.status).toBe("done");
    });

    it("应该抛出错误当任务不存在", async () => {
      await expect(runner.getStatus("nonexistent_task")).rejects.toThrow(
        "Task not found: nonexistent_task"
      );
    });
  });
});

describe("NoOpHookBus", () => {
  it("应该静默执行 emit", async () => {
    const hookBus = new NoOpHookBus();

    // 不应该抛出错误
    await expect(
      hookBus.emit({
        type: "SubagentStart",
        taskId: "task_1",
        teamId: "team_1",
        timestamp: Date.now(),
        agent: "planner",
        goal: "测试",
        budget: { maxTurns: 10, timeoutMs: 60000 },
      })
    ).resolves.toBeUndefined();
  });
});

describe("Hook 触发顺序", () => {
  it("应该按正确顺序触发 Hook", async () => {
    const hookOrder: string[] = [];

    const hookBus = new AgentTeamHookBus();

    hookBus.on("SubagentStart", () => hookOrder.push("start"));
    hookBus.on("SubagentStop", () => hookOrder.push("stop"));
    hookBus.on("SubagentFail", () => hookOrder.push("fail"));

    const runner = new SubagentRunner(hookBus);
    const task = createTestTask();
    const context = createTestTeamContext();

    await runner.run(task, context);

    expect(hookOrder).toEqual(["start", "stop"]);
  });

  it("应该在失败时触发 SubagentFail 而不是 SubagentStop", async () => {
    const hookOrder: string[] = [];

    const hookBus = new AgentTeamHookBus();

    hookBus.on("SubagentStart", () => hookOrder.push("start"));
    hookBus.on("SubagentStop", () => hookOrder.push("stop"));
    hookBus.on("SubagentFail", () => hookOrder.push("fail"));

    class TestRunner extends SubagentRunner {
      protected async executeRole(): Promise<any> {
        throw new Error("模拟失败");
      }
    }

    const runner = new TestRunner(hookBus);
    const task = createTestTask();
    const context = createTestTeamContext();

    await runner.run(task, context);

    expect(hookOrder).toEqual(["start", "fail"]);
  });
});

describe("执行时长", () => {
  it("应该记录合理的执行时长", async () => {
    const runner = new SubagentRunner(hookBus);
    const task = createTestTask();
    const context = createTestTeamContext();

    const startTime = Date.now();
    const result = await runner.run(task, context);
    const endTime = Date.now();

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.durationMs).toBeLessThanOrEqual(endTime - startTime + 100); // 允许 100ms 误差
  });
});
