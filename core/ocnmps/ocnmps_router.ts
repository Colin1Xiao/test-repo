/**
 * OCNMPS Router V2 - 智能模型路由系统
 * 
 * 利用新 Runtime 能力解决路由幻觉问题：
 * - ToolRegistry: 统一模型调用入口
 * - PermissionEngine: 路由策略控制
 * - TaskStore: 路由任务追踪
 * - HookBus: 路由事件审计
 * - MemDir: 路由决策记忆
 * - task.verify: 路由验证
 */

import { ToolRegistry } from '../runtime/tool_registry';
import { HookBus } from '../runtime/hook_bus';
import { TaskStore } from '../runtime/task_store';
import { PermissionEngine } from '../runtime/permission_engine';
import { MemDir } from '../memory/memdir';

/** 路由配置 */
export interface OCNMPSConfig {
  /** 灰度比例 (0.0-1.0) */
  grayRatio: number;
  /** 模型映射 */
  modelMapping: Record<string, string>;
  /** 意图识别器 */
  intentClassifier: (text: string) => Promise<string>;
  /** 一致性哈希函数 */
  hashFunction: (text: string) => string;
}

/** 路由决策 */
export interface RoutingDecision {
  /** 原始文本 */
  input: string;
  /** 识别的意图 */
  intent: string;
  /** 推荐模型 */
  recommendedModel: string;
  /** 最终模型 */
  finalModel: string;
  /** 是否命中灰度 */
  grayHit: boolean;
  /** 灰度桶 */
  hashBucket: number;
  /** 灰度阈值 */
  threshold: number;
  /** 回退原因（如有） */
  fallbackReason?: string;
  /** 路由任务 ID */
  routingTaskId: string;
  /** 时间戳 */
  timestamp: number;
}

/** 路由验证结果 */
export interface RoutingVerification {
  /** 验证是否通过 */
  ok: boolean;
  /** 检查清单 */
  checklist: Array<{
    item: string;
    status: 'pass' | 'warn' | 'fail';
    note?: string;
  }>;
  /** 摘要 */
  summary: string;
}

/** OCNMPS Router V2 实现 */
export class OCNMPSRouter {
  private grayRatio: number;
  private modelMapping: Record<string, string>;
  private intentClassifier: (text: string) => Promise<string>;
  private hashFunction: (text: string) => string;
  private taskStore: TaskStore;
  private hookBus: HookBus;
  private memDir: MemDir;
  private permissionEngine?: PermissionEngine;

  constructor(config: OCNMPSConfig, dependencies: {
    taskStore: TaskStore;
    hookBus: HookBus;
    memDir?: MemDir;
    permissionEngine?: PermissionEngine;
  }) {
    this.grayRatio = config.grayRatio;
    this.modelMapping = config.modelMapping;
    this.intentClassifier = config.intentClassifier;
    this.hashFunction = config.hashFunction;
    this.taskStore = dependencies.taskStore;
    this.hookBus = dependencies.hookBus;
    this.memDir = dependencies.memDir ?? new MemDir();
    this.permissionEngine = dependencies.permissionEngine;
  }

