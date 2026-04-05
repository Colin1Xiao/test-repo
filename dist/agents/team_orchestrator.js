"use strict";
/**
 * Agent Teams / Subagents - 团队编排器
 *
 * 核心调度器：创建团队、调度子代理、归并结果
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamOrchestrator = void 0;
exports.createTeamOrchestrator = createTeamOrchestrator;
exports.runTeam = runTeam;
const state_machine_1 = require("./state_machine");
const subagent_runner_1 = require("./subagent_runner");
// ============================================================================
// 团队编排器实现
// ============================================================================
class TeamOrchestrator {
    constructor(runner, hookBus) {
        this.teams = new Map();
        this.runner = runner || new subagent_runner_1.SubagentRunner();
        this.hookBus = hookBus || new subagent_runner_1.NoOpHookBus();
    }
    /**
     * 创建子代理团队
     */
    async createTeam(params) {
        const teamId = this.generateId("team");
        const timestamp = Date.now();
        // 创建团队上下文
        const context = {
            teamId,
            parentTaskId: params.parentTaskId,
            sessionId: params.sessionId,
            agents: [],
            sharedState: {},
            worktree: params.worktree,
            allowedTools: [],
            totalBudget: params.totalBudget,
            usedBudget: { turns: 0, tokens: 0, elapsedMs: 0 },
            status: "active",
            createdAt: timestamp,
        };
        // 创建子代理任务
        for (const agentConfig of params.agents) {
            const task = {
                id: this.generateId("task"),
                parentTaskId: params.parentTaskId,
                sessionId: params.sessionId,
                teamId,
                agent: agentConfig.role,
                goal: agentConfig.goal,
                inputs: agentConfig.inputs || {},
                allowedTools: agentConfig.allowedTools,
                forbiddenTools: [],
                worktree: params.worktree,
                budget: agentConfig.budget,
                status: "queued",
                createdAt: timestamp,
                currentTurn: 0,
                dependsOn: agentConfig.dependsOn,
            };
            context.agents.push(task);
        }
        // 注册团队
        this.teams.set(teamId, context);
        // 触发 TeamCreate Hook
        await this.hookBus.emit({
            type: "TeamCreate",
            teamId,
            parentTaskId: params.parentTaskId,
            agents: params.agents.map(a => a.role),
            totalBudget: params.totalBudget,
            timestamp,
        });
        return context;
    }
    /**
     * 动态添加子任务到团队
     */
    async delegateTask(params) {
        const context = this.teams.get(params.teamId);
        if (!context) {
            throw new Error(`Team not found: ${params.teamId}`);
        }
        if (context.status !== "active") {
            throw new Error(`Team is not active: ${context.status}`);
        }
        const timestamp = Date.now();
        const task = {
            id: this.generateId("task"),
            parentTaskId: context.parentTaskId,
            sessionId: context.sessionId,
            teamId: params.teamId,
            agent: params.agent,
            goal: params.goal,
            inputs: params.inputs || {},
            allowedTools: params.allowedTools,
            forbiddenTools: [],
            worktree: context.worktree,
            budget: params.budget,
            status: "queued",
            createdAt: timestamp,
            currentTurn: 0,
            dependsOn: params.dependsOn,
        };
        context.agents.push(task);
        return task;
    }
    /**
     * 等待团队所有子代理完成
     *
     * 支持：
     * - 串行执行（有依赖）
     * - 简单 fan-out（无依赖）
     * - 失败处理
     */
    async waitForCompletion(teamId, options) {
        const context = this.teams.get(teamId);
        if (!context) {
            throw new Error(`Team not found: ${teamId}`);
        }
        const timeoutMs = options?.timeoutMs || 300000; // 默认 5 分钟
        const stopOnError = options?.stopOnError ?? false;
        const startTime = Date.now();
        const results = [];
        const failedTasks = [];
        // 按依赖关系排序执行
        const executed = new Set();
        const executing = new Map();
        while (executed.size < context.agents.length) {
            // 检查超时
            if (Date.now() - startTime > timeoutMs) {
                await this.emitTeamFail(teamId, "Timeout", failedTasks);
                (0, state_machine_1.failTeam)(context, "Timeout");
                throw new Error(`Team execution timeout after ${timeoutMs}ms`);
            }
            // 获取可执行任务（依赖已满足）
            const readyTasks = context.agents.filter(task => task.status === "queued" &&
                !executed.has(task.id) &&
                !executing.has(task.id) &&
                this.areDependenciesSatisfied(task, executed));
            // 启动可执行任务
            for (const task of readyTasks) {
                const promise = this.executeTask(task, context)
                    .then(result => {
                    executed.add(task.id);
                    executing.delete(task.id);
                    results.push(result);
                    return result;
                })
                    .catch(error => {
                    executed.add(task.id);
                    executing.delete(task.id);
                    failedTasks.push(task.id);
                    if (stopOnError) {
                        throw error;
                    }
                    return null;
                });
                executing.set(task.id, promise);
            }
            // 等待至少一个完成
            if (executing.size > 0) {
                await Promise.race(executing.values());
            }
            else if (readyTasks.length === 0 && executed.size < context.agents.length) {
                // 死锁检测
                const remaining = context.agents.filter(t => !executed.has(t.id));
                if (remaining.length > 0) {
                    const error = `Deadlock detected: ${remaining.length} tasks blocked`;
                    await this.emitTeamFail(teamId, error, remaining.map(t => t.id));
                    (0, state_machine_1.failTeam)(context, error);
                    throw new Error(error);
                }
            }
        }
        // 检查是否有失败
        if (failedTasks.length > 0 && stopOnError) {
            await this.emitTeamFail(teamId, `${failedTasks.length} tasks failed`, failedTasks);
            (0, state_machine_1.failTeam)(context, `${failedTasks.length} tasks failed`);
            throw new Error(`Team execution failed: ${failedTasks.length} tasks`);
        }
        return results;
    }
    /**
     * 归并多个子代理结果
     */
    async mergeResults(results) {
        // 合并且件
        const allArtifacts = [];
        const allPatches = [];
        const allFindings = [];
        const allBlockers = [];
        const allRecommendations = [];
        let totalConfidence = 0;
        let validResults = 0;
        for (const result of results) {
            if (result.artifacts)
                allArtifacts.push(...result.artifacts);
            if (result.patches)
                allPatches.push(...result.patches);
            if (result.findings)
                allFindings.push(...result.findings);
            if (result.blockers)
                allBlockers.push(...result.blockers);
            if (result.recommendations)
                allRecommendations.push(...result.recommendations);
            if (result.confidence !== undefined) {
                totalConfidence += result.confidence;
                validResults++;
            }
        }
        // 生成摘要
        const summary = this.generateSummary(results);
        // 计算平均置信度
        const confidence = validResults > 0 ? totalConfidence / validResults : 0;
        const mergedResult = {
            summary,
            artifacts: allArtifacts,
            patches: allPatches,
            findings: allFindings,
            confidence,
            blockers: allBlockers,
            recommendations: allRecommendations,
        };
        // 触发 TeamMerge Hook
        await this.hookBus.emit({
            type: "TeamMerge",
            teamId: results[0]?.teamId || "unknown",
            timestamp: Date.now(),
            resultsCount: results.length,
            mergedSummary: summary,
        });
        return mergedResult;
    }
    /**
     * 取消团队执行
     */
    async cancelTeam(teamId, reason) {
        const context = this.teams.get(teamId);
        if (!context) {
            throw new Error(`Team not found: ${teamId}`);
        }
        const cancelledTasks = [];
        // 取消所有活跃任务
        for (const task of context.agents) {
            if (task.status === "queued" || task.status === "running") {
                task.status = "cancelled";
                task.completedAt = Date.now();
                task.lastError = reason;
                cancelledTasks.push(task.id);
            }
        }
        // 更新团队状态
        (0, state_machine_1.cancelTeam)(context, reason);
        // 触发 TeamCancel Hook
        await this.hookBus.emit({
            type: "TeamCancel",
            teamId,
            timestamp: Date.now(),
            reason: reason || "User cancelled",
            cancelledTasks,
        });
    }
    /**
     * 获取团队状态
     */
    async getTeamStatus(teamId) {
        const context = this.teams.get(teamId);
        if (!context) {
            throw new Error(`Team not found: ${teamId}`);
        }
        return { ...context };
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 执行单个任务
     */
    async executeTask(task, context) {
        // 更新共享状态
        context.sharedState.currentTask = task.id;
        // 执行
        const result = await this.runner.run(task, context);
        // 更新预算使用
        context.usedBudget.turns += result.turnsUsed;
        if (result.tokensUsed) {
            context.usedBudget.tokens += result.tokensUsed;
        }
        context.usedBudget.elapsedMs += result.durationMs;
        // 将结果添加到共享状态（供后续任务使用）
        context.sharedState[`result_${task.agent}`] = result;
        return result;
    }
    /**
     * 检查依赖是否已满足
     */
    areDependenciesSatisfied(task, executed) {
        if (!task.dependsOn || task.dependsOn.length === 0) {
            return true;
        }
        return task.dependsOn.every(depId => executed.has(depId));
    }
    /**
     * 生成团队执行摘要
     */
    generateSummary(results) {
        if (results.length === 0) {
            return "无执行结果";
        }
        const summaries = results.map(r => `- [${r.agent}]: ${r.summary}`);
        return `团队执行完成 (${results.length} 个子任务):\n${summaries.join("\n")}`;
    }
    /**
     * 生成唯一 ID
     */
    generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    /**
     * 触发 TeamFail Hook
     */
    async emitTeamFail(teamId, reason, failedTasks) {
        await this.hookBus.emit({
            type: "TeamFail",
            teamId,
            timestamp: Date.now(),
            reason,
            failedTasks,
        });
    }
    /**
     * 触发 TeamComplete Hook
     */
    async emitTeamComplete(teamId, results, mergedResult) {
        const context = this.teams.get(teamId);
        const duration = context ? (0, state_machine_1.getTeamDuration)(context) || 0 : 0;
        await this.hookBus.emit({
            type: "TeamComplete",
            teamId,
            timestamp: Date.now(),
            results,
            mergedResult,
            durationMs: duration,
        });
    }
}
exports.TeamOrchestrator = TeamOrchestrator;
// ============================================================================
// 工厂函数
// ============================================================================
/**
 * 创建 TeamOrchestrator 实例
 */
