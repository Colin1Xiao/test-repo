/**
 * EntrypointAudit - 主入口接管审计
 * 
 * 核对所有真实入口是否已走新 runtime：
 * - Telegram 主消息入口
 * - 本地 CLI / shell 入口
 * - 旧 skills/commands 执行入口
 * - 后台任务恢复入口
 * - approval 恢复入口
 * - session start / end 生命周期
 * 
 * 输出接管表：
 * | 入口 | QueryGuard | PermissionEngine | TaskStore | HookBus |
 */

/** 入口接管状态 */
export interface EntrypointStatus {
  /** 入口名称 */
  name: string;
  /** 是否已走新 runtime */
  usesRuntime: boolean;
  /** 是否走 QueryGuard */
  usesQueryGuard: boolean;
  /** 是否走 PermissionEngine */
  usesPermissionEngine: boolean;
  /** 是否写 TaskStore */
  usesTaskStore: boolean;
  /** 是否发 HookBus */
  usesHookBus: boolean;
  /** 备注 */
  notes?: string;
  /** 风险等级 */
  risk: 'low' | 'medium' | 'high';
}

/** 审计结果 */
export interface AuditResult {
  /** 审计时间 */
  timestamp: number;
  /** 入口列表 */
  entrypoints: EntrypointStatus[];
  /** 统计 */
  summary: {
    total: number;
    fullyMigrated: number;
    partiallyMigrated: number;
    notMigrated: number;
    highRiskCount: number;
  };
  /** 建议 */
  recommendations: string[];
}

/** 主入口接管审计 */
export class EntrypointAuditor {
  private entrypoints: Map<string, EntrypointStatus> = new Map();

  /**
   * 注册入口
   */
  register(entrypoint: EntrypointStatus): void {
    this.entrypoints.set(entrypoint.name, entrypoint);
  }

  /**
   * 更新入口状态
   */
  update(
    name: string,
    patch: Partial<EntrypointStatus>,
  ): EntrypointStatus | null {
    const existing = this.entrypoints.get(name);
    if (!existing) {
      return null;
    }

    const updated = { ...existing, ...patch };
    this.entrypoints.set(name, updated);
    return updated;
  }

  /**
   * 执行审计
   */
  audit(): AuditResult {
    const entrypoints = Array.from(this.entrypoints.values());
    
    const summary = {
      total: entrypoints.length,
      fullyMigrated: 0,
      partiallyMigrated: 0,
      notMigrated: 0,
      highRiskCount: 0,
    };

    const recommendations: string[] = [];

    for (const ep of entrypoints) {
      // 统计完全迁移
      const allFlags = [
        ep.usesRuntime,
        ep.usesQueryGuard,
        ep.usesPermissionEngine,
        ep.usesTaskStore,
        ep.usesHookBus,
      ];
      
      const trueCount = allFlags.filter(f => f).length;
      
      if (trueCount === 5) {
        summary.fullyMigrated++;
      } else if (trueCount >= 3) {
        summary.partiallyMigrated++;
      } else {
        summary.notMigrated++;
      }

      if (ep.risk === 'high') {
        summary.highRiskCount++;
        recommendations.push(
          `🔴 高风险入口 "${ep.name}" 未完全接入新 runtime：${ep.notes}`,
        );
      } else if (trueCount < 5) {
        recommendations.push(
          `🟡 入口 "${ep.name}" 部分功能未接入：${ep.notes}`,
        );
      }
    }

    return {
      timestamp: Date.now(),
      entrypoints,
      summary,
      recommendations,
    };
  }