  /**
   * 路由决策（带完整审计）
   */
  async route(options: {
    text: string;
    sessionId: string;
    defaultModel: string;
  }): Promise<RoutingDecision> {
    const { text, sessionId, defaultModel } = options;

    // 1. 创建路由任务
    const routingTask = this.taskStore.create({
      type: 'workflow',
      sessionId,
      agentId: 'ocnmps',
      workspaceRoot: process.cwd(),
      description: `OCNMPS routing: ${text.substring(0, 50)}...`,
    });

    // 2. 发送路由开始 hook
    await this.hookBus.emit({
      type: 'task.created',
      taskId: routingTask.id,
      taskType: 'workflow',
      sessionId,
      description: routingTask.description,
      timestamp: Date.now(),
    });

    // 3. 意图识别
    const intent = await this.intentClassifier(text);
    this.taskStore.appendOutput(routingTask.id, `🧠 Intent: ${intent}\n`);

    // 4. 灰度计算（MD5 分桶）
    const hash = this.hashFunction(text);
    const hashBucket = parseInt(hash.substring(0, 8), 16) % 10000;
    const threshold = Math.floor(this.grayRatio * 10000);
    const grayHit = hashBucket < threshold;

    this.taskStore.appendOutput(
      routingTask.id,
      `🎲 Gray: bucket=${hashBucket}, threshold=${threshold}, hit=${grayHit}\n`,
    );

    // 5. 推荐模型
    const recommendedModel = this.modelMapping[intent] ?? defaultModel;

    // 6. 最终模型决策
    let finalModel: string;
    let fallbackReason: string | undefined;

    if (grayHit) {
      finalModel = recommendedModel;
      this.taskStore.appendOutput(
        routingTask.id,
        `✅ Routing to ${finalModel} (gray hit)\n`,
      );
    } else {
      finalModel = defaultModel;
      fallbackReason = 'gray_miss';
      this.taskStore.appendOutput(
        routingTask.id,
        `⏭️ Using default ${defaultModel} (gray miss)\n`,
      );
    }

    // 7. 路由验证
    const verification = this.verifyRouting({
      intent,
      recommendedModel,
      finalModel,
      grayHit,
    });

    if (!verification.ok) {
      this.taskStore.appendOutput(
        routingTask.id,
        `⚠️ Verification warning: ${verification.summary}\n`,
      );
    }

    // 8. 完成任务
    this.taskStore.update(routingTask.id, {
      status: 'completed',
      metadata: {
        intent,
        recommendedModel,
        finalModel,
        grayHit,
        hashBucket,
        threshold,
        verification,
      },
    });

    // 9. 发送路由完成 hook
    await this.hookBus.emit({
      type: 'task.status_changed',
      taskId: routingTask.id,
      sessionId,
      from: 'running',
      to: 'completed',
      timestamp: Date.now(),
    });

    // 10. 写入记忆（高价值路由决策）
    if (grayHit || intent !== 'MAIN') {
      this.memDir.create({
        scope: 'ops',
        title: `OCNMPS Routing: ${intent}`,
        summary: `${text.substring(0, 100)}... → ${finalModel}`,
        tags: ['ocnmps', 'routing', intent.toLowerCase()],
        path: `ops/ocnmps_routing_${routingTask.id}.md`,
        source: sessionId,
      }, `
## Routing Decision

- Input: ${text}
- Intent: ${intent}
- Recommended: ${recommendedModel}
- Final: ${finalModel}
- Gray Hit: ${grayHit}
- Hash Bucket: ${hashBucket}
- Threshold: ${threshold}

## Verification

${verification.checklist.map(c => `- ${c.item}: ${c.status}`).join('\n')}
`);
    }

    return {
      input: text,
      intent,
      recommendedModel,
      finalModel,
      grayHit,
      hashBucket,
      threshold,
      fallbackReason,
      routingTaskId: routingTask.id,
      timestamp: Date.now(),
    };
  }

  /**
   * 验证路由决策
   */
  verifyRouting(decision: {
    intent: string;
    recommendedModel: string;
    finalModel: string;
    grayHit: boolean;
  }): RoutingVerification {
    const checklist: RoutingVerification['checklist'] = [];

    // 检查 1: 意图是否有效
    const validIntents = ['CODE', 'REASON', 'LONG', 'CN', 'FAST', 'MAIN'];
    if (validIntents.includes(decision.intent)) {
      checklist.push({
        item: 'Intent is valid',
        status: 'pass',
        note: decision.intent,
      });
    } else {
      checklist.push({
        item: 'Intent is valid',
        status: 'warn',
        note: `Unknown intent: ${decision.intent}`,
      });
    }

    // 检查 2: 灰度命中时模型是否切换
    if (decision.grayHit && decision.recommendedModel !== decision.finalModel) {
      checklist.push({
        item: 'Gray hit model switch',
        status: 'fail',
        note: `Expected ${decision.recommendedModel}, got ${decision.finalModel}`,
      });
    } else {
      checklist.push({
        item: 'Gray hit model switch',
        status: 'pass',
        note: decision.grayHit ? 'Switched' : 'N/A',
      });
    }

    // 检查 3: 模型是否在映射表中
    if (this.modelMapping[decision.intent] || decision.intent === 'MAIN') {
      checklist.push({
        item: 'Model mapping exists',
        status: 'pass',
      });
    } else {
      checklist.push({
        item: 'Model mapping exists',
        status: 'warn',
        note: `No mapping for ${decision.intent}`,
      });
    }

    // 检查 4: 默认模型是否合理
    if (decision.finalModel) {
      checklist.push({
        item: 'Final model specified',
        status: 'pass',
      });
    } else {
      checklist.push({
        item: 'Final model specified',
        status: 'fail',
        note: 'No final model',
      });
    }

    const passCount = checklist.filter(c => c.status === 'pass').length;
    const warnCount = checklist.filter(c => c.status === 'warn').length;
    const failCount = checklist.filter(c => c.status === 'fail').length;

    const summary = `Verification: ${passCount} pass, ${warnCount} warn, ${failCount} fail`;

    return {
      ok: failCount === 0,
      checklist,
      summary,
    };
  }

