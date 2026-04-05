"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const team_orchestrator_1 = require("./team_orchestrator");
const index_1 = require("./index");
const delegation_policy_1 = require("./delegation_policy");
// ============================================================================
// Mock Runner：模拟真实执行
// ============================================================================
class MockSubagentRunner extends index_1.SubagentRunner {
    setFailTask(taskId) {
        this.failTaskId = taskId;
    }
    setTimeoutTask(taskId) {
        this.timeoutTaskId = taskId;
    }
    async executeRole(task, context) {
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
            artifacts: task.agent === "planner"
                ? [{ type: "text", content: "计划", description: "任务计划" }]
                : undefined,
            patches: task.agent === "code_fixer"
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
            findings: task.agent === "code_reviewer"
                ? [
                    {
                        type: "suggestion",
                        severity: "low",
                        description: "建议添加类型注解",
                    },
                ]
                : undefined,
            recommendations: task.agent === "planner" ? ["执行代码修复", "验证结果"] : undefined,
        };
    }
}
// ============================================================================
// 测试用例
// ============================================================================
(0, vitest_1.describe)("Team Flow - 端到端", () => {
    let hookBus;
    let runner;
    let orchestrator;
    (0, vitest_1.beforeEach)(() => {
        hookBus = new index_1.AgentTeamHookBus();
        runner = new MockSubagentRunner(hookBus);
        orchestrator = new team_orchestrator_1.TeamOrchestrator(runner, hookBus);
    });
    (0, vitest_1.describe)("成功流程", () => {
        (0, vitest_1.it)("应该完成 planner → fixer → verifier 完整流程", async () => {
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
            (0, vitest_1.expect)(results.length).toBe(3);
            (0, vitest_1.expect)(results.map(r => r.agent)).toEqual([
                "planner",
                "code_fixer",
                "verify_agent",
            ]);
            // 验证团队状态
            const finalContext = await orchestrator.getTeamStatus(context.teamId);
            (0, vitest_1.expect)(finalContext.status).toBe("active"); // 需要手动调用 completeTeam
            // 归并结果
            const merged = await orchestrator.mergeResults(results);
            (0, vitest_1.expect)(merged.summary).toBeDefined();
            (0, vitest_1.expect)(merged.confidence).toBeGreaterThan(0);
            (0, vitest_1.expect)(merged.artifacts.length).toBe(1); // planner 的计划
            (0, vitest_1.expect)(merged.patches.length).toBe(1); // fixer 的补丁
            (0, vitest_1.expect)(merged.findings.length).toBe(1); // reviewer 的发现
        });
        (0, vitest_1.it)("应该按依赖顺序执行", async () => {
            const executionOrder = [];
            const hookBus = new index_1.AgentTeamHookBus();
            hookBus.on("SubagentStop", (event) => {
                executionOrder.push(event.result?.agent || "unknown");
            });
            const runner = new MockSubagentRunner(hookBus);
            const orchestrator = new team_orchestrator_1.TeamOrchestrator(runner, hookBus);
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
            (0, vitest_1.expect)(executionOrder).toEqual(["planner", "code_fixer", "verify_agent"]);
        });
    });
    (0, vitest_1.describe)("失败处理", () => {
        (0, vitest_1.it)("应该处理单个子代理失败", async () => {
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
            (0, vitest_1.expect)(results.length).toBe(1); // 只有成功的结果
            (0, vitest_1.expect)(results[0].agent).toBe("planner");
        });
        (0, vitest_1.it)("应该在 stopOnError=true 时立即停止", async () => {
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
            await (0, vitest_1.expect)(orchestrator.waitForCompletion(context.teamId, {
                stopOnError: true,
            })).rejects.toThrow();
        });
    });
    (0, vitest_1.describe)("取消流程", () => {
        (0, vitest_1.it)("应该取消所有活跃任务", async () => {
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
            (0, vitest_1.expect)(finalContext.status).toBe("cancelled");
            (0, vitest_1.expect)(finalContext.agents.every(a => a.status === "cancelled")).toBe(true);
        });
    });
    (0, vitest_1.describe)("Hook 触发", () => {
        (0, vitest_1.it)("应该触发完整的 Hook 序列", async () => {
            const hookEvents = [];
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
            await orchestrator.mergeResults(await orchestrator.waitForCompletion(context.teamId));
            (0, vitest_1.expect)(hookEvents).toContain("TeamCreate");
            (0, vitest_1.expect)(hookEvents.filter(e => e === "SubagentStart").length).toBe(1);
            (0, vitest_1.expect)(hookEvents.filter(e => e === "SubagentStop").length).toBe(1);
            (0, vitest_1.expect)(hookEvents).toContain("TeamMerge");
        });
    });
});
(0, vitest_1.describe)("runTeam (便捷函数)", () => {
    (0, vitest_1.it)("应该完成端到端执行", async () => {
        const hookBus = new index_1.AgentTeamHookBus();
        const runner = new MockSubagentRunner(hookBus);
        const { context, results, merged } = await (0, team_orchestrator_1.runTeam)({
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
        }, runner, hookBus);
        (0, vitest_1.expect)(context.status).toBe("completed");
        (0, vitest_1.expect)(results.length).toBe(2);
        (0, vitest_1.expect)(merged.summary).toBeDefined();
    });
});
(0, vitest_1.describe)("Delegation Policy 集成", () => {
    (0, vitest_1.it)("应该使用策略推荐角色", async () => {
        const policy = new delegation_policy_1.DelegationPolicy();
        const agents = await policy.recommendAgents({
            id: "task_policy",
            goal: "复杂任务",
            complexity: "high",
        });
        (0, vitest_1.expect)(agents.length).toBe(5);
        (0, vitest_1.expect)(agents.map(a => a.role)).toEqual([
            "planner",
            "repo_reader",
            "code_fixer",
            "code_reviewer",
            "verify_agent",
        ]);
    });
    (0, vitest_1.it)("应该使用策略计算预算", async () => {
        const policy = new delegation_policy_1.DelegationPolicy();
        const agents = await policy.recommendAgents({
            id: "task_budget",
            goal: "测试",
            complexity: "medium",
        });
        const allocation = await policy.calculateBudget({ maxTurns: 100, timeoutMs: 600000 }, agents);
        (0, vitest_1.expect)(allocation.perAgent).toBeDefined();
        (0, vitest_1.expect)(allocation.reserved).toBeDefined();
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVhbV9mbG93LnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvYWdlbnRzL3RlYW1fZmxvdy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7O0dBU0c7O0FBRUgsbUNBQTBEO0FBQzFELDJEQUFnRTtBQUNoRSxtQ0FBMkQ7QUFDM0QsMkRBQXVEO0FBR3ZELCtFQUErRTtBQUMvRSxxQkFBcUI7QUFDckIsK0VBQStFO0FBRS9FLE1BQU0sa0JBQW1CLFNBQVEsc0JBQWM7SUFJN0MsV0FBVyxDQUFDLE1BQWM7UUFDeEIsSUFBSSxDQUFDLFVBQVUsR0FBRyxNQUFNLENBQUM7SUFDM0IsQ0FBQztJQUVELGNBQWMsQ0FBQyxNQUFjO1FBQzNCLElBQUksQ0FBQyxhQUFhLEdBQUcsTUFBTSxDQUFDO0lBQzlCLENBQUM7SUFFUyxLQUFLLENBQUMsV0FBVyxDQUFDLElBQVMsRUFBRSxPQUFZO1FBQ2pELE9BQU87UUFDUCxJQUFJLElBQUksQ0FBQyxVQUFVLEtBQUssSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ2hDLE1BQU0sSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDNUIsQ0FBQztRQUVELE9BQU87UUFDUCxJQUFJLElBQUksQ0FBQyxhQUFhLEtBQUssSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ25DLE1BQU0sSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDM0QsQ0FBQztRQUVELE9BQU87UUFDUCxPQUFPO1lBQ0wsY0FBYyxFQUFFLElBQUksQ0FBQyxFQUFFO1lBQ3ZCLFlBQVksRUFBRSxJQUFJLENBQUMsWUFBWTtZQUMvQixNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU07WUFDbkIsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLO1lBQ2pCLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQyxLQUFL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QUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUM1QyxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUZWFtIEZsb3cg56uv5Yiw56uv5rWL6K+VXG4gKiBcbiAqIOmqjOivgeWujOaVtOeahOWboumYn+aJp+ihjOa1geeoi++8mlxuICogMS4g5Yib5bu65Zui6ZifXG4gKiAyLiDosIPluqblrZDku6PnkIbvvIjmjInkvp3otZbpobrluo/vvIlcbiAqIDMuIOWkhOeQhuWksei0peWcuuaZr1xuICogNC4g5b2S5bm257uT5p6cXG4gKiA1LiDlj5bmtogv6YeN6K+VXG4gKi9cblxuaW1wb3J0IHsgZGVzY3JpYmUsIGl0LCBleHBlY3QsIGJlZm9yZUVhY2ggfSBmcm9tIFwidml0ZXN0XCI7XG5pbXBvcnQgeyBUZWFtT3JjaGVzdHJhdG9yLCBydW5UZWFtIH0gZnJvbSBcIi4vdGVhbV9vcmNoZXN0cmF0b3JcIjtcbmltcG9ydCB7IFN1YmFnZW50UnVubmVyLCBBZ2VudFRlYW1Ib29rQnVzIH0gZnJvbSBcIi4vaW5kZXhcIjtcbmltcG9ydCB7IERlbGVnYXRpb25Qb2xpY3kgfSBmcm9tIFwiLi9kZWxlZ2F0aW9uX3BvbGljeVwiO1xuaW1wb3J0IHR5cGUgeyBDcmVhdGVUZWFtUGFyYW1zLCBTdWJhZ2VudFJlc3VsdCB9IGZyb20gXCIuL3R5cGVzXCI7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIE1vY2sgUnVubmVy77ya5qih5ouf55yf5a6e5omn6KGMXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmNsYXNzIE1vY2tTdWJhZ2VudFJ1bm5lciBleHRlbmRzIFN1YmFnZW50UnVubmVyIHtcbiAgcHJpdmF0ZSBmYWlsVGFza0lkPzogc3RyaW5nO1xuICBwcml2YXRlIHRpbWVvdXRUYXNrSWQ/OiBzdHJpbmc7XG5cbiAgc2V0RmFpbFRhc2sodGFza0lkOiBzdHJpbmcpIHtcbiAgICB0aGlzLmZhaWxUYXNrSWQgPSB0YXNrSWQ7XG4gIH1cblxuICBzZXRUaW1lb3V0VGFzayh0YXNrSWQ6IHN0cmluZykge1xuICAgIHRoaXMudGltZW91dFRhc2tJZCA9IHRhc2tJZDtcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBleGVjdXRlUm9sZSh0YXNrOiBhbnksIGNvbnRleHQ6IGFueSk6IFByb21pc2U8YW55PiB7XG4gICAgLy8g5qih5ouf5aSx6LSlXG4gICAgaWYgKHRoaXMuZmFpbFRhc2tJZCA9PT0gdGFzay5pZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwi5qih5ouf5Lu75Yqh5aSx6LSlXCIpO1xuICAgIH1cblxuICAgIC8vIOaooeaLn+i2heaXtlxuICAgIGlmICh0aGlzLnRpbWVvdXRUYXNrSWQgPT09IHRhc2suaWQpIHtcbiAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCAxMDAwMCkpO1xuICAgIH1cblxuICAgIC8vIOato+W4uOi/lOWbnlxuICAgIHJldHVybiB7XG4gICAgICBzdWJhZ2VudFRhc2tJZDogdGFzay5pZCxcbiAgICAgIHBhcmVudFRhc2tJZDogdGFzay5wYXJlbnRUYXNrSWQsXG4gICAgICB0ZWFtSWQ6IHRhc2sudGVhbUlkLFxuICAgICAgYWdlbnQ6IHRhc2suYWdlbnQsXG4gICAgICBzdW1tYXJ5OiBgJHt0YXNrLmFnZW50fSDlrozmiJDvvJoke3Rhc2suZ29hbH1gLFxuICAgICAgY29uZmlkZW5jZTogMC44ICsgTWF0aC5yYW5kb20oKSAqIDAuMixcbiAgICAgIHR1cm5zVXNlZDogTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogNSkgKyAxLFxuICAgICAgdG9rZW5zVXNlZDogTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMCkgKyA1MDAsXG4gICAgICBkdXJhdGlvbk1zOiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMDApICsgMTAsXG4gICAgICBhcnRpZmFjdHM6XG4gICAgICAgIHRhc2suYWdlbnQgPT09IFwicGxhbm5lclwiXG4gICAgICAgICAgPyBbeyB0eXBlOiBcInRleHRcIiBhcyBjb25zdCwgY29udGVudDogXCLorqHliJJcIiwgZGVzY3JpcHRpb246IFwi5Lu75Yqh6K6h5YiSXCIgfV1cbiAgICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICAgIHBhdGNoZXM6XG4gICAgICAgIHRhc2suYWdlbnQgPT09IFwiY29kZV9maXhlclwiXG4gICAgICAgICAgPyBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBmaWxlSWQ6IFwic3JjL2FwcC50c1wiLFxuICAgICAgICAgICAgICAgIGRpZmY6IFwiLS0tIGEvc3JjL2FwcC50c1xcbisrKyBiL3NyYy9hcHAudHNcIixcbiAgICAgICAgICAgICAgICBodW5rczogMSxcbiAgICAgICAgICAgICAgICBsaW5lc0FkZGVkOiA1LFxuICAgICAgICAgICAgICAgIGxpbmVzRGVsZXRlZDogMixcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF1cbiAgICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICAgIGZpbmRpbmdzOlxuICAgICAgICB0YXNrLmFnZW50ID09PSBcImNvZGVfcmV2aWV3ZXJcIlxuICAgICAgICAgID8gW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogXCJzdWdnZXN0aW9uXCIgYXMgY29uc3QsXG4gICAgICAgICAgICAgICAgc2V2ZXJpdHk6IFwibG93XCIgYXMgY29uc3QsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IFwi5bu66K6u5re75Yqg57G75Z6L5rOo6KejXCIsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdXG4gICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICByZWNvbW1lbmRhdGlvbnM6XG4gICAgICAgIHRhc2suYWdlbnQgPT09IFwicGxhbm5lclwiID8gW1wi5omn6KGM5Luj56CB5L+u5aSNXCIsIFwi6aqM6K+B57uT5p6cXCJdIDogdW5kZWZpbmVkLFxuICAgIH07XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5rWL6K+V55So5L6LXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmRlc2NyaWJlKFwiVGVhbSBGbG93IC0g56uv5Yiw56uvXCIsICgpID0+IHtcbiAgbGV0IGhvb2tCdXM6IEFnZW50VGVhbUhvb2tCdXM7XG4gIGxldCBydW5uZXI6IE1vY2tTdWJhZ2VudFJ1bm5lcjtcbiAgbGV0IG9yY2hlc3RyYXRvcjogVGVhbU9yY2hlc3RyYXRvcjtcblxuICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICBob29rQnVzID0gbmV3IEFnZW50VGVhbUhvb2tCdXMoKTtcbiAgICBydW5uZXIgPSBuZXcgTW9ja1N1YmFnZW50UnVubmVyKGhvb2tCdXMpO1xuICAgIG9yY2hlc3RyYXRvciA9IG5ldyBUZWFtT3JjaGVzdHJhdG9yKHJ1bm5lciwgaG9va0J1cyk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKFwi5oiQ5Yqf5rWB56iLXCIsICgpID0+IHtcbiAgICBpdChcIuW6lOivpeWujOaIkCBwbGFubmVyIOKGkiBmaXhlciDihpIgdmVyaWZpZXIg5a6M5pW05rWB56iLXCIsIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IGNvbnRleHQgPSBhd2FpdCBvcmNoZXN0cmF0b3IuY3JlYXRlVGVhbSh7XG4gICAgICAgIHBhcmVudFRhc2tJZDogXCJ0YXNrX2UyZVwiLFxuICAgICAgICBzZXNzaW9uSWQ6IFwic2Vzc2lvbl9lMmVcIixcbiAgICAgICAgZ29hbDogXCLkv67lpI0gYnVnIOW5tumqjOivgVwiLFxuICAgICAgICBhZ2VudHM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICByb2xlOiBcInBsYW5uZXJcIixcbiAgICAgICAgICAgIGdvYWw6IFwi5YiG5p6QIGJ1ZyDlubbliLblrprkv67lpI3orqHliJJcIixcbiAgICAgICAgICAgIGFsbG93ZWRUb29sczogW1wiZnMucmVhZFwiLCBcImdyZXAuc2VhcmNoXCJdLFxuICAgICAgICAgICAgYnVkZ2V0OiB7IG1heFR1cm5zOiAxMCwgdGltZW91dE1zOiA2MDAwMCB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgcm9sZTogXCJjb2RlX2ZpeGVyXCIsXG4gICAgICAgICAgICBnb2FsOiBcIuWunueOsOS/ruWkjVwiLFxuICAgICAgICAgICAgYWxsb3dlZFRvb2xzOiBbXCJmcy5yZWFkXCIsIFwiZnMud3JpdGVcIl0sXG4gICAgICAgICAgICBidWRnZXQ6IHsgbWF4VHVybnM6IDIwLCB0aW1lb3V0TXM6IDEyMDAwMCB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgcm9sZTogXCJ2ZXJpZnlfYWdlbnRcIixcbiAgICAgICAgICAgIGdvYWw6IFwi6L+Q6KGM5rWL6K+V6aqM6K+BXCIsXG4gICAgICAgICAgICBhbGxvd2VkVG9vbHM6IFtcInNoZWxsLnJ1blwiXSxcbiAgICAgICAgICAgIGJ1ZGdldDogeyBtYXhUdXJuczogMTUsIHRpbWVvdXRNczogOTAwMDAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICB0b3RhbEJ1ZGdldDoge1xuICAgICAgICAgIG1heFR1cm5zOiA1MCxcbiAgICAgICAgICB0aW1lb3V0TXM6IDMwMDAwMCxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyDnrYnlvoXlrozmiJBcbiAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBvcmNoZXN0cmF0b3Iud2FpdEZvckNvbXBsZXRpb24oY29udGV4dC50ZWFtSWQpO1xuXG4gICAgICAvLyDpqozor4Hnu5PmnpxcbiAgICAgIGV4cGVjdChyZXN1bHRzLmxlbmd0aCkudG9CZSgzKTtcbiAgICAgIGV4cGVjdChyZXN1bHRzLm1hcChyID0+IHIuYWdlbnQpKS50b0VxdWFsKFtcbiAgICAgICAgXCJwbGFubmVyXCIsXG4gICAgICAgIFwiY29kZV9maXhlclwiLFxuICAgICAgICBcInZlcmlmeV9hZ2VudFwiLFxuICAgICAgXSk7XG5cbiAgICAgIC8vIOmqjOivgeWboumYn+eKtuaAgVxuICAgICAgY29uc3QgZmluYWxDb250ZXh0ID0gYXdhaXQgb3JjaGVzdHJhdG9yLmdldFRlYW1TdGF0dXMoY29udGV4dC50ZWFtSWQpO1xuICAgICAgZXhwZWN0KGZpbmFsQ29udGV4dC5zdGF0dXMpLnRvQmUoXCJhY3RpdmVcIik7IC8vIOmcgOimgeaJi+WKqOiwg+eUqCBjb21wbGV0ZVRlYW1cblxuICAgICAgLy8g5b2S5bm257uT5p6cXG4gICAgICBjb25zdCBtZXJnZWQgPSBhd2FpdCBvcmNoZXN0cmF0b3IubWVyZ2VSZXN1bHRzKHJlc3VsdHMpO1xuICAgICAgZXhwZWN0KG1lcmdlZC5zdW1tYXJ5KS50b0JlRGVmaW5lZCgpO1xuICAgICAgZXhwZWN0KG1lcmdlZC5jb25maWRlbmNlKS50b0JlR3JlYXRlclRoYW4oMCk7XG4gICAgICBleHBlY3QobWVyZ2VkLmFydGlmYWN0cy5sZW5ndGgpLnRvQmUoMSk7IC8vIHBsYW5uZXIg55qE6K6h5YiSXG4gICAgICBleHBlY3QobWVyZ2VkLnBhdGNoZXMubGVuZ3RoKS50b0JlKDEpOyAvLyBmaXhlciDnmoTooaXkuIFcbiAgICAgIGV4cGVjdChtZXJnZWQuZmluZGluZ3MubGVuZ3RoKS50b0JlKDEpOyAvLyByZXZpZXdlciDnmoTlj5HnjrBcbiAgICB9KTtcblxuICAgIGl0KFwi5bqU6K+l5oyJ5L6d6LWW6aG65bqP5omn6KGMXCIsIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IGV4ZWN1dGlvbk9yZGVyOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgY29uc3QgaG9va0J1cyA9IG5ldyBBZ2VudFRlYW1Ib29rQnVzKCk7XG5cbiAgICAgIGhvb2tCdXMub24oXCJTdWJhZ2VudFN0b3BcIiwgKGV2ZW50KSA9PiB7XG4gICAgICAgIGV4ZWN1dGlvbk9yZGVyLnB1c2goZXZlbnQucmVzdWx0Py5hZ2VudCB8fCBcInVua25vd25cIik7XG4gICAgICB9KTtcblxuICAgICAgY29uc3QgcnVubmVyID0gbmV3IE1vY2tTdWJhZ2VudFJ1bm5lcihob29rQnVzKTtcbiAgICAgIGNvbnN0IG9yY2hlc3RyYXRvciA9IG5ldyBUZWFtT3JjaGVzdHJhdG9yKHJ1bm5lciwgaG9va0J1cyk7XG5cbiAgICAgIGNvbnN0IGNvbnRleHQgPSBhd2FpdCBvcmNoZXN0cmF0b3IuY3JlYXRlVGVhbSh7XG4gICAgICAgIHBhcmVudFRhc2tJZDogXCJ0YXNrX2RlcFwiLFxuICAgICAgICBzZXNzaW9uSWQ6IFwic2Vzc2lvbl9kZXBcIixcbiAgICAgICAgZ29hbDogXCLkvp3otZbku7vliqFcIixcbiAgICAgICAgYWdlbnRzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgcm9sZTogXCJwbGFubmVyXCIsXG4gICAgICAgICAgICBnb2FsOiBcIuinhOWIklwiLFxuICAgICAgICAgICAgYWxsb3dlZFRvb2xzOiBbXCJmcy5yZWFkXCJdLFxuICAgICAgICAgICAgYnVkZ2V0OiB7IG1heFR1cm5zOiAxMCwgdGltZW91dE1zOiA2MDAwMCB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgcm9sZTogXCJjb2RlX2ZpeGVyXCIsXG4gICAgICAgICAgICBnb2FsOiBcIuS/ruWkjVwiLFxuICAgICAgICAgICAgYWxsb3dlZFRvb2xzOiBbXCJmcy53cml0ZVwiXSxcbiAgICAgICAgICAgIGJ1ZGdldDogeyBtYXhUdXJuczogMjAsIHRpbWVvdXRNczogMTIwMDAwIH0sXG4gICAgICAgICAgICBkZXBlbmRzT246IFtcInBsYW5uZXJcIl0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICByb2xlOiBcInZlcmlmeV9hZ2VudFwiLFxuICAgICAgICAgICAgZ29hbDogXCLpqozor4FcIixcbiAgICAgICAgICAgIGFsbG93ZWRUb29sczogW1wic2hlbGwucnVuXCJdLFxuICAgICAgICAgICAgYnVkZ2V0OiB7IG1heFR1cm5zOiAxNSwgdGltZW91dE1zOiA5MDAwMCB9LFxuICAgICAgICAgICAgZGVwZW5kc09uOiBbXCJjb2RlX2ZpeGVyXCJdLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIHRvdGFsQnVkZ2V0OiB7XG4gICAgICAgICAgbWF4VHVybnM6IDUwLFxuICAgICAgICAgIHRpbWVvdXRNczogMzAwMDAwLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIOiuvue9ruS+nei1luWFs+ezu1xuICAgICAgY29uc3QgcGxhbm5lclRhc2sgPSBjb250ZXh0LmFnZW50c1swXTtcbiAgICAgIGNvbnRleHQuYWdlbnRzWzFdLmRlcGVuZHNPbiA9IFtwbGFubmVyVGFzay5pZF07XG4gICAgICBjb250ZXh0LmFnZW50c1syXS5kZXBlbmRzT24gPSBbY29udGV4dC5hZ2VudHNbMV0uaWRdO1xuXG4gICAgICBhd2FpdCBvcmNoZXN0cmF0b3Iud2FpdEZvckNvbXBsZXRpb24oY29udGV4dC50ZWFtSWQpO1xuXG4gICAgICAvLyDpqozor4HmiafooYzpobrluo9cbiAgICAgIGV4cGVjdChleGVjdXRpb25PcmRlcikudG9FcXVhbChbXCJwbGFubmVyXCIsIFwiY29kZV9maXhlclwiLCBcInZlcmlmeV9hZ2VudFwiXSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKFwi5aSx6LSl5aSE55CGXCIsICgpID0+IHtcbiAgICBpdChcIuW6lOivpeWkhOeQhuWNleS4quWtkOS7o+eQhuWksei0pVwiLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBjb250ZXh0ID0gYXdhaXQgb3JjaGVzdHJhdG9yLmNyZWF0ZVRlYW0oe1xuICAgICAgICBwYXJlbnRUYXNrSWQ6IFwidGFza19mYWlsXCIsXG4gICAgICAgIHNlc3Npb25JZDogXCJzZXNzaW9uX2ZhaWxcIixcbiAgICAgICAgZ29hbDogXCLmtYvor5XlpLHotKXlpITnkIZcIixcbiAgICAgICAgYWdlbnRzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgcm9sZTogXCJwbGFubmVyXCIsXG4gICAgICAgICAgICBnb2FsOiBcIuinhOWIklwiLFxuICAgICAgICAgICAgYWxsb3dlZFRvb2xzOiBbXCJmcy5yZWFkXCJdLFxuICAgICAgICAgICAgYnVkZ2V0OiB7IG1heFR1cm5zOiAxMCwgdGltZW91dE1zOiA2MDAwMCB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgcm9sZTogXCJjb2RlX2ZpeGVyXCIsXG4gICAgICAgICAgICBnb2FsOiBcIuS/ruWkjVwiLFxuICAgICAgICAgICAgYWxsb3dlZFRvb2xzOiBbXCJmcy53cml0ZVwiXSxcbiAgICAgICAgICAgIGJ1ZGdldDogeyBtYXhUdXJuczogMjAsIHRpbWVvdXRNczogMTIwMDAwIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgdG90YWxCdWRnZXQ6IHtcbiAgICAgICAgICBtYXhUdXJuczogMzUsXG4gICAgICAgICAgdGltZW91dE1zOiAzMDAwMDAsXG4gICAgICAgIH0sXG4gICAgICB9KTtcblxuICAgICAgLy8g6K6pIGZpeGVyIOWksei0pVxuICAgICAgY29uc3QgZml4ZXJUYXNrID0gY29udGV4dC5hZ2VudHNbMV07XG4gICAgICBydW5uZXIuc2V0RmFpbFRhc2soZml4ZXJUYXNrLmlkKTtcblxuICAgICAgLy8gc3RvcE9uRXJyb3I9ZmFsc2XvvIznu6fnu63miafooYxcbiAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBvcmNoZXN0cmF0b3Iud2FpdEZvckNvbXBsZXRpb24oY29udGV4dC50ZWFtSWQsIHtcbiAgICAgICAgc3RvcE9uRXJyb3I6IGZhbHNlLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIHBsYW5uZXIg5oiQ5Yqf77yMZml4ZXIg5aSx6LSlXG4gICAgICBleHBlY3QocmVzdWx0cy5sZW5ndGgpLnRvQmUoMSk7IC8vIOWPquacieaIkOWKn+eahOe7k+aenFxuICAgICAgZXhwZWN0KHJlc3VsdHNbMF0uYWdlbnQpLnRvQmUoXCJwbGFubmVyXCIpO1xuICAgIH0pO1xuXG4gICAgaXQoXCLlupTor6XlnKggc3RvcE9uRXJyb3I9dHJ1ZSDml7bnq4vljbPlgZzmraJcIiwgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgY29udGV4dCA9IGF3YWl0IG9yY2hlc3RyYXRvci5jcmVhdGVUZWFtKHtcbiAgICAgICAgcGFyZW50VGFza0lkOiBcInRhc2tfc3RvcFwiLFxuICAgICAgICBzZXNzaW9uSWQ6IFwic2Vzc2lvbl9zdG9wXCIsXG4gICAgICAgIGdvYWw6IFwi5rWL6K+V5YGc5q2iXCIsXG4gICAgICAgIGFnZW50czogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHJvbGU6IFwicGxhbm5lclwiLFxuICAgICAgICAgICAgZ29hbDogXCLop4TliJJcIixcbiAgICAgICAgICAgIGFsbG93ZWRUb29sczogW1wiZnMucmVhZFwiXSxcbiAgICAgICAgICAgIGJ1ZGdldDogeyBtYXhUdXJuczogMTAsIHRpbWVvdXRNczogNjAwMDAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHJvbGU6IFwiY29kZV9maXhlclwiLFxuICAgICAgICAgICAgZ29hbDogXCLkv67lpI1cIixcbiAgICAgICAgICAgIGFsbG93ZWRUb29sczogW1wiZnMud3JpdGVcIl0sXG4gICAgICAgICAgICBidWRnZXQ6IHsgbWF4VHVybnM6IDIwLCB0aW1lb3V0TXM6IDEyMDAwMCB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIHRvdGFsQnVkZ2V0OiB7XG4gICAgICAgICAgbWF4VHVybnM6IDM1LFxuICAgICAgICAgIHRpbWVvdXRNczogMzAwMDAwLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIOiuqSBwbGFubmVyIOWksei0pVxuICAgICAgcnVubmVyLnNldEZhaWxUYXNrKGNvbnRleHQuYWdlbnRzWzBdLmlkKTtcblxuICAgICAgLy8gc3RvcE9uRXJyb3I9dHJ1Ze+8jOeri+WNs+WBnOatolxuICAgICAgYXdhaXQgZXhwZWN0KFxuICAgICAgICBvcmNoZXN0cmF0b3Iud2FpdEZvckNvbXBsZXRpb24oY29udGV4dC50ZWFtSWQsIHtcbiAgICAgICAgICBzdG9wT25FcnJvcjogdHJ1ZSxcbiAgICAgICAgfSlcbiAgICAgICkucmVqZWN0cy50b1Rocm93KCk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKFwi5Y+W5raI5rWB56iLXCIsICgpID0+IHtcbiAgICBpdChcIuW6lOivpeWPlua2iOaJgOaciea0u+i3g+S7u+WKoVwiLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBjb250ZXh0ID0gYXdhaXQgb3JjaGVzdHJhdG9yLmNyZWF0ZVRlYW0oe1xuICAgICAgICBwYXJlbnRUYXNrSWQ6IFwidGFza19jYW5jZWxcIixcbiAgICAgICAgc2Vzc2lvbklkOiBcInNlc3Npb25fY2FuY2VsXCIsXG4gICAgICAgIGdvYWw6IFwi5rWL6K+V5Y+W5raIXCIsXG4gICAgICAgIGFnZW50czogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHJvbGU6IFwicGxhbm5lclwiLFxuICAgICAgICAgICAgZ29hbDogXCLop4TliJJcIixcbiAgICAgICAgICAgIGFsbG93ZWRUb29sczogW1wiZnMucmVhZFwiXSxcbiAgICAgICAgICAgIGJ1ZGdldDogeyBtYXhUdXJuczogMTAsIHRpbWVvdXRNczogNjAwMDAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHJvbGU6IFwiY29kZV9maXhlclwiLFxuICAgICAgICAgICAgZ29hbDogXCLkv67lpI1cIixcbiAgICAgICAgICAgIGFsbG93ZWRUb29sczogW1wiZnMud3JpdGVcIl0sXG4gICAgICAgICAgICBidWRnZXQ6IHsgbWF4VHVybnM6IDIwLCB0aW1lb3V0TXM6IDEyMDAwMCB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIHRvdGFsQnVkZ2V0OiB7XG4gICAgICAgICAgbWF4VHVybnM6IDM1LFxuICAgICAgICAgIHRpbWVvdXRNczogMzAwMDAwLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIOeri+WNs+WPlua2iFxuICAgICAgYXdhaXQgb3JjaGVzdHJhdG9yLmNhbmNlbFRlYW0oY29udGV4dC50ZWFtSWQsIFwi55So5oi35Y+W5raIXCIpO1xuXG4gICAgICBjb25zdCBmaW5hbENvbnRleHQgPSBhd2FpdCBvcmNoZXN0cmF0b3IuZ2V0VGVhbVN0YXR1cyhjb250ZXh0LnRlYW1JZCk7XG5cbiAgICAgIGV4cGVjdChmaW5hbENvbnRleHQuc3RhdHVzKS50b0JlKFwiY2FuY2VsbGVkXCIpO1xuICAgICAgZXhwZWN0KGZpbmFsQ29udGV4dC5hZ2VudHMuZXZlcnkoYSA9PiBhLnN0YXR1cyA9PT0gXCJjYW5jZWxsZWRcIikpLnRvQmUodHJ1ZSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGRlc2NyaWJlKFwiSG9vayDop6blj5FcIiwgKCkgPT4ge1xuICAgIGl0KFwi5bqU6K+l6Kem5Y+R5a6M5pW055qEIEhvb2sg5bqP5YiXXCIsIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IGhvb2tFdmVudHM6IHN0cmluZ1tdID0gW107XG5cbiAgICAgIGhvb2tCdXMub24oXCJUZWFtQ3JlYXRlXCIsICgpID0+IGhvb2tFdmVudHMucHVzaChcIlRlYW1DcmVhdGVcIikpO1xuICAgICAgaG9va0J1cy5vbihcIlN1YmFnZW50U3RhcnRcIiwgKCkgPT4gaG9va0V2ZW50cy5wdXNoKFwiU3ViYWdlbnRTdGFydFwiKSk7XG4gICAgICBob29rQnVzLm9uKFwiU3ViYWdlbnRTdG9wXCIsICgpID0+IGhvb2tFdmVudHMucHVzaChcIlN1YmFnZW50U3RvcFwiKSk7XG4gICAgICBob29rQnVzLm9uKFwiVGVhbU1lcmdlXCIsICgpID0+IGhvb2tFdmVudHMucHVzaChcIlRlYW1NZXJnZVwiKSk7XG5cbiAgICAgIGNvbnN0IGNvbnRleHQgPSBhd2FpdCBvcmNoZXN0cmF0b3IuY3JlYXRlVGVhbSh7XG4gICAgICAgIHBhcmVudFRhc2tJZDogXCJ0YXNrX2hvb2tcIixcbiAgICAgICAgc2Vzc2lvbklkOiBcInNlc3Npb25faG9va1wiLFxuICAgICAgICBnb2FsOiBcIua1i+ivlSBIb29rXCIsXG4gICAgICAgIGFnZW50czogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHJvbGU6IFwicGxhbm5lclwiLFxuICAgICAgICAgICAgZ29hbDogXCLop4TliJJcIixcbiAgICAgICAgICAgIGFsbG93ZWRUb29sczogW1wiZnMucmVhZFwiXSxcbiAgICAgICAgICAgIGJ1ZGdldDogeyBtYXhUdXJuczogMTAsIHRpbWVvdXRNczogNjAwMDAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICB0b3RhbEJ1ZGdldDoge1xuICAgICAgICAgIG1heFR1cm5zOiAxNSxcbiAgICAgICAgICB0aW1lb3V0TXM6IDYwMDAwLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIGF3YWl0IG9yY2hlc3RyYXRvci53YWl0Rm9yQ29tcGxldGlvbihjb250ZXh0LnRlYW1JZCk7XG4gICAgICBhd2FpdCBvcmNoZXN0cmF0b3IubWVyZ2VSZXN1bHRzKFxuICAgICAgICBhd2FpdCBvcmNoZXN0cmF0b3Iud2FpdEZvckNvbXBsZXRpb24oY29udGV4dC50ZWFtSWQpXG4gICAgICApO1xuXG4gICAgICBleHBlY3QoaG9va0V2ZW50cykudG9Db250YWluKFwiVGVhbUNyZWF0ZVwiKTtcbiAgICAgIGV4cGVjdChob29rRXZlbnRzLmZpbHRlcihlID0+IGUgPT09IFwiU3ViYWdlbnRTdGFydFwiKS5sZW5ndGgpLnRvQmUoMSk7XG4gICAgICBleHBlY3QoaG9va0V2ZW50cy5maWx0ZXIoZSA9PiBlID09PSBcIlN1YmFnZW50U3RvcFwiKS5sZW5ndGgpLnRvQmUoMSk7XG4gICAgICBleHBlY3QoaG9va0V2ZW50cykudG9Db250YWluKFwiVGVhbU1lcmdlXCIpO1xuICAgIH0pO1xuICB9KTtcbn0pO1xuXG5kZXNjcmliZShcInJ1blRlYW0gKOS+v+aNt+WHveaVsClcIiwgKCkgPT4ge1xuICBpdChcIuW6lOivpeWujOaIkOerr+WIsOerr+aJp+ihjFwiLCBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgaG9va0J1cyA9IG5ldyBBZ2VudFRlYW1Ib29rQnVzKCk7XG4gICAgY29uc3QgcnVubmVyID0gbmV3IE1vY2tTdWJhZ2VudFJ1bm5lcihob29rQnVzKTtcblxuICAgIGNvbnN0IHsgY29udGV4dCwgcmVzdWx0cywgbWVyZ2VkIH0gPSBhd2FpdCBydW5UZWFtKFxuICAgICAge1xuICAgICAgICBwYXJlbnRUYXNrSWQ6IFwidGFza19ydW5cIixcbiAgICAgICAgc2Vzc2lvbklkOiBcInNlc3Npb25fcnVuXCIsXG4gICAgICAgIGdvYWw6IFwi56uv5Yiw56uv5rWL6K+VXCIsXG4gICAgICAgIGFnZW50czogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHJvbGU6IFwicGxhbm5lclwiLFxuICAgICAgICAgICAgZ29hbDogXCLop4TliJJcIixcbiAgICAgICAgICAgIGFsbG93ZWRUb29sczogW1wiZnMucmVhZFwiXSxcbiAgICAgICAgICAgIGJ1ZGdldDogeyBtYXhUdXJuczogMTAsIHRpbWVvdXRNczogNjAwMDAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHJvbGU6IFwidmVyaWZ5X2FnZW50XCIsXG4gICAgICAgICAgICBnb2FsOiBcIumqjOivgVwiLFxuICAgICAgICAgICAgYWxsb3dlZFRvb2xzOiBbXCJzaGVsbC5ydW5cIl0sXG4gICAgICAgICAgICBidWRnZXQ6IHsgbWF4VHVybnM6IDE1LCB0aW1lb3V0TXM6IDkwMDAwIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgdG90YWxCdWRnZXQ6IHtcbiAgICAgICAgICBtYXhUdXJuczogMzAsXG4gICAgICAgICAgdGltZW91dE1zOiAzMDAwMDAsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgcnVubmVyLFxuICAgICAgaG9va0J1c1xuICAgICk7XG5cbiAgICBleHBlY3QoY29udGV4dC5zdGF0dXMpLnRvQmUoXCJjb21wbGV0ZWRcIik7XG4gICAgZXhwZWN0KHJlc3VsdHMubGVuZ3RoKS50b0JlKDIpO1xuICAgIGV4cGVjdChtZXJnZWQuc3VtbWFyeSkudG9CZURlZmluZWQoKTtcbiAgfSk7XG59KTtcblxuZGVzY3JpYmUoXCJEZWxlZ2F0aW9uIFBvbGljeSDpm4bmiJBcIiwgKCkgPT4ge1xuICBpdChcIuW6lOivpeS9v+eUqOetlueVpeaOqOiNkOinkuiJslwiLCBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgcG9saWN5ID0gbmV3IERlbGVnYXRpb25Qb2xpY3koKTtcbiAgICBjb25zdCBhZ2VudHMgPSBhd2FpdCBwb2xpY3kucmVjb21tZW5kQWdlbnRzKHtcbiAgICAgIGlkOiBcInRhc2tfcG9saWN5XCIsXG4gICAgICBnb2FsOiBcIuWkjeadguS7u+WKoVwiLFxuICAgICAgY29tcGxleGl0eTogXCJoaWdoXCIsXG4gICAgfSk7XG5cbiAgICBleHBlY3QoYWdlbnRzLmxlbmd0aCkudG9CZSg1KTtcbiAgICBleHBlY3QoYWdlbnRzLm1hcChhID0+IGEucm9sZSkpLnRvRXF1YWwoW1xuICAgICAgXCJwbGFubmVyXCIsXG4gICAgICBcInJlcG9fcmVhZGVyXCIsXG4gICAgICBcImNvZGVfZml4ZXJcIixcbiAgICAgIFwiY29kZV9yZXZpZXdlclwiLFxuICAgICAgXCJ2ZXJpZnlfYWdlbnRcIixcbiAgICBdKTtcbiAgfSk7XG5cbiAgaXQoXCLlupTor6Xkvb/nlKjnrZbnlaXorqHnrpfpooTnrpdcIiwgYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHBvbGljeSA9IG5ldyBEZWxlZ2F0aW9uUG9saWN5KCk7XG4gICAgY29uc3QgYWdlbnRzID0gYXdhaXQgcG9saWN5LnJlY29tbWVuZEFnZW50cyh7XG4gICAgICBpZDogXCJ0YXNrX2J1ZGdldFwiLFxuICAgICAgZ29hbDogXCLmtYvor5VcIixcbiAgICAgIGNvbXBsZXhpdHk6IFwibWVkaXVtXCIsXG4gICAgfSk7XG5cbiAgICBjb25zdCBhbGxvY2F0aW9uID0gYXdhaXQgcG9saWN5LmNhbGN1bGF0ZUJ1ZGdldChcbiAgICAgIHsgbWF4VHVybnM6IDEwMCwgdGltZW91dE1zOiA2MDAwMDAgfSxcbiAgICAgIGFnZW50c1xuICAgICk7XG5cbiAgICBleHBlY3QoYWxsb2NhdGlvbi5wZXJBZ2VudCkudG9CZURlZmluZWQoKTtcbiAgICBleHBlY3QoYWxsb2NhdGlvbi5yZXNlcnZlZCkudG9CZURlZmluZWQoKTtcbiAgfSk7XG59KTtcbiJdfQ==