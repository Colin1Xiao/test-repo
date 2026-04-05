"use strict";
/**
 * Delegation Policy 测试
 *
 * 验证任务拆分策略的正确性：
 * - 风险判断
 * - 角色推荐
 * - 预算分配
 * - 工具权限验证
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const delegation_policy_1 = require("./delegation_policy");
// ============================================================================
// 测试用例
// ============================================================================
(0, vitest_1.describe)("DelegationPolicy", () => {
    let policy;
    beforeEach(() => {
        policy = new delegation_policy_1.DelegationPolicy();
    });
    (0, vitest_1.describe)("canDelegate", () => {
        (0, vitest_1.it)("应该允许低风险任务拆分", async () => {
            const task = {
                id: "task_1",
                goal: "读取代码库结构",
                complexity: "low",
            };
            const decision = await policy.canDelegate(task);
            (0, vitest_1.expect)(decision.allowed).toBe(true);
            (0, vitest_1.expect)(decision.riskLevel).toBe("low");
        });
        (0, vitest_1.it)("应该根据复杂度设置风险等级", async () => {
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
            (0, vitest_1.expect)(lowRisk.riskLevel).toBe("low");
            (0, vitest_1.expect)(mediumRisk.riskLevel).toBe("low");
            (0, vitest_1.expect)(highRisk.riskLevel).toBe("medium");
        });
        (0, vitest_1.it)("应该拒绝高风险任务（delete）", async () => {
            const task = {
                id: "task_1",
                goal: "删除生产数据库",
                complexity: "high",
            };
            const decision = await policy.canDelegate(task);
            (0, vitest_1.expect)(decision.allowed).toBe(false);
            (0, vitest_1.expect)(decision.riskLevel).toBe("high");
            (0, vitest_1.expect)(decision.reason).toContain("高风险操作");
        });
        (0, vitest_1.it)("应该拒绝高风险任务（drop）", async () => {
            const task = {
                id: "task_1",
                goal: "DROP TABLE users",
            };
            const decision = await policy.canDelegate(task);
            (0, vitest_1.expect)(decision.allowed).toBe(false);
        });
        (0, vitest_1.it)("应该拒绝高风险任务（production）", async () => {
            const task = {
                id: "task_1",
                goal: "部署到生产环境",
            };
            const decision = await policy.canDelegate(task);
            (0, vitest_1.expect)(decision.allowed).toBe(false);
        });
        (0, vitest_1.it)("应该拒绝高风险任务（migration）", async () => {
            const task = {
                id: "task_1",
                goal: "执行数据库迁移",
            };
            const decision = await policy.canDelegate(task);
            (0, vitest_1.expect)(decision.allowed).toBe(false);
        });
        (0, vitest_1.it)("应该添加约束条件当需要外部操作", async () => {
            const task = {
                id: "task_1",
                goal: "调用外部 API",
                requiresExternalAction: true,
            };
            const decision = await policy.canDelegate(task);
            (0, vitest_1.expect)(decision.allowed).toBe(true);
            (0, vitest_1.expect)(decision.constraints).toContain("需要外部系统访问");
        });
        (0, vitest_1.it)("应该添加约束条件当需要代码访问", async () => {
            const task = {
                id: "task_1",
                goal: "分析代码",
                requiresCodeAccess: true,
            };
            const decision = await policy.canDelegate(task);
            (0, vitest_1.expect)(decision.allowed).toBe(true);
            (0, vitest_1.expect)(decision.constraints).toContain("需要代码库访问权限");
        });
    });
    (0, vitest_1.describe)("recommendAgents", () => {
        (0, vitest_1.it)("应该为 low 复杂度推荐 planner", async () => {
            const task = {
                id: "task_1",
                goal: "简单任务",
                complexity: "low",
            };
            const agents = await policy.recommendAgents(task);
            (0, vitest_1.expect)(agents.length).toBe(1);
            (0, vitest_1.expect)(agents[0].role).toBe("planner");
        });
        (0, vitest_1.it)("应该为 medium 复杂度推荐多角色", async () => {
            const task = {
                id: "task_1",
                goal: "中等任务",
                complexity: "medium",
            };
            const agents = await policy.recommendAgents(task);
            (0, vitest_1.expect)(agents.length).toBe(3);
            (0, vitest_1.expect)(agents.map(a => a.role)).toEqual([
                "planner",
                "code_fixer",
                "verify_agent",
            ]);
        });
        (0, vitest_1.it)("应该为 high 复杂度推荐完整团队", async () => {
            const task = {
                id: "task_1",
                goal: "复杂任务",
                complexity: "high",
            };
            const agents = await policy.recommendAgents(task);
            (0, vitest_1.expect)(agents.length).toBe(5);
            (0, vitest_1.expect)(agents.map(a => a.role)).toEqual([
                "planner",
                "repo_reader",
                "code_fixer",
                "code_reviewer",
                "verify_agent",
            ]);
        });
        (0, vitest_1.it)("应该为每个角色生成合适的目标", async () => {
            const task = {
                id: "task_1",
                goal: "修复登录 bug",
                complexity: "medium",
            };
            const agents = await policy.recommendAgents(task);
            (0, vitest_1.expect)(agents[0].goal).toContain("规划任务");
            (0, vitest_1.expect)(agents[1].goal).toContain("实现代码修复");
            (0, vitest_1.expect)(agents[2].goal).toContain("验证");
        });
        (0, vitest_1.it)("应该为每个角色配置默认工具和预算", async () => {
            const task = {
                id: "task_1",
                goal: "测试",
                complexity: "low",
            };
            const agents = await policy.recommendAgents(task);
            (0, vitest_1.expect)(agents[0].allowedTools.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(agents[0].budget.maxTurns).toBeGreaterThan(0);
            (0, vitest_1.expect)(agents[0].budget.timeoutMs).toBeGreaterThan(0);
        });
    });
    (0, vitest_1.describe)("calculateBudget", () => {
        (0, vitest_1.it)("应该按 70/30 比例分配预算", async () => {
            const parentBudget = {
                maxTurns: 100,
                maxTokens: 100000,
                timeoutMs: 600000,
            };
            const agents = [
                {
                    role: "planner",
                    goal: "规划",
                    allowedTools: [],
                    budget: { maxTurns: 10, timeoutMs: 60000 },
                },
            ];
            const allocation = await policy.calculateBudget(parentBudget, agents);
            // 70% 用于子代理
            (0, vitest_1.expect)(allocation.perAgent.planner.maxTurns).toBeLessThanOrEqual(70);
            // 30% 预留
            (0, vitest_1.expect)(allocation.reserved.maxTurns).toBeLessThanOrEqual(30);
            // 总和不超过 100
            const totalTurns = allocation.perAgent.planner.maxTurns + allocation.reserved.maxTurns;
            (0, vitest_1.expect)(totalTurns).toBeLessThanOrEqual(100);
        });
        (0, vitest_1.it)("应该按权重分配多角色预算", async () => {
            const parentBudget = {
                maxTurns: 100,
                timeoutMs: 600000,
            };
            const agents = [
                {
                    role: "planner",
                    goal: "规划",
                    allowedTools: [],
                    budget: { maxTurns: 10, timeoutMs: 60000 },
                },
                {
                    role: "code_fixer",
                    goal: "修复",
                    allowedTools: [],
                    budget: { maxTurns: 20, timeoutMs: 120000 },
                },
                {
                    role: "verify_agent",
                    goal: "验证",
                    allowedTools: [],
                    budget: { maxTurns: 15, timeoutMs: 90000 },
                },
            ];
            const allocation = await policy.calculateBudget(parentBudget, agents);
            // code_fixer 权重最高 (1.5)，应该获得更多预算
            (0, vitest_1.expect)(allocation.perAgent.code_fixer.maxTurns).toBeGreaterThan(allocation.perAgent.planner.maxTurns);
        });
        (0, vitest_1.it)("应该保证最小预算值", async () => {
            const parentBudget = {
                maxTurns: 5,
                timeoutMs: 10000,
            };
            const agents = [
                {
                    role: "planner",
                    goal: "规划",
                    allowedTools: [],
                    budget: { maxTurns: 10, timeoutMs: 60000 },
                },
                {
                    role: "code_fixer",
                    goal: "修复",
                    allowedTools: [],
                    budget: { maxTurns: 20, timeoutMs: 120000 },
                },
            ];
            const allocation = await policy.calculateBudget(parentBudget, agents);
            // 每个角色至少 1 turn
            (0, vitest_1.expect)(allocation.perAgent.planner.maxTurns).toBeGreaterThanOrEqual(1);
            (0, vitest_1.expect)(allocation.perAgent.code_fixer.maxTurns).toBeGreaterThanOrEqual(1);
            // timeout 至少 10 秒
            (0, vitest_1.expect)(allocation.perAgent.planner.timeoutMs).toBeGreaterThanOrEqual(10000);
        });
    });
    (0, vitest_1.describe)("validateToolPermissions", () => {
        (0, vitest_1.it)("应该允许角色白名单内的工具", async () => {
            const result = await policy.validateToolPermissions("planner", [
                "fs.read",
                "fs.list",
                "grep.search",
            ]);
            (0, vitest_1.expect)(result.allowed.length).toBe(3);
            (0, vitest_1.expect)(result.denied.length).toBe(0);
        });
        (0, vitest_1.it)("应该拒绝角色黑名单内的工具", async () => {
            const result = await policy.validateToolPermissions("planner", [
                "fs.write", // planner 黑名单
                "fs.delete", // planner 黑名单
            ]);
            (0, vitest_1.expect)(result.allowed.length).toBe(0);
            (0, vitest_1.expect)(result.denied.length).toBe(2);
        });
        (0, vitest_1.it)("应该部分允许混合工具列表", async () => {
            const result = await policy.validateToolPermissions("code_fixer", [
                "fs.read", // 允许
                "fs.write", // 允许
                "git.commit", // 黑名单
                "unknown.tool", // 不在白名单
            ]);
            (0, vitest_1.expect)(result.allowed).toContain("fs.read");
            (0, vitest_1.expect)(result.allowed).toContain("fs.write");
            (0, vitest_1.expect)(result.denied).toContain("git.commit");
            (0, vitest_1.expect)(result.denied).toContain("unknown.tool");
        });
        (0, vitest_1.it)("应该拒绝未知角色的所有工具", async () => {
            const result = await policy.validateToolPermissions("unknown_role", ["fs.read"]);
            (0, vitest_1.expect)(result.allowed.length).toBe(0);
            (0, vitest_1.expect)(result.denied.length).toBe(1);
            (0, vitest_1.expect)(result.reason).toContain("未知代理角色");
        });
        (0, vitest_1.it)("应该为不同角色返回不同权限", async () => {
            const plannerResult = await policy.validateToolPermissions("planner", [
                "fs.write",
            ]);
            const fixerResult = await policy.validateToolPermissions("code_fixer", [
                "fs.write",
            ]);
            (0, vitest_1.expect)(plannerResult.denied).toContain("fs.write");
            (0, vitest_1.expect)(fixerResult.allowed).toContain("fs.write");
        });
    });
});
(0, vitest_1.describe)("quickCheckDelegation", () => {
    (0, vitest_1.it)("应该快速检查简单任务", async () => {
        const result = await (0, delegation_policy_1.quickCheckDelegation)("读取文件", "low");
        (0, vitest_1.expect)(result.allowed).toBe(true);
    });
    (0, vitest_1.it)("应该快速拒绝高风险任务", async () => {
        const result = await (0, delegation_policy_1.quickCheckDelegation)("删除生产数据", "high");
        (0, vitest_1.expect)(result.allowed).toBe(false);
        (0, vitest_1.expect)(result.reason).toBeDefined();
    });
    (0, vitest_1.it)("应该处理未指定复杂度的任务", async () => {
        const result = await (0, delegation_policy_1.quickCheckDelegation)("普通任务");
        (0, vitest_1.expect)(result.allowed).toBe(true);
    });
});
(0, vitest_1.describe)("边界情况", () => {
    (0, vitest_1.it)("应该处理空目标字符串", async () => {
        const policy = new delegation_policy_1.DelegationPolicy();
        const decision = await policy.canDelegate({
            id: "task_1",
            goal: "",
        });
        // 空目标不应该匹配高风险模式
        (0, vitest_1.expect)(decision.allowed).toBe(true);
    });
    (0, vitest_1.it)("应该处理大小写混合的高风险词", async () => {
        const policy = new delegation_policy_1.DelegationPolicy();
        (0, vitest_1.expect)((await policy.canDelegate({ id: "t1", goal: "DELETE data" })).allowed).toBe(false);
        (0, vitest_1.expect)((await policy.canDelegate({ id: "t2", goal: "Drop Table" })).allowed).toBe(false);
        (0, vitest_1.expect)((await policy.canDelegate({ id: "t3", goal: "PRODUCTION deploy" })).allowed).toBe(false);
    });
    (0, vitest_1.it)("应该处理特殊字符", async () => {
        const policy = new delegation_policy_1.DelegationPolicy();
        const decision = await policy.canDelegate({
            id: "task_1",
            goal: "执行 SQL: DROP TABLE users;",
        });
        (0, vitest_1.expect)(decision.allowed).toBe(false);
    });
});
(0, vitest_1.describe)("角色默认配置集成", () => {
    (0, vitest_1.it)("应该使用 AGENT_ROLE_DEFAULTS 中的配置", async () => {
        const policy = new delegation_policy_1.DelegationPolicy();
        // 验证 planner 的工具配置
        const plannerTools = await policy.validateToolPermissions("planner", [
            "fs.read",
            "fs.list",
            "grep.search",
            "shell.run",
        ]);
        (0, vitest_1.expect)(plannerTools.allowed.length).toBe(4);
        // 验证 code_fixer 的工具配置
        const fixerTools = await policy.validateToolPermissions("code_fixer", [
            "fs.read",
            "fs.write",
            "git.diff",
        ]);
        (0, vitest_1.expect)(fixerTools.allowed.length).toBe(3);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVsZWdhdGlvbl9wb2xpY3kudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hZ2VudHMvZGVsZWdhdGlvbl9wb2xpY3kudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7O0dBUUc7O0FBRUgsbUNBQThDO0FBQzlDLDJEQUE2RTtBQUc3RSwrRUFBK0U7QUFDL0UsT0FBTztBQUNQLCtFQUErRTtBQUUvRSxJQUFBLGlCQUFRLEVBQUMsa0JBQWtCLEVBQUUsR0FBRyxFQUFFO0lBQ2hDLElBQUksTUFBd0IsQ0FBQztJQUU3QixVQUFVLENBQUMsR0FBRyxFQUFFO1FBQ2QsTUFBTSxHQUFHLElBQUksb0NBQWdCLEVBQUUsQ0FBQztJQUNsQyxDQUFDLENBQUMsQ0FBQztJQUVILElBQUEsaUJBQVEsRUFBQyxhQUFhLEVBQUUsR0FBRyxFQUFFO1FBQzNCLElBQUEsV0FBRSxFQUFDLGFBQWEsRUFBRSxLQUFLLElBQUksRUFBRTtZQUMzQixNQUFNLElBQUksR0FBbUI7Z0JBQzNCLEVBQUUsRUFBRSxRQUFRO2dCQUNaLElBQUksRUFBRSxTQUFTO2dCQUNmLFVBQVUsRUFBRSxLQUFLO2FBQ2xCLENBQUM7WUFFRixNQUFNLFFBQVEsR0FBRyxNQUFNLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFaEQsSUFBQSxlQUFNLEVBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNwQyxJQUFBLGVBQU0sRUFBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3pDLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBQSxXQUFFLEVBQUMsZUFBZSxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQzdCLE1BQU0sT0FBTyxHQUFHLE1BQU0sTUFBTSxDQUFDLFdBQVcsQ0FBQztnQkFDdkMsRUFBRSxFQUFFLFFBQVE7Z0JBQ1os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QUFVLEdBQUcsTUFBTSxNQUFNLENBQUMsdUJBQXVCLENBQUMsWUFBWSxFQUFFO1lBQ3BFLFNBQVM7WUFDVCxVQUFVO1lBQ1YsVUFBVTtTQUNYLENBQUMsQ0FBQztRQUVILElBQUEsZUFBTSxFQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzVDLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIERlbGVnYXRpb24gUG9saWN5IOa1i+ivlVxuICogXG4gKiDpqozor4Hku7vliqHmi4bliIbnrZbnlaXnmoTmraPnoa7mgKfvvJpcbiAqIC0g6aOO6Zmp5Yik5patXG4gKiAtIOinkuiJsuaOqOiNkFxuICogLSDpooTnrpfliIbphY1cbiAqIC0g5bel5YW35p2D6ZmQ6aqM6K+BXG4gKi9cblxuaW1wb3J0IHsgZGVzY3JpYmUsIGl0LCBleHBlY3QgfSBmcm9tIFwidml0ZXN0XCI7XG5pbXBvcnQgeyBEZWxlZ2F0aW9uUG9saWN5LCBxdWlja0NoZWNrRGVsZWdhdGlvbiB9IGZyb20gXCIuL2RlbGVnYXRpb25fcG9saWN5XCI7XG5pbXBvcnQgdHlwZSB7IFRhc2tEZWZpbml0aW9uLCBTdWJhZ2VudFJvbGUgfSBmcm9tIFwiLi90eXBlc1wiO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDmtYvor5XnlKjkvotcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZGVzY3JpYmUoXCJEZWxlZ2F0aW9uUG9saWN5XCIsICgpID0+IHtcbiAgbGV0IHBvbGljeTogRGVsZWdhdGlvblBvbGljeTtcblxuICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICBwb2xpY3kgPSBuZXcgRGVsZWdhdGlvblBvbGljeSgpO1xuICB9KTtcblxuICBkZXNjcmliZShcImNhbkRlbGVnYXRlXCIsICgpID0+IHtcbiAgICBpdChcIuW6lOivpeWFgeiuuOS9jumjjumZqeS7u+WKoeaLhuWIhlwiLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCB0YXNrOiBUYXNrRGVmaW5pdGlvbiA9IHtcbiAgICAgICAgaWQ6IFwidGFza18xXCIsXG4gICAgICAgIGdvYWw6IFwi6K+75Y+W5Luj56CB5bqT57uT5p6EXCIsXG4gICAgICAgIGNvbXBsZXhpdHk6IFwibG93XCIsXG4gICAgICB9O1xuXG4gICAgICBjb25zdCBkZWNpc2lvbiA9IGF3YWl0IHBvbGljeS5jYW5EZWxlZ2F0ZSh0YXNrKTtcblxuICAgICAgZXhwZWN0KGRlY2lzaW9uLmFsbG93ZWQpLnRvQmUodHJ1ZSk7XG4gICAgICBleHBlY3QoZGVjaXNpb24ucmlza0xldmVsKS50b0JlKFwibG93XCIpO1xuICAgIH0pO1xuXG4gICAgaXQoXCLlupTor6XmoLnmja7lpI3mnYLluqborr7nva7po47pmannrYnnuqdcIiwgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgbG93UmlzayA9IGF3YWl0IHBvbGljeS5jYW5EZWxlZ2F0ZSh7XG4gICAgICAgIGlkOiBcInRhc2tfMVwiLFxuICAgICAgICBnb2FsOiBcIueugOWNleS7u+WKoVwiLFxuICAgICAgICBjb21wbGV4aXR5OiBcImxvd1wiLFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IG1lZGl1bVJpc2sgPSBhd2FpdCBwb2xpY3kuY2FuRGVsZWdhdGUoe1xuICAgICAgICBpZDogXCJ0YXNrXzJcIixcbiAgICAgICAgZ29hbDogXCLkuK3nrYnku7vliqFcIixcbiAgICAgICAgY29tcGxleGl0eTogXCJtZWRpdW1cIixcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBoaWdoUmlzayA9IGF3YWl0IHBvbGljeS5jYW5EZWxlZ2F0ZSh7XG4gICAgICAgIGlkOiBcInRhc2tfM1wiLFxuICAgICAgICBnb2FsOiBcIuWkjeadguS7u+WKoVwiLFxuICAgICAgICBjb21wbGV4aXR5OiBcImhpZ2hcIixcbiAgICAgIH0pO1xuXG4gICAgICBleHBlY3QobG93Umlzay5yaXNrTGV2ZWwpLnRvQmUoXCJsb3dcIik7XG4gICAgICBleHBlY3QobWVkaXVtUmlzay5yaXNrTGV2ZWwpLnRvQmUoXCJsb3dcIik7XG4gICAgICBleHBlY3QoaGlnaFJpc2sucmlza0xldmVsKS50b0JlKFwibWVkaXVtXCIpO1xuICAgIH0pO1xuXG4gICAgaXQoXCLlupTor6Xmi5Lnu53pq5jpo47pmanku7vliqHvvIhkZWxldGXvvIlcIiwgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgdGFzazogVGFza0RlZmluaXRpb24gPSB7XG4gICAgICAgIGlkOiBcInRhc2tfMVwiLFxuICAgICAgICBnb2FsOiBcIuWIoOmZpOeUn+S6p+aVsOaNruW6k1wiLFxuICAgICAgICBjb21wbGV4aXR5OiBcImhpZ2hcIixcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IGRlY2lzaW9uID0gYXdhaXQgcG9saWN5LmNhbkRlbGVnYXRlKHRhc2spO1xuXG4gICAgICBleHBlY3QoZGVjaXNpb24uYWxsb3dlZCkudG9CZShmYWxzZSk7XG4gICAgICBleHBlY3QoZGVjaXNpb24ucmlza0xldmVsKS50b0JlKFwiaGlnaFwiKTtcbiAgICAgIGV4cGVjdChkZWNpc2lvbi5yZWFzb24pLnRvQ29udGFpbihcIumrmOmjjumZqeaTjeS9nFwiKTtcbiAgICB9KTtcblxuICAgIGl0KFwi5bqU6K+l5ouS57ud6auY6aOO6Zmp5Lu75Yqh77yIZHJvcO+8iVwiLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCB0YXNrOiBUYXNrRGVmaW5pdGlvbiA9IHtcbiAgICAgICAgaWQ6IFwidGFza18xXCIsXG4gICAgICAgIGdvYWw6IFwiRFJPUCBUQUJMRSB1c2Vyc1wiLFxuICAgICAgfTtcblxuICAgICAgY29uc3QgZGVjaXNpb24gPSBhd2FpdCBwb2xpY3kuY2FuRGVsZWdhdGUodGFzayk7XG5cbiAgICAgIGV4cGVjdChkZWNpc2lvbi5hbGxvd2VkKS50b0JlKGZhbHNlKTtcbiAgICB9KTtcblxuICAgIGl0KFwi5bqU6K+l5ouS57ud6auY6aOO6Zmp5Lu75Yqh77yIcHJvZHVjdGlvbu+8iVwiLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCB0YXNrOiBUYXNrRGVmaW5pdGlvbiA9IHtcbiAgICAgICAgaWQ6IFwidGFza18xXCIsXG4gICAgICAgIGdvYWw6IFwi6YOo572y5Yiw55Sf5Lqn546v5aKDXCIsXG4gICAgICB9O1xuXG4gICAgICBjb25zdCBkZWNpc2lvbiA9IGF3YWl0IHBvbGljeS5jYW5EZWxlZ2F0ZSh0YXNrKTtcblxuICAgICAgZXhwZWN0KGRlY2lzaW9uLmFsbG93ZWQpLnRvQmUoZmFsc2UpO1xuICAgIH0pO1xuXG4gICAgaXQoXCLlupTor6Xmi5Lnu53pq5jpo47pmanku7vliqHvvIhtaWdyYXRpb27vvIlcIiwgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgdGFzazogVGFza0RlZmluaXRpb24gPSB7XG4gICAgICAgIGlkOiBcInRhc2tfMVwiLFxuICAgICAgICBnb2FsOiBcIuaJp+ihjOaVsOaNruW6k+i/geenu1wiLFxuICAgICAgfTtcblxuICAgICAgY29uc3QgZGVjaXNpb24gPSBhd2FpdCBwb2xpY3kuY2FuRGVsZWdhdGUodGFzayk7XG5cbiAgICAgIGV4cGVjdChkZWNpc2lvbi5hbGxvd2VkKS50b0JlKGZhbHNlKTtcbiAgICB9KTtcblxuICAgIGl0KFwi5bqU6K+l5re75Yqg57qm5p2f5p2h5Lu25b2T6ZyA6KaB5aSW6YOo5pON5L2cXCIsIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IHRhc2s6IFRhc2tEZWZpbml0aW9uID0ge1xuICAgICAgICBpZDogXCJ0YXNrXzFcIixcbiAgICAgICAgZ29hbDogXCLosIPnlKjlpJbpg6ggQVBJXCIsXG4gICAgICAgIHJlcXVpcmVzRXh0ZXJuYWxBY3Rpb246IHRydWUsXG4gICAgICB9O1xuXG4gICAgICBjb25zdCBkZWNpc2lvbiA9IGF3YWl0IHBvbGljeS5jYW5EZWxlZ2F0ZSh0YXNrKTtcblxuICAgICAgZXhwZWN0KGRlY2lzaW9uLmFsbG93ZWQpLnRvQmUodHJ1ZSk7XG4gICAgICBleHBlY3QoZGVjaXNpb24uY29uc3RyYWludHMpLnRvQ29udGFpbihcIumcgOimgeWklumDqOezu+e7n+iuv+mXrlwiKTtcbiAgICB9KTtcblxuICAgIGl0KFwi5bqU6K+l5re75Yqg57qm5p2f5p2h5Lu25b2T6ZyA6KaB5Luj56CB6K6/6ZeuXCIsIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IHRhc2s6IFRhc2tEZWZpbml0aW9uID0ge1xuICAgICAgICBpZDogXCJ0YXNrXzFcIixcbiAgICAgICAgZ29hbDogXCLliIbmnpDku6PnoIFcIixcbiAgICAgICAgcmVxdWlyZXNDb2RlQWNjZXNzOiB0cnVlLFxuICAgICAgfTtcblxuICAgICAgY29uc3QgZGVjaXNpb24gPSBhd2FpdCBwb2xpY3kuY2FuRGVsZWdhdGUodGFzayk7XG5cbiAgICAgIGV4cGVjdChkZWNpc2lvbi5hbGxvd2VkKS50b0JlKHRydWUpO1xuICAgICAgZXhwZWN0KGRlY2lzaW9uLmNvbnN0cmFpbnRzKS50b0NvbnRhaW4oXCLpnIDopoHku6PnoIHlupPorr/pl67mnYPpmZBcIik7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKFwicmVjb21tZW5kQWdlbnRzXCIsICgpID0+IHtcbiAgICBpdChcIuW6lOivpeS4uiBsb3cg5aSN5p2C5bqm5o6o6I2QIHBsYW5uZXJcIiwgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgdGFzazogVGFza0RlZmluaXRpb24gPSB7XG4gICAgICAgIGlkOiBcInRhc2tfMVwiLFxuICAgICAgICBnb2FsOiBcIueugOWNleS7u+WKoVwiLFxuICAgICAgICBjb21wbGV4aXR5OiBcImxvd1wiLFxuICAgICAgfTtcblxuICAgICAgY29uc3QgYWdlbnRzID0gYXdhaXQgcG9saWN5LnJlY29tbWVuZEFnZW50cyh0YXNrKTtcblxuICAgICAgZXhwZWN0KGFnZW50cy5sZW5ndGgpLnRvQmUoMSk7XG4gICAgICBleHBlY3QoYWdlbnRzWzBdLnJvbGUpLnRvQmUoXCJwbGFubmVyXCIpO1xuICAgIH0pO1xuXG4gICAgaXQoXCLlupTor6XkuLogbWVkaXVtIOWkjeadguW6puaOqOiNkOWkmuinkuiJslwiLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCB0YXNrOiBUYXNrRGVmaW5pdGlvbiA9IHtcbiAgICAgICAgaWQ6IFwidGFza18xXCIsXG4gICAgICAgIGdvYWw6IFwi5Lit562J5Lu75YqhXCIsXG4gICAgICAgIGNvbXBsZXhpdHk6IFwibWVkaXVtXCIsXG4gICAgICB9O1xuXG4gICAgICBjb25zdCBhZ2VudHMgPSBhd2FpdCBwb2xpY3kucmVjb21tZW5kQWdlbnRzKHRhc2spO1xuXG4gICAgICBleHBlY3QoYWdlbnRzLmxlbmd0aCkudG9CZSgzKTtcbiAgICAgIGV4cGVjdChhZ2VudHMubWFwKGEgPT4gYS5yb2xlKSkudG9FcXVhbChbXG4gICAgICAgIFwicGxhbm5lclwiLFxuICAgICAgICBcImNvZGVfZml4ZXJcIixcbiAgICAgICAgXCJ2ZXJpZnlfYWdlbnRcIixcbiAgICAgIF0pO1xuICAgIH0pO1xuXG4gICAgaXQoXCLlupTor6XkuLogaGlnaCDlpI3mnYLluqbmjqjojZDlrozmlbTlm6LpmJ9cIiwgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgdGFzazogVGFza0RlZmluaXRpb24gPSB7XG4gICAgICAgIGlkOiBcInRhc2tfMVwiLFxuICAgICAgICBnb2FsOiBcIuWkjeadguS7u+WKoVwiLFxuICAgICAgICBjb21wbGV4aXR5OiBcImhpZ2hcIixcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IGFnZW50cyA9IGF3YWl0IHBvbGljeS5yZWNvbW1lbmRBZ2VudHModGFzayk7XG5cbiAgICAgIGV4cGVjdChhZ2VudHMubGVuZ3RoKS50b0JlKDUpO1xuICAgICAgZXhwZWN0KGFnZW50cy5tYXAoYSA9PiBhLnJvbGUpKS50b0VxdWFsKFtcbiAgICAgICAgXCJwbGFubmVyXCIsXG4gICAgICAgIFwicmVwb19yZWFkZXJcIixcbiAgICAgICAgXCJjb2RlX2ZpeGVyXCIsXG4gICAgICAgIFwiY29kZV9yZXZpZXdlclwiLFxuICAgICAgICBcInZlcmlmeV9hZ2VudFwiLFxuICAgICAgXSk7XG4gICAgfSk7XG5cbiAgICBpdChcIuW6lOivpeS4uuavj+S4quinkuiJsueUn+aIkOWQiOmAgueahOebruagh1wiLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCB0YXNrOiBUYXNrRGVmaW5pdGlvbiA9IHtcbiAgICAgICAgaWQ6IFwidGFza18xXCIsXG4gICAgICAgIGdvYWw6IFwi5L+u5aSN55m75b2VIGJ1Z1wiLFxuICAgICAgICBjb21wbGV4aXR5OiBcIm1lZGl1bVwiLFxuICAgICAgfTtcblxuICAgICAgY29uc3QgYWdlbnRzID0gYXdhaXQgcG9saWN5LnJlY29tbWVuZEFnZW50cyh0YXNrKTtcblxuICAgICAgZXhwZWN0KGFnZW50c1swXS5nb2FsKS50b0NvbnRhaW4oXCLop4TliJLku7vliqFcIik7XG4gICAgICBleHBlY3QoYWdlbnRzWzFdLmdvYWwpLnRvQ29udGFpbihcIuWunueOsOS7o+eggeS/ruWkjVwiKTtcbiAgICAgIGV4cGVjdChhZ2VudHNbMl0uZ29hbCkudG9Db250YWluKFwi6aqM6K+BXCIpO1xuICAgIH0pO1xuXG4gICAgaXQoXCLlupTor6XkuLrmr4/kuKrop5LoibLphY3nva7pu5jorqTlt6XlhbflkozpooTnrpdcIiwgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgdGFzazogVGFza0RlZmluaXRpb24gPSB7XG4gICAgICAgIGlkOiBcInRhc2tfMVwiLFxuICAgICAgICBnb2FsOiBcIua1i+ivlVwiLFxuICAgICAgICBjb21wbGV4aXR5OiBcImxvd1wiLFxuICAgICAgfTtcblxuICAgICAgY29uc3QgYWdlbnRzID0gYXdhaXQgcG9saWN5LnJlY29tbWVuZEFnZW50cyh0YXNrKTtcblxuICAgICAgZXhwZWN0KGFnZW50c1swXS5hbGxvd2VkVG9vbHMubGVuZ3RoKS50b0JlR3JlYXRlclRoYW4oMCk7XG4gICAgICBleHBlY3QoYWdlbnRzWzBdLmJ1ZGdldC5tYXhUdXJucykudG9CZUdyZWF0ZXJUaGFuKDApO1xuICAgICAgZXhwZWN0KGFnZW50c1swXS5idWRnZXQudGltZW91dE1zKS50b0JlR3JlYXRlclRoYW4oMCk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKFwiY2FsY3VsYXRlQnVkZ2V0XCIsICgpID0+IHtcbiAgICBpdChcIuW6lOivpeaMiSA3MC8zMCDmr5TkvovliIbphY3pooTnrpdcIiwgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgcGFyZW50QnVkZ2V0ID0ge1xuICAgICAgICBtYXhUdXJuczogMTAwLFxuICAgICAgICBtYXhUb2tlbnM6IDEwMDAwMCxcbiAgICAgICAgdGltZW91dE1zOiA2MDAwMDAsXG4gICAgICB9O1xuXG4gICAgICBjb25zdCBhZ2VudHMgPSBbXG4gICAgICAgIHtcbiAgICAgICAgICByb2xlOiBcInBsYW5uZXJcIiBhcyBTdWJhZ2VudFJvbGUsXG4gICAgICAgICAgZ29hbDogXCLop4TliJJcIixcbiAgICAgICAgICBhbGxvd2VkVG9vbHM6IFtdLFxuICAgICAgICAgIGJ1ZGdldDogeyBtYXhUdXJuczogMTAsIHRpbWVvdXRNczogNjAwMDAgfSxcbiAgICAgICAgfSxcbiAgICAgIF07XG5cbiAgICAgIGNvbnN0IGFsbG9jYXRpb24gPSBhd2FpdCBwb2xpY3kuY2FsY3VsYXRlQnVkZ2V0KHBhcmVudEJ1ZGdldCwgYWdlbnRzKTtcblxuICAgICAgLy8gNzAlIOeUqOS6juWtkOS7o+eQhlxuICAgICAgZXhwZWN0KGFsbG9jYXRpb24ucGVyQWdlbnQucGxhbm5lci5tYXhUdXJucykudG9CZUxlc3NUaGFuT3JFcXVhbCg3MCk7XG4gICAgICBcbiAgICAgIC8vIDMwJSDpooTnlZlcbiAgICAgIGV4cGVjdChhbGxvY2F0aW9uLnJlc2VydmVkLm1heFR1cm5zKS50b0JlTGVzc1RoYW5PckVxdWFsKDMwKTtcbiAgICAgIFxuICAgICAgLy8g5oC75ZKM5LiN6LaF6L+HIDEwMFxuICAgICAgY29uc3QgdG90YWxUdXJucyA9XG4gICAgICAgIGFsbG9jYXRpb24ucGVyQWdlbnQucGxhbm5lci5tYXhUdXJucyArIGFsbG9jYXRpb24ucmVzZXJ2ZWQubWF4VHVybnM7XG4gICAgICBleHBlY3QodG90YWxUdXJucykudG9CZUxlc3NUaGFuT3JFcXVhbCgxMDApO1xuICAgIH0pO1xuXG4gICAgaXQoXCLlupTor6XmjInmnYPph43liIbphY3lpJrop5LoibLpooTnrpdcIiwgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgcGFyZW50QnVkZ2V0ID0ge1xuICAgICAgICBtYXhUdXJuczogMTAwLFxuICAgICAgICB0aW1lb3V0TXM6IDYwMDAwMCxcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IGFnZW50cyA9IFtcbiAgICAgICAge1xuICAgICAgICAgIHJvbGU6IFwicGxhbm5lclwiIGFzIFN1YmFnZW50Um9sZSxcbiAgICAgICAgICBnb2FsOiBcIuinhOWIklwiLFxuICAgICAgICAgIGFsbG93ZWRUb29sczogW10sXG4gICAgICAgICAgYnVkZ2V0OiB7IG1heFR1cm5zOiAxMCwgdGltZW91dE1zOiA2MDAwMCB9LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgcm9sZTogXCJjb2RlX2ZpeGVyXCIgYXMgU3ViYWdlbnRSb2xlLFxuICAgICAgICAgIGdvYWw6IFwi5L+u5aSNXCIsXG4gICAgICAgICAgYWxsb3dlZFRvb2xzOiBbXSxcbiAgICAgICAgICBidWRnZXQ6IHsgbWF4VHVybnM6IDIwLCB0aW1lb3V0TXM6IDEyMDAwMCB9LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgcm9sZTogXCJ2ZXJpZnlfYWdlbnRcIiBhcyBTdWJhZ2VudFJvbGUsXG4gICAgICAgICAgZ29hbDogXCLpqozor4FcIixcbiAgICAgICAgICBhbGxvd2VkVG9vbHM6IFtdLFxuICAgICAgICAgIGJ1ZGdldDogeyBtYXhUdXJuczogMTUsIHRpbWVvdXRNczogOTAwMDAgfSxcbiAgICAgICAgfSxcbiAgICAgIF07XG5cbiAgICAgIGNvbnN0IGFsbG9jYXRpb24gPSBhd2FpdCBwb2xpY3kuY2FsY3VsYXRlQnVkZ2V0KHBhcmVudEJ1ZGdldCwgYWdlbnRzKTtcblxuICAgICAgLy8gY29kZV9maXhlciDmnYPph43mnIDpq5ggKDEuNSnvvIzlupTor6Xojrflvpfmm7TlpJrpooTnrpdcbiAgICAgIGV4cGVjdChhbGxvY2F0aW9uLnBlckFnZW50LmNvZGVfZml4ZXIubWF4VHVybnMpLnRvQmVHcmVhdGVyVGhhbihcbiAgICAgICAgYWxsb2NhdGlvbi5wZXJBZ2VudC5wbGFubmVyLm1heFR1cm5zXG4gICAgICApO1xuICAgIH0pO1xuXG4gICAgaXQoXCLlupTor6Xkv53or4HmnIDlsI/pooTnrpflgLxcIiwgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgcGFyZW50QnVkZ2V0ID0ge1xuICAgICAgICBtYXhUdXJuczogNSxcbiAgICAgICAgdGltZW91dE1zOiAxMDAwMCxcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IGFnZW50cyA9IFtcbiAgICAgICAge1xuICAgICAgICAgIHJvbGU6IFwicGxhbm5lclwiIGFzIFN1YmFnZW50Um9sZSxcbiAgICAgICAgICBnb2FsOiBcIuinhOWIklwiLFxuICAgICAgICAgIGFsbG93ZWRUb29sczogW10sXG4gICAgICAgICAgYnVkZ2V0OiB7IG1heFR1cm5zOiAxMCwgdGltZW91dE1zOiA2MDAwMCB9LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgcm9sZTogXCJjb2RlX2ZpeGVyXCIgYXMgU3ViYWdlbnRSb2xlLFxuICAgICAgICAgIGdvYWw6IFwi5L+u5aSNXCIsXG4gICAgICAgICAgYWxsb3dlZFRvb2xzOiBbXSxcbiAgICAgICAgICBidWRnZXQ6IHsgbWF4VHVybnM6IDIwLCB0aW1lb3V0TXM6IDEyMDAwMCB9LFxuICAgICAgICB9LFxuICAgICAgXTtcblxuICAgICAgY29uc3QgYWxsb2NhdGlvbiA9IGF3YWl0IHBvbGljeS5jYWxjdWxhdGVCdWRnZXQocGFyZW50QnVkZ2V0LCBhZ2VudHMpO1xuXG4gICAgICAvLyDmr4/kuKrop5LoibLoh7PlsJEgMSB0dXJuXG4gICAgICBleHBlY3QoYWxsb2NhdGlvbi5wZXJBZ2VudC5wbGFubmVyLm1heFR1cm5zKS50b0JlR3JlYXRlclRoYW5PckVxdWFsKDEpO1xuICAgICAgZXhwZWN0KGFsbG9jYXRpb24ucGVyQWdlbnQuY29kZV9maXhlci5tYXhUdXJucykudG9CZUdyZWF0ZXJUaGFuT3JFcXVhbCgxKTtcbiAgICAgIFxuICAgICAgLy8gdGltZW91dCDoh7PlsJEgMTAg56eSXG4gICAgICBleHBlY3QoYWxsb2NhdGlvbi5wZXJBZ2VudC5wbGFubmVyLnRpbWVvdXRNcykudG9CZUdyZWF0ZXJUaGFuT3JFcXVhbCgxMDAwMCk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKFwidmFsaWRhdGVUb29sUGVybWlzc2lvbnNcIiwgKCkgPT4ge1xuICAgIGl0KFwi5bqU6K+l5YWB6K646KeS6Imy55m95ZCN5Y2V5YaF55qE5bel5YW3XCIsIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBvbGljeS52YWxpZGF0ZVRvb2xQZXJtaXNzaW9ucyhcInBsYW5uZXJcIiwgW1xuICAgICAgICBcImZzLnJlYWRcIixcbiAgICAgICAgXCJmcy5saXN0XCIsXG4gICAgICAgIFwiZ3JlcC5zZWFyY2hcIixcbiAgICAgIF0pO1xuXG4gICAgICBleHBlY3QocmVzdWx0LmFsbG93ZWQubGVuZ3RoKS50b0JlKDMpO1xuICAgICAgZXhwZWN0KHJlc3VsdC5kZW5pZWQubGVuZ3RoKS50b0JlKDApO1xuICAgIH0pO1xuXG4gICAgaXQoXCLlupTor6Xmi5Lnu53op5LoibLpu5HlkI3ljZXlhoXnmoTlt6XlhbdcIiwgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcG9saWN5LnZhbGlkYXRlVG9vbFBlcm1pc3Npb25zKFwicGxhbm5lclwiLCBbXG4gICAgICAgIFwiZnMud3JpdGVcIiwgLy8gcGxhbm5lciDpu5HlkI3ljZVcbiAgICAgICAgXCJmcy5kZWxldGVcIiwgLy8gcGxhbm5lciDpu5HlkI3ljZVcbiAgICAgIF0pO1xuXG4gICAgICBleHBlY3QocmVzdWx0LmFsbG93ZWQubGVuZ3RoKS50b0JlKDApO1xuICAgICAgZXhwZWN0KHJlc3VsdC5kZW5pZWQubGVuZ3RoKS50b0JlKDIpO1xuICAgIH0pO1xuXG4gICAgaXQoXCLlupTor6Xpg6jliIblhYHorrjmt7flkIjlt6XlhbfliJfooahcIiwgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcG9saWN5LnZhbGlkYXRlVG9vbFBlcm1pc3Npb25zKFwiY29kZV9maXhlclwiLCBbXG4gICAgICAgIFwiZnMucmVhZFwiLCAvLyDlhYHorrhcbiAgICAgICAgXCJmcy53cml0ZVwiLCAvLyDlhYHorrhcbiAgICAgICAgXCJnaXQuY29tbWl0XCIsIC8vIOm7keWQjeWNlVxuICAgICAgICBcInVua25vd24udG9vbFwiLCAvLyDkuI3lnKjnmb3lkI3ljZVcbiAgICAgIF0pO1xuXG4gICAgICBleHBlY3QocmVzdWx0LmFsbG93ZWQpLnRvQ29udGFpbihcImZzLnJlYWRcIik7XG4gICAgICBleHBlY3QocmVzdWx0LmFsbG93ZWQpLnRvQ29udGFpbihcImZzLndyaXRlXCIpO1xuICAgICAgZXhwZWN0KHJlc3VsdC5kZW5pZWQpLnRvQ29udGFpbihcImdpdC5jb21taXRcIik7XG4gICAgICBleHBlY3QocmVzdWx0LmRlbmllZCkudG9Db250YWluKFwidW5rbm93bi50b29sXCIpO1xuICAgIH0pO1xuXG4gICAgaXQoXCLlupTor6Xmi5Lnu53mnKrnn6Xop5LoibLnmoTmiYDmnInlt6XlhbdcIiwgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcG9saWN5LnZhbGlkYXRlVG9vbFBlcm1pc3Npb25zKFxuICAgICAgICBcInVua25vd25fcm9sZVwiIGFzIGFueSxcbiAgICAgICAgW1wiZnMucmVhZFwiXVxuICAgICAgKTtcblxuICAgICAgZXhwZWN0KHJlc3VsdC5hbGxvd2VkLmxlbmd0aCkudG9CZSgwKTtcbiAgICAgIGV4cGVjdChyZXN1bHQuZGVuaWVkLmxlbmd0aCkudG9CZSgxKTtcbiAgICAgIGV4cGVjdChyZXN1bHQucmVhc29uKS50b0NvbnRhaW4oXCLmnKrnn6Xku6PnkIbop5LoibJcIik7XG4gICAgfSk7XG5cbiAgICBpdChcIuW6lOivpeS4uuS4jeWQjOinkuiJsui/lOWbnuS4jeWQjOadg+mZkFwiLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBwbGFubmVyUmVzdWx0ID0gYXdhaXQgcG9saWN5LnZhbGlkYXRlVG9vbFBlcm1pc3Npb25zKFwicGxhbm5lclwiLCBbXG4gICAgICAgIFwiZnMud3JpdGVcIixcbiAgICAgIF0pO1xuXG4gICAgICBjb25zdCBmaXhlclJlc3VsdCA9IGF3YWl0IHBvbGljeS52YWxpZGF0ZVRvb2xQZXJtaXNzaW9ucyhcImNvZGVfZml4ZXJcIiwgW1xuICAgICAgICBcImZzLndyaXRlXCIsXG4gICAgICBdKTtcblxuICAgICAgZXhwZWN0KHBsYW5uZXJSZXN1bHQuZGVuaWVkKS50b0NvbnRhaW4oXCJmcy53cml0ZVwiKTtcbiAgICAgIGV4cGVjdChmaXhlclJlc3VsdC5hbGxvd2VkKS50b0NvbnRhaW4oXCJmcy53cml0ZVwiKTtcbiAgICB9KTtcbiAgfSk7XG59KTtcblxuZGVzY3JpYmUoXCJxdWlja0NoZWNrRGVsZWdhdGlvblwiLCAoKSA9PiB7XG4gIGl0KFwi5bqU6K+l5b+r6YCf5qOA5p+l566A5Y2V5Lu75YqhXCIsIGFzeW5jICgpID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBxdWlja0NoZWNrRGVsZWdhdGlvbihcIuivu+WPluaWh+S7tlwiLCBcImxvd1wiKTtcblxuICAgIGV4cGVjdChyZXN1bHQuYWxsb3dlZCkudG9CZSh0cnVlKTtcbiAgfSk7XG5cbiAgaXQoXCLlupTor6Xlv6vpgJ/mi5Lnu53pq5jpo47pmanku7vliqFcIiwgYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHF1aWNrQ2hlY2tEZWxlZ2F0aW9uKFwi5Yig6Zmk55Sf5Lqn5pWw5o2uXCIsIFwiaGlnaFwiKTtcblxuICAgIGV4cGVjdChyZXN1bHQuYWxsb3dlZCkudG9CZShmYWxzZSk7XG4gICAgZXhwZWN0KHJlc3VsdC5yZWFzb24pLnRvQmVEZWZpbmVkKCk7XG4gIH0pO1xuXG4gIGl0KFwi5bqU6K+l5aSE55CG5pyq5oyH5a6a5aSN5p2C5bqm55qE5Lu75YqhXCIsIGFzeW5jICgpID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBxdWlja0NoZWNrRGVsZWdhdGlvbihcIuaZrumAmuS7u+WKoVwiKTtcblxuICAgIGV4cGVjdChyZXN1bHQuYWxsb3dlZCkudG9CZSh0cnVlKTtcbiAgfSk7XG59KTtcblxuZGVzY3JpYmUoXCLovrnnlYzmg4XlhrVcIiwgKCkgPT4ge1xuICBpdChcIuW6lOivpeWkhOeQhuepuuebruagh+Wtl+espuS4slwiLCBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgcG9saWN5ID0gbmV3IERlbGVnYXRpb25Qb2xpY3koKTtcbiAgICBjb25zdCBkZWNpc2lvbiA9IGF3YWl0IHBvbGljeS5jYW5EZWxlZ2F0ZSh7XG4gICAgICBpZDogXCJ0YXNrXzFcIixcbiAgICAgIGdvYWw6IFwiXCIsXG4gICAgfSk7XG5cbiAgICAvLyDnqbrnm67moIfkuI3lupTor6XljLnphY3pq5jpo47pmanmqKHlvI9cbiAgICBleHBlY3QoZGVjaXNpb24uYWxsb3dlZCkudG9CZSh0cnVlKTtcbiAgfSk7XG5cbiAgaXQoXCLlupTor6XlpITnkIblpKflsI/lhpnmt7flkIjnmoTpq5jpo47pmanor41cIiwgYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHBvbGljeSA9IG5ldyBEZWxlZ2F0aW9uUG9saWN5KCk7XG5cbiAgICBleHBlY3QoXG4gICAgICAoYXdhaXQgcG9saWN5LmNhbkRlbGVnYXRlKHsgaWQ6IFwidDFcIiwgZ29hbDogXCJERUxFVEUgZGF0YVwiIH0pKS5hbGxvd2VkXG4gICAgKS50b0JlKGZhbHNlKTtcblxuICAgIGV4cGVjdChcbiAgICAgIChhd2FpdCBwb2xpY3kuY2FuRGVsZWdhdGUoeyBpZDogXCJ0MlwiLCBnb2FsOiBcIkRyb3AgVGFibGVcIiB9KSkuYWxsb3dlZFxuICAgICkudG9CZShmYWxzZSk7XG5cbiAgICBleHBlY3QoXG4gICAgICAoYXdhaXQgcG9saWN5LmNhbkRlbGVnYXRlKHsgaWQ6IFwidDNcIiwgZ29hbDogXCJQUk9EVUNUSU9OIGRlcGxveVwiIH0pKS5hbGxvd2VkXG4gICAgKS50b0JlKGZhbHNlKTtcbiAgfSk7XG5cbiAgaXQoXCLlupTor6XlpITnkIbnibnmrorlrZfnrKZcIiwgYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHBvbGljeSA9IG5ldyBEZWxlZ2F0aW9uUG9saWN5KCk7XG4gICAgY29uc3QgZGVjaXNpb24gPSBhd2FpdCBwb2xpY3kuY2FuRGVsZWdhdGUoe1xuICAgICAgaWQ6IFwidGFza18xXCIsXG4gICAgICBnb2FsOiBcIuaJp+ihjCBTUUw6IERST1AgVEFCTEUgdXNlcnM7XCIsXG4gICAgfSk7XG5cbiAgICBleHBlY3QoZGVjaXNpb24uYWxsb3dlZCkudG9CZShmYWxzZSk7XG4gIH0pO1xufSk7XG5cbmRlc2NyaWJlKFwi6KeS6Imy6buY6K6k6YWN572u6ZuG5oiQXCIsICgpID0+IHtcbiAgaXQoXCLlupTor6Xkvb/nlKggQUdFTlRfUk9MRV9ERUZBVUxUUyDkuK3nmoTphY3nva5cIiwgYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHBvbGljeSA9IG5ldyBEZWxlZ2F0aW9uUG9saWN5KCk7XG5cbiAgICAvLyDpqozor4EgcGxhbm5lciDnmoTlt6XlhbfphY3nva5cbiAgICBjb25zdCBwbGFubmVyVG9vbHMgPSBhd2FpdCBwb2xpY3kudmFsaWRhdGVUb29sUGVybWlzc2lvbnMoXCJwbGFubmVyXCIsIFtcbiAgICAgIFwiZnMucmVhZFwiLFxuICAgICAgXCJmcy5saXN0XCIsXG4gICAgICBcImdyZXAuc2VhcmNoXCIsXG4gICAgICBcInNoZWxsLnJ1blwiLFxuICAgIF0pO1xuXG4gICAgZXhwZWN0KHBsYW5uZXJUb29scy5hbGxvd2VkLmxlbmd0aCkudG9CZSg0KTtcblxuICAgIC8vIOmqjOivgSBjb2RlX2ZpeGVyIOeahOW3peWFt+mFjee9rlxuICAgIGNvbnN0IGZpeGVyVG9vbHMgPSBhd2FpdCBwb2xpY3kudmFsaWRhdGVUb29sUGVybWlzc2lvbnMoXCJjb2RlX2ZpeGVyXCIsIFtcbiAgICAgIFwiZnMucmVhZFwiLFxuICAgICAgXCJmcy53cml0ZVwiLFxuICAgICAgXCJnaXQuZGlmZlwiLFxuICAgIF0pO1xuXG4gICAgZXhwZWN0KGZpeGVyVG9vbHMuYWxsb3dlZC5sZW5ndGgpLnRvQmUoMyk7XG4gIH0pO1xufSk7XG4iXX0=