  /**
   * 获取路由历史
   */
  getRoutingHistory(options?: {
    sessionId?: string;
    grayHitOnly?: boolean;
    limit?: number;
  }): RoutingDecision[] {
    const tasks = this.taskStore.list({
      statusIn: ['completed'],
    });

    const results: RoutingDecision[] = [];

    for (const task of tasks.slice(0, options?.limit ?? 100)) {
      if (task.metadata && (task.metadata as any).intent) {
        const meta = task.metadata as any;
        
        if (options?.grayHitOnly && !meta.grayHit) {
          continue;
        }
        
        if (options?.sessionId && task.sessionId !== options.sessionId) {
          continue;
        }

        results.push({
          input: task.description,
          intent: meta.intent,
          recommendedModel: meta.recommendedModel,
          finalModel: meta.finalModel,
          grayHit: meta.grayHit,
          hashBucket: meta.hashBucket,
          threshold: meta.threshold,
          routingTaskId: task.id,
          timestamp: task.createdAt,
        });
      }
    }

    return results;
  }

  /**
   * 获取路由统计
   */
  getStats(): {
    total: number;
    grayHits: number;
    byIntent: Record<string, number>;
    byModel: Record<string, number>;
    avgVerificationScore: number;
  } {
    const history = this.getRoutingHistory({ limit: 1000 });
    
    const stats = {
      total: history.length,
      grayHits: history.filter(h => h.grayHit).length,
      byIntent: {} as Record<string, number>,
      byModel: {} as Record<string, number>,
      avgVerificationScore: 0,
    };

    for (const h of history) {
      stats.byIntent[h.intent] = (stats.byIntent[h.intent] ?? 0) + 1;
      stats.byModel[h.finalModel] = (stats.byModel[h.finalModel] ?? 0) + 1;
    }

    return stats;
  }
}

/**
 * 创建 OCNMPS Router V2（快速初始化）
 */
export function createOCNMPSRouter(config: {
  grayRatio?: number;
  modelMapping?: Record<string, string>;
  intentClassifier?: (text: string) => Promise<string>;
}): OCNMPSRouter {
  const taskStore = new TaskStore();
  const hookBus = new HookBus();
  const memDir = new MemDir();

  return new OCNMPSRouter(
    {
      grayRatio: config.grayRatio ?? 0.05,
      modelMapping: config.modelMapping ?? {
        CODE: 'modelstudio/qwen3-coder-next',
        REASON: 'xai/grok-4-1-fast-reasoning',
        LONG: 'modelstudio/qwen3.5-plus',
        CN: 'modelstudio/qwen3.5-plus',
        FAST: 'modelstudio/qwen3-max-2026-01-23',
        MAIN: 'modelstudio/qwen3.5-plus',
      },
      intentClassifier: async (text: string) => {
        // 简化意图识别（实际应调用分类模型）
        if (text.includes('code') || text.includes('function') || text.includes('class')) {
          return 'CODE';
        }
        if (text.includes('why') || text.includes('explain') || text.includes('reason')) {
          return 'REASON';
        }
        if (text.length > 500) {
          return 'LONG';
        }
        if (/[\u4e00-\u9fff]/.test(text)) {
          return 'CN';
        }
        return 'MAIN';
      },
      hashFunction: (text: string) => {
        // MD5 简化实现（实际应用 crypto 库）
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
          const char = text.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
      },
    },
    { taskStore, hookBus, memDir },
  );
}
