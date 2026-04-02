/**
 * ToolRegistry - 工具注册与调用中心
 * 
 * 统一注册、发现、调用所有技能/工具。
 * 新旧工具都通过此注册表接入，agent 选工具查 registry。
 * 
 * 功能：
 * - register(skill) - 注册技能
 * - get(name) - 获取技能
 * - list() - 列出所有技能
 * - search(query) - 搜索技能
 * - invoke(name, ctx, input) - 调用技能
 */

import { Skill, SkillDef, buildSkill, ExecutionContext } from './build_skill';
import { PermissionEngine } from './permission_engine';
import { TaskStore, RuntimeTask, TaskType } from './task_store';
import { HookBus } from './hook_bus';
import { QueryGuard } from './query_guard';

/** 技能注册项 */
interface SkillEntry {
  skill: Skill;
  enabled: boolean;
  createdAt: number;
  callCount: number;
}

/** ToolRegistry 配置 */
export interface ToolRegistryConfig {
  permissions?: PermissionEngine;
  tasks?: TaskStore;
  hooks?: HookBus;
  guard?: QueryGuard;
}

/** 搜索结果 */
export interface SearchMatch {
  name: string;
  description: string;
  category: string;
  tags: string[];
  score: number;
}

/** ToolRegistry 实现 */
export class ToolRegistry {
  private skills: Map<string, SkillEntry> = new Map();
  private permissions?: PermissionEngine;
  private tasks?: TaskStore;
  private hooks?: HookBus;
  private guard?: QueryGuard;

  constructor(config: ToolRegistryConfig = {}) {
    this.permissions = config.permissions;
    this.tasks = config.tasks;
    this.hooks = config.hooks;
    this.guard = config.guard;
  }

  /**
   * 注册技能
   * 
   * @param skill 技能定义
   * 
   * @example
   * registry.register(buildSkill({
   *   name: 'fs.read',
   *   description: 'Read file',
   *   category: 'fs',
   *   inputSchema: z.object({ path: z.string() }),
   *   async handler(ctx, input) {
   *     return await ctx.fs.readFile(input.path);
   *   },
   * }));
   */
  register(skill: Skill | SkillDef): void {
    const built = 'kind' in skill ? skill : buildSkill(skill);
    
    this.skills.set(built.name, {
      skill: built,
      enabled: true,
      createdAt: Date.now(),
      callCount: 0,
    });
  }

  /**
   * 获取技能
   */
  get(name: string): Skill | undefined {
    return this.skills.get(name)?.skill;
  }

  /**
   * 列出所有技能
   */
  list(options?: { enabledOnly?: boolean; category?: string }): Skill[] {
    const result: Skill[] = [];
    
    this.skills.forEach((entry, name) => {
      if (options?.enabledOnly && !entry.enabled) return;
      if (options?.category && entry.skill.category !== options.category) return;
      result.push(entry.skill);
    });
    
    return result;
  }

  /**
   * 搜索技能（按名称/描述/标签）
   */
  search(query: string): SearchMatch[] {
    const results: SearchMatch[] = [];
    const queryLower = query.toLowerCase();
    
    this.skills.forEach((entry, name) => {
      if (!entry.enabled) return;
      
      const skill = entry.skill;
      let score = 0;
      
      // 名称匹配（最高权重）
      if (skill.name.toLowerCase().includes(queryLower)) {
        score += 100;
      }
      
      // 描述匹配
      if (skill.description.toLowerCase().includes(queryLower)) {
        score += 50;
      }
      
      // 标签匹配
      if (skill.tags?.some(tag => tag.toLowerCase().includes(queryLower))) {
        score += 30;
      }
      
      // 搜索提示匹配
      if (skill.searchHint?.toLowerCase().includes(queryLower)) {
        score += 20;
      }
      
      if (score > 0) {
        results.push({
          name: skill.name,
          description: skill.description,
          category: skill.category,
          tags: skill.tags ?? [],
          score,
        });
      }
    });
    
    // 按分数排序
    results.sort((a, b) => b.score - a.score);
    return results;
  }

