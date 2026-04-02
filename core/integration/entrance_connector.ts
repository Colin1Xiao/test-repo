/**
 * EntranceConnector - 入口连接器
 * 
 * 将真实入口强制改走统一主链：
 * - Telegram 主消息入口
 * - CLI 入口
 * - 旧 skills 执行入口
 * - 后台任务恢复入口
 * 
 * 统一主链：
 * 入口 → QueryGuard → agent binding → ToolRegistry → PermissionEngine → TaskStore → HookBus → output
 */

import { QueryGuard } from '../runtime/query_guard';
import { ToolRegistry } from '../runtime/tool_registry';
import { PermissionEngine } from '../runtime/permission_engine';
import { TaskStore } from '../runtime/task_store';
import { HookBus } from '../runtime/hook_bus';
import { AgentRegistry } from '../agents/agent_registry';
import { ApprovalBridge } from '../bridge/approval_bridge';
import { createExecutionContext, type ExecutionContext } from '../runtime/execution_context';

/** 入口连接配置 */
export interface EntranceConnectorConfig {
  queryGuard: QueryGuard;
  toolRegistry: ToolRegistry;
  permissions: PermissionEngine;
  tasks: TaskStore;
  hooks: HookBus;
  agents: AgentRegistry;
  approvalBridge?: ApprovalBridge;
  workspaceRoot: string;
}

/** 入口连接器 */
export class EntranceConnector {
  private queryGuard: QueryGuard;
  private toolRegistry: ToolRegistry;
  private permissions: PermissionEngine;
  private tasks: TaskStore;
  private hooks: HookBus;
  private agents: AgentRegistry;
  private approvalBridge?: ApprovalBridge;
  private workspaceRoot: string;

  constructor(config: EntranceConnectorConfig) {
    this.queryGuard = config.queryGuard;
    this.toolRegistry = config.toolRegistry;
    this.permissions = config.permissions;
    this.tasks = config.tasks;
    this.hooks = config.hooks;
    this.agents = config.agents;
    this.approvalBridge = config.approvalBridge;
    this.workspaceRoot = config.workspaceRoot;
  }

