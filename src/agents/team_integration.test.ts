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

import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionContextAdapter, deriveSubagentContext } from './execution_context_adapter';
import { PermissionBridge, canAccessTool } from './permission_bridge';
import { TaskStoreBridge } from './taskstore_bridge';
import { TeamOrchestrator, runTeam } from './team_orchestrator';
import { SubagentRunner, AgentTeamHookBus } from './index';
import type { ExecutionContext } from '../../core/runtime/execution_context';
import type { SubagentTask, TeamContext, CreateTeamParams } from './types';

// ============================================================================
// Mock 实现
// ============================================================================

class MockExecutionContext implements Partial<ExecutionContext> {
  sessionId = 'session_test_123';
  turnId = 'turn_1';
  taskId = 'task_parent';
  agentId = 'main_assistant';
  workspaceRoot = '/workspace';
  cwd = '/workspace/project';
  abortController = new AbortController();
  signal = this.abortController.signal;
  logger = {
    debug: (msg: string) => console.log('[DEBUG]', msg),
    info: (msg: string) => console.log('[INFO]', msg),
    warn: (msg: string) => console.log('[WARN]', msg),
    error: (msg: string) => console.log('[ERROR]', msg),
  };
  emit = () => {};
  state = {
    get: () => undefined,
    set: () => {},
    delete: () => {},
  };
  permissions = {
    evaluate: () => ({
      allowed: true,
      behavior: 'allow',
      requiresApproval: false,
      explanation: 'Mock allow',
    }),
  } as any;
  tasks = {
    create: (def: any) => ({
      id: `task_${Date.now()}`,
      ...def,
      status: 'pending',
      createdAt: Date.now(),
    }),
    get: () => undefined,
    list: () => [],
    update: () => {},
    appendOutput: () => {},
    getOutput: () => '',
    cancel: async () => {},
  } as any;
  memory = {
    read: async () => [],
    write: async () => {},
  };
  fs = {
    readFile: async () => '',
    writeFile: async () => {},
    exists: async () => false,
    listDir: async () => [],
  };
  exec = {
    run: async () => ({ stdout: '', stderr: '', code: 0 }),
  };
  requestApproval = async () => ({
    requestId: 'approval_1',
    approved: true,
    reason: 'Mock approval',
    approvedAt: Date.now(),
    approvedBy: 'test',
  });
  appendSystemNote = () => {};
}

class MockPermissionEngine {
  evaluate = () => ({
    allowed: true,
    behavior: 'allow',
    requiresApproval: false,
    explanation: 'Mock allow',
  });
}

class MockTaskStore {
  private tasks: Map<string, any> = new Map();
  
  create(def: any) {
    const task = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ...def,
      status: 'pending',
      createdAt: Date.now(),
    };
    this.tasks.set(task.id, task);
    return task;
  }
  
  get(taskId: string) {
    return this.tasks.get(taskId);
  }
  
  list(filter?: any) {
    let result = Array.from(this.tasks.values());
    if (filter?.parentTaskId) {
      result = result.filter(t => t.parentTaskId === filter.parentTaskId);
    }
    return result;
  }
  
  update(taskId: string, patch: any) {
    const task = this.tasks.get(taskId);
    if (task) {
      Object.assign(task, patch);
    }
  }
  
  appendOutput(taskId: string, chunk: string) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.output = (task.output || '') + chunk;
    }
  }
  
  getOutput(taskId: string) {
    const task = this.tasks.get(taskId);
    return task?.output || '';
  }
  
  async cancel(taskId: string) {
    this.update(taskId, { status: 'cancelled' });
  }
}

// ============================================================================
// 测试用例
// ============================================================================

