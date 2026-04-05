/**
 * Projection Service - 投影服务
 * 
 * 职责：
 * 1. 把 dashboard snapshot 投影成不同模式
 * 2. 支持 summary / detail / operator / management / incident / approval_focus / agent_focus
 * 3. 支持不同目标端：cli / telegram / web / audit / api
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  DashboardSnapshot,
  DashboardSection,
  DashboardCard,
  ProjectionMode,
  ProjectionTarget,
  ProjectionOptions,
  ProjectionResult,
  ProjectionFilter,
  ProjectionSort,
  ProjectionGroup,
} from './dashboard_types';

// ============================================================================
// 投影服务
// ============================================================================

export class ProjectionService {
  /**
   * 投影仪表盘
   */
  project(
    dashboard: DashboardSnapshot,
    options?: ProjectionOptions
  ): ProjectionResult {
    const now = Date.now();
    const mode = options?.mode || 'summary';
    const target = options?.target || 'api';
    
    // 应用过滤器
    const filteredSections = this.applyFilter(dashboard.sections, options?.filter);
    
    // 应用排序
    const sortedSections = this.applySort(filteredSections, options?.sort);
    
    // 应用分组
    const groupedSections = this.applyGroup(sortedSections, options?.group);
    
    // 限制项数
    const limitedSections = this.limitItems(groupedSections, options?.maxItems);
    
    // 生成投影内容
    const content = this.generateContent(limitedSections, dashboard.summary, mode, target);
    
    // 生成投影摘要
    const projectionSummary = this.buildProjectionSummary(dashboard.summary, limitedSections);
    
    return {
      projectionId: `projection_${now}`,
      mode,
      target,
      createdAt: now,
      content,
      sections: limitedSections,
      summary: projectionSummary,
      attentionItems: this.applyAttentionFilter(dashboard.attentionItems, options?.filter),
      metadata: {
        sourceDashboardId: dashboard.dashboardId,
        appliedFilter: options?.filter,
        appliedSort: options?.sort,
        itemCount: this.countItems(limitedSections),
      },
    };
  }
  
  /**
   * 投影为摘要模式
   */
  projectSummary(dashboard: DashboardSnapshot): ProjectionResult {
    return this.project(dashboard, {
      mode: 'summary',
      maxItems: 10,
    });
  }
  
  /**
   * 投影为详情模式
   */
  projectDetail(dashboard: DashboardSnapshot): ProjectionResult {
    return this.project(dashboard, {
      mode: 'detail',
      maxItems: 100,
    });
  }
  
  /**
   * 投影为操作员模式
   */
  projectOperator(dashboard: DashboardSnapshot): ProjectionResult {
    return this.project(dashboard, {
      mode: 'operator',
      filter: { attentionOnly: true },
      maxItems: 50,
    });
  }
  
  /**
   * 投影为管理模式
   */
  projectManagement(dashboard: DashboardSnapshot): ProjectionResult {
    return this.project(dashboard, {
      mode: 'management',
      maxItems: 20,
    });
  }
  
  /**
   * 投影为事件聚焦模式
   */
  projectIncident(dashboard: DashboardSnapshot): ProjectionResult {
    return this.project(dashboard, {
      mode: 'incident',
      filter: { attentionOnly: true, type: ['incidents'] },
      maxItems: 30,
    });
  }
  
  /**
   * 投影为审批聚焦模式
   */
  projectApprovalFocus(dashboard: DashboardSnapshot): ProjectionResult {
    return this.project(dashboard, {
      mode: 'approval_focus',
      filter: { type: ['approvals'] },
      sort: { field: 'age', direction: 'desc' },
      maxItems: 30,
    });
  }
  
  /**
   * 投影为 Agent 聚焦模式
   */
  projectAgentFocus(dashboard: DashboardSnapshot): ProjectionResult {
    return this.project(dashboard, {
      mode: 'agent_focus',
      filter: { type: ['agents'] },
      sort: { field: 'healthScore', direction: 'asc' },
      maxItems: 30,
    });
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 应用过滤器
   */
  private applyFilter(
    sections: DashboardSection[],
    filter?: ProjectionFilter
  ): DashboardSection[] {
    if (!filter) {
      return sections;
    }
    
    let filtered = [...sections];
    
    // 只显示关注项
    if (filter.attentionOnly) {
      filtered = filtered.filter(s => s.type === 'incidents' || s.cards.some(c => c.severity === 'high' || c.severity === 'critical'));
    }
    
    // 类型过滤
    if (filter.type && filter.type.length > 0) {
      filtered = filtered.filter(s => filter.type!.includes(s.type));
    }
    
    // 关键词过滤
    if (filter.keyword) {
      const keyword = filter.keyword.toLowerCase();
      filtered = filtered.map(section => ({
        ...section,
        cards: section.cards.filter(card =>
          card.title.toLowerCase().includes(keyword) ||
          card.subtitle?.toLowerCase().includes(keyword)
        ),
      })).filter(section => section.cards.length > 0);
    }
    
    return filtered;
  }
  
  /**
   * 应用排序
   */
  private applySort(
    sections: DashboardSection[],
    sort?: ProjectionSort
  ): DashboardSection[] {
    if (!sort) {
      // 默认按优先级排序
      return [...sections].sort((a, b) => a.priority - b.priority);
    }
    
    return [...sections].sort((a, b) => {
      let aVal: any;
      let bVal: any;
      
      switch (sort.field) {
        case 'priority':
          aVal = a.priority;
          bVal = b.priority;
          break;
        case 'cardCount':
          aVal = a.cards.length;
          bVal = b.cards.length;
          break;
        default:
          aVal = a[sort.field];
          bVal = b[sort.field];
      }
      
      if (sort.direction === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });
  }
  
  /**
   * 应用分组
   */
  private applyGroup(
    sections: DashboardSection[],
    group?: ProjectionGroup
  ): DashboardSection[] {
    if (!group) {
      return sections;
    }
    
    // 简化实现：按类型分组
    if (group.field === 'type') {
      const grouped: DashboardSection[] = [];
      const byType: Record<string, DashboardSection[]> = {};
      
      for (const section of sections) {
        if (!byType[section.type]) {
          byType[section.type] = [];
        }
        byType[section.type].push(section);
      }
      
      for (const [type, typeSections] of Object.entries(byType)) {
        grouped.push({
          id: `group_${type}`,
          type: sectionTypeToDashboardType(type),
          title: group.groupTitle || type.toUpperCase(),
          priority: 0,
          collapsed: false,
          badges: [],
          cards: typeSections.flatMap(s => s.cards),
        });
      }
      
      return grouped;
    }
    
    return sections;
  }
  
  /**
   * 限制项数
   */
  private limitItems(
    sections: DashboardSection[],
    maxItems?: number
  ): DashboardSection[] {
    if (!maxItems) {
      return sections;
    }
    
    let totalCards = 0;
    const limited: DashboardSection[] = [];
    
    for (const section of sections) {
      if (totalCards >= maxItems) {
        break;
      }
      
      const remainingCards = maxItems - totalCards;
      limited.push({
        ...section,
        cards: section.cards.slice(0, remainingCards),
      });
      
      totalCards += section.cards.length;
    }
    
    return limited;
  }
  
  /**
   * 应用关注项过滤器
   */
  private applyAttentionFilter(
    attentionItems: any[],
    filter?: ProjectionFilter
  ): any[] {
    if (!filter) {
      return attentionItems;
    }
    
    let filtered = [...attentionItems];
    
    // 严重级别过滤
    if (filter.severity && filter.severity.length > 0) {
      filtered = filtered.filter(item => filter.severity!.includes(item.severity));
    }
    
    // 类型过滤
    if (filter.type && filter.type.length > 0) {
      filtered = filtered.filter(item => filter.type!.includes(item.sourceType));
    }
    
    return filtered;
  }
  
  /**
   * 生成投影内容
   */
  private generateContent(
    sections: DashboardSection[],
    summary: any,
    mode: ProjectionMode,
    target: ProjectionTarget
  ): string {
    const lines: string[] = [];
    
    // 根据模式和目标生成不同格式
    switch (mode) {
      case 'summary':
        lines.push(this.generateSummaryContent(summary, sections));
        break;
      
      case 'detail':
        lines.push(this.generateDetailContent(summary, sections));
        break;
      
      case 'operator':
        lines.push(this.generateOperatorContent(summary, sections));
        break;
      
      case 'management':
        lines.push(this.generateManagementContent(summary, sections));
        break;
      
      case 'incident':
        lines.push(this.generateIncidentContent(summary, sections));
        break;
      
      default:
        lines.push(this.generateDefaultContent(summary, sections));
    }
    
    return lines.join('\n');
  }
  
  /**
   * 生成摘要内容
   */
  private generateSummaryContent(summary: any, sections: DashboardSection[]): string {
    const lines: string[] = [];
    
    lines.push(`# System Status: ${summary.overallStatus.toUpperCase()}`);
    lines.push('');
    lines.push(`Health Score: ${summary.healthScore}/100`);
    lines.push(`Tasks: ${summary.totalTasks} total, ${summary.blockedTasks} blocked`);
    lines.push(`Approvals: ${summary.pendingApprovals} pending`);
    lines.push(`Incidents: ${summary.activeIncidents} active`);
    lines.push(`Agents: ${summary.degradedAgents} degraded`);
    lines.push('');
    
    // 关注项
    const attentionSection = sections.find(s => s.type === 'incidents');
    if (attentionSection && attentionSection.cards.length > 0) {
      lines.push('## Attention Required');
      lines.push('');
      for (const card of attentionSection.cards.slice(0, 5)) {
        lines.push(`- [${card.severity?.toUpperCase()}] ${card.title}`);
      }
      lines.push('');
    }
    
    return lines.join('\n');
  }
  
  /**
   * 生成详情内容
   */
  private generateDetailContent(summary: any, sections: DashboardSection[]): string {
    const lines: string[] = [];
    
    lines.push(this.generateSummaryContent(summary, sections));
    
    // 所有分段详情
    for (const section of sections) {
      if (section.type === 'incidents') {
        continue; // 已经输出过
      }
      
      lines.push(`## ${section.title}`);
      lines.push('');
      
      for (const card of section.cards.slice(0, 10)) {
        lines.push(`### ${card.title}`);
        lines.push(`Status: ${card.status}`);
        if (card.subtitle) {
          lines.push(`Details: ${card.subtitle}`);
        }
        if (card.severity) {
          lines.push(`Severity: ${card.severity}`);
        }
        lines.push('');
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * 生成操作员内容
   */
  private generateOperatorContent(summary: any, sections: DashboardSection[]): string {
    const lines: string[] = [];
    
    lines.push(`# Operator Dashboard - ${summary.overallStatus.toUpperCase()}`);
    lines.push('');
    
    // 只关注需要行动的事项
    const attentionSection = sections.find(s => s.type === 'incidents');
    if (attentionSection && attentionSection.cards.length > 0) {
      lines.push('## Requires Action');
      lines.push('');
      for (const card of attentionSection.cards) {
        lines.push(`- [${card.severity?.toUpperCase()}] ${card.title}`);
        if (card.suggestedActions && card.suggestedActions.length > 0) {
          for (const action of card.suggestedActions) {
            lines.push(`  → ${action.type} ${action.targetId}`);
          }
        }
      }
      lines.push('');
    }
    
    return lines.join('\n');
  }
  
  /**
   * 生成管理内容
   */
  private generateManagementContent(summary: any, sections: DashboardSection[]): string {
    const lines: string[] = [];
    
    lines.push(`# Management Summary`);
    lines.push('');
    lines.push(`Overall Status: ${summary.overallStatus.toUpperCase()}`);
    lines.push(`Health Score: ${summary.healthScore}/100`);
    lines.push('');
    lines.push('## Key Metrics');
    lines.push('');
    lines.push(`- Tasks: ${summary.totalTasks} (${summary.blockedTasks} blocked)`);
    lines.push(`- Approvals: ${summary.pendingApprovals} pending`);
    lines.push(`- Incidents: ${summary.activeIncidents} active`);
    lines.push(`- Agents: ${summary.degradedAgents} degraded`);
    lines.push('');
    
    // 建议动作
    if (summary.attentionCount > 0) {
      lines.push('## Recommendations');
      lines.push('');
      lines.push(`- ${summary.attentionCount} items require attention`);
      lines.push('- Review operator dashboard for details');
    }
    
    return lines.join('\n');
  }
  
  /**
   * 生成事件内容
   */
  private generateIncidentContent(summary: any, sections: DashboardSection[]): string {
    const lines: string[] = [];
    
    lines.push(`# Incident Report`);
    lines.push('');
    
    const attentionSection = sections.find(s => s.type === 'incidents');
    if (attentionSection) {
      for (const card of attentionSection.cards) {
        lines.push(`## ${card.title}`);
        lines.push(`Severity: ${card.severity}`);
        if (card.subtitle) {
          lines.push(`Details: ${card.subtitle}`);
        }
        lines.push('');
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * 生成默认内容
   */
  private generateDefaultContent(summary: any, sections: DashboardSection[]): string {
    return this.generateSummaryContent(summary, sections);
  }
  
  /**
   * 构建投影摘要
   */
  private buildProjectionSummary(
    dashboardSummary: any,
    sections: DashboardSection[]
  ): any {
    return {
      ...dashboardSummary,
      sectionCount: sections.length,
      cardCount: this.countItems(sections),
    };
  }
  
  /**
   * 计算项数
   */
  private countItems(sections: DashboardSection[]): number {
    return sections.reduce((sum, section) => sum + section.cards.length, 0);
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 分段类型转换为仪表盘类型
 */
function sectionTypeToDashboardType(type: string): any {
  const typeMap: Record<string, any> = {
    tasks: 'tasks',
    approvals: 'approvals',
    ops: 'ops',
    agents: 'agents',
    incidents: 'incidents',
    actions: 'actions',
  };
  
  return typeMap[type] || 'tasks';
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建投影服务
 */
export function createProjectionService(): ProjectionService {
  return new ProjectionService();
}

/**
 * 快速投影仪表盘
 */
export function projectDashboard(
  dashboard: any,
  options?: ProjectionOptions
): ProjectionResult {
  const service = new ProjectionService();
  return service.project(dashboard, options);
}