  /**
   * 获取接管表（文本格式）
   */
  getTable(): string {
    const result = this.audit();
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('主入口接管审计表');
    lines.push('='.repeat(80));
    lines.push('');
    lines.push(
      [
        '入口',
        'Runtime',
        'QueryGuard',
        'PermissionEngine',
        'TaskStore',
        'HookBus',
        '风险',
        '备注',
      ].join(' | '),
    );
    lines.push('-'.repeat(80));

    for (const ep of result.entrypoints) {
      lines.push(
        [
          ep.name,
          ep.usesRuntime ? '✅' : '❌',
          ep.usesQueryGuard ? '✅' : '❌',
          ep.usesPermissionEngine ? '✅' : '❌',
          ep.usesTaskStore ? '✅' : '❌',
          ep.usesHookBus ? '✅' : '❌',
          ep.risk === 'high' ? '🔴' : ep.risk === 'medium' ? '🟡' : '🟢',
          ep.notes ?? '-',
        ].join(' | '),
      );
    }

    lines.push('');
    lines.push('='.repeat(80));
    lines.push('统计');
    lines.push('='.repeat(80));
    lines.push(`总计：${result.summary.total}`);
    lines.push(`完全迁移：${result.summary.fullyMigrated}`);
    lines.push(`部分迁移：${result.summary.partiallyMigrated}`);
    lines.push(`未迁移：${result.summary.notMigrated}`);
    lines.push(`高风险入口：${result.summary.highRiskCount}`);
    lines.push('');

    if (result.recommendations.length > 0) {
      lines.push('建议');
      lines.push('-'.repeat(80));
      for (const rec of result.recommendations) {
        lines.push(rec);
      }
    }

    return lines.join('\n');
  }

  /**
   * 获取高风险入口列表
   */
  getHighRiskEntrypoints(): EntrypointStatus[] {
    return Array.from(this.entrypoints.values()).filter(ep => ep.risk === 'high');
  }

  /**
   * 获取未完全迁移的入口
   */
  getIncompleteEntrypoints(): EntrypointStatus[] {
    return Array.from(this.entrypoints.values()).filter(
      ep =>
        !ep.usesRuntime ||
        !ep.usesQueryGuard ||
        !ep.usesPermissionEngine ||
        !ep.usesTaskStore ||
        !ep.usesHookBus,
    );
  }
}

/**
 * 创建默认审计配置（预注册已知入口）
 */
export function createDefaultAuditor(): EntrypointAuditor {
  const auditor = new EntrypointAuditor();

  // 预注册已知入口（需要根据实际情况更新状态）
  auditor.register({
    name: 'Telegram 主消息入口',
    usesRuntime: false, // 待确认
    usesQueryGuard: false, // 待确认
    usesPermissionEngine: false, // 待确认
    usesTaskStore: false, // 待确认
    usesHookBus: false, // 待确认
    notes: '需要接入 QueryGuard 和 ToolRegistry.invoke()',
    risk: 'high',
  });

  auditor.register({
    name: '本地 CLI 入口',
    usesRuntime: false, // 待确认
    usesQueryGuard: false, // 待确认
    usesPermissionEngine: false, // 待确认
    usesTaskStore: false, // 待确认
    usesHookBus: false, // 待确认
    notes: '需要确认是否走新 runtime',
    risk: 'medium',
  });

  auditor.register({
    name: '旧 skills 执行入口',
    usesRuntime: false, // 待确认
    usesQueryGuard: false,
    usesPermissionEngine: false,
    usesTaskStore: false,
    usesHookBus: false,
    notes: '需要通过 legacy_tool_adapter 迁移',
    risk: 'high',
  });

  auditor.register({
    name: '后台任务恢复入口',
    usesRuntime: false, // 待确认
    usesQueryGuard: false,
    usesPermissionEngine: false,
    usesTaskStore: true, // 假设有
    usesHookBus: false,
    notes: '需要接入 QueryGuard 防止重入',
    risk: 'medium',
  });

  auditor.register({
    name: 'Approval 恢复入口',
    usesRuntime: true, // ApprovalBridge 已实现
    usesQueryGuard: false,
    usesPermissionEngine: true,
    usesTaskStore: true,
    usesHookBus: true,
    notes: 'ApprovalBridge 已接入',
    risk: 'low',
  });

  auditor.register({
    name: 'Session Start',
    usesRuntime: false, // 待确认
    usesQueryGuard: false,
    usesPermissionEngine: false,
    usesTaskStore: false,
    usesHookBus: true, // SessionStartHandler 已注册
    notes: 'SessionStartHandler 已注册 hook',
    risk: 'low',
  });

  auditor.register({
    name: 'Session End',
    usesRuntime: false, // 待确认
    usesQueryGuard: false,
    usesPermissionEngine: false,
    usesTaskStore: false,
    usesHookBus: true, // 待确认
    notes: '需要确认 hook 是否触发',
    risk: 'low',
  });

  return auditor;
}
