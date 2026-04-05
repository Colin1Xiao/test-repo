/**
 * Delegation Policy 测试
 * 
 * 验证任务拆分策略的正确性：
 * - 风险判断
 * - 角色推荐
 * - 预算分配
 * - 工具权限验证
 */

import { describe, it, expect } from "vitest";
import { DelegationPolicy, quickCheckDelegation } from "./delegation_policy";
import type { TaskDefinition, SubagentRole } from "./types";

// ============================================================================
// 测试用例
// ============================================================================

describe("DelegationPolicy", () => {
  let policy: DelegationPolicy;

  beforeEach(() => {
    policy = new DelegationPolicy();
  });

  describe("canDelegate", () => {
    it("应该允许低风险任务拆分", async () => {
      const task: TaskDefinition = {
        id: "task_1",
        goal: "读取代码库结构",
        complexity: "low",
      };

      const decision = await policy.canDelegate(task);

      expect(decision.allowed).toBe(true);
      expect(decision.riskLevel).toBe("low");
    });

    it("应该根据复杂度设置风险等级", async () => {
      const lowRisk = await policy.canDelegate({
        id: "task_1",
        goal: "简单任务",
        complexity: "low",
      });

      const mediumRisk = await policy.canDelegate({
        id: "task_2",
        goal: "中等任务",
        complexity: "medium",
      });

      const highRisk = await policy.canDelegate({
        id: "task_3",
        goal: "复杂任务",
        complexity: "high",
      });

      expect(lowRisk.riskLevel).toBe("low");
      expect(mediumRisk.riskLevel).toBe("low");
      expect(highRisk.riskLevel).toBe("medium");
    });

    it("应该拒绝高风险任务（delete）", async () => {
      const task: TaskDefinition = {
        id: "task_1",
        goal: "删除生产数据库",
        complexity: "high",
      };

      const decision = await policy.canDelegate(task);

      expect(decision.allowed).toBe(false);
      expect(decision.riskLevel).toBe("high");
      expect(decision.reason).toContain("高风险操作");
    });

    it("应该拒绝高风险任务（drop）", async () => {
      const task: TaskDefinition = {
        id: "task_1",
        goal: "DROP TABLE users",
      };

      const decision = await policy.canDelegate(task);

      expect(decision.allowed).toBe(false);
    });

    it("应该拒绝高风险任务（production）", async () => {
      const task: TaskDefinition = {
        id: "task_1",
        goal: "部署到生产环境",
      };

      const decision = await policy.canDelegate(task);

      expect(decision.allowed).toBe(false);
    });

    it("应该拒绝高风险任务（migration）", async () => {
      const task: TaskDefinition = {
        id: "task_1",
        goal: "执行数据库迁移",
      };

      const decision = await policy.canDelegate(task);

      expect(decision.allowed).toBe(false);
    });

    it("应该添加约束条件当需要外部操作", async () => {
      const task: TaskDefinition = {
        id: "task_1",
        goal: "调用外部 API",
        requiresExternalAction: true,
      };

      const decision = await policy.canDelegate(task);

      expect(decision.allowed).toBe(true);
      expect(decision.constraints).toContain("需要外部系统访问");
    });

    it("应该添加约束条件当需要代码访问", async () => {
      const task: TaskDefinition = {
        id: "task_1",
        goal: "分析代码",
        requiresCodeAccess: true,
      };

      const decision = await policy.canDelegate(task);

      expect(decision.allowed).toBe(true);
      expect(decision.constraints).toContain("需要代码库访问权限");
    });
  });

  describe("recommendAgents", () => {
    it("应该为 low 复杂度推荐 planner", async () => {
      const task: TaskDefinition = {
        id: "task_1",
        goal: "简单任务",
        complexity: "low",
      };

      const agents = await policy.recommendAgents(task);

      expect(agents.length).toBe(1);
      expect(agents[0].role).toBe("planner");
    });

    it("应该为 medium 复杂度推荐多角色", async () => {
      const task: TaskDefinition = {
        id: "task_1",
        goal: "中等任务",
        complexity: "medium",
      };

      const agents = await policy.recommendAgents(task);

      expect(agents.length).toBe(3);
      expect(agents.map(a => a.role)).toEqual([
        "planner",
        "code_fixer",
        "verify_agent",
      ]);
    });

    it("应该为 high 复杂度推荐完整团队", async () => {
      const task: TaskDefinition = {
        id: "task_1",
        goal: "复杂任务",
        complexity: "high",
      };

      const agents = await policy.recommendAgents(task);

      expect(agents.length).toBe(5);
      expect(agents.map(a => a.role)).toEqual([
        "planner",
        "repo_reader",
        "code_fixer",
        "code_reviewer",
        "verify_agent",
      ]);
    });

    it("应该为每个角色生成合适的目标", async () => {
      const task: TaskDefinition = {
        id: "task_1",
        goal: "修复登录 bug",
        complexity: "medium",
      };

      const agents = await policy.recommendAgents(task);

      expect(agents[0].goal).toContain("规划任务");
      expect(agents[1].goal).toContain("实现代码修复");
      expect(agents[2].goal).toContain("验证");
    });

    it("应该为每个角色配置默认工具和预算", async () => {
      const task: TaskDefinition = {
        id: "task_1",
        goal: "测试",
        complexity: "low",
      };

      const agents = await policy.recommendAgents(task);

      expect(agents[0].allowedTools.length).toBeGreaterThan(0);
      expect(agents[0].budget.maxTurns).toBeGreaterThan(0);
      expect(agents[0].budget.timeoutMs).toBeGreaterThan(0);
    });
  });

  describe("calculateBudget", () => {
    it("应该按 70/30 比例分配预算", async () => {
      const parentBudget = {
        maxTurns: 100,
        maxTokens: 100000,
        timeoutMs: 600000,
      };

      const agents = [
        {
          role: "planner" as SubagentRole,
          goal: "规划",
          allowedTools: [],
          budget: { maxTurns: 10, timeoutMs: 60000 },
        },
      ];

      const allocation = await policy.calculateBudget(parentBudget, agents);

      // 70% 用于子代理
      expect(allocation.perAgent.planner.maxTurns).toBeLessThanOrEqual(70);
      
      // 30% 预留
      expect(allocation.reserved.maxTurns).toBeLessThanOrEqual(30);
      
      // 总和不超过 100
      const totalTurns =
        allocation.perAgent.planner.maxTurns + allocation.reserved.maxTurns;
      expect(totalTurns).toBeLessThanOrEqual(100);
    });

    it("应该按权重分配多角色预算", async () => {
      const parentBudget = {
        maxTurns: 100,
        timeoutMs: 600000,
      };

      const agents = [
        {
          role: "planner" as SubagentRole,
          goal: "规划",
          allowedTools: [],
          budget: { maxTurns: 10, timeoutMs: 60000 },
        },
        {
          role: "code_fixer" as SubagentRole,
          goal: "修复",
          allowedTools: [],
          budget: { maxTurns: 20, timeoutMs: 120000 },
        },
        {
          role: "verify_agent" as SubagentRole,
          goal: "验证",
          allowedTools: [],
          budget: { maxTurns: 15, timeoutMs: 90000 },
        },
      ];

      const allocation = await policy.calculateBudget(parentBudget, agents);

      // code_fixer 权重最高 (1.5)，应该获得更多预算
      expect(allocation.perAgent.code_fixer.maxTurns).toBeGreaterThan(
        allocation.perAgent.planner.maxTurns
      );
    });

    it("应该保证最小预算值", async () => {
      const parentBudget = {
        maxTurns: 5,
        timeoutMs: 10000,
      };

      const agents = [
        {
          role: "planner" as SubagentRole,
          goal: "规划",
          allowedTools: [],
          budget: { maxTurns: 10, timeoutMs: 60000 },
        },
        {
          role: "code_fixer" as SubagentRole,
          goal: "修复",
          allowedTools: [],
          budget: { maxTurns: 20, timeoutMs: 120000 },
        },
      ];

      const allocation = await policy.calculateBudget(parentBudget, agents);

      // 每个角色至少 1 turn
      expect(allocation.perAgent.planner.maxTurns).toBeGreaterThanOrEqual(1);
      expect(allocation.perAgent.code_fixer.maxTurns).toBeGreaterThanOrEqual(1);
      
      // timeout 至少 10 秒
      expect(allocation.perAgent.planner.timeoutMs).toBeGreaterThanOrEqual(10000);
    });
  });

  describe("validateToolPermissions", () => {
    it("应该允许角色白名单内的工具", async () => {
      const result = await policy.validateToolPermissions("planner", [
        "fs.read",
        "fs.list",
        "grep.search",
      ]);

      expect(result.allowed.length).toBe(3);
      expect(result.denied.length).toBe(0);
    });

    it("应该拒绝角色黑名单内的工具", async () => {
      const result = await policy.validateToolPermissions("planner", [
        "fs.write", // planner 黑名单
        "fs.delete", // planner 黑名单
      ]);

      expect(result.allowed.length).toBe(0);
      expect(result.denied.length).toBe(2);
    });

    it("应该部分允许混合工具列表", async () => {
      const result = await policy.validateToolPermissions("code_fixer", [
        "fs.read", // 允许
        "fs.write", // 允许
        "git.commit", // 黑名单
        "unknown.tool", // 不在白名单
      ]);

      expect(result.allowed).toContain("fs.read");
      expect(result.allowed).toContain("fs.write");
      expect(result.denied).toContain("git.commit");
      expect(result.denied).toContain("unknown.tool");
    });

    it("应该拒绝未知角色的所有工具", async () => {
      const result = await policy.validateToolPermissions(
        "unknown_role" as any,
        ["fs.read"]
      );

      expect(result.allowed.length).toBe(0);
      expect(result.denied.length).toBe(1);
      expect(result.reason).toContain("未知代理角色");
    });

    it("应该为不同角色返回不同权限", async () => {
      const plannerResult = await policy.validateToolPermissions("planner", [
        "fs.write",
      ]);

      const fixerResult = await policy.validateToolPermissions("code_fixer", [
        "fs.write",
      ]);

      expect(plannerResult.denied).toContain("fs.write");
      expect(fixerResult.allowed).toContain("fs.write");
    });
  });
});

