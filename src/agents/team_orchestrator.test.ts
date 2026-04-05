/**
 * TeamOrchestrator 测试
 * 
 * 验证最小可运行链路：
 * 1. 创建团队
 * 2. 调度子代理
 * 3. 等待完成
 * 4. 归并结果
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TeamOrchestrator, runTeam } from "./team_orchestrator";
import { SubagentRunner, AgentTeamHookBus } from "./index";
import type { CreateTeamParams, SubagentResult, MergedResult } from "./types";

describe("TeamOrchestrator", () => {
  let orchestrator: TeamOrchestrator;
  let hookBus: AgentTeamHookBus;
  
  beforeEach(() => {
    hookBus = new AgentTeamHookBus();
    const runner = new SubagentRunner(hookBus);
    orchestrator = new TeamOrchestrator(runner, hookBus);
  });
  
  describe("createTeam", () => {
    it("应该成功创建团队", async () => {
      const params: CreateTeamParams = {
        parentTaskId: "task_123",
        sessionId: "session_456",
        goal: "测试任务",
        agents: [
          {
            role: "planner",
            goal: "规划任务",
            allowedTools: ["fs.read"],
            budget: {
              maxTurns: 10,
              timeoutMs: 60000,
            },
          },
        ],
        totalBudget: {
          maxTurns: 30,
          timeoutMs: 300000,
        },
      };
      
      const context = await orchestrator.createTeam(params);
      
      expect(context.teamId).toBeDefined();
      expect(context.parentTaskId).toBe("task_123");
      expect(context.agents.length).toBe(1);
      expect(context.agents[0].agent).toBe("planner");
      expect(context.status).toBe("active");
    });
    
    it("应该创建多个子代理任务", async () => {
      const params: CreateTeamParams = {
        parentTaskId: "task_123",
        sessionId: "session_456",
        goal: "多角色任务",
        agents: [
          {
            role: "planner",
            goal: "规划",
            allowedTools: ["fs.read"],
            budget: { maxTurns: 10, timeoutMs: 60000 },
          },
          {
            role: "code_fixer",
            goal: "修复代码",
            allowedTools: ["fs.read", "fs.write"],
            budget: { maxTurns: 20, timeoutMs: 120000 },
            dependsOn: ["task_planner"],
          },
          {
            role: "verify_agent",
            goal: "验证结果",
            allowedTools: ["shell.run"],
            budget: { maxTurns: 15, timeoutMs: 90000 },
            dependsOn: ["task_fixer"],
          },
        ],
        totalBudget: {
          maxTurns: 50,
          timeoutMs: 300000,
        },
      };
      
      const context = await orchestrator.createTeam(params);
      
      expect(context.agents.length).toBe(3);
      expect(context.agents[0].agent).toBe("planner");
      expect(context.agents[1].agent).toBe("code_fixer");
      expect(context.agents[2].agent).toBe("verify_agent");
      
      // 验证依赖关系
      expect(context.agents[1].dependsOn).toBeDefined();
      expect(context.agents[2].dependsOn).toBeDefined();
    });
  });
  
  describe("waitForCompletion", () => {
    it("应该等待所有子代理完成", async () => {
      const params: CreateTeamParams = {
        parentTaskId: "task_123",
        sessionId: "session_456",
        goal: "测试任务",
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
      };
      
      const context = await orchestrator.createTeam(params);
      const results = await orchestrator.waitForCompletion(context.teamId);
      
      expect(results.length).toBe(2);
      expect(results[0].agent).toBe("planner");
      expect(results[1].agent).toBe("verify_agent");
    });
    
    it("应该按依赖顺序执行", async () => {
      const params: CreateTeamParams = {
        parentTaskId: "task_123",
        sessionId: "session_456",
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
            dependsOn: ["planner_task"], // 依赖 planner
          },
        ],
        totalBudget: {
          maxTurns: 35,
          timeoutMs: 300000,
        },
      };
      
      const context = await orchestrator.createTeam(params);
      
      // 手动设置依赖关系（实际 ID 由系统生成）
      const plannerTask = context.agents[0];
      context.agents[1].dependsOn = [plannerTask.id];
      
      const results = await orchestrator.waitForCompletion(context.teamId);
      
      expect(results.length).toBe(2);
      // planner 应该先执行
      expect(results[0].agent).toBe("planner");
      expect(results[1].agent).toBe("code_fixer");
    });
  });
  
  describe("mergeResults", () => {
    it("应该归并多个结果", async () => {
      const mockResults: SubagentResult[] = [
        {
          subagentTaskId: "task_1",
          parentTaskId: "parent_1",
          teamId: "team_1",
          agent: "planner",
          summary: "规划完成",
          confidence: 0.9,
          turnsUsed: 5,
          durationMs: 1000,
          artifacts: [
            { type: "text", description: "计划文档", content: "..." },
          ],
          recommendations: ["执行代码修复"],
        },
        {
          subagentTaskId: "task_2",
          parentTaskId: "parent_1",
          teamId: "team_1",
          agent: "code_fixer",
          summary: "修复完成",
          confidence: 0.8,
          turnsUsed: 10,
          durationMs: 2000,
          patches: [
            { fileId: "src/app.ts", diff: "...", hunks: 1, linesAdded: 5, linesDeleted: 2 },
          ],
        },
      ];
      
      const merged = await orchestrator.mergeResults(mockResults);
      
      expect(merged.summary).toBeDefined();
      expect(merged.artifacts.length).toBe(1);
      expect(merged.patches.length).toBe(1);
      expect(merged.confidence).toBeCloseTo(0.85, 2);
      expect(merged.recommendations.length).toBe(1);
    });
    
    it("应该处理空结果", async () => {
      const merged = await orchestrator.mergeResults([]);
      
      expect(merged.summary).toBe("无执行结果");
      expect(merged.confidence).toBe(0);
    });
  });
  
  describe("cancelTeam", () => {
    it("应该取消团队执行", async () => {
      const params: CreateTeamParams = {
        parentTaskId: "task_123",
        sessionId: "session_456",
        goal: "测试任务",
        agents: [
          {
            role: "planner",
            goal: "规划",
            allowedTools: ["fs.read"],
            budget: { maxTurns: 10, timeoutMs: 60000 },
          },
        ],
        totalBudget: {
          maxTurns: 30,
          timeoutMs: 300000,
        },
      };
      
      const context = await orchestrator.createTeam(params);
      await orchestrator.cancelTeam(context.teamId, "用户取消");
      
      const finalContext = await orchestrator.getTeamStatus(context.teamId);
      
      expect(finalContext.status).toBe("cancelled");
      expect(finalContext.agents[0].status).toBe("cancelled");
    });
  });
});

describe("runTeam (端到端)", () => {
  it("应该完成端到端执行", async () => {
    const hookBus = new AgentTeamHookBus();
    const runner = new SubagentRunner(hookBus);
    
    const params: CreateTeamParams = {
      parentTaskId: "task_e2e",
      sessionId: "session_e2e",
      goal: "端到端测试",
      agents: [
        {
          role: "planner",
          goal: "规划任务",
          allowedTools: ["fs.read"],
          budget: { maxTurns: 10, timeoutMs: 60000 },
        },
        {
          role: "verify_agent",
          goal: "验证结果",
          allowedTools: ["shell.run"],
          budget: { maxTurns: 15, timeoutMs: 90000 },
        },
      ],
      totalBudget: {
        maxTurns: 30,
        timeoutMs: 300000,
      },
    };
    
    const { context, results, merged } = await runTeam(params, runner, hookBus);
    
    // 验证团队状态
    expect(context.status).toBe("completed");
    
    // 验证结果数量
    expect(results.length).toBe(2);
    
    // 验证归并结果
    expect(merged.summary).toBeDefined();
    expect(merged.confidence).toBeGreaterThan(0);
    
    // 验证 Hook 触发
    expect(hookBus.getHandlerCount()).toBe(0); // 默认无处理器
  });
});

describe("状态机集成", () => {
  it("应该正确转换子代理状态", async () => {
    const hookBus = new AgentTeamHookBus();
    const runner = new SubagentRunner(hookBus);
    const orchestrator = new TeamOrchestrator(runner, hookBus);
    
    const params: CreateTeamParams = {
      parentTaskId: "task_state",
      sessionId: "session_state",
      goal: "状态测试",
      agents: [
        {
          role: "planner",
          goal: "规划",
          allowedTools: ["fs.read"],
          budget: { maxTurns: 10, timeoutMs: 60000 },
        },
      ],
      totalBudget: {
        maxTurns: 30,
        timeoutMs: 300000,
      },
    };
    
    const context = await orchestrator.createTeam(params);
    const task = context.agents[0];
    
    // 初始状态：queued
    expect(task.status).toBe("queued");
    
    // 执行后：done
    await orchestrator.waitForCompletion(context.teamId);
    
    const finalTask = context.agents[0];
    expect(finalTask.status).toBe("done");
    expect(finalTask.startedAt).toBeDefined();
    expect(finalTask.completedAt).toBeDefined();
  });
});