function createTeamOrchestrator(runner, hookBus) {
    return new TeamOrchestrator(runner, hookBus);
}
// ============================================================================
// 便捷函数：端到端执行
// ============================================================================
/**
 * 创建并执行团队（便捷函数）
 */
async function runTeam(params, runner, hookBus) {
    const orchestrator = createTeamOrchestrator(runner, hookBus);
    // 创建团队
    const context = await orchestrator.createTeam(params);
    // 等待完成
    const results = await orchestrator.waitForCompletion(context.teamId);
    // 归并结果
    const merged = await orchestrator.mergeResults(results);
    // 更新团队状态
    const finalContext = await orchestrator.getTeamStatus(context.teamId);
    (0, state_machine_1.completeTeam)(finalContext);
    // 触发完成 Hook
    await hookBus?.emit({
        type: "TeamComplete",
        teamId: context.teamId,
        timestamp: Date.now(),
        results,
        mergedResult: merged,
        durationMs: (0, state_machine_1.getTeamDuration)(finalContext) || 0,
    });
    return { context: finalContext, results, merged };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVhbV9vcmNoZXN0cmF0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvYWdlbnRzL3RlYW1fb3JjaGVzdHJhdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7OztHQU9HOzs7QUE4ZUgsd0RBS0M7QUFTRCwwQkFtQ0M7QUExZ0JELG1EQU15QjtBQUN6Qix1REFBMEU7QUFvRDFFLCtFQUErRTtBQUMvRSxVQUFVO0FBQ1YsK0VBQStFO0FBRS9FLE1BQWEsZ0JBQWdCO0lBSzNCLFlBQVksTUFBd0IsRUFBRSxPQUFrQjtRQUpoRCxVQUFLLEdBQTZCLElBQUksR0FBRyxFQUFFLENBQUM7UUFLbEQsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLElBQUksSUFBSSxnQ0FBYyxFQUFFLENBQUM7UUFDN0MsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLElBQUksSUFBSSw2QkFBVyxFQUFFLENBQUM7SUFDOUMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLFVBQVUsQ0FBQyxNQUF3QjtRQUN2QyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3ZDLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUU3QixVQUFVO1FBQ1YsTUFBTSxPQUFPLEdBQWdCO1lBQzNCLE1BQU07WUFDTixZQUFZLEVBQUUsTUFBTSxDQUFDLFlBQVk7WUFDakMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxTQUFTO1lBQzNCLE1BQU0sRUFBRSxFQUFFO1lBQ1YsV0FBVyxFQUFFLEVBQUU7WUFDZixRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVE7WUFDekIsWUFBWSxFQUFFLEVBQUU7WUFDaEIsV0FBVyxFQUFFLE1BQU0sQ0FBQyxXQUFXO1lBQy9CLFVBQVUsRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFF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LGFBQWEsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDdEUsSUFBQSw0QkFBWSxFQUFDLFlBQVksQ0FBQyxDQUFDO0lBRTNCLFlBQVk7SUFDWixNQUFNLE9BQU8sRUFBRSxJQUFJLENBQUM7UUFDbEIsSUFBSSxFQUFFLGNBQWM7UUFDcEIsTUFBTSxFQUFFLE9BQU8sQ0FBQyxNQUFNO1FBQ3RCLFNBQVMsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO1FBQ3JCLE9BQU87UUFDUCxZQUFZLEVBQUUsTUFBTTtRQUNwQixVQUFVLEVBQUUsSUFBQSwrQkFBZSxFQUFDLFlBQVksQ0FBQyxJQUFJLENBQUM7S0FDMUIsQ0FBQyxDQUFDO0lBRXhCLE9BQU8sRUFBRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsQ0FBQztBQUNwRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBZ2VudCBUZWFtcyAvIFN1YmFnZW50cyAtIOWboumYn+e8luaOkuWZqFxuICogXG4gKiDmoLjlv4PosIPluqblmajvvJrliJvlu7rlm6LpmJ/jgIHosIPluqblrZDku6PnkIbjgIHlvZLlubbnu5PmnpxcbiAqIFxuICogQHZlcnNpb24gdjAuMS4wXG4gKiBAZGF0ZSAyMDI2LTA0LTAzXG4gKi9cblxuaW1wb3J0IHR5cGUge1xuICBTdWJhZ2VudFRhc2ssXG4gIFN1YmFnZW50UmVzdWx0LFxuICBUZWFtQ29udGV4dCxcbiAgVGVhbVN0YXR1cyxcbiAgQnVkZ2V0U3BlYyxcbiAgTWVyZ2VkUmVzdWx0LFxuICBBcnRpZmFjdFJlZixcbiAgUGF0Y2hSZWYsXG4gIEZpbmRpbmcsXG59IGZyb20gXCIuL3R5cGVzXCI7XG5pbXBvcnQgdHlwZSB7XG4gIElUZWFtT3JjaGVzdHJhdG9yLFxuICBDcmVhdGVUZWFtUGFyYW1zLFxuICBEZWxlZ2F0ZVRhc2tQYXJhbXMsXG4gIFdhaXRGb3JPcHRpb25zLFxuICBBZ2VudFJvbGVDb25maWcsXG59IGZyb20gXCIuL3R5cGVzXCI7XG5pbXBvcnQgdHlwZSB7IElTdWJhZ2VudFJ1bm5lciB9IGZyb20gXCIuL3N1YmFnZW50X3J1bm5lclwiO1xuaW1wb3J0IHtcbiAgY29tcGxldGVUZWFtLFxuICBmYWlsVGVhbSxcbiAgY2FuY2VsVGVhbSxcbiAgZ2V0VGVhbUR1cmF0aW9uLFxuICBpc1RlYW1Db21wbGV0ZSxcbn0gZnJvbSBcIi4vc3RhdGVfbWFjaGluZVwiO1xuaW1wb3J0IHsgU3ViYWdlbnRSdW5uZXIsIElIb29rQnVzLCBOb09wSG9va0J1cyB9IGZyb20gXCIuL3N1YmFnZW50X3J1bm5lclwiO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDlm6LpmJ/kuovku7bnsbvlnovvvIhIb29rQnVzIOmbhuaIkO+8iVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgdHlwZSBUZWFtSG9va0V2ZW50VHlwZSA9XG4gIHwgXCJUZWFtQ3JlYXRlXCJcbiAgfCBcIlRlYW1Db21wbGV0ZVwiXG4gIHwgXCJUZWFtRmFpbFwiXG4gIHwgXCJUZWFtQ2FuY2VsXCJcbiAgfCBcIlRlYW1NZXJnZVwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRlYW1Ib29rRXZlbnQge1xuICB0eXBlOiBUZWFtSG9va0V2ZW50VHlwZTtcbiAgdGVhbUlkOiBzdHJpbmc7XG4gIHRpbWVzdGFtcDogbnVtYmVyO1xuICBba2V5OiBzdHJpbmddOiB1bmtub3duO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRlYW1DcmVhdGVFdmVudCBleHRlbmRzIFRlYW1Ib29rRXZlbnQge1xuICB0eXBlOiBcIlRlYW1DcmVhdGVcIjtcbiAgcGFyZW50VGFza0lkOiBzdHJpbmc7XG4gIGFnZW50czogc3RyaW5nW107XG4gIHRvdGFsQnVkZ2V0OiBCdWRnZXRTcGVjO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRlYW1Db21wbGV0ZUV2ZW50IGV4dGVuZHMgVGVhbUhvb2tFdmVudCB7XG4gIHR5cGU6IFwiVGVhbUNvbXBsZXRlXCI7XG4gIHJlc3VsdHM6IFN1YmFnZW50UmVzdWx0W107XG4gIG1lcmdlZFJlc3VsdDogTWVyZ2VkUmVzdWx0O1xuICBkdXJhdGlvbk1zOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGVhbUZhaWxFdmVudCBleHRlbmRzIFRlYW1Ib29rRXZlbnQge1xuICB0eXBlOiBcIlRlYW1GYWlsXCI7XG4gIHJlYXNvbjogc3RyaW5nO1xuICBmYWlsZWRUYXNrczogc3RyaW5nW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGVhbUNhbmNlbEV2ZW50IGV4dGVuZHMgVGVhbUhvb2tFdmVudCB7XG4gIHR5cGU6IFwiVGVhbUNhbmNlbFwiO1xuICByZWFzb246IHN0cmluZztcbiAgY2FuY2VsbGVkVGFza3M6IHN0cmluZ1tdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRlYW1NZXJnZUV2ZW50IGV4dGVuZHMgVGVhbUhvb2tFdmVudCB7XG4gIHR5cGU6IFwiVGVhbU1lcmdlXCI7XG4gIHJlc3VsdHNDb3VudDogbnVtYmVyO1xuICBtZXJnZWRTdW1tYXJ5OiBzdHJpbmc7XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOWboumYn+e8luaOkuWZqOWunueOsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgVGVhbU9yY2hlc3RyYXRvciBpbXBsZW1lbnRzIElUZWFtT3JjaGVzdHJhdG9yIHtcbiAgcHJpdmF0ZSB0ZWFtczogTWFwPHN0cmluZywgVGVhbUNvbnRleHQ+ID0gbmV3IE1hcCgpO1xuICBwcml2YXRlIHJ1bm5lcjogSVN1YmFnZW50UnVubmVyO1xuICBwcml2YXRlIGhvb2tCdXM6IElIb29rQnVzO1xuICBcbiAgY29uc3RydWN0b3IocnVubmVyPzogSVN1YmFnZW50UnVubmVyLCBob29rQnVzPzogSUhvb2tCdXMpIHtcbiAgICB0aGlzLnJ1bm5lciA9IHJ1bm5lciB8fCBuZXcgU3ViYWdlbnRSdW5uZXIoKTtcbiAgICB0aGlzLmhvb2tCdXMgPSBob29rQnVzIHx8IG5ldyBOb09wSG9va0J1cygpO1xuICB9XG4gIFxuICAvKipcbiAgICog5Yib5bu65a2Q5Luj55CG5Zui6ZifXG4gICAqL1xuICBhc3luYyBjcmVhdGVUZWFtKHBhcmFtczogQ3JlYXRlVGVhbVBhcmFtcyk6IFByb21pc2U8VGVhbUNvbnRleHQ+IHtcbiAgICBjb25zdCB0ZWFtSWQgPSB0aGlzLmdlbmVyYXRlSWQoXCJ0ZWFtXCIpO1xuICAgIGNvbnN0IHRpbWVzdGFtcCA9IERhdGUubm93KCk7XG4gICAgXG4gICAgLy8g5Yib5bu65Zui6Zif5LiK5LiL5paHXG4gICAgY29uc3QgY29udGV4dDogVGVhbUNvbnRleHQgPSB7XG4gICAgICB0ZWFtSWQsXG4gICAgICBwYXJlbnRUYXNrSWQ6IHBhcmFtcy5wYXJlbnRUYXNrSWQsXG4gICAgICBzZXNzaW9uSWQ6IHBhcmFtcy5zZXNzaW9uSWQsXG4gICAgICBhZ2VudHM6IFtdLFxuICAgICAgc2hhcmVkU3RhdGU6IHt9LFxuICAgICAgd29ya3RyZWU6IHBhcmFtcy53b3JrdHJlZSxcbiAgICAgIGFsbG93ZWRUb29sczogW10sXG4gICAgICB0b3RhbEJ1ZGdldDogcGFyYW1zLnRvdGFsQnVkZ2V0LFxuICAgICAgdXNlZEJ1ZGdldDogeyB0dXJuczogMCwgdG9rZW5zOiAwLCBlbGFwc2VkTXM6IDAgfSxcbiAgICAgIHN0YXR1czogXCJhY3RpdmVcIixcbiAgICAgIGNyZWF0ZWRBdDogdGltZXN0YW1wLFxuICAgIH07XG4gICAgXG4gICAgLy8g5Yib5bu65a2Q5Luj55CG5Lu75YqhXG4gICAgZm9yIChjb25zdCBhZ2VudENvbmZpZyBvZiBwYXJhbXMuYWdlbnRzKSB7XG4gICAgICBjb25zdCB0YXNrOiBTdWJhZ2VudFRhc2sgPSB7XG4gICAgICAgIGlkOiB0aGlzLmdlbmVyYXRlSWQoXCJ0YXNrXCIpLFxuICAgICAgICBwYXJlbnRUYXNrSWQ6IHBhcmFtcy5wYXJlbnRUYXNrSWQsXG4gICAgICAgIHNlc3Npb25JZDogcGFyYW1zLnNlc3Npb25JZCxcbiAgICAgICAgdGVhbUlkLFxuICAgICAgICBhZ2VudDogYWdlbnRDb25maWcucm9sZSxcbiAgICAgICAgZ29hbDogYWdlbnRDb25maWcuZ29hbCxcbiAgICAgICAgaW5wdXRzOiBhZ2VudENvbmZpZy5pbnB1dHMgfHwge30sXG4gICAgICAgIGFsbG93ZWRUb29sczogYWdlbnRDb25maWcuYWxsb3dlZFRvb2xzLFxuICAgICAgICBmb3JiaWRkZW5Ub29sczogW10sXG4gICAgICAgIHdvcmt0cmVlOiBwYXJhbXMud29ya3RyZWUsXG4gICAgICAgIGJ1ZGdldDogYWdlbnRDb25maWcuYnVkZ2V0LFxuICAgICAgICBzdGF0dXM6IFwicXVldWVkXCIsXG4gICAgICAgIGNyZWF0ZWRBdDogdGltZXN0YW1wLFxuICAgICAgICBjdXJyZW50VHVybjogMCxcbiAgICAgICAgZGVwZW5kc09uOiBhZ2VudENvbmZpZy5kZXBlbmRzT24sXG4gICAgICB9O1xuICAgICAgY29udGV4dC5hZ2VudHMucHVzaCh0YXNrKTtcbiAgICB9XG4gICAgXG4gICAgLy8g5rOo5YaM5Zui6ZifXG4gICAgdGhpcy50ZWFtcy5zZXQodGVhbUlkLCBjb250ZXh0KTtcbiAgICBcbiAgICAvLyDop6blj5EgVGVhbUNyZWF0ZSBIb29rXG4gICAgYXdhaXQgdGhpcy5ob29rQnVzLmVtaXQoe1xuICAgICAgdHlwZTogXCJUZWFtQ3JlYXRlXCIsXG4gICAgICB0ZWFtSWQsXG4gICAgICBwYXJlbnRUYXNrSWQ6IHBhcmFtcy5wYXJlbnRUYXNrSWQsXG4gICAgICBhZ2VudHM6IHBhcmFtcy5hZ2VudHMubWFwKGEgPT4gYS5yb2xlKSxcbiAgICAgIHRvdGFsQnVkZ2V0OiBwYXJhbXMudG90YWxCdWRnZXQsXG4gICAgICB0aW1lc3RhbXAsXG4gICAgfSBhcyBUZWFtQ3JlYXRlRXZlbnQpO1xuICAgIFxuICAgIHJldHVybiBjb250ZXh0O1xuICB9XG4gIFxuICAvKipcbiAgICog5Yqo5oCB5re75Yqg5a2Q5Lu75Yqh5Yiw5Zui6ZifXG4gICAqL1xuICBhc3luYyBkZWxlZ2F0ZVRhc2socGFyYW1zOiBEZWxlZ2F0ZVRhc2tQYXJhbXMpOiBQcm9taXNlPFN1YmFnZW50VGFzaz4ge1xuICAgIGNvbnN0IGNvbnRleHQgPSB0aGlzLnRlYW1zLmdldChwYXJhbXMudGVhbUlkKTtcbiAgICBpZiAoIWNvbnRleHQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVGVhbSBub3QgZm91bmQ6ICR7cGFyYW1zLnRlYW1JZH1gKTtcbiAgICB9XG4gICAgXG4gICAgaWYgKGNvbnRleHQuc3RhdHVzICE9PSBcImFjdGl2ZVwiKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFRlYW0gaXMgbm90IGFjdGl2ZTogJHtjb250ZXh0LnN0YXR1c31gKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgdGltZXN0YW1wID0gRGF0ZS5ub3coKTtcbiAgICBcbiAgICBjb25zdCB0YXNrOiBTdWJhZ2VudFRhc2sgPSB7XG4gICAgICBpZDogdGhpcy5nZW5lcmF0ZUlkKFwidGFza1wiKSxcbiAgICAgIHBhcmVudFRhc2tJZDogY29udGV4dC5wYXJlbnRUYXNrSWQsXG4gICAgICBzZXNzaW9uSWQ6IGNvbnRleHQuc2Vzc2lvbklkLFxuICAgICAgdGVhbUlkOiBwYXJhbXMudGVhbUlkLFxuICAgICAgYWdlbnQ6IHBhcmFtcy5hZ2VudCxcbiAgICAgIGdvYWw6IHBhcmFtcy5nb2FsLFxuICAgICAgaW5wdXRzOiBwYXJhbXMuaW5wdXRzIHx8IHt9LFxuICAgICAgYWxsb3dlZFRvb2xzOiBwYXJhbXMuYWxsb3dlZFRvb2xzLFxuICAgICAgZm9yYmlkZGVuVG9vbHM6IFtdLFxuICAgICAgd29ya3RyZWU6IGNvbnRleHQud29ya3RyZWUsXG4gICAgICBidWRnZXQ6IHBhcmFtcy5idWRnZXQsXG4gICAgICBzdGF0dXM6IFwicXVldWVkXCIsXG4gICAgICBjcmVhdGVkQXQ6IHRpbWVzdGFtcCxcbiAgICAgIGN1cnJlbnRUdXJuOiAwLFxuICAgICAgZGVwZW5kc09uOiBwYXJhbXMuZGVwZW5kc09uLFxuICAgIH07XG4gICAgXG4gICAgY29udGV4dC5hZ2VudHMucHVzaCh0YXNrKTtcbiAgICBcbiAgICByZXR1cm4gdGFzaztcbiAgfVxuICBcbiAgLyoqXG4gICAqIOetieW+heWboumYn+aJgOacieWtkOS7o+eQhuWujOaIkFxuICAgKiBcbiAgICog5pSv5oyB77yaXG4gICAqIC0g5Liy6KGM5omn6KGM77yI5pyJ5L6d6LWW77yJXG4gICAqIC0g566A5Y2VIGZhbi1vdXTvvIjml6Dkvp3otZbvvIlcbiAgICogLSDlpLHotKXlpITnkIZcbiAgICovXG4gIGFzeW5jIHdhaXRGb3JDb21wbGV0aW9uKFxuICAgIHRlYW1JZDogc3RyaW5nLFxuICAgIG9wdGlvbnM/OiBXYWl0Rm9yT3B0aW9uc1xuICApOiBQcm9taXNlPFN1YmFnZW50UmVzdWx0W10+IHtcbiAgICBjb25zdCBjb250ZXh0ID0gdGhpcy50ZWFtcy5nZXQodGVhbUlkKTtcbiAgICBpZiAoIWNvbnRleHQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVGVhbSBub3QgZm91bmQ6ICR7dGVhbUlkfWApO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCB0aW1lb3V0TXMgPSBvcHRpb25zPy50aW1lb3V0TXMgfHwgMzAwMDAwOyAgLy8g6buY6K6kIDUg5YiG6ZKfXG4gICAgY29uc3Qgc3RvcE9uRXJyb3IgPSBvcHRpb25zPy5zdG9wT25FcnJvciA/PyBmYWxzZTtcbiAgICBcbiAgICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIGNvbnN0IHJlc3VsdHM6IFN1YmFnZW50UmVzdWx0W10gPSBbXTtcbiAgICBjb25zdCBmYWlsZWRUYXNrczogc3RyaW5nW10gPSBbXTtcbiAgICBcbiAgICAvLyDmjInkvp3otZblhbPns7vmjpLluo/miafooYxcbiAgICBjb25zdCBleGVjdXRlZCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGNvbnN0IGV4ZWN1dGluZyA9IG5ldyBNYXA8c3RyaW5nLCBQcm9taXNlPFN1YmFnZW50UmVzdWx0Pj4oKTtcbiAgICBcbiAgICB3aGlsZSAoZXhlY3V0ZWQuc2l6ZSA8IGNvbnRleHQuYWdlbnRzLmxlbmd0aCkge1xuICAgICAgLy8g5qOA5p+l6LaF5pe2XG4gICAgICBpZiAoRGF0ZS5ub3coKSAtIHN0YXJ0VGltZSA+IHRpbWVvdXRNcykge1xuICAgICAgICBhd2FpdCB0aGlzLmVtaXRUZWFtRmFpbCh0ZWFtSWQsIFwiVGltZW91dFwiLCBmYWlsZWRUYXNrcyk7XG4gICAgICAgIGZhaWxUZWFtKGNvbnRleHQsIFwiVGltZW91dFwiKTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUZWFtIGV4ZWN1dGlvbiB0aW1lb3V0IGFmdGVyICR7dGltZW91dE1zfW1zYCk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIOiOt+WPluWPr+aJp+ihjOS7u+WKoe+8iOS+nei1luW3sua7oei2s++8iVxuICAgICAgY29uc3QgcmVhZHlUYXNrcyA9IGNvbnRleHQuYWdlbnRzLmZpbHRlcih0YXNrID0+XG4gICAgICAgIHRhc2suc3RhdHVzID09PSBcInF1ZXVlZFwiICYmXG4gICAgICAgICFleGVjdXRlZC5oYXModGFzay5pZCkgJiZcbiAgICAgICAgIWV4ZWN1dGluZy5oYXModGFzay5pZCkgJiZcbiAgICAgICAgdGhpcy5hcmVEZXBlbmRlbmNpZXNTYXRpc2ZpZWQodGFzaywgZXhlY3V0ZWQpXG4gICAgICApO1xuICAgICAgXG4gICAgICAvLyDlkK/liqjlj6/miafooYzku7vliqFcbiAgICAgIGZvciAoY29uc3QgdGFzayBvZiByZWFkeVRhc2tzKSB7XG4gICAgICAgIGNvbnN0IHByb21pc2UgPSB0aGlzLmV4ZWN1dGVUYXNrKHRhc2ssIGNvbnRleHQpXG4gICAgICAgICAgLnRoZW4ocmVzdWx0ID0+IHtcbiAgICAgICAgICAgIGV4ZWN1dGVkLmFkZCh0YXNrLmlkKTtcbiAgICAgICAgICAgIGV4ZWN1dGluZy5kZWxldGUodGFzay5pZCk7XG4gICAgICAgICAgICByZXN1bHRzLnB1c2gocmVzdWx0KTtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgfSlcbiAgICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgICAgZXhlY3V0ZWQuYWRkKHRhc2suaWQpO1xuICAgICAgICAgICAgZXhlY3V0aW5nLmRlbGV0ZSh0YXNrLmlkKTtcbiAgICAgICAgICAgIGZhaWxlZFRhc2tzLnB1c2godGFzay5pZCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChzdG9wT25FcnJvcikge1xuICAgICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBleGVjdXRpbmcuc2V0KHRhc2suaWQsIHByb21pc2UpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyDnrYnlvoXoh7PlsJHkuIDkuKrlrozmiJBcbiAgICAgIGlmIChleGVjdXRpbmcuc2l6ZSA+IDApIHtcbiAgICAgICAgYXdhaXQgUHJvbWlzZS5yYWNlKGV4ZWN1dGluZy52YWx1ZXMoKSk7XG4gICAgICB9IGVsc2UgaWYgKHJlYWR5VGFza3MubGVuZ3RoID09PSAwICYmIGV4ZWN1dGVkLnNpemUgPCBjb250ZXh0LmFnZW50cy5sZW5ndGgpIHtcbiAgICAgICAgLy8g5q276ZSB5qOA5rWLXG4gICAgICAgIGNvbnN0IHJlbWFpbmluZyA9IGNvbnRleHQuYWdlbnRzLmZpbHRlcih0ID0+ICFleGVjdXRlZC5oYXModC5pZCkpO1xuICAgICAgICBpZiAocmVtYWluaW5nLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBjb25zdCBlcnJvciA9IGBEZWFkbG9jayBkZXRlY3RlZDogJHtyZW1haW5pbmcubGVuZ3RofSB0YXNrcyBibG9ja2VkYDtcbiAgICAgICAgICBhd2FpdCB0aGlzLmVtaXRUZWFtRmFpbCh0ZWFtSWQsIGVycm9yLCByZW1haW5pbmcubWFwKHQgPT4gdC5pZCkpO1xuICAgICAgICAgIGZhaWxUZWFtKGNvbnRleHQsIGVycm9yKTtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOajgOafpeaYr+WQpuacieWksei0pVxuICAgIGlmIChmYWlsZWRUYXNrcy5sZW5ndGggPiAwICYmIHN0b3BPbkVycm9yKSB7XG4gICAgICBhd2FpdCB0aGlzLmVtaXRUZWFtRmFpbCh0ZWFtSWQsIGAke2ZhaWxlZFRhc2tzLmxlbmd0aH0gdGFza3MgZmFpbGVkYCwgZmFpbGVkVGFza3MpO1xuICAgICAgZmFpbFRlYW0oY29udGV4dCwgYCR7ZmFpbGVkVGFza3MubGVuZ3RofSB0YXNrcyBmYWlsZWRgKTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVGVhbSBleGVjdXRpb24gZmFpbGVkOiAke2ZhaWxlZFRhc2tzLmxlbmd0aH0gdGFza3NgKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDlvZLlubblpJrkuKrlrZDku6PnkIbnu5PmnpxcbiAgICovXG4gIGFzeW5jIG1lcmdlUmVzdWx0cyhyZXN1bHRzOiBTdWJhZ2VudFJlc3VsdFtdKTogUHJvbWlzZTxNZXJnZWRSZXN1bHQ+IHtcbiAgICAvLyDlkIjlubbkuJTku7ZcbiAgICBjb25zdCBhbGxBcnRpZmFjdHM6IEFydGlmYWN0UmVmW10gPSBbXTtcbiAgICBjb25zdCBhbGxQYXRjaGVzOiBQYXRjaFJlZltdID0gW107XG4gICAgY29uc3QgYWxsRmluZGluZ3M6IEZpbmRpbmdbXSA9IFtdO1xuICAgIGNvbnN0IGFsbEJsb2NrZXJzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IGFsbFJlY29tbWVuZGF0aW9uczogc3RyaW5nW10gPSBbXTtcbiAgICBcbiAgICBsZXQgdG90YWxDb25maWRlbmNlID0gMDtcbiAgICBsZXQgdmFsaWRSZXN1bHRzID0gMDtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiByZXN1bHRzKSB7XG4gICAgICBpZiAocmVzdWx0LmFydGlmYWN0cykgYWxsQXJ0aWZhY3RzLnB1c2goLi4ucmVzdWx0LmFydGlmYWN0cyk7XG4gICAgICBpZiAocmVzdWx0LnBhdGNoZXMpIGFsbFBhdGNoZXMucHVzaCguLi5yZXN1bHQucGF0Y2hlcyk7XG4gICAgICBpZiAocmVzdWx0LmZpbmRpbmdzKSBhbGxGaW5kaW5ncy5wdXNoKC4uLnJlc3VsdC5maW5kaW5ncyk7XG4gICAgICBpZiAocmVzdWx0LmJsb2NrZXJzKSBhbGxCbG9ja2Vycy5wdXNoKC4uLnJlc3VsdC5ibG9ja2Vycyk7XG4gICAgICBpZiAocmVzdWx0LnJlY29tbWVuZGF0aW9ucykgYWxsUmVjb21tZW5kYXRpb25zLnB1c2goLi4ucmVzdWx0LnJlY29tbWVuZGF0aW9ucyk7XG4gICAgICBcbiAgICAgIGlmIChyZXN1bHQuY29uZmlkZW5jZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRvdGFsQ29uZmlkZW5jZSArPSByZXN1bHQuY29uZmlkZW5jZTtcbiAgICAgICAgdmFsaWRSZXN1bHRzKys7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIOeUn+aIkOaRmOimgVxuICAgIGNvbnN0IHN1bW1hcnkgPSB0aGlzLmdlbmVyYXRlU3VtbWFyeShyZXN1bHRzKTtcbiAgICBcbiAgICAvLyDorqHnrpflubPlnYfnva7kv6HluqZcbiAgICBjb25zdCBjb25maWRlbmNlID0gdmFsaWRSZXN1bHRzID4gMCA/IHRvdGFsQ29uZmlkZW5jZSAvIHZhbGlkUmVzdWx0cyA6IDA7XG4gICAgXG4gICAgY29uc3QgbWVyZ2VkUmVzdWx0OiBNZXJnZWRSZXN1bHQgPSB7XG4gICAgICBzdW1tYXJ5LFxuICAgICAgYXJ0aWZhY3RzOiBhbGxBcnRpZmFjdHMsXG4gICAgICBwYXRjaGVzOiBhbGxQYXRjaGVzLFxuICAgICAgZmluZGluZ3M6IGFsbEZpbmRpbmdzLFxuICAgICAgY29uZmlkZW5jZSxcbiAgICAgIGJsb2NrZXJzOiBhbGxCbG9ja2VycyxcbiAgICAgIHJlY29tbWVuZGF0aW9uczogYWxsUmVjb21tZW5kYXRpb25zLFxuICAgIH07XG4gICAgXG4gICAgLy8g6Kem5Y+RIFRlYW1NZXJnZSBIb29rXG4gICAgYXdhaXQgdGhpcy5ob29rQnVzLmVtaXQoe1xuICAgICAgdHlwZTogXCJUZWFtTWVyZ2VcIixcbiAgICAgIHRlYW1JZDogcmVzdWx0c1swXT8udGVhbUlkIHx8IFwidW5rbm93blwiLFxuICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgICAgcmVzdWx0c0NvdW50OiByZXN1bHRzLmxlbmd0aCxcbiAgICAgIG1lcmdlZFN1bW1hcnk6IHN1bW1hcnksXG4gICAgfSBhcyBUZWFtTWVyZ2VFdmVudCk7XG4gICAgXG4gICAgcmV0dXJuIG1lcmdlZFJlc3VsdDtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOWPlua2iOWboumYn+aJp+ihjFxuICAgKi9cbiAgYXN5bmMgY2FuY2VsVGVhbSh0ZWFtSWQ6IHN0cmluZywgcmVhc29uPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgY29udGV4dCA9IHRoaXMudGVhbXMuZ2V0KHRlYW1JZCk7XG4gICAgaWYgKCFjb250ZXh0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFRlYW0gbm90IGZvdW5kOiAke3RlYW1JZH1gKTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgY2FuY2VsbGVkVGFza3M6IHN0cmluZ1tdID0gW107XG4gICAgXG4gICAgLy8g5Y+W5raI5omA5pyJ5rS76LeD5Lu75YqhXG4gICAgZm9yIChjb25zdCB0YXNrIG9mIGNvbnRleHQuYWdlbnRzKSB7XG4gICAgICBpZiAodGFzay5zdGF0dXMgPT09IFwicXVldWVkXCIgfHwgdGFzay5zdGF0dXMgPT09IFwicnVubmluZ1wiKSB7XG4gICAgICAgIHRhc2suc3RhdHVzID0gXCJjYW5jZWxsZWRcIjtcbiAgICAgICAgdGFzay5jb21wbGV0ZWRBdCA9IERhdGUubm93KCk7XG4gICAgICAgIHRhc2subGFzdEVycm9yID0gcmVhc29uO1xuICAgICAgICBjYW5jZWxsZWRUYXNrcy5wdXNoKHRhc2suaWQpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDmm7TmlrDlm6LpmJ/nirbmgIFcbiAgICBjYW5jZWxUZWFtKGNvbnRleHQsIHJlYXNvbik7XG4gICAgXG4gICAgLy8g6Kem5Y+RIFRlYW1DYW5jZWwgSG9va1xuICAgIGF3YWl0IHRoaXMuaG9va0J1cy5lbWl0KHtcbiAgICAgIHR5cGU6IFwiVGVhbUNhbmNlbFwiLFxuICAgICAgdGVhbUlkLFxuICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgICAgcmVhc29uOiByZWFzb24gfHwgXCJVc2VyIGNhbmNlbGxlZFwiLFxuICAgICAgY2FuY2VsbGVkVGFza3MsXG4gICAgfSBhcyBUZWFtQ2FuY2VsRXZlbnQpO1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W5Zui6Zif54q25oCBXG4gICAqL1xuICBhc3luYyBnZXRUZWFtU3RhdHVzKHRlYW1JZDogc3RyaW5nKTogUHJvbWlzZTxUZWFtQ29udGV4dD4ge1xuICAgIGNvbnN0IGNvbnRleHQgPSB0aGlzLnRlYW1zLmdldCh0ZWFtSWQpO1xuICAgIGlmICghY29udGV4dCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBUZWFtIG5vdCBmb3VuZDogJHt0ZWFtSWR9YCk7XG4gICAgfVxuICAgIHJldHVybiB7IC4uLmNvbnRleHQgfTtcbiAgfVxuICBcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAvLyDlhoXpg6jmlrnms5VcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICBcbiAgLyoqXG4gICAqIOaJp+ihjOWNleS4quS7u+WKoVxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBleGVjdXRlVGFzayhcbiAgICB0YXNrOiBTdWJhZ2VudFRhc2ssXG4gICAgY29udGV4dDogVGVhbUNvbnRleHRcbiAgKTogUHJvbWlzZTxTdWJhZ2VudFJlc3VsdD4ge1xuICAgIC8vIOabtOaWsOWFseS6q+eKtuaAgVxuICAgIGNvbnRleHQuc2hhcmVkU3RhdGUuY3VycmVudFRhc2sgPSB0YXNrLmlkO1xuICAgIFxuICAgIC8vIOaJp+ihjFxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucnVubmVyLnJ1bih0YXNrLCBjb250ZXh0KTtcbiAgICBcbiAgICAvLyDmm7TmlrDpooTnrpfkvb/nlKhcbiAgICBjb250ZXh0LnVzZWRCdWRnZXQudHVybnMgKz0gcmVzdWx0LnR1cm5zVXNlZDtcbiAgICBpZiAocmVzdWx0LnRva2Vuc1VzZWQpIHtcbiAgICAgIGNvbnRleHQudXNlZEJ1ZGdldC50b2tlbnMgKz0gcmVzdWx0LnRva2Vuc1VzZWQ7XG4gICAgfVxuICAgIGNvbnRleHQudXNlZEJ1ZGdldC5lbGFwc2VkTXMgKz0gcmVzdWx0LmR1cmF0aW9uTXM7XG4gICAgXG4gICAgLy8g5bCG57uT5p6c5re75Yqg5Yiw5YWx5Lqr54q25oCB77yI5L6b5ZCO57ut5Lu75Yqh5L2/55So77yJXG4gICAgY29udGV4dC5zaGFyZWRTdGF0ZVtgcmVzdWx0XyR7dGFzay5hZ2VudH1gXSA9IHJlc3VsdDtcbiAgICBcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIFxuICAvKipcbiAgICog5qOA5p+l5L6d6LWW5piv5ZCm5bey5ruh6LazXG4gICAqL1xuICBwcml2YXRlIGFyZURlcGVuZGVuY2llc1NhdGlzZmllZChcbiAgICB0YXNrOiBTdWJhZ2VudFRhc2ssXG4gICAgZXhlY3V0ZWQ6IFNldDxzdHJpbmc+XG4gICk6IGJvb2xlYW4ge1xuICAgIGlmICghdGFzay5kZXBlbmRzT24gfHwgdGFzay5kZXBlbmRzT24ubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHRhc2suZGVwZW5kc09uLmV2ZXJ5KGRlcElkID0+IGV4ZWN1dGVkLmhhcyhkZXBJZCkpO1xuICB9XG4gIFxuICAvKipcbiAgICog55Sf5oiQ5Zui6Zif5omn6KGM5pGY6KaBXG4gICAqL1xuICBwcml2YXRlIGdlbmVyYXRlU3VtbWFyeShyZXN1bHRzOiBTdWJhZ2VudFJlc3VsdFtdKTogc3RyaW5nIHtcbiAgICBpZiAocmVzdWx0cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBcIuaXoOaJp+ihjOe7k+aenFwiO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBzdW1tYXJpZXMgPSByZXN1bHRzLm1hcChyID0+IGAtIFske3IuYWdlbnR9XTogJHtyLnN1bW1hcnl9YCk7XG4gICAgcmV0dXJuIGDlm6LpmJ/miafooYzlrozmiJAgKCR7cmVzdWx0cy5sZW5ndGh9IOS4quWtkOS7u+WKoSk6XFxuJHtzdW1tYXJpZXMuam9pbihcIlxcblwiKX1gO1xuICB9XG4gIFxuICAvKipcbiAgICog55Sf5oiQ5ZSv5LiAIElEXG4gICAqL1xuICBwcml2YXRlIGdlbmVyYXRlSWQocHJlZml4OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBgJHtwcmVmaXh9XyR7RGF0ZS5ub3coKX1fJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyLCA4KX1gO1xuICB9XG4gIFxuICAvKipcbiAgICog6Kem5Y+RIFRlYW1GYWlsIEhvb2tcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZW1pdFRlYW1GYWlsKFxuICAgIHRlYW1JZDogc3RyaW5nLFxuICAgIHJlYXNvbjogc3RyaW5nLFxuICAgIGZhaWxlZFRhc2tzOiBzdHJpbmdbXVxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLmhvb2tCdXMuZW1pdCh7XG4gICAgICB0eXBlOiBcIlRlYW1GYWlsXCIsXG4gICAgICB0ZWFtSWQsXG4gICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICByZWFzb24sXG4gICAgICBmYWlsZWRUYXNrcyxcbiAgICB9IGFzIFRlYW1GYWlsRXZlbnQpO1xuICB9XG4gIFxuICAvKipcbiAgICog6Kem5Y+RIFRlYW1Db21wbGV0ZSBIb29rXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGVtaXRUZWFtQ29tcGxldGUoXG4gICAgdGVhbUlkOiBzdHJpbmcsXG4gICAgcmVzdWx0czogU3ViYWdlbnRSZXN1bHRbXSxcbiAgICBtZXJnZWRSZXN1bHQ6IE1lcmdlZFJlc3VsdFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjb250ZXh0ID0gdGhpcy50ZWFtcy5nZXQodGVhbUlkKTtcbiAgICBjb25zdCBkdXJhdGlvbiA9IGNvbnRleHQgPyBnZXRUZWFtRHVyYXRpb24oY29udGV4dCkgfHwgMCA6IDA7XG4gICAgXG4gICAgYXdhaXQgdGhpcy5ob29rQnVzLmVtaXQoe1xuICAgICAgdHlwZTogXCJUZWFtQ29tcGxldGVcIixcbiAgICAgIHRlYW1JZCxcbiAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICAgIHJlc3VsdHMsXG4gICAgICBtZXJnZWRSZXN1bHQsXG4gICAgICBkdXJhdGlvbk1zOiBkdXJhdGlvbixcbiAgICB9IGFzIFRlYW1Db21wbGV0ZUV2ZW50KTtcbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDlt6XljoLlh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDliJvlu7ogVGVhbU9yY2hlc3RyYXRvciDlrp7kvotcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVRlYW1PcmNoZXN0cmF0b3IoXG4gIHJ1bm5lcj86IElTdWJhZ2VudFJ1bm5lcixcbiAgaG9va0J1cz86IElIb29rQnVzXG4pOiBJVGVhbU9yY2hlc3RyYXRvciB7XG4gIHJldHVybiBuZXcgVGVhbU9yY2hlc3RyYXRvcihydW5uZXIsIGhvb2tCdXMpO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDkvr/mjbflh73mlbDvvJrnq6/liLDnq6/miafooYxcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDliJvlu7rlubbmiafooYzlm6LpmJ/vvIjkvr/mjbflh73mlbDvvIlcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1blRlYW0oXG4gIHBhcmFtczogQ3JlYXRlVGVhbVBhcmFtcyxcbiAgcnVubmVyPzogSVN1YmFnZW50UnVubmVyLFxuICBob29rQnVzPzogSUhvb2tCdXNcbik6IFByb21pc2U8e1xuICBjb250ZXh0OiBUZWFtQ29udGV4dDtcbiAgcmVzdWx0czogU3ViYWdlbnRSZXN1bHRbXTtcbiAgbWVyZ2VkOiBNZXJnZWRSZXN1bHQ7XG59PiB7XG4gIGNvbnN0IG9yY2hlc3RyYXRvciA9IGNyZWF0ZVRlYW1PcmNoZXN0cmF0b3IocnVubmVyLCBob29rQnVzKTtcbiAgXG4gIC8vIOWIm+W7uuWboumYn1xuICBjb25zdCBjb250ZXh0ID0gYXdhaXQgb3JjaGVzdHJhdG9yLmNyZWF0ZVRlYW0ocGFyYW1zKTtcbiAgXG4gIC8vIOetieW+heWujOaIkFxuICBjb25zdCByZXN1bHRzID0gYXdhaXQgb3JjaGVzdHJhdG9yLndhaXRGb3JDb21wbGV0aW9uKGNvbnRleHQudGVhbUlkKTtcbiAgXG4gIC8vIOW9kuW5tue7k+aenFxuICBjb25zdCBtZXJnZWQgPSBhd2FpdCBvcmNoZXN0cmF0b3IubWVyZ2VSZXN1bHRzKHJlc3VsdHMpO1xuICBcbiAgLy8g5pu05paw5Zui6Zif54q25oCBXG4gIGNvbnN0IGZpbmFsQ29udGV4dCA9IGF3YWl0IG9yY2hlc3RyYXRvci5nZXRUZWFtU3RhdHVzKGNvbnRleHQudGVhbUlkKTtcbiAgY29tcGxldGVUZWFtKGZpbmFsQ29udGV4dCk7XG4gIFxuICAvLyDop6blj5HlrozmiJAgSG9va1xuICBhd2FpdCBob29rQnVzPy5lbWl0KHtcbiAgICB0eXBlOiBcIlRlYW1Db21wbGV0ZVwiLFxuICAgIHRlYW1JZDogY29udGV4dC50ZWFtSWQsXG4gICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgIHJlc3VsdHMsXG4gICAgbWVyZ2VkUmVzdWx0OiBtZXJnZWQsXG4gICAgZHVyYXRpb25NczogZ2V0VGVhbUR1cmF0aW9uKGZpbmFsQ29udGV4dCkgfHwgMCxcbiAgfSBhcyBUZWFtQ29tcGxldGVFdmVudCk7XG4gIFxuICByZXR1cm4geyBjb250ZXh0OiBmaW5hbENvbnRleHQsIHJlc3VsdHMsIG1lcmdlZCB9O1xufVxuIl19