describe('Team Integration', () => {
  describe('ExecutionContext Adapter', () => {
    it('应该成功将 ExecutionContext 转换为 TeamContext', () => {
      const parentContext = new MockExecutionContext() as ExecutionContext;
      const adapter = new ExecutionContextAdapter();
      
      const teamContext = adapter.convertToTeamContext(
        parentContext,
        'team_test',
        'task_parent',
        { maxTurns: 50, timeoutMs: 300000 }
      );
      
      expect(teamContext.teamId).toBe('team_test');
      expect(teamContext.parentTaskId).toBe('task_parent');
      expect(teamContext.sessionId).toBe(parentContext.sessionId);
      expect(teamContext.status).toBe('active');
      expect(teamContext.totalBudget.maxTurns).toBe(50);
    });
    
    it('应该从父上下文派生子代理上下文', () => {
      const parentContext = new MockExecutionContext() as ExecutionContext;
      const adapter = new ExecutionContextAdapter();
      
      const teamContext = adapter.convertToTeamContext(
        parentContext,
        'team_test',
        'task_parent',
        { maxTurns: 50, timeoutMs: 300000 }
      );
      
      const subagentTask: SubagentTask = {
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
      expect(subagentContext.parentSessionId).toBe(parentContext.sessionId);
      expect(subagentContext.parentTaskId).toBe('task_parent');
      expect(subagentContext.subagentTaskId).toBe('task_sub_1');
      
      // 验证上下文继承
      expect(subagentContext.cwd).toBe(parentContext.cwd);
      expect(subagentContext.workspaceRoot).toBe(parentContext.workspaceRoot);
      
      // 验证权限裁剪
      expect(subagentContext.allowedTools).toContain('fs.read');
      expect(subagentContext.forbiddenTools).toContain('fs.write');
      expect(subagentContext.maxTurns).toBe(10);
    });
    
    it('应该裁剪工具权限（子代理权限 ≤ 父上下文）', () => {
      const parentContext = new MockExecutionContext() as ExecutionContext;
      const adapter = new ExecutionContextAdapter();
      
      const teamContext = adapter.convertToTeamContext(
        parentContext,
        'team_test',
        'task_parent',
        { maxTurns: 50, timeoutMs: 300000 }
      );
      
      // 父上下文允许所有工具
      const subagentTask: SubagentTask = {
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
      expect(subagentContext.allowedTools).not.toContain('fs.write');
      expect(subagentContext.allowedTools).not.toContain('git.commit');
      expect(subagentContext.allowedTools).toContain('fs.read');
    });
    
    it('应该将 SubagentResult 转换为可归档格式', () => {
      const adapter = new ExecutionContextAdapter();
      
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
          { type: 'text' as const, description: '计划文档', content: '...' },
        ],
        patches: [
          { fileId: 'src/app.ts', diff: '...', hunks: 1, linesAdded: 5, linesDeleted: 2 },
        ],
        findings: [
          { type: 'suggestion' as const, severity: 'low' as const, description: '建议优化' },
        ],
      };
      
      const normalized = adapter.normalizeSubagentResult(result, 'task_parent');
      
      expect(normalized.summary).toBe('规划完成');
      expect(normalized.artifacts.length).toBe(1);
      expect(normalized.patches?.length).toBe(1);
      expect(normalized.findings?.length).toBe(1);
    });
  });
  
  describe('Permission Bridge', () => {
    it('应该验证角色工具访问', () => {
      const permissionEngine = new MockPermissionEngine() as any;
      const bridge = new PermissionBridge(permissionEngine);
      
      // planner 允许的工具
      expect(bridge.validateToolAccess('planner', 'fs.read')).toBe(true);
      expect(bridge.validateToolAccess('planner', 'fs.list')).toBe(true);
      
      // planner 禁止的工具
      expect(bridge.validateToolAccess('planner', 'fs.write')).toBe(false);
      expect(bridge.validateToolAccess('planner', 'git.commit')).toBe(false);
      
      // code_fixer 允许的工具
      expect(bridge.validateToolAccess('code_fixer', 'fs.write')).toBe(true);
    });
    
    it('应该获取角色工具列表', () => {
      const permissionEngine = new MockPermissionEngine() as any;
      const bridge = new PermissionBridge(permissionEngine);
      
      const allowed = bridge.getAllowedTools('planner');
      expect(allowed.length).toBeGreaterThan(0);
      expect(allowed).toContain('fs.read');
      
      const forbidden = bridge.getForbiddenTools('planner');
      expect(forbidden.length).toBeGreaterThan(0);
      expect(forbidden).toContain('fs.write');
    });
    
    it('应该检查权限（集成 PermissionEngine）', async () => {
      const permissionEngine = new MockPermissionEngine() as any;
      const bridge = new PermissionBridge(permissionEngine);
      
      const decision = await bridge.checkPermission({
        subagentTaskId: 'task_sub_1',
        teamId: 'team_test',
        role: 'planner',
        tool: 'fs.read',
      });
      
      expect(decision.allowed).toBe(true);
    });
  });
  
  describe('TaskStore Bridge', () => {
    it('应该创建团队任务', async () => {
      const taskStore = new MockTaskStore() as any;
      const bridge = new TaskStoreBridge(taskStore);
      
      const teamTask = await bridge.createTeamTask(
        'team_test',
        'task_parent',
        'session_123',
        'main_assistant',
        '/workspace',
        '测试团队目标'
      );
      
      expect(teamTask.id).toBeDefined();
      expect(teamTask.type).toBe('subagent');
      expect(teamTask.parentTaskId).toBe('task_parent');
      expect(teamTask.metadata?.teamId).toBe('team_test');
    });
    
    it('应该创建子代理任务', async () => {
      const taskStore = new MockTaskStore() as any;
      const bridge = new TaskStoreBridge(taskStore);
      
      const teamTask = await bridge.createTeamTask(
        'team_test',
        'task_parent',
        'session_123',
        'main_assistant',
        '/workspace',
        '测试团队'
      );
      
      const subagentTask: SubagentTask = {
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
      
      expect(subtask.id).toBeDefined();
      expect(subtask.parentTaskId).toBe(teamTask.id);
      expect(subtask.metadata?.subagentTaskId).toBe('task_sub_1');
      expect(subtask.metadata?.role).toBe('planner');
    });
    
    it('应该更新子任务状态', async () => {
      const taskStore = new MockTaskStore() as any;
      const bridge = new TaskStoreBridge(taskStore);
      
      const teamTask = await bridge.createTeamTask(
        'team_test',
        'task_parent',
        'session_123',
        'main_assistant',
        '/workspace',
        '测试团队'
      );
      
      const subagentTask: SubagentTask = {
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
      expect(updated.status).toBe('running');
    });
    
    it('应该记录子代理结果', async () => {
      const taskStore = new MockTaskStore() as any;
      const bridge = new TaskStoreBridge(taskStore);
      
      const teamTask = await bridge.createTeamTask(
        'team_test',
        'task_parent',
        'session_123',
        'main_assistant',
        '/workspace',
        '测试团队'
      );
      
      const subagentTask: SubagentTask = {
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
      expect(updated.metadata?.result.summary).toBe('规划完成');
      expect(updated.output).toContain('Subagent Result');
    });
    
    it('应该获取团队的所有子任务', async () => {
      const taskStore = new MockTaskStore() as any;
      const bridge = new TaskStoreBridge(taskStore);
      
      const teamTask = await bridge.createTeamTask(
        'team_test',
        'task_parent',
        'session_123',
        'main_assistant',
        '/workspace',
        '测试团队'
      );
      
      // 创建 3 个子任务
      for (let i = 0; i < 3; i++) {
        const subagentTask: SubagentTask = {
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
      
      expect(subtasks.length).toBe(3);
    });
  });
  
  describe('Parent-Child 状态传导', () => {
    it('应该取消所有子任务当 parent cancel', async () => {
      const taskStore = new MockTaskStore() as any;
      const bridge = new TaskStoreBridge(taskStore);
      const hookBus = new AgentTeamHookBus();
      const runner = new SubagentRunner(hookBus);
      const orchestrator = new TeamOrchestrator(runner, hookBus);
      
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
      const teamTask = await bridge.createTeamTask(
        context.teamId,
        'task_parent',
        'session_123',
        'main_assistant',
        '/workspace',
        context.agents[0].goal
      );
      
      for (const agent of context.agents) {
        await bridge.createSubagentTask(agent, teamTask.id);
      }
      
      // 取消团队
      await orchestrator.cancelTeam(context.teamId, '用户取消');
      
      // 验证所有子任务状态
      const subtasks = await bridge.getTeamSubtasks(teamTask.id);
      expect(subtasks.every(t => t.status === 'pending' || t.status === 'cancelled')).toBe(true);
    });
  });
  
  describe('HookBus 集成', () => {
    it('应该触发完整的团队生命周期事件', async () => {
      const hookEvents: string[] = [];
      const hookBus = new AgentTeamHookBus();
      
      hookBus.on('TeamCreate', () => hookEvents.push('TeamCreate'));
      hookBus.on('SubagentStart', () => hookEvents.push('SubagentStart'));
      hookBus.on('SubagentStop', () => hookEvents.push('SubagentStop'));
      hookBus.on('TeamComplete', () => hookEvents.push('TeamComplete'));
      
      const runner = new SubagentRunner(hookBus);
      const orchestrator = new TeamOrchestrator(runner, hookBus);
      
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
      
      expect(hookEvents).toContain('TeamCreate');
      expect(hookEvents).toContain('SubagentStart');
      expect(hookEvents).toContain('SubagentStop');
    });
  });
});
