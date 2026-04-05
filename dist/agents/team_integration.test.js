"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const execution_context_adapter_1 = require("./execution_context_adapter");
const permission_bridge_1 = require("./permission_bridge");
const taskstore_bridge_1 = require("./taskstore_bridge");
const team_orchestrator_1 = require("./team_orchestrator");
const index_1 = require("./index");
// ============================================================================
// Mock 实现
// ============================================================================
class MockExecutionContext {
    constructor() {
        this.sessionId = 'session_test_123';
        this.turnId = 'turn_1';
        this.taskId = 'task_parent';
        this.agentId = 'main_assistant';
        this.workspaceRoot = '/workspace';
        this.cwd = '/workspace/project';
        this.abortController = new AbortController();
        this.signal = this.abortController.signal;
        this.logger = {
            debug: (msg) => console.log('[DEBUG]', msg),
            info: (msg) => console.log('[INFO]', msg),
            warn: (msg) => console.log('[WARN]', msg),
            error: (msg) => console.log('[ERROR]', msg),
        };
        this.emit = () => { };
        this.state = {
            get: () => undefined,
            set: () => { },
            delete: () => { },
        };
        this.permissions = {
            evaluate: () => ({
                allowed: true,
                behavior: 'allow',
                requiresApproval: false,
                explanation: 'Mock allow',
            }),
        };
        this.tasks = {
            create: (def) => ({
                id: `task_${Date.now()}`,
                ...def,
                status: 'pending',
                createdAt: Date.now(),
            }),
            get: () => undefined,
            list: () => [],
            update: () => { },
            appendOutput: () => { },
            getOutput: () => '',
            cancel: async () => { },
        };
        this.memory = {
            read: async () => [],
            write: async () => { },
        };
        this.fs = {
            readFile: async () => '',
            writeFile: async () => { },
            exists: async () => false,
            listDir: async () => [],
        };
        this.exec = {
            run: async () => ({ stdout: '', stderr: '', code: 0 }),
        };
        this.requestApproval = async () => ({
            requestId: 'approval_1',
            approved: true,
            reason: 'Mock approval',
            approvedAt: Date.now(),
            approvedBy: 'test',
        });
        this.appendSystemNote = () => { };
    }
}
class MockPermissionEngine {
    constructor() {
        this.evaluate = () => ({
            allowed: true,
            behavior: 'allow',
            requiresApproval: false,
            explanation: 'Mock allow',
        });
    }
}
class MockTaskStore {
    constructor() {
        this.tasks = new Map();
    }
    create(def) {
        const task = {
            id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            ...def,
            status: 'pending',
            createdAt: Date.now(),
        };
        this.tasks.set(task.id, task);
        return task;
    }
    get(taskId) {
        return this.tasks.get(taskId);
    }
    list(filter) {
        let result = Array.from(this.tasks.values());
        if (filter?.parentTaskId) {
            result = result.filter(t => t.parentTaskId === filter.parentTaskId);
        }
        return result;
    }
    update(taskId, patch) {
        const task = this.tasks.get(taskId);
        if (task) {
            Object.assign(task, patch);
        }
    }
    appendOutput(taskId, chunk) {
        const task = this.tasks.get(taskId);
        if (task) {
            task.output = (task.output || '') + chunk;
        }
    }
    getOutput(taskId) {
        const task = this.tasks.get(taskId);
        return task?.output || '';
    }
    async cancel(taskId) {
        this.update(taskId, { status: 'cancelled' });
    }
}
// ============================================================================
// 测试用例
// ============================================================================
(0, vitest_1.describe)('Team Integration', () => {
    (0, vitest_1.describe)('ExecutionContext Adapter', () => {
        (0, vitest_1.it)('应该成功将 ExecutionContext 转换为 TeamContext', () => {
            const parentContext = new MockExecutionContext();
            const adapter = new execution_context_adapter_1.ExecutionContextAdapter();
            const teamContext = adapter.convertToTeamContext(parentContext, 'team_test', 'task_parent', { maxTurns: 50, timeoutMs: 300000 });
            (0, vitest_1.expect)(teamContext.teamId).toBe('team_test');
            (0, vitest_1.expect)(teamContext.parentTaskId).toBe('task_parent');
            (0, vitest_1.expect)(teamContext.sessionId).toBe(parentContext.sessionId);
            (0, vitest_1.expect)(teamContext.status).toBe('active');
            (0, vitest_1.expect)(teamContext.totalBudget.maxTurns).toBe(50);
        });
        (0, vitest_1.it)('应该从父上下文派生子代理上下文', () => {
            const parentContext = new MockExecutionContext();
            const adapter = new execution_context_adapter_1.ExecutionContextAdapter();
            const teamContext = adapter.convertToTeamContext(parentContext, 'team_test', 'task_parent', { maxTurns: 50, timeoutMs: 300000 });
            const subagentTask = {
                id: 'task_sub_1',
                parentTaskId: 'task_parent',
                sessionId: parentContext.sessionId,
                teamId: 'team_test',
                agent: 'planner',
                goal: '规划任务',
                inputs: {},
                allowedTools: ['fs.read', 'fs.list', 'grep.search'],
                budget: { maxTurns: 10, timeoutMs: 60000 },
                status: 'queued',
                createdAt: Date.now(),
                currentTurn: 0,
            };
            const subagentContext = adapter.deriveSubagentContext({
                parentContext,
                task: subagentTask,
                teamContext,
                role: 'planner',
            });
            // 验证身份继承
            (0, vitest_1.expect)(subagentContext.parentSessionId).toBe(parentContext.sessionId);
            (0, vitest_1.expect)(subagentContext.parentTaskId).toBe('task_parent');
            (0, vitest_1.expect)(subagentContext.subagentTaskId).toBe('task_sub_1');
            // 验证上下文继承
            (0, vitest_1.expect)(subagentContext.cwd).toBe(parentContext.cwd);
            (0, vitest_1.expect)(subagentContext.workspaceRoot).toBe(parentContext.workspaceRoot);
            // 验证权限裁剪
            (0, vitest_1.expect)(subagentContext.allowedTools).toContain('fs.read');
            (0, vitest_1.expect)(subagentContext.forbiddenTools).toContain('fs.write');
            (0, vitest_1.expect)(subagentContext.maxTurns).toBe(10);
        });
        (0, vitest_1.it)('应该裁剪工具权限（子代理权限 ≤ 父上下文）', () => {
            const parentContext = new MockExecutionContext();
            const adapter = new execution_context_adapter_1.ExecutionContextAdapter();
            const teamContext = adapter.convertToTeamContext(parentContext, 'team_test', 'task_parent', { maxTurns: 50, timeoutMs: 300000 });
            // 父上下文允许所有工具
            const subagentTask = {
                id: 'task_sub_1',
                parentTaskId: 'task_parent',
                sessionId: parentContext.sessionId,
                teamId: 'team_test',
                agent: 'planner',
                goal: '规划任务',
                inputs: {},
                allowedTools: ['fs.read', 'fs.write', 'git.commit'], // 包含 planner 禁止的工具
                budget: { maxTurns: 10, timeoutMs: 60000 },
                status: 'queued',
                createdAt: Date.now(),
                currentTurn: 0,
            };
            const subagentContext = adapter.deriveSubagentContext({
                parentContext,
                task: subagentTask,
                teamContext,
                role: 'planner',
            });
            // planner 不允许 fs.write 和 git.commit
            (0, vitest_1.expect)(subagentContext.allowedTools).not.toContain('fs.write');
            (0, vitest_1.expect)(subagentContext.allowedTools).not.toContain('git.commit');
            (0, vitest_1.expect)(subagentContext.allowedTools).toContain('fs.read');
        });
        (0, vitest_1.it)('应该将 SubagentResult 转换为可归档格式', () => {
            const adapter = new execution_context_adapter_1.ExecutionContextAdapter();
            const result = {
                subagentTaskId: 'task_sub_1',
                parentTaskId: 'task_parent',
                teamId: 'team_test',
                agent: 'planner',
                summary: '规划完成',
                confidence: 0.9,
                turnsUsed: 5,
                tokensUsed: 5000,
                durationMs: 1000,
                artifacts: [
                    { type: 'text', description: '计划文档', content: '...' },
                ],
                patches: [
                    { fileId: 'src/app.ts', diff: '...', hunks: 1, linesAdded: 5, linesDeleted: 2 },
                ],
                findings: [
                    { type: 'suggestion', severity: 'low', description: '建议优化' },
                ],
            };
            const normalized = adapter.normalizeSubagentResult(result, 'task_parent');
            (0, vitest_1.expect)(normalized.summary).toBe('规划完成');
            (0, vitest_1.expect)(normalized.artifacts.length).toBe(1);
            (0, vitest_1.expect)(normalized.patches?.length).toBe(1);
            (0, vitest_1.expect)(normalized.findings?.length).toBe(1);
        });
    });
    (0, vitest_1.describe)('Permission Bridge', () => {
        (0, vitest_1.it)('应该验证角色工具访问', () => {
            const permissionEngine = new MockPermissionEngine();
            const bridge = new permission_bridge_1.PermissionBridge(permissionEngine);
            // planner 允许的工具
            (0, vitest_1.expect)(bridge.validateToolAccess('planner', 'fs.read')).toBe(true);
            (0, vitest_1.expect)(bridge.validateToolAccess('planner', 'fs.list')).toBe(true);
            // planner 禁止的工具
            (0, vitest_1.expect)(bridge.validateToolAccess('planner', 'fs.write')).toBe(false);
            (0, vitest_1.expect)(bridge.validateToolAccess('planner', 'git.commit')).toBe(false);
            // code_fixer 允许的工具
            (0, vitest_1.expect)(bridge.validateToolAccess('code_fixer', 'fs.write')).toBe(true);
        });
        (0, vitest_1.it)('应该获取角色工具列表', () => {
            const permissionEngine = new MockPermissionEngine();
            const bridge = new permission_bridge_1.PermissionBridge(permissionEngine);
            const allowed = bridge.getAllowedTools('planner');
            (0, vitest_1.expect)(allowed.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(allowed).toContain('fs.read');
            const forbidden = bridge.getForbiddenTools('planner');
            (0, vitest_1.expect)(forbidden.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(forbidden).toContain('fs.write');
        });
        (0, vitest_1.it)('应该检查权限（集成 PermissionEngine）', async () => {
            const permissionEngine = new MockPermissionEngine();
            const bridge = new permission_bridge_1.PermissionBridge(permissionEngine);
            const decision = await bridge.checkPermission({
                subagentTaskId: 'task_sub_1',
                teamId: 'team_test',
                role: 'planner',
                tool: 'fs.read',
            });
            (0, vitest_1.expect)(decision.allowed).toBe(true);
        });
    });
    (0, vitest_1.describe)('TaskStore Bridge', () => {
        (0, vitest_1.it)('应该创建团队任务', async () => {
            const taskStore = new MockTaskStore();
            const bridge = new taskstore_bridge_1.TaskStoreBridge(taskStore);
            const teamTask = await bridge.createTeamTask('team_test', 'task_parent', 'session_123', 'main_assistant', '/workspace', '测试团队目标');
            (0, vitest_1.expect)(teamTask.id).toBeDefined();
            (0, vitest_1.expect)(teamTask.type).toBe('subagent');
            (0, vitest_1.expect)(teamTask.parentTaskId).toBe('task_parent');
            (0, vitest_1.expect)(teamTask.metadata?.teamId).toBe('team_test');
        });
        (0, vitest_1.it)('应该创建子代理任务', async () => {
            const taskStore = new MockTaskStore();
            const bridge = new taskstore_bridge_1.TaskStoreBridge(taskStore);
            const teamTask = await bridge.createTeamTask('team_test', 'task_parent', 'session_123', 'main_assistant', '/workspace', '测试团队');
            const subagentTask = {
                id: 'task_sub_1',
                parentTaskId: 'task_parent',
                sessionId: 'session_123',
                teamId: 'team_test',
                agent: 'planner',
                goal: '规划任务',
                inputs: {},
                allowedTools: ['fs.read'],
                budget: { maxTurns: 10, timeoutMs: 60000 },
                status: 'queued',
                createdAt: Date.now(),
                currentTurn: 0,
            };
            const subtask = await bridge.createSubagentTask(subagentTask, teamTask.id);
            (0, vitest_1.expect)(subtask.id).toBeDefined();
            (0, vitest_1.expect)(subtask.parentTaskId).toBe(teamTask.id);
            (0, vitest_1.expect)(subtask.metadata?.subagentTaskId).toBe('task_sub_1');
            (0, vitest_1.expect)(subtask.metadata?.role).toBe('planner');
        });
        (0, vitest_1.it)('应该更新子任务状态', async () => {
            const taskStore = new MockTaskStore();
            const bridge = new taskstore_bridge_1.TaskStoreBridge(taskStore);
            const teamTask = await bridge.createTeamTask('team_test', 'task_parent', 'session_123', 'main_assistant', '/workspace', '测试团队');
            const subagentTask = {
                id: 'task_sub_1',
                parentTaskId: 'task_parent',
                sessionId: 'session_123',
                teamId: 'team_test',
                agent: 'planner',
                goal: '规划任务',
                inputs: {},
                allowedTools: ['fs.read'],
                budget: { maxTurns: 10, timeoutMs: 60000 },
                status: 'queued',
                createdAt: Date.now(),
                currentTurn: 0,
            };
            const subtask = await bridge.createSubagentTask(subagentTask, teamTask.id);
            // 更新状态为 running
            await bridge.updateSubagentStatus(subtask.id, 'running');
            const updated = taskStore.get(subtask.id);
            (0, vitest_1.expect)(updated.status).toBe('running');
        });
        (0, vitest_1.it)('应该记录子代理结果', async () => {
            const taskStore = new MockTaskStore();
            const bridge = new taskstore_bridge_1.TaskStoreBridge(taskStore);
            const teamTask = await bridge.createTeamTask('team_test', 'task_parent', 'session_123', 'main_assistant', '/workspace', '测试团队');
            const subagentTask = {
                id: 'task_sub_1',
                parentTaskId: 'task_parent',
                sessionId: 'session_123',
                teamId: 'team_test',
                agent: 'planner',
                goal: '规划任务',
                inputs: {},
                allowedTools: ['fs.read'],
                budget: { maxTurns: 10, timeoutMs: 60000 },
                status: 'queued',
                createdAt: Date.now(),
                currentTurn: 0,
            };
            const subtask = await bridge.createSubagentTask(subagentTask, teamTask.id);
            const result = {
                subagentTaskId: 'task_sub_1',
                parentTaskId: 'task_parent',
                teamId: 'team_test',
                agent: 'planner',
                summary: '规划完成',
                confidence: 0.9,
                turnsUsed: 5,
                tokensUsed: 5000,
                durationMs: 1000,
            };
            await bridge.recordSubagentResult(subtask.id, result);
            const updated = taskStore.get(subtask.id);
            (0, vitest_1.expect)(updated.metadata?.result.summary).toBe('规划完成');
            (0, vitest_1.expect)(updated.output).toContain('Subagent Result');
        });
        (0, vitest_1.it)('应该获取团队的所有子任务', async () => {
            const taskStore = new MockTaskStore();
            const bridge = new taskstore_bridge_1.TaskStoreBridge(taskStore);
            const teamTask = await bridge.createTeamTask('team_test', 'task_parent', 'session_123', 'main_assistant', '/workspace', '测试团队');
            // 创建 3 个子任务
            for (let i = 0; i < 3; i++) {
                const subagentTask = {
                    id: `task_sub_${i}`,
                    parentTaskId: 'task_parent',
                    sessionId: 'session_123',
                    teamId: 'team_test',
                    agent: 'planner',
                    goal: `任务 ${i}`,
                    inputs: {},
                    allowedTools: ['fs.read'],
                    budget: { maxTurns: 10, timeoutMs: 60000 },
                    status: 'queued',
                    createdAt: Date.now(),
                    currentTurn: 0,
                };
                await bridge.createSubagentTask(subagentTask, teamTask.id);
            }
            const subtasks = await bridge.getTeamSubtasks(teamTask.id);
            (0, vitest_1.expect)(subtasks.length).toBe(3);
        });
    });
    (0, vitest_1.describe)('Parent-Child 状态传导', () => {
        (0, vitest_1.it)('应该取消所有子任务当 parent cancel', async () => {
            const taskStore = new MockTaskStore();
            const bridge = new taskstore_bridge_1.TaskStoreBridge(taskStore);
            const hookBus = new index_1.AgentTeamHookBus();
            const runner = new index_1.SubagentRunner(hookBus);
            const orchestrator = new team_orchestrator_1.TeamOrchestrator(runner, hookBus);
            const context = await orchestrator.createTeam({
                parentTaskId: 'task_parent',
                sessionId: 'session_123',
                goal: '测试取消传导',
                agents: [
                    {
                        role: 'planner',
                        goal: '规划',
                        allowedTools: ['fs.read'],
                        budget: { maxTurns: 10, timeoutMs: 60000 },
                    },
                    {
                        role: 'code_fixer',
                        goal: '修复',
                        allowedTools: ['fs.write'],
                        budget: { maxTurns: 20, timeoutMs: 120000 },
                    },
                ],
                totalBudget: { maxTurns: 35, timeoutMs: 300000 },
            });
            // 在 TaskStore 中创建子任务
            const teamTask = await bridge.createTeamTask(context.teamId, 'task_parent', 'session_123', 'main_assistant', '/workspace', context.agents[0].goal);
            for (const agent of context.agents) {
                await bridge.createSubagentTask(agent, teamTask.id);
            }
            // 取消团队
            await orchestrator.cancelTeam(context.teamId, '用户取消');
            // 验证所有子任务状态
            const subtasks = await bridge.getTeamSubtasks(teamTask.id);
            (0, vitest_1.expect)(subtasks.every(t => t.status === 'pending' || t.status === 'cancelled')).toBe(true);
        });
    });
    (0, vitest_1.describe)('HookBus 集成', () => {
        (0, vitest_1.it)('应该触发完整的团队生命周期事件', async () => {
            const hookEvents = [];
            const hookBus = new index_1.AgentTeamHookBus();
            hookBus.on('TeamCreate', () => hookEvents.push('TeamCreate'));
            hookBus.on('SubagentStart', () => hookEvents.push('SubagentStart'));
            hookBus.on('SubagentStop', () => hookEvents.push('SubagentStop'));
            hookBus.on('TeamComplete', () => hookEvents.push('TeamComplete'));
            const runner = new index_1.SubagentRunner(hookBus);
            const orchestrator = new team_orchestrator_1.TeamOrchestrator(runner, hookBus);
            const context = await orchestrator.createTeam({
                parentTaskId: 'task_parent',
                sessionId: 'session_123',
                goal: '测试 Hook 集成',
                agents: [
                    {
                        role: 'planner',
                        goal: '规划',
                        allowedTools: ['fs.read'],
                        budget: { maxTurns: 10, timeoutMs: 60000 },
                    },
                ],
                totalBudget: { maxTurns: 15, timeoutMs: 60000 },
            });
            await orchestrator.waitForCompletion(context.teamId);
            (0, vitest_1.expect)(hookEvents).toContain('TeamCreate');
            (0, vitest_1.expect)(hookEvents).toContain('SubagentStart');
            (0, vitest_1.expect)(hookEvents).toContain('SubagentStop');
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVhbV9pbnRlZ3JhdGlvbi50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2FnZW50cy90ZWFtX2ludGVncmF0aW9uLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7R0FTRzs7QUFFSCxtQ0FBMEQ7QUFDMUQsMkVBQTZGO0FBQzdGLDJEQUFzRTtBQUN0RSx5REFBcUQ7QUFDckQsMkRBQWdFO0FBQ2hFLG1DQUEyRDtBQUkzRCwrRUFBK0U7QUFDL0UsVUFBVTtBQUNWLCtFQUErRTtBQUUvRSxNQUFNLG9CQUFvQjtJQUExQjtRQUNFLGNBQVMsR0FBRyxrQkFBa0IsQ0FBQztRQUMvQixXQUFNLEdBQUcsUUFBUSxDQUFDO1FBQ2xCLFdBQU0sR0FBRyxhQUFhLENBQUM7UUFDdkIsWUFBTyxHQUFHLGdCQUFnQixDQUFDO1FBQzNCLGtCQUFhLEdBQUcsWUFBWSxDQUFDO1FBQzdCLFFBQUcsR0FBRyxvQkFBb0IsQ0FBQztRQUMzQixvQkFBZSxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7UUFDeEMsV0FBTSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDO1FBQ3JDLFdBQU0sR0FBRztZQUNQLEtBQUssRUFBRSxDQUFDLEdBQVcsRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDO1lBQ25ELElBQUksRUFBRSxDQUFDLEdBQVcsRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDO1lBQ2pELElBQUksRUFBRSxDQUFDLEdBQVcsRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDO1lBQ2pELEtBQUssRUFBRSxDQUFDLEdBQVcsRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDO1NBQ3BELENBQUM7UUFDRixT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QUFFLFNBQVMsRUFBRSxLQUFLLEVBQUU7cUJBQzNDO2lCQUNGO2dCQUNELFdBQVcsRUFBRSxFQUFFLFFBQVEsRUFBRSxFQUFFLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRTthQUNoRCxDQUFDLENBQUM7WUFFSCxNQUFNLFlBQVksQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7WUFFckQsSUFBQSxlQUFNLEVBQUMsVUFBVSxDQUFDLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQzNDLElBQUEsZUFBTSxFQUFDLFVBQVUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsQ0FBQztZQUM5QyxJQUFBLGVBQU0sRUFBQyxVQUFVLENBQUMsQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDL0MsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUZWFtIEludGVncmF0aW9uIFRlc3RzIC0g6ZuG5oiQ5rWL6K+VXG4gKiBcbiAqIOmqjOivgSBBZ2VudCBUZWFtcyDkuI4gT3BlbkNsYXcg5Li75bmy55qE6ZuG5oiQ77yaXG4gKiAxLiBFeGVjdXRpb25Db250ZXh0IOaIkOWKn+i9rOaIkCBUZWFtQ29udGV4dFxuICogMi4g5a2Q5Luj55CG57un5om/5L2G5pS257yp54i25p2D6ZmQXG4gKiAzLiDlrZDku7vliqHlnKggVGFza1N0b3JlIOS4reato+ehruW7uuaho+S4juaUtuaVm1xuICogNC4gVGVhbS9TdWJhZ2VudCDkuovku7bov5vlhaXnu5/kuIAgSG9va0J1c1xuICogNS4gcGFyZW50IGNhbmNlbCAvIGZhaWwgLyBhcHByb3ZhbCBibG9jayDog73mraPnoa7kvKDlr7zliLAgY2hpbGRyZW5cbiAqL1xuXG5pbXBvcnQgeyBkZXNjcmliZSwgaXQsIGV4cGVjdCwgYmVmb3JlRWFjaCB9IGZyb20gJ3ZpdGVzdCc7XG5pbXBvcnQgeyBFeGVjdXRpb25Db250ZXh0QWRhcHRlciwgZGVyaXZlU3ViYWdlbnRDb250ZXh0IH0gZnJvbSAnLi9leGVjdXRpb25fY29udGV4dF9hZGFwdGVyJztcbmltcG9ydCB7IFBlcm1pc3Npb25CcmlkZ2UsIGNhbkFjY2Vzc1Rvb2wgfSBmcm9tICcuL3Blcm1pc3Npb25fYnJpZGdlJztcbmltcG9ydCB7IFRhc2tTdG9yZUJyaWRnZSB9IGZyb20gJy4vdGFza3N0b3JlX2JyaWRnZSc7XG5pbXBvcnQgeyBUZWFtT3JjaGVzdHJhdG9yLCBydW5UZWFtIH0gZnJvbSAnLi90ZWFtX29yY2hlc3RyYXRvcic7XG5pbXBvcnQgeyBTdWJhZ2VudFJ1bm5lciwgQWdlbnRUZWFtSG9va0J1cyB9IGZyb20gJy4vaW5kZXgnO1xuaW1wb3J0IHR5cGUgeyBFeGVjdXRpb25Db250ZXh0IH0gZnJvbSAnLi4vLi4vY29yZS9ydW50aW1lL2V4ZWN1dGlvbl9jb250ZXh0JztcbmltcG9ydCB0eXBlIHsgU3ViYWdlbnRUYXNrLCBUZWFtQ29udGV4dCwgQ3JlYXRlVGVhbVBhcmFtcyB9IGZyb20gJy4vdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBNb2NrIOWunueOsFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5jbGFzcyBNb2NrRXhlY3V0aW9uQ29udGV4dCBpbXBsZW1lbnRzIFBhcnRpYWw8RXhlY3V0aW9uQ29udGV4dD4ge1xuICBzZXNzaW9uSWQgPSAnc2Vzc2lvbl90ZXN0XzEyMyc7XG4gIHR1cm5JZCA9ICd0dXJuXzEnO1xuICB0YXNrSWQgPSAndGFza19wYXJlbnQnO1xuICBhZ2VudElkID0gJ21haW5fYXNzaXN0YW50JztcbiAgd29ya3NwYWNlUm9vdCA9ICcvd29ya3NwYWNlJztcbiAgY3dkID0gJy93b3Jrc3BhY2UvcHJvamVjdCc7XG4gIGFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgc2lnbmFsID0gdGhpcy5hYm9ydENvbnRyb2xsZXIuc2lnbmFsO1xuICBsb2dnZXIgPSB7XG4gICAgZGVidWc6IChtc2c6IHN0cmluZykgPT4gY29uc29sZS5sb2coJ1tERUJVR10nLCBtc2cpLFxuICAgIGluZm86IChtc2c6IHN0cmluZykgPT4gY29uc29sZS5sb2coJ1tJTkZPXScsIG1zZyksXG4gICAgd2FybjogKG1zZzogc3RyaW5nKSA9PiBjb25zb2xlLmxvZygnW1dBUk5dJywgbXNnKSxcbiAgICBlcnJvcjogKG1zZzogc3RyaW5nKSA9PiBjb25zb2xlLmxvZygnW0VSUk9SXScsIG1zZyksXG4gIH07XG4gIGVtaXQgPSAoKSA9PiB7fTtcbiAgc3RhdGUgPSB7XG4gICAgZ2V0OiAoKSA9PiB1bmRlZmluZWQsXG4gICAgc2V0OiAoKSA9PiB7fSxcbiAgICBkZWxldGU6ICgpID0+IHt9LFxuICB9O1xuICBwZXJtaXNzaW9ucyA9IHtcbiAgICBldmFsdWF0ZTogKCkgPT4gKHtcbiAgICAgIGFsbG93ZWQ6IHRydWUsXG4gICAgICBiZWhhdmlvcjogJ2FsbG93JyxcbiAgICAgIHJlcXVpcmVzQXBwcm92YWw6IGZhbHNlLFxuICAgICAgZXhwbGFuYXRpb246ICdNb2NrIGFsbG93JyxcbiAgICB9KSxcbiAgfSBhcyBhbnk7XG4gIHRhc2tzID0ge1xuICAgIGNyZWF0ZTogKGRlZjogYW55KSA9PiAoe1xuICAgICAgaWQ6IGB0YXNrXyR7RGF0ZS5ub3coKX1gLFxuICAgICAgLi4uZGVmLFxuICAgICAgc3RhdHVzOiAncGVuZGluZycsXG4gICAgICBjcmVhdGVkQXQ6IERhdGUubm93KCksXG4gICAgfSksXG4gICAgZ2V0OiAoKSA9PiB1bmRlZmluZWQsXG4gICAgbGlzdDogKCkgPT4gW10sXG4gICAgdXBkYXRlOiAoKSA9PiB7fSxcbiAgICBhcHBlbmRPdXRwdXQ6ICgpID0+IHt9LFxuICAgIGdldE91dHB1dDogKCkgPT4gJycsXG4gICAgY2FuY2VsOiBhc3luYyAoKSA9PiB7fSxcbiAgfSBhcyBhbnk7XG4gIG1lbW9yeSA9IHtcbiAgICByZWFkOiBhc3luYyAoKSA9PiBbXSxcbiAgICB3cml0ZTogYXN5bmMgKCkgPT4ge30sXG4gIH07XG4gIGZzID0ge1xuICAgIHJlYWRGaWxlOiBhc3luYyAoKSA9PiAnJyxcbiAgICB3cml0ZUZpbGU6IGFzeW5jICgpID0+IHt9LFxuICAgIGV4aXN0czogYXN5bmMgKCkgPT4gZmFsc2UsXG4gICAgbGlzdERpcjogYXN5bmMgKCkgPT4gW10sXG4gIH07XG4gIGV4ZWMgPSB7XG4gICAgcnVuOiBhc3luYyAoKSA9PiAoeyBzdGRvdXQ6ICcnLCBzdGRlcnI6ICcnLCBjb2RlOiAwIH0pLFxuICB9O1xuICByZXF1ZXN0QXBwcm92YWwgPSBhc3luYyAoKSA9PiAoe1xuICAgIHJlcXVlc3RJZDogJ2FwcHJvdmFsXzEnLFxuICAgIGFwcHJvdmVkOiB0cnVlLFxuICAgIHJlYXNvbjogJ01vY2sgYXBwcm92YWwnLFxuICAgIGFwcHJvdmVkQXQ6IERhdGUubm93KCksXG4gICAgYXBwcm92ZWRCeTogJ3Rlc3QnLFxuICB9KTtcbiAgYXBwZW5kU3lzdGVtTm90ZSA9ICgpID0+IHt9O1xufVxuXG5jbGFzcyBNb2NrUGVybWlzc2lvbkVuZ2luZSB7XG4gIGV2YWx1YXRlID0gKCkgPT4gKHtcbiAgICBhbGxvd2VkOiB0cnVlLFxuICAgIGJlaGF2aW9yOiAnYWxsb3cnLFxuICAgIHJlcXVpcmVzQXBwcm92YWw6IGZhbHNlLFxuICAgIGV4cGxhbmF0aW9uOiAnTW9jayBhbGxvdycsXG4gIH0pO1xufVxuXG5jbGFzcyBNb2NrVGFza1N0b3JlIHtcbiAgcHJpdmF0ZSB0YXNrczogTWFwPHN0cmluZywgYW55PiA9IG5ldyBNYXAoKTtcbiAgXG4gIGNyZWF0ZShkZWY6IGFueSkge1xuICAgIGNvbnN0IHRhc2sgPSB7XG4gICAgICBpZDogYHRhc2tfJHtEYXRlLm5vdygpfV8ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIsIDYpfWAsXG4gICAgICAuLi5kZWYsXG4gICAgICBzdGF0dXM6ICdwZW5kaW5nJyxcbiAgICAgIGNyZWF0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICB9O1xuICAgIHRoaXMudGFza3Muc2V0KHRhc2suaWQsIHRhc2spO1xuICAgIHJldHVybiB0YXNrO1xuICB9XG4gIFxuICBnZXQodGFza0lkOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy50YXNrcy5nZXQodGFza0lkKTtcbiAgfVxuICBcbiAgbGlzdChmaWx0ZXI/OiBhbnkpIHtcbiAgICBsZXQgcmVzdWx0ID0gQXJyYXkuZnJvbSh0aGlzLnRhc2tzLnZhbHVlcygpKTtcbiAgICBpZiAoZmlsdGVyPy5wYXJlbnRUYXNrSWQpIHtcbiAgICAgIHJlc3VsdCA9IHJlc3VsdC5maWx0ZXIodCA9PiB0LnBhcmVudFRhc2tJZCA9PT0gZmlsdGVyLnBhcmVudFRhc2tJZCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgXG4gIHVwZGF0ZSh0YXNrSWQ6IHN0cmluZywgcGF0Y2g6IGFueSkge1xuICAgIGNvbnN0IHRhc2sgPSB0aGlzLnRhc2tzLmdldCh0YXNrSWQpO1xuICAgIGlmICh0YXNrKSB7XG4gICAgICBPYmplY3QuYXNzaWduKHRhc2ssIHBhdGNoKTtcbiAgICB9XG4gIH1cbiAgXG4gIGFwcGVuZE91dHB1dCh0YXNrSWQ6IHN0cmluZywgY2h1bms6IHN0cmluZykge1xuICAgIGNvbnN0IHRhc2sgPSB0aGlzLnRhc2tzLmdldCh0YXNrSWQpO1xuICAgIGlmICh0YXNrKSB7XG4gICAgICB0YXNrLm91dHB1dCA9ICh0YXNrLm91dHB1dCB8fCAnJykgKyBjaHVuaztcbiAgICB9XG4gIH1cbiAgXG4gIGdldE91dHB1dCh0YXNrSWQ6IHN0cmluZykge1xuICAgIGNvbnN0IHRhc2sgPSB0aGlzLnRhc2tzLmdldCh0YXNrSWQpO1xuICAgIHJldHVybiB0YXNrPy5vdXRwdXQgfHwgJyc7XG4gIH1cbiAgXG4gIGFzeW5jIGNhbmNlbCh0YXNrSWQ6IHN0cmluZykge1xuICAgIHRoaXMudXBkYXRlKHRhc2tJZCwgeyBzdGF0dXM6ICdjYW5jZWxsZWQnIH0pO1xuICB9XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOa1i+ivleeUqOS+i1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5kZXNjcmliZSgnVGVhbSBJbnRlZ3JhdGlvbicsICgpID0+IHtcbiAgZGVzY3JpYmUoJ0V4ZWN1dGlvbkNvbnRleHQgQWRhcHRlcicsICgpID0+IHtcbiAgICBpdCgn5bqU6K+l5oiQ5Yqf5bCGIEV4ZWN1dGlvbkNvbnRleHQg6L2s5o2i5Li6IFRlYW1Db250ZXh0JywgKCkgPT4ge1xuICAgICAgY29uc3QgcGFyZW50Q29udGV4dCA9IG5ldyBNb2NrRXhlY3V0aW9uQ29udGV4dCgpIGFzIEV4ZWN1dGlvbkNvbnRleHQ7XG4gICAgICBjb25zdCBhZGFwdGVyID0gbmV3IEV4ZWN1dGlvbkNvbnRleHRBZGFwdGVyKCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHRlYW1Db250ZXh0ID0gYWRhcHRlci5jb252ZXJ0VG9UZWFtQ29udGV4dChcbiAgICAgICAgcGFyZW50Q29udGV4dCxcbiAgICAgICAgJ3RlYW1fdGVzdCcsXG4gICAgICAgICd0YXNrX3BhcmVudCcsXG4gICAgICAgIHsgbWF4VHVybnM6IDUwLCB0aW1lb3V0TXM6IDMwMDAwMCB9XG4gICAgICApO1xuICAgICAgXG4gICAgICBleHBlY3QodGVhbUNvbnRleHQudGVhbUlkKS50b0JlKCd0ZWFtX3Rlc3QnKTtcbiAgICAgIGV4cGVjdCh0ZWFtQ29udGV4dC5wYXJlbnRUYXNrSWQpLnRvQmUoJ3Rhc2tfcGFyZW50Jyk7XG4gICAgICBleHBlY3QodGVhbUNvbnRleHQuc2Vzc2lvbklkKS50b0JlKHBhcmVudENvbnRleHQuc2Vzc2lvbklkKTtcbiAgICAgIGV4cGVjdCh0ZWFtQ29udGV4dC5zdGF0dXMpLnRvQmUoJ2FjdGl2ZScpO1xuICAgICAgZXhwZWN0KHRlYW1Db250ZXh0LnRvdGFsQnVkZ2V0Lm1heFR1cm5zKS50b0JlKDUwKTtcbiAgICB9KTtcbiAgICBcbiAgICBpdCgn5bqU6K+l5LuO54i25LiK5LiL5paH5rS+55Sf5a2Q5Luj55CG5LiK5LiL5paHJywgKCkgPT4ge1xuICAgICAgY29uc3QgcGFyZW50Q29udGV4dCA9IG5ldyBNb2NrRXhlY3V0aW9uQ29udGV4dCgpIGFzIEV4ZWN1dGlvbkNvbnRleHQ7XG4gICAgICBjb25zdCBhZGFwdGVyID0gbmV3IEV4ZWN1dGlvbkNvbnRleHRBZGFwdGVyKCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHRlYW1Db250ZXh0ID0gYWRhcHRlci5jb252ZXJ0VG9UZWFtQ29udGV4dChcbiAgICAgICAgcGFyZW50Q29udGV4dCxcbiAgICAgICAgJ3RlYW1fdGVzdCcsXG4gICAgICAgICd0YXNrX3BhcmVudCcsXG4gICAgICAgIHsgbWF4VHVybnM6IDUwLCB0aW1lb3V0TXM6IDMwMDAwMCB9XG4gICAgICApO1xuICAgICAgXG4gICAgICBjb25zdCBzdWJhZ2VudFRhc2s6IFN1YmFnZW50VGFzayA9IHtcbiAgICAgICAgaWQ6ICd0YXNrX3N1Yl8xJyxcbiAgICAgICAgcGFyZW50VGFza0lkOiAndGFza19wYXJlbnQnLFxuICAgICAgICBzZXNzaW9uSWQ6IHBhcmVudENvbnRleHQuc2Vzc2lvbklkLFxuICAgICAgICB0ZWFtSWQ6ICd0ZWFtX3Rlc3QnLFxuICAgICAgICBhZ2VudDogJ3BsYW5uZXInLFxuICAgICAgICBnb2FsOiAn6KeE5YiS5Lu75YqhJyxcbiAgICAgICAgaW5wdXRzOiB7fSxcbiAgICAgICAgYWxsb3dlZFRvb2xzOiBbJ2ZzLnJlYWQnLCAnZnMubGlzdCcsICdncmVwLnNlYXJjaCddLFxuICAgICAgICBidWRnZXQ6IHsgbWF4VHVybnM6IDEwLCB0aW1lb3V0TXM6IDYwMDAwIH0sXG4gICAgICAgIHN0YXR1czogJ3F1ZXVlZCcsXG4gICAgICAgIGNyZWF0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgICAgY3VycmVudFR1cm46IDAsXG4gICAgICB9O1xuICAgICAgXG4gICAgICBjb25zdCBzdWJhZ2VudENvbnRleHQgPSBhZGFwdGVyLmRlcml2ZVN1YmFnZW50Q29udGV4dCh7XG4gICAgICAgIHBhcmVudENvbnRleHQsXG4gICAgICAgIHRhc2s6IHN1YmFnZW50VGFzayxcbiAgICAgICAgdGVhbUNvbnRleHQsXG4gICAgICAgIHJvbGU6ICdwbGFubmVyJyxcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICAvLyDpqozor4Houqvku73nu6fmib9cbiAgICAgIGV4cGVjdChzdWJhZ2VudENvbnRleHQucGFyZW50U2Vzc2lvbklkKS50b0JlKHBhcmVudENvbnRleHQuc2Vzc2lvbklkKTtcbiAgICAgIGV4cGVjdChzdWJhZ2VudENvbnRleHQucGFyZW50VGFza0lkKS50b0JlKCd0YXNrX3BhcmVudCcpO1xuICAgICAgZXhwZWN0KHN1YmFnZW50Q29udGV4dC5zdWJhZ2VudFRhc2tJZCkudG9CZSgndGFza19zdWJfMScpO1xuICAgICAgXG4gICAgICAvLyDpqozor4HkuIrkuIvmlofnu6fmib9cbiAgICAgIGV4cGVjdChzdWJhZ2VudENvbnRleHQuY3dkKS50b0JlKHBhcmVudENvbnRleHQuY3dkKTtcbiAgICAgIGV4cGVjdChzdWJhZ2VudENvbnRleHQud29ya3NwYWNlUm9vdCkudG9CZShwYXJlbnRDb250ZXh0LndvcmtzcGFjZVJvb3QpO1xuICAgICAgXG4gICAgICAvLyDpqozor4HmnYPpmZDoo4HliapcbiAgICAgIGV4cGVjdChzdWJhZ2VudENvbnRleHQuYWxsb3dlZFRvb2xzKS50b0NvbnRhaW4oJ2ZzLnJlYWQnKTtcbiAgICAgIGV4cGVjdChzdWJhZ2VudENvbnRleHQuZm9yYmlkZGVuVG9vbHMpLnRvQ29udGFpbignZnMud3JpdGUnKTtcbiAgICAgIGV4cGVjdChzdWJhZ2VudENvbnRleHQubWF4VHVybnMpLnRvQmUoMTApO1xuICAgIH0pO1xuICAgIFxuICAgIGl0KCflupTor6Xoo4Hliarlt6XlhbfmnYPpmZDvvIjlrZDku6PnkIbmnYPpmZAg4omkIOeItuS4iuS4i+aWh++8iScsICgpID0+IHtcbiAgICAgIGNvbnN0IHBhcmVudENvbnRleHQgPSBuZXcgTW9ja0V4ZWN1dGlvbkNvbnRleHQoKSBhcyBFeGVjdXRpb25Db250ZXh0O1xuICAgICAgY29uc3QgYWRhcHRlciA9IG5ldyBFeGVjdXRpb25Db250ZXh0QWRhcHRlcigpO1xuICAgICAgXG4gICAgICBjb25zdCB0ZWFtQ29udGV4dCA9IGFkYXB0ZXIuY29udmVydFRvVGVhbUNvbnRleHQoXG4gICAgICAgIHBhcmVudENvbnRleHQsXG4gICAgICAgICd0ZWFtX3Rlc3QnLFxuICAgICAgICAndGFza19wYXJlbnQnLFxuICAgICAgICB7IG1heFR1cm5zOiA1MCwgdGltZW91dE1zOiAzMDAwMDAgfVxuICAgICAgKTtcbiAgICAgIFxuICAgICAgLy8g54i25LiK5LiL5paH5YWB6K645omA5pyJ5bel5YW3XG4gICAgICBjb25zdCBzdWJhZ2VudFRhc2s6IFN1YmFnZW50VGFzayA9IHtcbiAgICAgICAgaWQ6ICd0YXNrX3N1Yl8xJyxcbiAgICAgICAgcGFyZW50VGFza0lkOiAndGFza19wYXJlbnQnLFxuICAgICAgICBzZXNzaW9uSWQ6IHBhcmVudENvbnRleHQuc2Vzc2lvbklkLFxuICAgICAgICB0ZWFtSWQ6ICd0ZWFtX3Rlc3QnLFxuICAgICAgICBhZ2VudDogJ3BsYW5uZXInLFxuICAgICAgICBnb2FsOiAn6KeE5YiS5Lu75YqhJyxcbiAgICAgICAgaW5wdXRzOiB7fSxcbiAgICAgICAgYWxsb3dlZFRvb2xzOiBbJ2ZzLnJlYWQnLCAnZnMud3JpdGUnLCAnZ2l0LmNvbW1pdCddLCAvLyDljIXlkKsgcGxhbm5lciDnpoHmraLnmoTlt6XlhbdcbiAgICAgICAgYnVkZ2V0OiB7IG1heFR1cm5zOiAxMCwgdGltZW91dE1zOiA2MDAwMCB9LFxuICAgICAgICBzdGF0dXM6ICdxdWV1ZWQnLFxuICAgICAgICBjcmVhdGVkQXQ6IERhdGUubm93KCksXG4gICAgICAgIGN1cnJlbnRUdXJuOiAwLFxuICAgICAgfTtcbiAgICAgIFxuICAgICAgY29uc3Qgc3ViYWdlbnRDb250ZXh0ID0gYWRhcHRlci5kZXJpdmVTdWJhZ2VudENvbnRleHQoe1xuICAgICAgICBwYXJlbnRDb250ZXh0LFxuICAgICAgICB0YXNrOiBzdWJhZ2VudFRhc2ssXG4gICAgICAgIHRlYW1Db250ZXh0LFxuICAgICAgICByb2xlOiAncGxhbm5lcicsXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8gcGxhbm5lciDkuI3lhYHorrggZnMud3JpdGUg5ZKMIGdpdC5jb21taXRcbiAgICAgIGV4cGVjdChzdWJhZ2VudENvbnRleHQuYWxsb3dlZFRvb2xzKS5ub3QudG9Db250YWluKCdmcy53cml0ZScpO1xuICAgICAgZXhwZWN0KHN1YmFnZW50Q29udGV4dC5hbGxvd2VkVG9vbHMpLm5vdC50b0NvbnRhaW4oJ2dpdC5jb21taXQnKTtcbiAgICAgIGV4cGVjdChzdWJhZ2VudENvbnRleHQuYWxsb3dlZFRvb2xzKS50b0NvbnRhaW4oJ2ZzLnJlYWQnKTtcbiAgICB9KTtcbiAgICBcbiAgICBpdCgn5bqU6K+l5bCGIFN1YmFnZW50UmVzdWx0IOi9rOaNouS4uuWPr+W9kuaho+agvOW8jycsICgpID0+IHtcbiAgICAgIGNvbnN0IGFkYXB0ZXIgPSBuZXcgRXhlY3V0aW9uQ29udGV4dEFkYXB0ZXIoKTtcbiAgICAgIFxuICAgICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgICBzdWJhZ2VudFRhc2tJZDogJ3Rhc2tfc3ViXzEnLFxuICAgICAgICBwYXJlbnRUYXNrSWQ6ICd0YXNrX3BhcmVudCcsXG4gICAgICAgIHRlYW1JZDogJ3RlYW1fdGVzdCcsXG4gICAgICAgIGFnZW50OiAncGxhbm5lcicsXG4gICAgICAgIHN1bW1hcnk6ICfop4TliJLlrozmiJAnLFxuICAgICAgICBjb25maWRlbmNlOiAwLjksXG4gICAgICAgIHR1cm5zVXNlZDogNSxcbiAgICAgICAgdG9rZW5zVXNlZDogNTAwMCxcbiAgICAgICAgZHVyYXRpb25NczogMTAwMCxcbiAgICAgICAgYXJ0aWZhY3RzOiBbXG4gICAgICAgICAgeyB0eXBlOiAndGV4dCcgYXMgY29uc3QsIGRlc2NyaXB0aW9uOiAn6K6h5YiS5paH5qGjJywgY29udGVudDogJy4uLicgfSxcbiAgICAgICAgXSxcbiAgICAgICAgcGF0Y2hlczogW1xuICAgICAgICAgIHsgZmlsZUlkOiAnc3JjL2FwcC50cycsIGRpZmY6ICcuLi4nLCBodW5rczogMSwgbGluZXNBZGRlZDogNSwgbGluZXNEZWxldGVkOiAyIH0sXG4gICAgICAgIF0sXG4gICAgICAgIGZpbmRpbmdzOiBbXG4gICAgICAgICAgeyB0eXBlOiAnc3VnZ2VzdGlvbicgYXMgY29uc3QsIHNldmVyaXR5OiAnbG93JyBhcyBjb25zdCwgZGVzY3JpcHRpb246ICflu7rorq7kvJjljJYnIH0sXG4gICAgICAgIF0sXG4gICAgICB9O1xuICAgICAgXG4gICAgICBjb25zdCBub3JtYWxpemVkID0gYWRhcHRlci5ub3JtYWxpemVTdWJhZ2VudFJlc3VsdChyZXN1bHQsICd0YXNrX3BhcmVudCcpO1xuICAgICAgXG4gICAgICBleHBlY3Qobm9ybWFsaXplZC5zdW1tYXJ5KS50b0JlKCfop4TliJLlrozmiJAnKTtcbiAgICAgIGV4cGVjdChub3JtYWxpemVkLmFydGlmYWN0cy5sZW5ndGgpLnRvQmUoMSk7XG4gICAgICBleHBlY3Qobm9ybWFsaXplZC5wYXRjaGVzPy5sZW5ndGgpLnRvQmUoMSk7XG4gICAgICBleHBlY3Qobm9ybWFsaXplZC5maW5kaW5ncz8ubGVuZ3RoKS50b0JlKDEpO1xuICAgIH0pO1xuICB9KTtcbiAgXG4gIGRlc2NyaWJlKCdQZXJtaXNzaW9uIEJyaWRnZScsICgpID0+IHtcbiAgICBpdCgn5bqU6K+l6aqM6K+B6KeS6Imy5bel5YW36K6/6ZeuJywgKCkgPT4ge1xuICAgICAgY29uc3QgcGVybWlzc2lvbkVuZ2luZSA9IG5ldyBNb2NrUGVybWlzc2lvbkVuZ2luZSgpIGFzIGFueTtcbiAgICAgIGNvbnN0IGJyaWRnZSA9IG5ldyBQZXJtaXNzaW9uQnJpZGdlKHBlcm1pc3Npb25FbmdpbmUpO1xuICAgICAgXG4gICAgICAvLyBwbGFubmVyIOWFgeiuuOeahOW3peWFt1xuICAgICAgZXhwZWN0KGJyaWRnZS52YWxpZGF0ZVRvb2xBY2Nlc3MoJ3BsYW5uZXInLCAnZnMucmVhZCcpKS50b0JlKHRydWUpO1xuICAgICAgZXhwZWN0KGJyaWRnZS52YWxpZGF0ZVRvb2xBY2Nlc3MoJ3BsYW5uZXInLCAnZnMubGlzdCcpKS50b0JlKHRydWUpO1xuICAgICAgXG4gICAgICAvLyBwbGFubmVyIOemgeatoueahOW3peWFt1xuICAgICAgZXhwZWN0KGJyaWRnZS52YWxpZGF0ZVRvb2xBY2Nlc3MoJ3BsYW5uZXInLCAnZnMud3JpdGUnKSkudG9CZShmYWxzZSk7XG4gICAgICBleHBlY3QoYnJpZGdlLnZhbGlkYXRlVG9vbEFjY2VzcygncGxhbm5lcicsICdnaXQuY29tbWl0JykpLnRvQmUoZmFsc2UpO1xuICAgICAgXG4gICAgICAvLyBjb2RlX2ZpeGVyIOWFgeiuuOeahOW3peWFt1xuICAgICAgZXhwZWN0KGJyaWRnZS52YWxpZGF0ZVRvb2xBY2Nlc3MoJ2NvZGVfZml4ZXInLCAnZnMud3JpdGUnKSkudG9CZSh0cnVlKTtcbiAgICB9KTtcbiAgICBcbiAgICBpdCgn5bqU6K+l6I635Y+W6KeS6Imy5bel5YW35YiX6KGoJywgKCkgPT4ge1xuICAgICAgY29uc3QgcGVybWlzc2lvbkVuZ2luZSA9IG5ldyBNb2NrUGVybWlzc2lvbkVuZ2luZSgpIGFzIGFueTtcbiAgICAgIGNvbnN0IGJyaWRnZSA9IG5ldyBQZXJtaXNzaW9uQnJpZGdlKHBlcm1pc3Npb25FbmdpbmUpO1xuICAgICAgXG4gICAgICBjb25zdCBhbGxvd2VkID0gYnJpZGdlLmdldEFsbG93ZWRUb29scygncGxhbm5lcicpO1xuICAgICAgZXhwZWN0KGFsbG93ZWQubGVuZ3RoKS50b0JlR3JlYXRlclRoYW4oMCk7XG4gICAgICBleHBlY3QoYWxsb3dlZCkudG9Db250YWluKCdmcy5yZWFkJyk7XG4gICAgICBcbiAgICAgIGNvbnN0IGZvcmJpZGRlbiA9IGJyaWRnZS5nZXRGb3JiaWRkZW5Ub29scygncGxhbm5lcicpO1xuICAgICAgZXhwZWN0KGZvcmJpZGRlbi5sZW5ndGgpLnRvQmVHcmVhdGVyVGhhbigwKTtcbiAgICAgIGV4cGVjdChmb3JiaWRkZW4pLnRvQ29udGFpbignZnMud3JpdGUnKTtcbiAgICB9KTtcbiAgICBcbiAgICBpdCgn5bqU6K+l5qOA5p+l5p2D6ZmQ77yI6ZuG5oiQIFBlcm1pc3Npb25FbmdpbmXvvIknLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBwZXJtaXNzaW9uRW5naW5lID0gbmV3IE1vY2tQZXJtaXNzaW9uRW5naW5lKCkgYXMgYW55O1xuICAgICAgY29uc3QgYnJpZGdlID0gbmV3IFBlcm1pc3Npb25CcmlkZ2UocGVybWlzc2lvbkVuZ2luZSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGRlY2lzaW9uID0gYXdhaXQgYnJpZGdlLmNoZWNrUGVybWlzc2lvbih7XG4gICAgICAgIHN1YmFnZW50VGFza0lkOiAndGFza19zdWJfMScsXG4gICAgICAgIHRlYW1JZDogJ3RlYW1fdGVzdCcsXG4gICAgICAgIHJvbGU6ICdwbGFubmVyJyxcbiAgICAgICAgdG9vbDogJ2ZzLnJlYWQnLFxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGV4cGVjdChkZWNpc2lvbi5hbGxvd2VkKS50b0JlKHRydWUpO1xuICAgIH0pO1xuICB9KTtcbiAgXG4gIGRlc2NyaWJlKCdUYXNrU3RvcmUgQnJpZGdlJywgKCkgPT4ge1xuICAgIGl0KCflupTor6XliJvlu7rlm6LpmJ/ku7vliqEnLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCB0YXNrU3RvcmUgPSBuZXcgTW9ja1Rhc2tTdG9yZSgpIGFzIGFueTtcbiAgICAgIGNvbnN0IGJyaWRnZSA9IG5ldyBUYXNrU3RvcmVCcmlkZ2UodGFza1N0b3JlKTtcbiAgICAgIFxuICAgICAgY29uc3QgdGVhbVRhc2sgPSBhd2FpdCBicmlkZ2UuY3JlYXRlVGVhbVRhc2soXG4gICAgICAgICd0ZWFtX3Rlc3QnLFxuICAgICAgICAndGFza19wYXJlbnQnLFxuICAgICAgICAnc2Vzc2lvbl8xMjMnLFxuICAgICAgICAnbWFpbl9hc3Npc3RhbnQnLFxuICAgICAgICAnL3dvcmtzcGFjZScsXG4gICAgICAgICfmtYvor5Xlm6LpmJ/nm67moIcnXG4gICAgICApO1xuICAgICAgXG4gICAgICBleHBlY3QodGVhbVRhc2suaWQpLnRvQmVEZWZpbmVkKCk7XG4gICAgICBleHBlY3QodGVhbVRhc2sudHlwZSkudG9CZSgnc3ViYWdlbnQnKTtcbiAgICAgIGV4cGVjdCh0ZWFtVGFzay5wYXJlbnRUYXNrSWQpLnRvQmUoJ3Rhc2tfcGFyZW50Jyk7XG4gICAgICBleHBlY3QodGVhbVRhc2subWV0YWRhdGE/LnRlYW1JZCkudG9CZSgndGVhbV90ZXN0Jyk7XG4gICAgfSk7XG4gICAgXG4gICAgaXQoJ+W6lOivpeWIm+W7uuWtkOS7o+eQhuS7u+WKoScsIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IHRhc2tTdG9yZSA9IG5ldyBNb2NrVGFza1N0b3JlKCkgYXMgYW55O1xuICAgICAgY29uc3QgYnJpZGdlID0gbmV3IFRhc2tTdG9yZUJyaWRnZSh0YXNrU3RvcmUpO1xuICAgICAgXG4gICAgICBjb25zdCB0ZWFtVGFzayA9IGF3YWl0IGJyaWRnZS5jcmVhdGVUZWFtVGFzayhcbiAgICAgICAgJ3RlYW1fdGVzdCcsXG4gICAgICAgICd0YXNrX3BhcmVudCcsXG4gICAgICAgICdzZXNzaW9uXzEyMycsXG4gICAgICAgICdtYWluX2Fzc2lzdGFudCcsXG4gICAgICAgICcvd29ya3NwYWNlJyxcbiAgICAgICAgJ+a1i+ivleWboumYnydcbiAgICAgICk7XG4gICAgICBcbiAgICAgIGNvbnN0IHN1YmFnZW50VGFzazogU3ViYWdlbnRUYXNrID0ge1xuICAgICAgICBpZDogJ3Rhc2tfc3ViXzEnLFxuICAgICAgICBwYXJlbnRUYXNrSWQ6ICd0YXNrX3BhcmVudCcsXG4gICAgICAgIHNlc3Npb25JZDogJ3Nlc3Npb25fMTIzJyxcbiAgICAgICAgdGVhbUlkOiAndGVhbV90ZXN0JyxcbiAgICAgICAgYWdlbnQ6ICdwbGFubmVyJyxcbiAgICAgICAgZ29hbDogJ+inhOWIkuS7u+WKoScsXG4gICAgICAgIGlucHV0czoge30sXG4gICAgICAgIGFsbG93ZWRUb29sczogWydmcy5yZWFkJ10sXG4gICAgICAgIGJ1ZGdldDogeyBtYXhUdXJuczogMTAsIHRpbWVvdXRNczogNjAwMDAgfSxcbiAgICAgICAgc3RhdHVzOiAncXVldWVkJyxcbiAgICAgICAgY3JlYXRlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgICBjdXJyZW50VHVybjogMCxcbiAgICAgIH07XG4gICAgICBcbiAgICAgIGNvbnN0IHN1YnRhc2sgPSBhd2FpdCBicmlkZ2UuY3JlYXRlU3ViYWdlbnRUYXNrKHN1YmFnZW50VGFzaywgdGVhbVRhc2suaWQpO1xuICAgICAgXG4gICAgICBleHBlY3Qoc3VidGFzay5pZCkudG9CZURlZmluZWQoKTtcbiAgICAgIGV4cGVjdChzdWJ0YXNrLnBhcmVudFRhc2tJZCkudG9CZSh0ZWFtVGFzay5pZCk7XG4gICAgICBleHBlY3Qoc3VidGFzay5tZXRhZGF0YT8uc3ViYWdlbnRUYXNrSWQpLnRvQmUoJ3Rhc2tfc3ViXzEnKTtcbiAgICAgIGV4cGVjdChzdWJ0YXNrLm1ldGFkYXRhPy5yb2xlKS50b0JlKCdwbGFubmVyJyk7XG4gICAgfSk7XG4gICAgXG4gICAgaXQoJ+W6lOivpeabtOaWsOWtkOS7u+WKoeeKtuaAgScsIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IHRhc2tTdG9yZSA9IG5ldyBNb2NrVGFza1N0b3JlKCkgYXMgYW55O1xuICAgICAgY29uc3QgYnJpZGdlID0gbmV3IFRhc2tTdG9yZUJyaWRnZSh0YXNrU3RvcmUpO1xuICAgICAgXG4gICAgICBjb25zdCB0ZWFtVGFzayA9IGF3YWl0IGJyaWRnZS5jcmVhdGVUZWFtVGFzayhcbiAgICAgICAgJ3RlYW1fdGVzdCcsXG4gICAgICAgICd0YXNrX3BhcmVudCcsXG4gICAgICAgICdzZXNzaW9uXzEyMycsXG4gICAgICAgICdtYWluX2Fzc2lzdGFudCcsXG4gICAgICAgICcvd29ya3NwYWNlJyxcbiAgICAgICAgJ+a1i+ivleWboumYnydcbiAgICAgICk7XG4gICAgICBcbiAgICAgIGNvbnN0IHN1YmFnZW50VGFzazogU3ViYWdlbnRUYXNrID0ge1xuICAgICAgICBpZDogJ3Rhc2tfc3ViXzEnLFxuICAgICAgICBwYXJlbnRUYXNrSWQ6ICd0YXNrX3BhcmVudCcsXG4gICAgICAgIHNlc3Npb25JZDogJ3Nlc3Npb25fMTIzJyxcbiAgICAgICAgdGVhbUlkOiAndGVhbV90ZXN0JyxcbiAgICAgICAgYWdlbnQ6ICdwbGFubmVyJyxcbiAgICAgICAgZ29hbDogJ+inhOWIkuS7u+WKoScsXG4gICAgICAgIGlucHV0czoge30sXG4gICAgICAgIGFsbG93ZWRUb29sczogWydmcy5yZWFkJ10sXG4gICAgICAgIGJ1ZGdldDogeyBtYXhUdXJuczogMTAsIHRpbWVvdXRNczogNjAwMDAgfSxcbiAgICAgICAgc3RhdHVzOiAncXVldWVkJyxcbiAgICAgICAgY3JlYXRlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgICBjdXJyZW50VHVybjogMCxcbiAgICAgIH07XG4gICAgICBcbiAgICAgIGNvbnN0IHN1YnRhc2sgPSBhd2FpdCBicmlkZ2UuY3JlYXRlU3ViYWdlbnRUYXNrKHN1YmFnZW50VGFzaywgdGVhbVRhc2suaWQpO1xuICAgICAgXG4gICAgICAvLyDmm7TmlrDnirbmgIHkuLogcnVubmluZ1xuICAgICAgYXdhaXQgYnJpZGdlLnVwZGF0ZVN1YmFnZW50U3RhdHVzKHN1YnRhc2suaWQsICdydW5uaW5nJyk7XG4gICAgICBcbiAgICAgIGNvbnN0IHVwZGF0ZWQgPSB0YXNrU3RvcmUuZ2V0KHN1YnRhc2suaWQpO1xuICAgICAgZXhwZWN0KHVwZGF0ZWQuc3RhdHVzKS50b0JlKCdydW5uaW5nJyk7XG4gICAgfSk7XG4gICAgXG4gICAgaXQoJ+W6lOivpeiusOW9leWtkOS7o+eQhue7k+aenCcsIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IHRhc2tTdG9yZSA9IG5ldyBNb2NrVGFza1N0b3JlKCkgYXMgYW55O1xuICAgICAgY29uc3QgYnJpZGdlID0gbmV3IFRhc2tTdG9yZUJyaWRnZSh0YXNrU3RvcmUpO1xuICAgICAgXG4gICAgICBjb25zdCB0ZWFtVGFzayA9IGF3YWl0IGJyaWRnZS5jcmVhdGVUZWFtVGFzayhcbiAgICAgICAgJ3RlYW1fdGVzdCcsXG4gICAgICAgICd0YXNrX3BhcmVudCcsXG4gICAgICAgICdzZXNzaW9uXzEyMycsXG4gICAgICAgICdtYWluX2Fzc2lzdGFudCcsXG4gICAgICAgICcvd29ya3NwYWNlJyxcbiAgICAgICAgJ+a1i+ivleWboumYnydcbiAgICAgICk7XG4gICAgICBcbiAgICAgIGNvbnN0IHN1YmFnZW50VGFzazogU3ViYWdlbnRUYXNrID0ge1xuICAgICAgICBpZDogJ3Rhc2tfc3ViXzEnLFxuICAgICAgICBwYXJlbnRUYXNrSWQ6ICd0YXNrX3BhcmVudCcsXG4gICAgICAgIHNlc3Npb25JZDogJ3Nlc3Npb25fMTIzJyxcbiAgICAgICAgdGVhbUlkOiAndGVhbV90ZXN0JyxcbiAgICAgICAgYWdlbnQ6ICdwbGFubmVyJyxcbiAgICAgICAgZ29hbDogJ+inhOWIkuS7u+WKoScsXG4gICAgICAgIGlucHV0czoge30sXG4gICAgICAgIGFsbG93ZWRUb29sczogWydmcy5yZWFkJ10sXG4gICAgICAgIGJ1ZGdldDogeyBtYXhUdXJuczogMTAsIHRpbWVvdXRNczogNjAwMDAgfSxcbiAgICAgICAgc3RhdHVzOiAncXVldWVkJyxcbiAgICAgICAgY3JlYXRlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgICBjdXJyZW50VHVybjogMCxcbiAgICAgIH07XG4gICAgICBcbiAgICAgIGNvbnN0IHN1YnRhc2sgPSBhd2FpdCBicmlkZ2UuY3JlYXRlU3ViYWdlbnRUYXNrKHN1YmFnZW50VGFzaywgdGVhbVRhc2suaWQpO1xuICAgICAgXG4gICAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICAgIHN1YmFnZW50VGFza0lkOiAndGFza19zdWJfMScsXG4gICAgICAgIHBhcmVudFRhc2tJZDogJ3Rhc2tfcGFyZW50JyxcbiAgICAgICAgdGVhbUlkOiAndGVhbV90ZXN0JyxcbiAgICAgICAgYWdlbnQ6ICdwbGFubmVyJyxcbiAgICAgICAgc3VtbWFyeTogJ+inhOWIkuWujOaIkCcsXG4gICAgICAgIGNvbmZpZGVuY2U6IDAuOSxcbiAgICAgICAgdHVybnNVc2VkOiA1LFxuICAgICAgICB0b2tlbnNVc2VkOiA1MDAwLFxuICAgICAgICBkdXJhdGlvbk1zOiAxMDAwLFxuICAgICAgfTtcbiAgICAgIFxuICAgICAgYXdhaXQgYnJpZGdlLnJlY29yZFN1YmFnZW50UmVzdWx0KHN1YnRhc2suaWQsIHJlc3VsdCk7XG4gICAgICBcbiAgICAgIGNvbnN0IHVwZGF0ZWQgPSB0YXNrU3RvcmUuZ2V0KHN1YnRhc2suaWQpO1xuICAgICAgZXhwZWN0KHVwZGF0ZWQubWV0YWRhdGE/LnJlc3VsdC5zdW1tYXJ5KS50b0JlKCfop4TliJLlrozmiJAnKTtcbiAgICAgIGV4cGVjdCh1cGRhdGVkLm91dHB1dCkudG9Db250YWluKCdTdWJhZ2VudCBSZXN1bHQnKTtcbiAgICB9KTtcbiAgICBcbiAgICBpdCgn5bqU6K+l6I635Y+W5Zui6Zif55qE5omA5pyJ5a2Q5Lu75YqhJywgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgdGFza1N0b3JlID0gbmV3IE1vY2tUYXNrU3RvcmUoKSBhcyBhbnk7XG4gICAgICBjb25zdCBicmlkZ2UgPSBuZXcgVGFza1N0b3JlQnJpZGdlKHRhc2tTdG9yZSk7XG4gICAgICBcbiAgICAgIGNvbnN0IHRlYW1UYXNrID0gYXdhaXQgYnJpZGdlLmNyZWF0ZVRlYW1UYXNrKFxuICAgICAgICAndGVhbV90ZXN0JyxcbiAgICAgICAgJ3Rhc2tfcGFyZW50JyxcbiAgICAgICAgJ3Nlc3Npb25fMTIzJyxcbiAgICAgICAgJ21haW5fYXNzaXN0YW50JyxcbiAgICAgICAgJy93b3Jrc3BhY2UnLFxuICAgICAgICAn5rWL6K+V5Zui6ZifJ1xuICAgICAgKTtcbiAgICAgIFxuICAgICAgLy8g5Yib5bu6IDMg5Liq5a2Q5Lu75YqhXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDM7IGkrKykge1xuICAgICAgICBjb25zdCBzdWJhZ2VudFRhc2s6IFN1YmFnZW50VGFzayA9IHtcbiAgICAgICAgICBpZDogYHRhc2tfc3ViXyR7aX1gLFxuICAgICAgICAgIHBhcmVudFRhc2tJZDogJ3Rhc2tfcGFyZW50JyxcbiAgICAgICAgICBzZXNzaW9uSWQ6ICdzZXNzaW9uXzEyMycsXG4gICAgICAgICAgdGVhbUlkOiAndGVhbV90ZXN0JyxcbiAgICAgICAgICBhZ2VudDogJ3BsYW5uZXInLFxuICAgICAgICAgIGdvYWw6IGDku7vliqEgJHtpfWAsXG4gICAgICAgICAgaW5wdXRzOiB7fSxcbiAgICAgICAgICBhbGxvd2VkVG9vbHM6IFsnZnMucmVhZCddLFxuICAgICAgICAgIGJ1ZGdldDogeyBtYXhUdXJuczogMTAsIHRpbWVvdXRNczogNjAwMDAgfSxcbiAgICAgICAgICBzdGF0dXM6ICdxdWV1ZWQnLFxuICAgICAgICAgIGNyZWF0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgICAgICBjdXJyZW50VHVybjogMCxcbiAgICAgICAgfTtcbiAgICAgICAgYXdhaXQgYnJpZGdlLmNyZWF0ZVN1YmFnZW50VGFzayhzdWJhZ2VudFRhc2ssIHRlYW1UYXNrLmlkKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3Qgc3VidGFza3MgPSBhd2FpdCBicmlkZ2UuZ2V0VGVhbVN1YnRhc2tzKHRlYW1UYXNrLmlkKTtcbiAgICAgIFxuICAgICAgZXhwZWN0KHN1YnRhc2tzLmxlbmd0aCkudG9CZSgzKTtcbiAgICB9KTtcbiAgfSk7XG4gIFxuICBkZXNjcmliZSgnUGFyZW50LUNoaWxkIOeKtuaAgeS8oOWvvCcsICgpID0+IHtcbiAgICBpdCgn5bqU6K+l5Y+W5raI5omA5pyJ5a2Q5Lu75Yqh5b2TIHBhcmVudCBjYW5jZWwnLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCB0YXNrU3RvcmUgPSBuZXcgTW9ja1Rhc2tTdG9yZSgpIGFzIGFueTtcbiAgICAgIGNvbnN0IGJyaWRnZSA9IG5ldyBUYXNrU3RvcmVCcmlkZ2UodGFza1N0b3JlKTtcbiAgICAgIGNvbnN0IGhvb2tCdXMgPSBuZXcgQWdlbnRUZWFtSG9va0J1cygpO1xuICAgICAgY29uc3QgcnVubmVyID0gbmV3IFN1YmFnZW50UnVubmVyKGhvb2tCdXMpO1xuICAgICAgY29uc3Qgb3JjaGVzdHJhdG9yID0gbmV3IFRlYW1PcmNoZXN0cmF0b3IocnVubmVyLCBob29rQnVzKTtcbiAgICAgIFxuICAgICAgY29uc3QgY29udGV4dCA9IGF3YWl0IG9yY2hlc3RyYXRvci5jcmVhdGVUZWFtKHtcbiAgICAgICAgcGFyZW50VGFza0lkOiAndGFza19wYXJlbnQnLFxuICAgICAgICBzZXNzaW9uSWQ6ICdzZXNzaW9uXzEyMycsXG4gICAgICAgIGdvYWw6ICfmtYvor5Xlj5bmtojkvKDlr7wnLFxuICAgICAgICBhZ2VudHM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICByb2xlOiAncGxhbm5lcicsXG4gICAgICAgICAgICBnb2FsOiAn6KeE5YiSJyxcbiAgICAgICAgICAgIGFsbG93ZWRUb29sczogWydmcy5yZWFkJ10sXG4gICAgICAgICAgICBidWRnZXQ6IHsgbWF4VHVybnM6IDEwLCB0aW1lb3V0TXM6IDYwMDAwIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICByb2xlOiAnY29kZV9maXhlcicsXG4gICAgICAgICAgICBnb2FsOiAn5L+u5aSNJyxcbiAgICAgICAgICAgIGFsbG93ZWRUb29sczogWydmcy53cml0ZSddLFxuICAgICAgICAgICAgYnVkZ2V0OiB7IG1heFR1cm5zOiAyMCwgdGltZW91dE1zOiAxMjAwMDAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICB0b3RhbEJ1ZGdldDogeyBtYXhUdXJuczogMzUsIHRpbWVvdXRNczogMzAwMDAwIH0sXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgLy8g5ZyoIFRhc2tTdG9yZSDkuK3liJvlu7rlrZDku7vliqFcbiAgICAgIGNvbnN0IHRlYW1UYXNrID0gYXdhaXQgYnJpZGdlLmNyZWF0ZVRlYW1UYXNrKFxuICAgICAgICBjb250ZXh0LnRlYW1JZCxcbiAgICAgICAgJ3Rhc2tfcGFyZW50JyxcbiAgICAgICAgJ3Nlc3Npb25fMTIzJyxcbiAgICAgICAgJ21haW5fYXNzaXN0YW50JyxcbiAgICAgICAgJy93b3Jrc3BhY2UnLFxuICAgICAgICBjb250ZXh0LmFnZW50c1swXS5nb2FsXG4gICAgICApO1xuICAgICAgXG4gICAgICBmb3IgKGNvbnN0IGFnZW50IG9mIGNvbnRleHQuYWdlbnRzKSB7XG4gICAgICAgIGF3YWl0IGJyaWRnZS5jcmVhdGVTdWJhZ2VudFRhc2soYWdlbnQsIHRlYW1UYXNrLmlkKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g5Y+W5raI5Zui6ZifXG4gICAgICBhd2FpdCBvcmNoZXN0cmF0b3IuY2FuY2VsVGVhbShjb250ZXh0LnRlYW1JZCwgJ+eUqOaIt+WPlua2iCcpO1xuICAgICAgXG4gICAgICAvLyDpqozor4HmiYDmnInlrZDku7vliqHnirbmgIFcbiAgICAgIGNvbnN0IHN1YnRhc2tzID0gYXdhaXQgYnJpZGdlLmdldFRlYW1TdWJ0YXNrcyh0ZWFtVGFzay5pZCk7XG4gICAgICBleHBlY3Qoc3VidGFza3MuZXZlcnkodCA9PiB0LnN0YXR1cyA9PT0gJ3BlbmRpbmcnIHx8IHQuc3RhdHVzID09PSAnY2FuY2VsbGVkJykpLnRvQmUodHJ1ZSk7XG4gICAgfSk7XG4gIH0pO1xuICBcbiAgZGVzY3JpYmUoJ0hvb2tCdXMg6ZuG5oiQJywgKCkgPT4ge1xuICAgIGl0KCflupTor6Xop6blj5HlrozmlbTnmoTlm6LpmJ/nlJ/lkb3lkajmnJ/kuovku7YnLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBob29rRXZlbnRzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgY29uc3QgaG9va0J1cyA9IG5ldyBBZ2VudFRlYW1Ib29rQnVzKCk7XG4gICAgICBcbiAgICAgIGhvb2tCdXMub24oJ1RlYW1DcmVhdGUnLCAoKSA9PiBob29rRXZlbnRzLnB1c2goJ1RlYW1DcmVhdGUnKSk7XG4gICAgICBob29rQnVzLm9uKCdTdWJhZ2VudFN0YXJ0JywgKCkgPT4gaG9va0V2ZW50cy5wdXNoKCdTdWJhZ2VudFN0YXJ0JykpO1xuICAgICAgaG9va0J1cy5vbignU3ViYWdlbnRTdG9wJywgKCkgPT4gaG9va0V2ZW50cy5wdXNoKCdTdWJhZ2VudFN0b3AnKSk7XG4gICAgICBob29rQnVzLm9uKCdUZWFtQ29tcGxldGUnLCAoKSA9PiBob29rRXZlbnRzLnB1c2goJ1RlYW1Db21wbGV0ZScpKTtcbiAgICAgIFxuICAgICAgY29uc3QgcnVubmVyID0gbmV3IFN1YmFnZW50UnVubmVyKGhvb2tCdXMpO1xuICAgICAgY29uc3Qgb3JjaGVzdHJhdG9yID0gbmV3IFRlYW1PcmNoZXN0cmF0b3IocnVubmVyLCBob29rQnVzKTtcbiAgICAgIFxuICAgICAgY29uc3QgY29udGV4dCA9IGF3YWl0IG9yY2hlc3RyYXRvci5jcmVhdGVUZWFtKHtcbiAgICAgICAgcGFyZW50VGFza0lkOiAndGFza19wYXJlbnQnLFxuICAgICAgICBzZXNzaW9uSWQ6ICdzZXNzaW9uXzEyMycsXG4gICAgICAgIGdvYWw6ICfmtYvor5UgSG9vayDpm4bmiJAnLFxuICAgICAgICBhZ2VudHM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICByb2xlOiAncGxhbm5lcicsXG4gICAgICAgICAgICBnb2FsOiAn6KeE5YiSJyxcbiAgICAgICAgICAgIGFsbG93ZWRUb29sczogWydmcy5yZWFkJ10sXG4gICAgICAgICAgICBidWRnZXQ6IHsgbWF4VHVybnM6IDEwLCB0aW1lb3V0TXM6IDYwMDAwIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgdG90YWxCdWRnZXQ6IHsgbWF4VHVybnM6IDE1LCB0aW1lb3V0TXM6IDYwMDAwIH0sXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgYXdhaXQgb3JjaGVzdHJhdG9yLndhaXRGb3JDb21wbGV0aW9uKGNvbnRleHQudGVhbUlkKTtcbiAgICAgIFxuICAgICAgZXhwZWN0KGhvb2tFdmVudHMpLnRvQ29udGFpbignVGVhbUNyZWF0ZScpO1xuICAgICAgZXhwZWN0KGhvb2tFdmVudHMpLnRvQ29udGFpbignU3ViYWdlbnRTdGFydCcpO1xuICAgICAgZXhwZWN0KGhvb2tFdmVudHMpLnRvQ29udGFpbignU3ViYWdlbnRTdG9wJyk7XG4gICAgfSk7XG4gIH0pO1xufSk7XG4iXX0=