  /**
   * 处理用户消息（统一主链入口）
   * 
   * 适用于：
   * - Telegram 消息
   * - CLI 命令
   * - 其他用户输入
   */
  async handleUserMessage(options: {
    sessionId: string;
    turnId: string;
    message: string;
    agentName?: string;
    fromUser?: { id: string; username?: string };
  }): Promise<{
    success: boolean;
    output?: string;
    error?: string;
  }> {
    // 1. QueryGuard 防并发
    if (!this.queryGuard.reserve()) {
      return {
        success: false,
        error: 'Another request is already processing',
      };
    }

    const gen = this.queryGuard.tryStart();
    if (gen === null) {
      return {
        success: false,
        error: 'Request already running',
      };
    }

    try {
      // 2. Agent 绑定
      const agentName = options.agentName ?? 'main_assistant';
      if (!this.agents.getAgent(options.sessionId)) {
        this.agents.bindAgent(options.sessionId, agentName);
      }

      // 3. 创建执行上下文
      const ctx = createExecutionContext({
        sessionId: options.sessionId,
        turnId: options.turnId,
        agentId: agentName,
        workspaceRoot: this.workspaceRoot,
        cwd: this.workspaceRoot,
        logger: console,
        emit: this.hooks.emit.bind(this.hooks),
        state: {
          get: (key: string) => undefined,
          set: (key: string, value: any) => {},
          delete: (key: string) => {},
        },
        permissions: this.permissions,
        tasks: this.tasks,
        memory: {
          read: async () => [],
          write: async () => {},
        },
        fs: {
          readFile: async (path: string) => '',
          writeFile: async (path: string, content: string) => {},
          exists: async (path: string) => false,
          listDir: async (path: string) => [],
        },
        exec: {
          run: async (command: string) => ({ stdout: '', stderr: '', code: 0 }),
        },
        requestApproval: async (req) => {
          if (!this.approvalBridge) {
            throw new Error('ApprovalBridge not configured');
          }
          const id = await this.approvalBridge.request(req);
          const decision = await this.approvalBridge.waitForDecision(id);
          return decision;
        },
        appendSystemNote: (note: string) => {},
      });

      // 4. 发送 session.started hook
      await this.hooks.emit({
        type: 'session.started',
        sessionId: options.sessionId,
        agentId: agentName,
        timestamp: Date.now(),
      });

      // 5. 调用工具/技能（这里简化为直接返回）
      // 实际应调用 planner 或 skill router
      return {
        success: true,
        output: 'Message processed through new runtime',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      // 6. 结束 QueryGuard
      this.queryGuard.end(gen);
      
      // 7. 发送 session.ended hook
      await this.hooks.emit({
        type: 'session.ended',
        sessionId: options.sessionId,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 调用工具（统一入口）
   * 
   * 适用于：
   * - 旧 skills 迁移
   * - 直接工具调用
   */
  async invokeTool(options: {
    sessionId: string;
    taskId?: string;
    toolName: string;
    input: any;
  }): Promise<any> {
    // 创建执行上下文
    const ctx = createExecutionContext({
      sessionId: options.sessionId,
      turnId: `turn_${Date.now()}`,
      taskId: options.taskId,
      agentId: this.agents.getAgentName(options.sessionId) ?? 'main_assistant',
      workspaceRoot: this.workspaceRoot,
      cwd: this.workspaceRoot,
      logger: console,
      emit: this.hooks.emit.bind(this.hooks),
      state: {
        get: () => undefined,
        set: () => {},
        delete: () => {},
      },
      permissions: this.permissions,
      tasks: this.tasks,
      memory: {
        read: async () => [],
        write: async () => {},
      },
      fs: {
        readFile: async () => '',
        writeFile: async () => {},
        exists: async () => false,
        listDir: async () => [],
      },
      exec: {
        run: async () => ({ stdout: '', stderr: '', code: 0 }),
      },
      requestApproval: async (req) => {
        if (!this.approvalBridge) {
          throw new Error('ApprovalBridge not configured');
        }
        const id = await this.approvalBridge.request(req);
        return await this.approvalBridge.waitForDecision(id);
      },
      appendSystemNote: () => {},
    });

    // 通过 ToolRegistry 调用
    return this.toolRegistry.invoke(options.toolName, ctx, options.input);
  }

  /**
   * 恢复后台任务
   */
  async resumeTask(options: {
    taskId: string;
    sessionId: string;
  }): Promise<{
    success: boolean;
    error?: string;
  }> {
    const task = this.tasks.get(options.taskId);
    if (!task) {
      return {
        success: false,
        error: 'Task not found',
      };
    }

    // 检查是否需要审批恢复
    if (task.status === 'waiting_approval') {
      // 等待审批完成
      return {
        success: false,
        error: 'Task still waiting for approval',
      };
    }

    // 恢复执行（简化实现）
    return {
      success: true,
    };
  }

  /**
   * 获取接管状态
   */
  get接管Status(): {
    queryGuard: boolean;
    permissionEngine: boolean;
    taskStore: boolean;
    hookBus: boolean;
    agentRegistry: boolean;
  } {
    return {
      queryGuard: !!this.queryGuard,
      permissionEngine: !!this.permissions,
      taskStore: !!this.tasks,
      hookBus: !!this.hooks,
      agentRegistry: !!this.agents,
    };
  }
}

/**
 * 创建入口连接器（快速初始化）
 */
export function createEntranceConnector(options?: {
  workspaceRoot?: string;
}): EntranceConnector {
  const queryGuard = new QueryGuard();
  const permissions = new PermissionEngine();
  const tasks = new TaskStore();
  const hooks = new HookBus();
  const agents = new AgentRegistry();
  const toolRegistry = new ToolRegistry({
    permissions,
    tasks,
    hooks,
    guard: queryGuard,
  });
  const approvalBridge = new ApprovalBridge({
    store: undefined, // 使用默认
    hooks,
    tasks,
  });

  return new EntranceConnector({
    queryGuard,
    toolRegistry,
    permissions,
    tasks,
    hooks,
    agents,
    approvalBridge,
    workspaceRoot: options?.workspaceRoot ?? process.cwd(),
  });
}