  /**
   * 调用技能
   * 
   * @param name 技能名称
   * @param ctx 执行上下文
   * @param input 输入参数
   * @returns 执行结果
   * 
   * 完整链路：
   * QueryGuard → PermissionEngine → TaskStore → HookBus → handler
   */
  async invoke<TInput = any, TOutput = any>(
    name: string,
    ctx: ExecutionContext,
    input: TInput,
  ): Promise<TOutput> {
    const entry = this.skills.get(name);
    if (!entry) {
      throw new Error(`Skill not found: ${name}`);
    }
    
    if (!entry.enabled) {
      throw new Error(`Skill disabled: ${name}`);
    }
    
    const skill = entry.skill;
    
    // 1. QueryGuard 检查（防止并发）
    if (this.guard && !this.guard.isActive()) {
      const gen = this.guard.tryStart();
      if (gen === null) {
        throw new Error('Query already running');
      }
      // 执行完成后会由调用方结束
    }
    
    // 2. 权限检查
    if (this.permissions) {
      const decision = this.permissions.evaluate({
        tool: skill.name,
        action: skill.category,
        target: typeof input === 'string' ? input : JSON.stringify(input),
        payload: input,
        cwd: ctx.cwd,
      });
      
      if (!decision.allowed && decision.behavior === 'deny') {
        // 发送 denied hook
        if (this.hooks) {
          await this.hooks.emit({
            type: 'tool.denied',
            sessionId: ctx.sessionId,
            taskId: ctx.taskId,
            tool: skill.name,
            reason: decision.explanation,
            timestamp: Date.now(),
          });
        }
        throw new Error(`Permission denied: ${decision.explanation}`);
      }
      
      if (!decision.allowed && decision.behavior === 'ask') {
        // 需要审批 - 抛出异常让上层处理
        const approvalError = new ApprovalRequiredError(
          decision.explanation,
          skill.name,
          input,
          ctx,
        );
        throw approvalError;
      }
    }
    
    // 3. 创建任务（如果是执行类操作）
    let task: RuntimeTask | undefined;
    if (this.tasks && ['exec', 'fs', 'workflow'].includes(skill.category)) {
      task = this.tasks.create({
        type: skill.category === 'exec' ? 'exec' : 'workflow',
        sessionId: ctx.sessionId,
        agentId: ctx.agentId,
        workspaceRoot: ctx.workspaceRoot,
        description: `${skill.name}(${JSON.stringify(input).slice(0, 50)}...)`,
      });
      
      // 发送 task.created hook
      if (this.hooks) {
        await this.hooks.emit({
          type: 'task.created',
          taskId: task.id,
          taskType: task.type,
          sessionId: ctx.sessionId,
          description: task.description,
          timestamp: Date.now(),
        });
      }
      
      // 更新 taskId 到上下文
      ctx.taskId = task.id;
    }
    
    // 4. 发送 before hook
    if (this.hooks) {
      await this.hooks.emit({
        type: 'tool.before',
        sessionId: ctx.sessionId,
        taskId: ctx.taskId,
        tool: skill.name,
        input,
        timestamp: Date.now(),
      });
    }
    
    // 5. 执行技能
    const startTime = Date.now();
    let success = true;
    let output: TOutput;
    
    try {
      // 更新任务状态为 running
      if (task && this.tasks) {
        this.tasks.update(task.id, { status: 'running' });
      }
      
      output = await skill.handler(ctx, input);
      
      // 更新任务状态为 completed
      if (task && this.tasks) {
        this.tasks.update(task.id, { status: 'completed' });
      }
    } catch (error) {
      success = false;
      
      // 更新任务状态为 failed
      if (task && this.tasks) {
        this.tasks.update(task.id, { 
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        });
      }
      
      throw error;
    } finally {
      // 6. 发送 after hook
      if (this.hooks) {
        const durationMs = Date.now() - startTime;
        await this.hooks.emit({
          type: 'tool.after',
          sessionId: ctx.sessionId,
          taskId: ctx.taskId,
          tool: skill.name,
          input,
          output: output!,
          ok: success,
          durationMs,
          timestamp: Date.now(),
        });
      }
      
      // 更新调用计数
      entry.callCount++;
      
      // 结束 QueryGuard
      if (this.guard && task) {
        // 通过 generation 验证
      }
    }
    
    return output;
  }

  /**
   * 禁用技能
   */
  disable(name: string): void {
    const entry = this.skills.get(name);
    if (entry) {
      entry.enabled = false;
    }
  }

  /**
   * 启用技能
   */
  enable(name: string): void {
    const entry = this.skills.get(name);
    if (entry) {
      entry.enabled = true;
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    enabled: number;
    disabled: number;
    byCategory: Record<string, number>;
  } {
    const stats = {
      total: this.skills.size,
      enabled: 0,
      disabled: 0,
      byCategory: {} as Record<string, number>,
    };
    
    this.skills.forEach(entry => {
      if (entry.enabled) {
        stats.enabled++;
      } else {
        stats.disabled++;
      }
      
      const cat = entry.skill.category;
      stats.byCategory[cat] = (stats.byCategory[cat] ?? 0) + 1;
    });
    
    return stats;
  }
}

/** 审批需要错误类 */
export class ApprovalRequiredError extends Error {
  constructor(
    message: string,
    public tool: string,
    public input: any,
    public ctx: ExecutionContext,
  ) {
    super(message);
    this.name = 'ApprovalRequiredError';
  }
}
