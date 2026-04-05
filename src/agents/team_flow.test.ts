/**
 * Team Flow 端到端测试
 * 
 * 验证完整的团队执行流程：
 * 1. 创建团队
 * 2. 调度子代理（按依赖顺序）
 * 3. 处理失败场景
 * 4. 归并结果
 * 5. 取消/重试
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TeamOrchestrator, runTeam } from "./team_orchestrator";
import { SubagentRunner, AgentTeamHookBus } from "./index";
import { DelegationPolicy } from "./delegation_policy";
import type { CreateTeamParams, SubagentResult } from "./types";

// ============================================================================
// Mock Runner：模拟真实执行
// ============================================================================

class MockSubagentRunner extends SubagentRunner {
  private failTaskId?: string;
  private timeoutTaskId?: string;

  setFailTask(taskId: string) {
    this.failTaskId = taskId;
  }

  setTimeoutTask(taskId: string) {
    this.timeoutTaskId = taskId;
  }

  protected async executeRole(task: any, context: any): Promise<any> {
    // 模拟失败
    if (this.failTaskId === task.id) {
      throw new Error("模拟任务失败");
    }

    // 模拟超时
    if (this.timeoutTaskId === task.id) {
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    // 正常返回
    return {
      subagentTaskId: task.id,
      parentTaskId: task.parentTaskId,
      teamId: task.teamId,
      agent: task.agent,
      summary: `${task.agent} 完成：${task.goal}`,
      confidence: 0.8 + Math.random() * 0.2,
      turnsUsed: Math.floor(Math.random() * 5) + 1,
      tokensUsed: Math.floor(Math.random() * 1000) + 500,
      durationMs: Math.floor(Math.random() * 100) + 10,
      artifacts:
        task.agent === "planner"
          ? [{ type: "text" as const, content: "计划", description: "任务计划" }]
          : undefined,
      patches:
        task.agent === "code_fixer"
          ? [
              {
                fileId: "src/app.ts",
                diff: "--- a/src/app.ts\n+++ b/src/app.ts",
                hunks: 1,
                linesAdded: 5,
                linesDeleted: 2,
              },
            ]
          : undefined,
      findings:
        task.agent === "code_reviewer"
          ? [
              {
                type: "suggestion" as const,
                severity: "low" as const,
                description: "建议添加类型注解",
              },
            ]
          : undefined,
      recommendations:
        task.agent === "planner" ? ["执行代码修复", "验证结果"] : undefined,
    };
  }
}

// ============================================================================
// 测试用例
// ============================================================================

describe("Team Flow - 端到端", () => {
  let hookBus: AgentTeamHookBus;
  let runner: MockSubagentRunner;
  let orchestrator: TeamOrchestrator;

  beforeEach(() => {
    hookBus = new AgentTeamHookBus();
    runner = new MockSubagentRunner(hookBus);
    orchestrator = new TeamOrchestrator(runner, hookBus);
  });

  describe("成功流程", () => {
    it("应该完成 planner → fixer → verifier 完整流程", async () => {
      const context = await orchestrator.createTeam({
        parentTaskId: "task_e2e",
        sessionId: "session_e2e",
        goal: "修复 bug 并验证",
        agents: [
          {
            role: "planner",
            goal: "分析 bug 并制定修复计划",
            allowedTools: ["fs.read", "grep.search"],
            budget: { maxTurns: 10, timeoutMs: 60000 },
          },
          {
            role: "code_fixer",
            goal: "实现修复",
            allowedTools: ["fs.read", "fs.write"],
            budget: { maxTurns: 20, timeoutMs: 120000 },
          },
          {
            role: "verify_agent",
            goal: "运行测试验证",
            allowedTools: ["shell.run"],
            budget: { maxTurns: 15, timeoutMs: 90000 },
          },
        ],
        totalBudget: {
          maxTurns: 50,
          timeoutMs: 300000,
        },
      });

      // 等待完成
      const results = await orchestrator.waitForCompletion(context.teamId);

      // 验证结果
      expect(results.length).toBe(3);
      expect(results.map(r => r.agent)).toEqual([
        "planner",
        "code_fixer",
        "verify_agent",
      ]);

      // 验证团队状态
      const finalContext = await orchestrator.getTeamStatus(context.teamId);
      expect(finalContext.status).toBe("active"); // 需要手动调用 completeTeam

      // 归并结果
      const merged = await orchestrator.mergeResults(results);
      expect(merged.summary).toBeDefined();
      expect(merged.confidence).toBeGreaterThan(0);
      expect(merged.artifacts.length).toBe(1); // planner 的计划
      expect(merged.patches.length).toBe(1); // fixer 的补丁
      expect(merged.findings.length).toBe(1); // reviewer 的发现
    });

    it("应该按依赖顺序执行", async () => {
      const executionOrder: string[] = [];
      const hookBus = new AgentTeamHookBus();

      hookBus.on("SubagentStop", (event) => {
        executionOrder.push(event.result?.agent || "unknown");
      });

      const runner = new MockSubagentRunner(hookBus);
      const orchestrator = new TeamOrchestrator(runner, hookBus);

      const context = await orchestrator.createTeam({
        parentTaskId: "task_dep",
        sessionId: "session_dep",
        goal: "依赖任务",
        agents: [
          {
            role: "planner",
            goal: "规划",
            allowedTools: ["fs.read"],
            budget: { maxTurns: 10, timeoutMs: 60000 },
          },
          {
            role: "code_fixer",
            goal: "修复",
            allowedTools: ["fs.write"],
            budget: { maxTurns: 20, timeoutMs: 120000 },
            dependsOn: ["planner"],
          },
          {
            role: "verify_agent",
            goal: "验证",
            allowedTools: ["shell.run"],
            budget: { maxTurns: 15, timeoutMs: 90000 },
            dependsOn: ["code_fixer"],
          },
        ],
        totalBudget: {
          maxTurns: 50,
          timeoutMs: 300000,
        },
      });

      // 设置依赖关系
      const plannerTask = context.agents[0];
      context.agents[1].dependsOn = [plannerTask.id];
      context.agents[2].dependsOn = [context.agents[1].id];

      await orchestrator.waitForCompletion(context.teamId);

      // 验证执行顺序
      expect(executionOrder).toEqual(["planner", "code_fixer", "verify_agent"]);
    });
  });

  describe("失败处理", () => {
    it("应该处理单个子代理失败", async () => {
      const context = await orchestrator.createTeam({
        parentTaskId: "task_fail",
        sessionId: "session_fail",
        goal: "测试失败处理",
        agents: [
          {
            role: "planner",
            goal: "规划",
            allowedTools: ["fs.read"],
            budget: { maxTurns: 10, timeoutMs: 60000 },
          },
          {
            role: "code_fixer",
            goal: "修复",
            allowedTools: ["fs.write"],
            budget: { maxTurns: 20, timeoutMs: 120000 },
          },
        ],
        totalBudget: {
          maxTurns: 35,
          timeoutMs: 300000,
        },
      });

      // 让 fixer 失败
      const fixerTask = context.agents[1];
      runner.setFailTask(fixerTask.id);

      // stopOnError=false，继续执行
      const results = await orchestrator.waitForCompletion(context.teamId, {
        stopOnError: false,
      });

      // planner 成功，fixer 失败
      expect(results.length).toBe(1); // 只有成功的结果
      expect(results[0].agent).toBe("planner");
    });

    it("应该在 stopOnError=true 时立即停止", async () => {
      const context = await orchestrator.createTeam({
        parentTaskId: "task_stop",
        sessionId: "session_stop",
        goal: "测试停止",
        agents: [
          {
            role: "planner",
            goal: "规划",
            allowedTools: ["fs.read"],
            budget: { maxTurns: 10, timeoutMs: 60000 },
          },
          {
            role: "code_fixer",
            goal: "修复",
            allowedTools: ["fs.write"],
            budget: { maxTurns: 20, timeoutMs: 120000 },
          },
        ],
        totalBudget: {
          maxTurns: 35,
          timeoutMs: 300000,
        },
      });

      // 让 planner 失败
      runner.setFailTask(context.agents[0].id);

      // stopOnError=true，立即停止
      await expect(
        orchestrator.waitForCompletion(context.teamId, {
          stopOnError: true,
        })
      ).rejects.toThrow();
    });
  });

  describe("取消流程", () => {
    it("应该取消所有活跃任务", async () => {
      const context = await orchestrator.createTeam({
        parentTaskId: "task_cancel",
        sessionId: "session_cancel",
        goal: "测试取消",
        agents: [
          {
            role: "planner",
            goal: "规划",
            allowedTools: ["fs.read"],
            budget: { maxTurns: 10, timeoutMs: 60000 },
          },
          {
            role: "code_fixer",
            goal: "修复",
            allowedTools: ["fs.write"],
            budget: { maxTurns: 20, timeoutMs: 120000 },
          },
        ],
        totalBudget: {
          maxTurns: 35,
          timeoutMs: 300000,
        },
      });

      // 立即取消
      await orchestrator.cancelTeam(context.teamId, "用户取消");

      const finalContext = await orchestrator.getTeamStatus(context.teamId);

      expect(finalContext.status).toBe("cancelled");
      expect(finalContext.agents.every(a => a.status === "cancelled")).toBe(true);
    });
  });

  describe("Hook 触发", () => {
    it("应该触发完整的 Hook 序列", async () => {
      const hookEvents: string[] = [];

      hookBus.on("TeamCreate", () => hookEvents.push("TeamCreate"));
      hookBus.on("SubagentStart", () => hookEvents.push("SubagentStart"));
      hookBus.on("SubagentStop", () => hookEvents.push("SubagentStop"));
      hookBus.on("TeamMerge", () => hookEvents.push("TeamMerge"));

      const context = await orchestrator.createTeam({
        parentTaskId: "task_hook",
        sessionId: "session_hook",
        goal: "测试 Hook",
        agents: [
          {
            role: "planner",
            goal: "规划",
            allowedTools: ["fs.read"],
            budget: { maxTurns: 10, timeoutMs: 60000 },
          },
        ],
        totalBudget: {
          maxTurns: 15,
          timeoutMs: 60000,
        },
      });

      await orchestrator.waitForCompletion(context.teamId);
      await orchestrator.mergeResults(
        await orchestrator.waitForCompletion(context.teamId)
      );

      expect(hookEvents).toContain("TeamCreate");
      expect(hookEvents.filter(e => e === "SubagentStart").length).toBe(1);
      expect(hookEvents.filter(e => e === "SubagentStop").length).toBe(1);
      expect(hookEvents).toContain("TeamMerge");
    });
  });
});

describe("runTeam (便捷函数)", () => {
  it("应该完成端到端执行", async () => {
    const hookBus = new AgentTeamHookBus();
    const runner = new MockSubagentRunner(hookBus);

    const { context, results, merged } = await runTeam(
      {
        parentTaskId: "task_run",
        sessionId: "session_run",
        goal: "端到端测试",
        agents: [
          {
            role: "planner",
            goal: "规划",
            allowedTools: ["fs.read"],
            budget: { maxTurns: 10, timeoutMs: 60000 },
          },
          {
            role: "verify_agent",
            goal: "验证",
            allowedTools: ["shell.run"],
            budget: { maxTurns: 15, timeoutMs: 90000 },
          },
        ],
        totalBudget: {
          maxTurns: 30,
          timeoutMs: 300000,
        },
      },
      runner,
      hookBus
    );

    expect(context.status).toBe("completed");
    expect(results.length).toBe(2);
    expect(merged.summary).toBeDefined();
  });
});

describe("Delegation Policy 集成", () => {
  it("应该使用策略推荐角色", async () => {
    const policy = new DelegationPolicy();
    const agents = await policy.recommendAgents({
      id: "task_policy",
      goal: "复杂任务",
      complexity: "high",
    });

    expect(agents.length).toBe(5);
    expect(agents.map(a => a.role)).toEqual([
      "planner",
      "repo_reader",
      "code_fixer",
      "code_reviewer",
      "verify_agent",
    ]);
  });

  it("应该使用策略计算预算", async () => {
    const policy = new DelegationPolicy();
    const agents = await policy.recommendAgents({
      id: "task_budget",
      goal: "测试",
      complexity: "medium",
    });

    const allocation = await policy.calculateBudget(
      { maxTurns: 100, timeoutMs: 600000 },
      agents
    );

    expect(allocation.perAgent).toBeDefined();
    expect(allocation.reserved).toBeDefined();
  });
});