describe("quickCheckDelegation", () => {
  it("应该快速检查简单任务", async () => {
    const result = await quickCheckDelegation("读取文件", "low");

    expect(result.allowed).toBe(true);
  });

  it("应该快速拒绝高风险任务", async () => {
    const result = await quickCheckDelegation("删除生产数据", "high");

    expect(result.allowed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("应该处理未指定复杂度的任务", async () => {
    const result = await quickCheckDelegation("普通任务");

    expect(result.allowed).toBe(true);
  });
});

describe("边界情况", () => {
  it("应该处理空目标字符串", async () => {
    const policy = new DelegationPolicy();
    const decision = await policy.canDelegate({
      id: "task_1",
      goal: "",
    });

    // 空目标不应该匹配高风险模式
    expect(decision.allowed).toBe(true);
  });

  it("应该处理大小写混合的高风险词", async () => {
    const policy = new DelegationPolicy();

    expect(
      (await policy.canDelegate({ id: "t1", goal: "DELETE data" })).allowed
    ).toBe(false);

    expect(
      (await policy.canDelegate({ id: "t2", goal: "Drop Table" })).allowed
    ).toBe(false);

    expect(
      (await policy.canDelegate({ id: "t3", goal: "PRODUCTION deploy" })).allowed
    ).toBe(false);
  });

  it("应该处理特殊字符", async () => {
    const policy = new DelegationPolicy();
    const decision = await policy.canDelegate({
      id: "task_1",
      goal: "执行 SQL: DROP TABLE users;",
    });

    expect(decision.allowed).toBe(false);
  });
});

describe("角色默认配置集成", () => {
  it("应该使用 AGENT_ROLE_DEFAULTS 中的配置", async () => {
    const policy = new DelegationPolicy();

    // 验证 planner 的工具配置
    const plannerTools = await policy.validateToolPermissions("planner", [
      "fs.read",
      "fs.list",
      "grep.search",
      "shell.run",
    ]);

    expect(plannerTools.allowed.length).toBe(4);

    // 验证 code_fixer 的工具配置
    const fixerTools = await policy.validateToolPermissions("code_fixer", [
      "fs.read",
      "fs.write",
      "git.diff",
    ]);

    expect(fixerTools.allowed.length).toBe(3);
  });
});
