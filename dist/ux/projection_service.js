"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectionService = void 0;
exports.createProjectionService = createProjectionService;
exports.projectDashboard = projectDashboard;
// ============================================================================
// 投影服务
// ============================================================================
class ProjectionService {
    /**
     * 投影仪表盘
     */
    project(dashboard, options) {
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
    projectSummary(dashboard) {
        return this.project(dashboard, {
            mode: 'summary',
            maxItems: 10,
        });
    }
    /**
     * 投影为详情模式
     */
    projectDetail(dashboard) {
        return this.project(dashboard, {
            mode: 'detail',
            maxItems: 100,
        });
    }
    /**
     * 投影为操作员模式
     */
    projectOperator(dashboard) {
        return this.project(dashboard, {
            mode: 'operator',
            filter: { attentionOnly: true },
            maxItems: 50,
        });
    }
    /**
     * 投影为管理模式
     */
    projectManagement(dashboard) {
        return this.project(dashboard, {
            mode: 'management',
            maxItems: 20,
        });
    }
    /**
     * 投影为事件聚焦模式
     */
    projectIncident(dashboard) {
        return this.project(dashboard, {
            mode: 'incident',
            filter: { attentionOnly: true, type: ['incidents'] },
            maxItems: 30,
        });
    }
    /**
     * 投影为审批聚焦模式
     */
    projectApprovalFocus(dashboard) {
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
    projectAgentFocus(dashboard) {
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
    applyFilter(sections, filter) {
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
            filtered = filtered.filter(s => filter.type.includes(s.type));
        }
        // 关键词过滤
        if (filter.keyword) {
            const keyword = filter.keyword.toLowerCase();
            filtered = filtered.map(section => ({
                ...section,
                cards: section.cards.filter(card => card.title.toLowerCase().includes(keyword) ||
                    card.subtitle?.toLowerCase().includes(keyword)),
            })).filter(section => section.cards.length > 0);
        }
        return filtered;
    }
    /**
     * 应用排序
     */
    applySort(sections, sort) {
        if (!sort) {
            // 默认按优先级排序
            return [...sections].sort((a, b) => a.priority - b.priority);
        }
        return [...sections].sort((a, b) => {
            let aVal;
            let bVal;
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
            }
            else {
                return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
            }
        });
    }
    /**
     * 应用分组
     */
    applyGroup(sections, group) {
        if (!group) {
            return sections;
        }
        // 简化实现：按类型分组
        if (group.field === 'type') {
            const grouped = [];
            const byType = {};
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
    limitItems(sections, maxItems) {
        if (!maxItems) {
            return sections;
        }
        let totalCards = 0;
        const limited = [];
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
    applyAttentionFilter(attentionItems, filter) {
        if (!filter) {
            return attentionItems;
        }
        let filtered = [...attentionItems];
        // 严重级别过滤
        if (filter.severity && filter.severity.length > 0) {
            filtered = filtered.filter(item => filter.severity.includes(item.severity));
        }
        // 类型过滤
        if (filter.type && filter.type.length > 0) {
            filtered = filtered.filter(item => filter.type.includes(item.sourceType));
        }
        return filtered;
    }
    /**
     * 生成投影内容
     */
    generateContent(sections, summary, mode, target) {
        const lines = [];
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
    generateSummaryContent(summary, sections) {
        const lines = [];
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
    generateDetailContent(summary, sections) {
        const lines = [];
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
    generateOperatorContent(summary, sections) {
        const lines = [];
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
    generateManagementContent(summary, sections) {
        const lines = [];
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
    generateIncidentContent(summary, sections) {
        const lines = [];
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
    generateDefaultContent(summary, sections) {
        return this.generateSummaryContent(summary, sections);
    }
    /**
     * 构建投影摘要
     */
    buildProjectionSummary(dashboardSummary, sections) {
        return {
            ...dashboardSummary,
            sectionCount: sections.length,
            cardCount: this.countItems(sections),
        };
    }
    /**
     * 计算项数
     */
    countItems(sections) {
        return sections.reduce((sum, section) => sum + section.cards.length, 0);
    }
}
exports.ProjectionService = ProjectionService;
// ============================================================================
// 辅助函数
// ============================================================================
/**
 * 分段类型转换为仪表盘类型
 */
function sectionTypeToDashboardType(type) {
    const typeMap = {
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
function createProjectionService() {
    return new ProjectionService();
}
/**
 * 快速投影仪表盘
 */
function projectDashboard(dashboard, options) {
    const service = new ProjectionService();
    return service.project(dashboard, options);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvamVjdGlvbl9zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V4L3Byb2plY3Rpb25fc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7R0FVRzs7O0FBaWpCSCwwREFFQztBQUtELDRDQU1DO0FBL2lCRCwrRUFBK0U7QUFDL0UsT0FBTztBQUNQLCtFQUErRTtBQUUvRSxNQUFhLGlCQUFpQjtJQUM1Qjs7T0FFRztJQUNILE9BQU8sQ0FDTCxTQUE0QixFQUM1QixPQUEyQjtRQUUzQixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDdkIsTUFBTSxJQUFJLEdBQUcsT0FBTyxFQUFFLElBQUksSUFBSSxTQUFTLENBQUM7UUFDeEMsTUFBTSxNQUFNLEdBQUcsT0FBTyxFQUFFLE1BQU0sSUFBSSxLQUFLLENBQUM7UUFFeEMsUUFBUTtRQUNSLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQztRQUUvRSxPQUFPO1FBQ1AsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFFdkUsT0FBTztRQUNQLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsY0FBYyxFQUFFLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4RSxPQUFPO1FBQ1AsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxlQUFlLEVBQUUsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBRTVFLFNBQVM7UUFDVCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLGVBQWUsRUFBRSxTQUFTLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztRQUV2RixTQUFT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QU0sT0FBTyxHQUFHLElBQUksaUJBQWlCLEVBQUUsQ0FBQztJQUN4QyxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQzdDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFByb2plY3Rpb24gU2VydmljZSAtIOaKleW9seacjeWKoVxuICogXG4gKiDogYzotKPvvJpcbiAqIDEuIOaKiiBkYXNoYm9hcmQgc25hcHNob3Qg5oqV5b2x5oiQ5LiN5ZCM5qih5byPXG4gKiAyLiDmlK/mjIEgc3VtbWFyeSAvIGRldGFpbCAvIG9wZXJhdG9yIC8gbWFuYWdlbWVudCAvIGluY2lkZW50IC8gYXBwcm92YWxfZm9jdXMgLyBhZ2VudF9mb2N1c1xuICogMy4g5pSv5oyB5LiN5ZCM55uu5qCH56uv77yaY2xpIC8gdGVsZWdyYW0gLyB3ZWIgLyBhdWRpdCAvIGFwaVxuICogXG4gKiBAdmVyc2lvbiB2MC4xLjBcbiAqIEBkYXRlIDIwMjYtMDQtMDNcbiAqL1xuXG5pbXBvcnQgdHlwZSB7XG4gIERhc2hib2FyZFNuYXBzaG90LFxuICBEYXNoYm9hcmRTZWN0aW9uLFxuICBEYXNoYm9hcmRDYXJkLFxuICBQcm9qZWN0aW9uTW9kZSxcbiAgUHJvamVjdGlvblRhcmdldCxcbiAgUHJvamVjdGlvbk9wdGlvbnMsXG4gIFByb2plY3Rpb25SZXN1bHQsXG4gIFByb2plY3Rpb25GaWx0ZXIsXG4gIFByb2plY3Rpb25Tb3J0LFxuICBQcm9qZWN0aW9uR3JvdXAsXG59IGZyb20gJy4vZGFzaGJvYXJkX3R5cGVzJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5oqV5b2x5pyN5YqhXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmV4cG9ydCBjbGFzcyBQcm9qZWN0aW9uU2VydmljZSB7XG4gIC8qKlxuICAgKiDmipXlvbHku6rooajnm5hcbiAgICovXG4gIHByb2plY3QoXG4gICAgZGFzaGJvYXJkOiBEYXNoYm9hcmRTbmFwc2hvdCxcbiAgICBvcHRpb25zPzogUHJvamVjdGlvbk9wdGlvbnNcbiAgKTogUHJvamVjdGlvblJlc3VsdCB7XG4gICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICBjb25zdCBtb2RlID0gb3B0aW9ucz8ubW9kZSB8fCAnc3VtbWFyeSc7XG4gICAgY29uc3QgdGFyZ2V0ID0gb3B0aW9ucz8udGFyZ2V0IHx8ICdhcGknO1xuICAgIFxuICAgIC8vIOW6lOeUqOi/h+a7pOWZqFxuICAgIGNvbnN0IGZpbHRlcmVkU2VjdGlvbnMgPSB0aGlzLmFwcGx5RmlsdGVyKGRhc2hib2FyZC5zZWN0aW9ucywgb3B0aW9ucz8uZmlsdGVyKTtcbiAgICBcbiAgICAvLyDlupTnlKjmjpLluo9cbiAgICBjb25zdCBzb3J0ZWRTZWN0aW9ucyA9IHRoaXMuYXBwbHlTb3J0KGZpbHRlcmVkU2VjdGlvbnMsIG9wdGlvbnM/LnNvcnQpO1xuICAgIFxuICAgIC8vIOW6lOeUqOWIhue7hFxuICAgIGNvbnN0IGdyb3VwZWRTZWN0aW9ucyA9IHRoaXMuYXBwbHlHcm91cChzb3J0ZWRTZWN0aW9ucywgb3B0aW9ucz8uZ3JvdXApO1xuICAgIFxuICAgIC8vIOmZkOWItumhueaVsFxuICAgIGNvbnN0IGxpbWl0ZWRTZWN0aW9ucyA9IHRoaXMubGltaXRJdGVtcyhncm91cGVkU2VjdGlvbnMsIG9wdGlvbnM/Lm1heEl0ZW1zKTtcbiAgICBcbiAgICAvLyDnlJ/miJDmipXlvbHlhoXlrrlcbiAgICBjb25zdCBjb250ZW50ID0gdGhpcy5nZW5lcmF0ZUNvbnRlbnQobGltaXRlZFNlY3Rpb25zLCBkYXNoYm9hcmQuc3VtbWFyeSwgbW9kZSwgdGFyZ2V0KTtcbiAgICBcbiAgICAvLyDnlJ/miJDmipXlvbHmkZjopoFcbiAgICBjb25zdCBwcm9qZWN0aW9uU3VtbWFyeSA9IHRoaXMuYnVpbGRQcm9qZWN0aW9uU3VtbWFyeShkYXNoYm9hcmQuc3VtbWFyeSwgbGltaXRlZFNlY3Rpb25zKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgcHJvamVjdGlvbklkOiBgcHJvamVjdGlvbl8ke25vd31gLFxuICAgICAgbW9kZSxcbiAgICAgIHRhcmdldCxcbiAgICAgIGNyZWF0ZWRBdDogbm93LFxuICAgICAgY29udGVudCxcbiAgICAgIHNlY3Rpb25zOiBsaW1pdGVkU2VjdGlvbnMsXG4gICAgICBzdW1tYXJ5OiBwcm9qZWN0aW9uU3VtbWFyeSxcbiAgICAgIGF0dGVudGlvbkl0ZW1zOiB0aGlzLmFwcGx5QXR0ZW50aW9uRmlsdGVyKGRhc2hib2FyZC5hdHRlbnRpb25JdGVtcywgb3B0aW9ucz8uZmlsdGVyKSxcbiAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgIHNvdXJjZURhc2hib2FyZElkOiBkYXNoYm9hcmQuZGFzaGJvYXJkSWQsXG4gICAgICAgIGFwcGxpZWRGaWx0ZXI6IG9wdGlvbnM/LmZpbHRlcixcbiAgICAgICAgYXBwbGllZFNvcnQ6IG9wdGlvbnM/LnNvcnQsXG4gICAgICAgIGl0ZW1Db3VudDogdGhpcy5jb3VudEl0ZW1zKGxpbWl0ZWRTZWN0aW9ucyksXG4gICAgICB9LFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmipXlvbHkuLrmkZjopoHmqKHlvI9cbiAgICovXG4gIHByb2plY3RTdW1tYXJ5KGRhc2hib2FyZDogRGFzaGJvYXJkU25hcHNob3QpOiBQcm9qZWN0aW9uUmVzdWx0IHtcbiAgICByZXR1cm4gdGhpcy5wcm9qZWN0KGRhc2hib2FyZCwge1xuICAgICAgbW9kZTogJ3N1bW1hcnknLFxuICAgICAgbWF4SXRlbXM6IDEwLFxuICAgIH0pO1xuICB9XG4gIFxuICAvKipcbiAgICog5oqV5b2x5Li66K+m5oOF5qih5byPXG4gICAqL1xuICBwcm9qZWN0RGV0YWlsKGRhc2hib2FyZDogRGFzaGJvYXJkU25hcHNob3QpOiBQcm9qZWN0aW9uUmVzdWx0IHtcbiAgICByZXR1cm4gdGhpcy5wcm9qZWN0KGRhc2hib2FyZCwge1xuICAgICAgbW9kZTogJ2RldGFpbCcsXG4gICAgICBtYXhJdGVtczogMTAwLFxuICAgIH0pO1xuICB9XG4gIFxuICAvKipcbiAgICog5oqV5b2x5Li65pON5L2c5ZGY5qih5byPXG4gICAqL1xuICBwcm9qZWN0T3BlcmF0b3IoZGFzaGJvYXJkOiBEYXNoYm9hcmRTbmFwc2hvdCk6IFByb2plY3Rpb25SZXN1bHQge1xuICAgIHJldHVybiB0aGlzLnByb2plY3QoZGFzaGJvYXJkLCB7XG4gICAgICBtb2RlOiAnb3BlcmF0b3InLFxuICAgICAgZmlsdGVyOiB7IGF0dGVudGlvbk9ubHk6IHRydWUgfSxcbiAgICAgIG1heEl0ZW1zOiA1MCxcbiAgICB9KTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaKleW9seS4uueuoeeQhuaooeW8j1xuICAgKi9cbiAgcHJvamVjdE1hbmFnZW1lbnQoZGFzaGJvYXJkOiBEYXNoYm9hcmRTbmFwc2hvdCk6IFByb2plY3Rpb25SZXN1bHQge1xuICAgIHJldHVybiB0aGlzLnByb2plY3QoZGFzaGJvYXJkLCB7XG4gICAgICBtb2RlOiAnbWFuYWdlbWVudCcsXG4gICAgICBtYXhJdGVtczogMjAsXG4gICAgfSk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmipXlvbHkuLrkuovku7bogZrnhKbmqKHlvI9cbiAgICovXG4gIHByb2plY3RJbmNpZGVudChkYXNoYm9hcmQ6IERhc2hib2FyZFNuYXBzaG90KTogUHJvamVjdGlvblJlc3VsdCB7XG4gICAgcmV0dXJuIHRoaXMucHJvamVjdChkYXNoYm9hcmQsIHtcbiAgICAgIG1vZGU6ICdpbmNpZGVudCcsXG4gICAgICBmaWx0ZXI6IHsgYXR0ZW50aW9uT25seTogdHJ1ZSwgdHlwZTogWydpbmNpZGVudHMnXSB9LFxuICAgICAgbWF4SXRlbXM6IDMwLFxuICAgIH0pO1xuICB9XG4gIFxuICAvKipcbiAgICog5oqV5b2x5Li65a6h5om56IGa54Sm5qih5byPXG4gICAqL1xuICBwcm9qZWN0QXBwcm92YWxGb2N1cyhkYXNoYm9hcmQ6IERhc2hib2FyZFNuYXBzaG90KTogUHJvamVjdGlvblJlc3VsdCB7XG4gICAgcmV0dXJuIHRoaXMucHJvamVjdChkYXNoYm9hcmQsIHtcbiAgICAgIG1vZGU6ICdhcHByb3ZhbF9mb2N1cycsXG4gICAgICBmaWx0ZXI6IHsgdHlwZTogWydhcHByb3ZhbHMnXSB9LFxuICAgICAgc29ydDogeyBmaWVsZDogJ2FnZScsIGRpcmVjdGlvbjogJ2Rlc2MnIH0sXG4gICAgICBtYXhJdGVtczogMzAsXG4gICAgfSk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmipXlvbHkuLogQWdlbnQg6IGa54Sm5qih5byPXG4gICAqL1xuICBwcm9qZWN0QWdlbnRGb2N1cyhkYXNoYm9hcmQ6IERhc2hib2FyZFNuYXBzaG90KTogUHJvamVjdGlvblJlc3VsdCB7XG4gICAgcmV0dXJuIHRoaXMucHJvamVjdChkYXNoYm9hcmQsIHtcbiAgICAgIG1vZGU6ICdhZ2VudF9mb2N1cycsXG4gICAgICBmaWx0ZXI6IHsgdHlwZTogWydhZ2VudHMnXSB9LFxuICAgICAgc29ydDogeyBmaWVsZDogJ2hlYWx0aFNjb3JlJywgZGlyZWN0aW9uOiAnYXNjJyB9LFxuICAgICAgbWF4SXRlbXM6IDMwLFxuICAgIH0pO1xuICB9XG4gIFxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIC8vIOWGhemDqOaWueazlVxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIFxuICAvKipcbiAgICog5bqU55So6L+H5ruk5ZmoXG4gICAqL1xuICBwcml2YXRlIGFwcGx5RmlsdGVyKFxuICAgIHNlY3Rpb25zOiBEYXNoYm9hcmRTZWN0aW9uW10sXG4gICAgZmlsdGVyPzogUHJvamVjdGlvbkZpbHRlclxuICApOiBEYXNoYm9hcmRTZWN0aW9uW10ge1xuICAgIGlmICghZmlsdGVyKSB7XG4gICAgICByZXR1cm4gc2VjdGlvbnM7XG4gICAgfVxuICAgIFxuICAgIGxldCBmaWx0ZXJlZCA9IFsuLi5zZWN0aW9uc107XG4gICAgXG4gICAgLy8g5Y+q5pi+56S65YWz5rOo6aG5XG4gICAgaWYgKGZpbHRlci5hdHRlbnRpb25Pbmx5KSB7XG4gICAgICBmaWx0ZXJlZCA9IGZpbHRlcmVkLmZpbHRlcihzID0+IHMudHlwZSA9PT0gJ2luY2lkZW50cycgfHwgcy5jYXJkcy5zb21lKGMgPT4gYy5zZXZlcml0eSA9PT0gJ2hpZ2gnIHx8IGMuc2V2ZXJpdHkgPT09ICdjcml0aWNhbCcpKTtcbiAgICB9XG4gICAgXG4gICAgLy8g57G75Z6L6L+H5rukXG4gICAgaWYgKGZpbHRlci50eXBlICYmIGZpbHRlci50eXBlLmxlbmd0aCA+IDApIHtcbiAgICAgIGZpbHRlcmVkID0gZmlsdGVyZWQuZmlsdGVyKHMgPT4gZmlsdGVyLnR5cGUhLmluY2x1ZGVzKHMudHlwZSkpO1xuICAgIH1cbiAgICBcbiAgICAvLyDlhbPplK7or43ov4fmu6RcbiAgICBpZiAoZmlsdGVyLmtleXdvcmQpIHtcbiAgICAgIGNvbnN0IGtleXdvcmQgPSBmaWx0ZXIua2V5d29yZC50b0xvd2VyQ2FzZSgpO1xuICAgICAgZmlsdGVyZWQgPSBmaWx0ZXJlZC5tYXAoc2VjdGlvbiA9PiAoe1xuICAgICAgICAuLi5zZWN0aW9uLFxuICAgICAgICBjYXJkczogc2VjdGlvbi5jYXJkcy5maWx0ZXIoY2FyZCA9PlxuICAgICAgICAgIGNhcmQudGl0bGUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhrZXl3b3JkKSB8fFxuICAgICAgICAgIGNhcmQuc3VidGl0bGU/LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoa2V5d29yZClcbiAgICAgICAgKSxcbiAgICAgIH0pKS5maWx0ZXIoc2VjdGlvbiA9PiBzZWN0aW9uLmNhcmRzLmxlbmd0aCA+IDApO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZmlsdGVyZWQ7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDlupTnlKjmjpLluo9cbiAgICovXG4gIHByaXZhdGUgYXBwbHlTb3J0KFxuICAgIHNlY3Rpb25zOiBEYXNoYm9hcmRTZWN0aW9uW10sXG4gICAgc29ydD86IFByb2plY3Rpb25Tb3J0XG4gICk6IERhc2hib2FyZFNlY3Rpb25bXSB7XG4gICAgaWYgKCFzb3J0KSB7XG4gICAgICAvLyDpu5jorqTmjInkvJjlhYjnuqfmjpLluo9cbiAgICAgIHJldHVybiBbLi4uc2VjdGlvbnNdLnNvcnQoKGEsIGIpID0+IGEucHJpb3JpdHkgLSBiLnByaW9yaXR5KTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIFsuLi5zZWN0aW9uc10uc29ydCgoYSwgYikgPT4ge1xuICAgICAgbGV0IGFWYWw6IGFueTtcbiAgICAgIGxldCBiVmFsOiBhbnk7XG4gICAgICBcbiAgICAgIHN3aXRjaCAoc29ydC5maWVsZCkge1xuICAgICAgICBjYXNlICdwcmlvcml0eSc6XG4gICAgICAgICAgYVZhbCA9IGEucHJpb3JpdHk7XG4gICAgICAgICAgYlZhbCA9IGIucHJpb3JpdHk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2NhcmRDb3VudCc6XG4gICAgICAgICAgYVZhbCA9IGEuY2FyZHMubGVuZ3RoO1xuICAgICAgICAgIGJWYWwgPSBiLmNhcmRzLmxlbmd0aDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBhVmFsID0gYVtzb3J0LmZpZWxkXTtcbiAgICAgICAgICBiVmFsID0gYltzb3J0LmZpZWxkXTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgaWYgKHNvcnQuZGlyZWN0aW9uID09PSAnYXNjJykge1xuICAgICAgICByZXR1cm4gYVZhbCA+IGJWYWwgPyAxIDogYVZhbCA8IGJWYWwgPyAtMSA6IDA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gYVZhbCA8IGJWYWwgPyAxIDogYVZhbCA+IGJWYWwgPyAtMSA6IDA7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDlupTnlKjliIbnu4RcbiAgICovXG4gIHByaXZhdGUgYXBwbHlHcm91cChcbiAgICBzZWN0aW9uczogRGFzaGJvYXJkU2VjdGlvbltdLFxuICAgIGdyb3VwPzogUHJvamVjdGlvbkdyb3VwXG4gICk6IERhc2hib2FyZFNlY3Rpb25bXSB7XG4gICAgaWYgKCFncm91cCkge1xuICAgICAgcmV0dXJuIHNlY3Rpb25zO1xuICAgIH1cbiAgICBcbiAgICAvLyDnroDljJblrp7njrDvvJrmjInnsbvlnovliIbnu4RcbiAgICBpZiAoZ3JvdXAuZmllbGQgPT09ICd0eXBlJykge1xuICAgICAgY29uc3QgZ3JvdXBlZDogRGFzaGJvYXJkU2VjdGlvbltdID0gW107XG4gICAgICBjb25zdCBieVR5cGU6IFJlY29yZDxzdHJpbmcsIERhc2hib2FyZFNlY3Rpb25bXT4gPSB7fTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBzZWN0aW9uIG9mIHNlY3Rpb25zKSB7XG4gICAgICAgIGlmICghYnlUeXBlW3NlY3Rpb24udHlwZV0pIHtcbiAgICAgICAgICBieVR5cGVbc2VjdGlvbi50eXBlXSA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIGJ5VHlwZVtzZWN0aW9uLnR5cGVdLnB1c2goc2VjdGlvbik7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgW3R5cGUsIHR5cGVTZWN0aW9uc10gb2YgT2JqZWN0LmVudHJpZXMoYnlUeXBlKSkge1xuICAgICAgICBncm91cGVkLnB1c2goe1xuICAgICAgICAgIGlkOiBgZ3JvdXBfJHt0eXBlfWAsXG4gICAgICAgICAgdHlwZTogc2VjdGlvblR5cGVUb0Rhc2hib2FyZFR5cGUodHlwZSksXG4gICAgICAgICAgdGl0bGU6IGdyb3VwLmdyb3VwVGl0bGUgfHwgdHlwZS50b1VwcGVyQ2FzZSgpLFxuICAgICAgICAgIHByaW9yaXR5OiAwLFxuICAgICAgICAgIGNvbGxhcHNlZDogZmFsc2UsXG4gICAgICAgICAgYmFkZ2VzOiBbXSxcbiAgICAgICAgICBjYXJkczogdHlwZVNlY3Rpb25zLmZsYXRNYXAocyA9PiBzLmNhcmRzKSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHJldHVybiBncm91cGVkO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gc2VjdGlvbnM7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDpmZDliLbpobnmlbBcbiAgICovXG4gIHByaXZhdGUgbGltaXRJdGVtcyhcbiAgICBzZWN0aW9uczogRGFzaGJvYXJkU2VjdGlvbltdLFxuICAgIG1heEl0ZW1zPzogbnVtYmVyXG4gICk6IERhc2hib2FyZFNlY3Rpb25bXSB7XG4gICAgaWYgKCFtYXhJdGVtcykge1xuICAgICAgcmV0dXJuIHNlY3Rpb25zO1xuICAgIH1cbiAgICBcbiAgICBsZXQgdG90YWxDYXJkcyA9IDA7XG4gICAgY29uc3QgbGltaXRlZDogRGFzaGJvYXJkU2VjdGlvbltdID0gW107XG4gICAgXG4gICAgZm9yIChjb25zdCBzZWN0aW9uIG9mIHNlY3Rpb25zKSB7XG4gICAgICBpZiAodG90YWxDYXJkcyA+PSBtYXhJdGVtcykge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgcmVtYWluaW5nQ2FyZHMgPSBtYXhJdGVtcyAtIHRvdGFsQ2FyZHM7XG4gICAgICBsaW1pdGVkLnB1c2goe1xuICAgICAgICAuLi5zZWN0aW9uLFxuICAgICAgICBjYXJkczogc2VjdGlvbi5jYXJkcy5zbGljZSgwLCByZW1haW5pbmdDYXJkcyksXG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgdG90YWxDYXJkcyArPSBzZWN0aW9uLmNhcmRzLmxlbmd0aDtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGxpbWl0ZWQ7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDlupTnlKjlhbPms6jpobnov4fmu6TlmahcbiAgICovXG4gIHByaXZhdGUgYXBwbHlBdHRlbnRpb25GaWx0ZXIoXG4gICAgYXR0ZW50aW9uSXRlbXM6IGFueVtdLFxuICAgIGZpbHRlcj86IFByb2plY3Rpb25GaWx0ZXJcbiAgKTogYW55W10ge1xuICAgIGlmICghZmlsdGVyKSB7XG4gICAgICByZXR1cm4gYXR0ZW50aW9uSXRlbXM7XG4gICAgfVxuICAgIFxuICAgIGxldCBmaWx0ZXJlZCA9IFsuLi5hdHRlbnRpb25JdGVtc107XG4gICAgXG4gICAgLy8g5Lil6YeN57qn5Yir6L+H5rukXG4gICAgaWYgKGZpbHRlci5zZXZlcml0eSAmJiBmaWx0ZXIuc2V2ZXJpdHkubGVuZ3RoID4gMCkge1xuICAgICAgZmlsdGVyZWQgPSBmaWx0ZXJlZC5maWx0ZXIoaXRlbSA9PiBmaWx0ZXIuc2V2ZXJpdHkhLmluY2x1ZGVzKGl0ZW0uc2V2ZXJpdHkpKTtcbiAgICB9XG4gICAgXG4gICAgLy8g57G75Z6L6L+H5rukXG4gICAgaWYgKGZpbHRlci50eXBlICYmIGZpbHRlci50eXBlLmxlbmd0aCA+IDApIHtcbiAgICAgIGZpbHRlcmVkID0gZmlsdGVyZWQuZmlsdGVyKGl0ZW0gPT4gZmlsdGVyLnR5cGUhLmluY2x1ZGVzKGl0ZW0uc291cmNlVHlwZSkpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gZmlsdGVyZWQ7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnlJ/miJDmipXlvbHlhoXlrrlcbiAgICovXG4gIHByaXZhdGUgZ2VuZXJhdGVDb250ZW50KFxuICAgIHNlY3Rpb25zOiBEYXNoYm9hcmRTZWN0aW9uW10sXG4gICAgc3VtbWFyeTogYW55LFxuICAgIG1vZGU6IFByb2plY3Rpb25Nb2RlLFxuICAgIHRhcmdldDogUHJvamVjdGlvblRhcmdldFxuICApOiBzdHJpbmcge1xuICAgIGNvbnN0IGxpbmVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIFxuICAgIC8vIOagueaNruaooeW8j+WSjOebruagh+eUn+aIkOS4jeWQjOagvOW8j1xuICAgIHN3aXRjaCAobW9kZSkge1xuICAgICAgY2FzZSAnc3VtbWFyeSc6XG4gICAgICAgIGxpbmVzLnB1c2godGhpcy5nZW5lcmF0ZVN1bW1hcnlDb250ZW50KHN1bW1hcnksIHNlY3Rpb25zKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgXG4gICAgICBjYXNlICdkZXRhaWwnOlxuICAgICAgICBsaW5lcy5wdXNoKHRoaXMuZ2VuZXJhdGVEZXRhaWxDb250ZW50KHN1bW1hcnksIHNlY3Rpb25zKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgXG4gICAgICBjYXNlICdvcGVyYXRvcic6XG4gICAgICAgIGxpbmVzLnB1c2godGhpcy5nZW5lcmF0ZU9wZXJhdG9yQ29udGVudChzdW1tYXJ5LCBzZWN0aW9ucykpO1xuICAgICAgICBicmVhaztcbiAgICAgIFxuICAgICAgY2FzZSAnbWFuYWdlbWVudCc6XG4gICAgICAgIGxpbmVzLnB1c2godGhpcy5nZW5lcmF0ZU1hbmFnZW1lbnRDb250ZW50KHN1bW1hcnksIHNlY3Rpb25zKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgXG4gICAgICBjYXNlICdpbmNpZGVudCc6XG4gICAgICAgIGxpbmVzLnB1c2godGhpcy5nZW5lcmF0ZUluY2lkZW50Q29udGVudChzdW1tYXJ5LCBzZWN0aW9ucykpO1xuICAgICAgICBicmVhaztcbiAgICAgIFxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgbGluZXMucHVzaCh0aGlzLmdlbmVyYXRlRGVmYXVsdENvbnRlbnQoc3VtbWFyeSwgc2VjdGlvbnMpKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGxpbmVzLmpvaW4oJ1xcbicpO1xuICB9XG4gIFxuICAvKipcbiAgICog55Sf5oiQ5pGY6KaB5YaF5a65XG4gICAqL1xuICBwcml2YXRlIGdlbmVyYXRlU3VtbWFyeUNvbnRlbnQoc3VtbWFyeTogYW55LCBzZWN0aW9uczogRGFzaGJvYXJkU2VjdGlvbltdKTogc3RyaW5nIHtcbiAgICBjb25zdCBsaW5lczogc3RyaW5nW10gPSBbXTtcbiAgICBcbiAgICBsaW5lcy5wdXNoKGAjIFN5c3RlbSBTdGF0dXM6ICR7c3VtbWFyeS5vdmVyYWxsU3RhdHVzLnRvVXBwZXJDYXNlKCl9YCk7XG4gICAgbGluZXMucHVzaCgnJyk7XG4gICAgbGluZXMucHVzaChgSGVhbHRoIFNjb3JlOiAke3N1bW1hcnkuaGVhbHRoU2NvcmV9LzEwMGApO1xuICAgIGxpbmVzLnB1c2goYFRhc2tzOiAke3N1bW1hcnkudG90YWxUYXNrc30gdG90YWwsICR7c3VtbWFyeS5ibG9ja2VkVGFza3N9IGJsb2NrZWRgKTtcbiAgICBsaW5lcy5wdXNoKGBBcHByb3ZhbHM6ICR7c3VtbWFyeS5wZW5kaW5nQXBwcm92YWxzfSBwZW5kaW5nYCk7XG4gICAgbGluZXMucHVzaChgSW5jaWRlbnRzOiAke3N1bW1hcnkuYWN0aXZlSW5jaWRlbnRzfSBhY3RpdmVgKTtcbiAgICBsaW5lcy5wdXNoKGBBZ2VudHM6ICR7c3VtbWFyeS5kZWdyYWRlZEFnZW50c30gZGVncmFkZWRgKTtcbiAgICBsaW5lcy5wdXNoKCcnKTtcbiAgICBcbiAgICAvLyDlhbPms6jpoblcbiAgICBjb25zdCBhdHRlbnRpb25TZWN0aW9uID0gc2VjdGlvbnMuZmluZChzID0+IHMudHlwZSA9PT0gJ2luY2lkZW50cycpO1xuICAgIGlmIChhdHRlbnRpb25TZWN0aW9uICYmIGF0dGVudGlvblNlY3Rpb24uY2FyZHMubGVuZ3RoID4gMCkge1xuICAgICAgbGluZXMucHVzaCgnIyMgQXR0ZW50aW9uIFJlcXVpcmVkJyk7XG4gICAgICBsaW5lcy5wdXNoKCcnKTtcbiAgICAgIGZvciAoY29uc3QgY2FyZCBvZiBhdHRlbnRpb25TZWN0aW9uLmNhcmRzLnNsaWNlKDAsIDUpKSB7XG4gICAgICAgIGxpbmVzLnB1c2goYC0gWyR7Y2FyZC5zZXZlcml0eT8udG9VcHBlckNhc2UoKX1dICR7Y2FyZC50aXRsZX1gKTtcbiAgICAgIH1cbiAgICAgIGxpbmVzLnB1c2goJycpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbGluZXMuam9pbignXFxuJyk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnlJ/miJDor6bmg4XlhoXlrrlcbiAgICovXG4gIHByaXZhdGUgZ2VuZXJhdGVEZXRhaWxDb250ZW50KHN1bW1hcnk6IGFueSwgc2VjdGlvbnM6IERhc2hib2FyZFNlY3Rpb25bXSk6IHN0cmluZyB7XG4gICAgY29uc3QgbGluZXM6IHN0cmluZ1tdID0gW107XG4gICAgXG4gICAgbGluZXMucHVzaCh0aGlzLmdlbmVyYXRlU3VtbWFyeUNvbnRlbnQoc3VtbWFyeSwgc2VjdGlvbnMpKTtcbiAgICBcbiAgICAvLyDmiYDmnInliIbmrrXor6bmg4VcbiAgICBmb3IgKGNvbnN0IHNlY3Rpb24gb2Ygc2VjdGlvbnMpIHtcbiAgICAgIGlmIChzZWN0aW9uLnR5cGUgPT09ICdpbmNpZGVudHMnKSB7XG4gICAgICAgIGNvbnRpbnVlOyAvLyDlt7Lnu4/ovpPlh7rov4dcbiAgICAgIH1cbiAgICAgIFxuICAgICAgbGluZXMucHVzaChgIyMgJHtzZWN0aW9uLnRpdGxlfWApO1xuICAgICAgbGluZXMucHVzaCgnJyk7XG4gICAgICBcbiAgICAgIGZvciAoY29uc3QgY2FyZCBvZiBzZWN0aW9uLmNhcmRzLnNsaWNlKDAsIDEwKSkge1xuICAgICAgICBsaW5lcy5wdXNoKGAjIyMgJHtjYXJkLnRpdGxlfWApO1xuICAgICAgICBsaW5lcy5wdXNoKGBTdGF0dXM6ICR7Y2FyZC5zdGF0dXN9YCk7XG4gICAgICAgIGlmIChjYXJkLnN1YnRpdGxlKSB7XG4gICAgICAgICAgbGluZXMucHVzaChgRGV0YWlsczogJHtjYXJkLnN1YnRpdGxlfWApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjYXJkLnNldmVyaXR5KSB7XG4gICAgICAgICAgbGluZXMucHVzaChgU2V2ZXJpdHk6ICR7Y2FyZC5zZXZlcml0eX1gKTtcbiAgICAgICAgfVxuICAgICAgICBsaW5lcy5wdXNoKCcnKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGxpbmVzLmpvaW4oJ1xcbicpO1xuICB9XG4gIFxuICAvKipcbiAgICog55Sf5oiQ5pON5L2c5ZGY5YaF5a65XG4gICAqL1xuICBwcml2YXRlIGdlbmVyYXRlT3BlcmF0b3JDb250ZW50KHN1bW1hcnk6IGFueSwgc2VjdGlvbnM6IERhc2hib2FyZFNlY3Rpb25bXSk6IHN0cmluZyB7XG4gICAgY29uc3QgbGluZXM6IHN0cmluZ1tdID0gW107XG4gICAgXG4gICAgbGluZXMucHVzaChgIyBPcGVyYXRvciBEYXNoYm9hcmQgLSAke3N1bW1hcnkub3ZlcmFsbFN0YXR1cy50b1VwcGVyQ2FzZSgpfWApO1xuICAgIGxpbmVzLnB1c2goJycpO1xuICAgIFxuICAgIC8vIOWPquWFs+azqOmcgOimgeihjOWKqOeahOS6i+mhuVxuICAgIGNvbnN0IGF0dGVudGlvblNlY3Rpb24gPSBzZWN0aW9ucy5maW5kKHMgPT4gcy50eXBlID09PSAnaW5jaWRlbnRzJyk7XG4gICAgaWYgKGF0dGVudGlvblNlY3Rpb24gJiYgYXR0ZW50aW9uU2VjdGlvbi5jYXJkcy5sZW5ndGggPiAwKSB7XG4gICAgICBsaW5lcy5wdXNoKCcjIyBSZXF1aXJlcyBBY3Rpb24nKTtcbiAgICAgIGxpbmVzLnB1c2goJycpO1xuICAgICAgZm9yIChjb25zdCBjYXJkIG9mIGF0dGVudGlvblNlY3Rpb24uY2FyZHMpIHtcbiAgICAgICAgbGluZXMucHVzaChgLSBbJHtjYXJkLnNldmVyaXR5Py50b1VwcGVyQ2FzZSgpfV0gJHtjYXJkLnRpdGxlfWApO1xuICAgICAgICBpZiAoY2FyZC5zdWdnZXN0ZWRBY3Rpb25zICYmIGNhcmQuc3VnZ2VzdGVkQWN0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgZm9yIChjb25zdCBhY3Rpb24gb2YgY2FyZC5zdWdnZXN0ZWRBY3Rpb25zKSB7XG4gICAgICAgICAgICBsaW5lcy5wdXNoKGAgIOKGkiAke2FjdGlvbi50eXBlfSAke2FjdGlvbi50YXJnZXRJZH1gKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxpbmVzLnB1c2goJycpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbGluZXMuam9pbignXFxuJyk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnlJ/miJDnrqHnkIblhoXlrrlcbiAgICovXG4gIHByaXZhdGUgZ2VuZXJhdGVNYW5hZ2VtZW50Q29udGVudChzdW1tYXJ5OiBhbnksIHNlY3Rpb25zOiBEYXNoYm9hcmRTZWN0aW9uW10pOiBzdHJpbmcge1xuICAgIGNvbnN0IGxpbmVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIFxuICAgIGxpbmVzLnB1c2goYCMgTWFuYWdlbWVudCBTdW1tYXJ5YCk7XG4gICAgbGluZXMucHVzaCgnJyk7XG4gICAgbGluZXMucHVzaChgT3ZlcmFsbCBTdGF0dXM6ICR7c3VtbWFyeS5vdmVyYWxsU3RhdHVzLnRvVXBwZXJDYXNlKCl9YCk7XG4gICAgbGluZXMucHVzaChgSGVhbHRoIFNjb3JlOiAke3N1bW1hcnkuaGVhbHRoU2NvcmV9LzEwMGApO1xuICAgIGxpbmVzLnB1c2goJycpO1xuICAgIGxpbmVzLnB1c2goJyMjIEtleSBNZXRyaWNzJyk7XG4gICAgbGluZXMucHVzaCgnJyk7XG4gICAgbGluZXMucHVzaChgLSBUYXNrczogJHtzdW1tYXJ5LnRvdGFsVGFza3N9ICgke3N1bW1hcnkuYmxvY2tlZFRhc2tzfSBibG9ja2VkKWApO1xuICAgIGxpbmVzLnB1c2goYC0gQXBwcm92YWxzOiAke3N1bW1hcnkucGVuZGluZ0FwcHJvdmFsc30gcGVuZGluZ2ApO1xuICAgIGxpbmVzLnB1c2goYC0gSW5jaWRlbnRzOiAke3N1bW1hcnkuYWN0aXZlSW5jaWRlbnRzfSBhY3RpdmVgKTtcbiAgICBsaW5lcy5wdXNoKGAtIEFnZW50czogJHtzdW1tYXJ5LmRlZ3JhZGVkQWdlbnRzfSBkZWdyYWRlZGApO1xuICAgIGxpbmVzLnB1c2goJycpO1xuICAgIFxuICAgIC8vIOW7uuiuruWKqOS9nFxuICAgIGlmIChzdW1tYXJ5LmF0dGVudGlvbkNvdW50ID4gMCkge1xuICAgICAgbGluZXMucHVzaCgnIyMgUmVjb21tZW5kYXRpb25zJyk7XG4gICAgICBsaW5lcy5wdXNoKCcnKTtcbiAgICAgIGxpbmVzLnB1c2goYC0gJHtzdW1tYXJ5LmF0dGVudGlvbkNvdW50fSBpdGVtcyByZXF1aXJlIGF0dGVudGlvbmApO1xuICAgICAgbGluZXMucHVzaCgnLSBSZXZpZXcgb3BlcmF0b3IgZGFzaGJvYXJkIGZvciBkZXRhaWxzJyk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOeUn+aIkOS6i+S7tuWGheWuuVxuICAgKi9cbiAgcHJpdmF0ZSBnZW5lcmF0ZUluY2lkZW50Q29udGVudChzdW1tYXJ5OiBhbnksIHNlY3Rpb25zOiBEYXNoYm9hcmRTZWN0aW9uW10pOiBzdHJpbmcge1xuICAgIGNvbnN0IGxpbmVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIFxuICAgIGxpbmVzLnB1c2goYCMgSW5jaWRlbnQgUmVwb3J0YCk7XG4gICAgbGluZXMucHVzaCgnJyk7XG4gICAgXG4gICAgY29uc3QgYXR0ZW50aW9uU2VjdGlvbiA9IHNlY3Rpb25zLmZpbmQocyA9PiBzLnR5cGUgPT09ICdpbmNpZGVudHMnKTtcbiAgICBpZiAoYXR0ZW50aW9uU2VjdGlvbikge1xuICAgICAgZm9yIChjb25zdCBjYXJkIG9mIGF0dGVudGlvblNlY3Rpb24uY2FyZHMpIHtcbiAgICAgICAgbGluZXMucHVzaChgIyMgJHtjYXJkLnRpdGxlfWApO1xuICAgICAgICBsaW5lcy5wdXNoKGBTZXZlcml0eTogJHtjYXJkLnNldmVyaXR5fWApO1xuICAgICAgICBpZiAoY2FyZC5zdWJ0aXRsZSkge1xuICAgICAgICAgIGxpbmVzLnB1c2goYERldGFpbHM6ICR7Y2FyZC5zdWJ0aXRsZX1gKTtcbiAgICAgICAgfVxuICAgICAgICBsaW5lcy5wdXNoKCcnKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGxpbmVzLmpvaW4oJ1xcbicpO1xuICB9XG4gIFxuICAvKipcbiAgICog55Sf5oiQ6buY6K6k5YaF5a65XG4gICAqL1xuICBwcml2YXRlIGdlbmVyYXRlRGVmYXVsdENvbnRlbnQoc3VtbWFyeTogYW55LCBzZWN0aW9uczogRGFzaGJvYXJkU2VjdGlvbltdKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5nZW5lcmF0ZVN1bW1hcnlDb250ZW50KHN1bW1hcnksIHNlY3Rpb25zKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaehOW7uuaKleW9seaRmOimgVxuICAgKi9cbiAgcHJpdmF0ZSBidWlsZFByb2plY3Rpb25TdW1tYXJ5KFxuICAgIGRhc2hib2FyZFN1bW1hcnk6IGFueSxcbiAgICBzZWN0aW9uczogRGFzaGJvYXJkU2VjdGlvbltdXG4gICk6IGFueSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLmRhc2hib2FyZFN1bW1hcnksXG4gICAgICBzZWN0aW9uQ291bnQ6IHNlY3Rpb25zLmxlbmd0aCxcbiAgICAgIGNhcmRDb3VudDogdGhpcy5jb3VudEl0ZW1zKHNlY3Rpb25zKSxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog6K6h566X6aG55pWwXG4gICAqL1xuICBwcml2YXRlIGNvdW50SXRlbXMoc2VjdGlvbnM6IERhc2hib2FyZFNlY3Rpb25bXSk6IG51bWJlciB7XG4gICAgcmV0dXJuIHNlY3Rpb25zLnJlZHVjZSgoc3VtLCBzZWN0aW9uKSA9PiBzdW0gKyBzZWN0aW9uLmNhcmRzLmxlbmd0aCwgMCk7XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g6L6F5Yqp5Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5YiG5q6157G75Z6L6L2s5o2i5Li65Luq6KGo55uY57G75Z6LXG4gKi9cbmZ1bmN0aW9uIHNlY3Rpb25UeXBlVG9EYXNoYm9hcmRUeXBlKHR5cGU6IHN0cmluZyk6IGFueSB7XG4gIGNvbnN0IHR5cGVNYXA6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7XG4gICAgdGFza3M6ICd0YXNrcycsXG4gICAgYXBwcm92YWxzOiAnYXBwcm92YWxzJyxcbiAgICBvcHM6ICdvcHMnLFxuICAgIGFnZW50czogJ2FnZW50cycsXG4gICAgaW5jaWRlbnRzOiAnaW5jaWRlbnRzJyxcbiAgICBhY3Rpb25zOiAnYWN0aW9ucycsXG4gIH07XG4gIFxuICByZXR1cm4gdHlwZU1hcFt0eXBlXSB8fCAndGFza3MnO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDkvr/mjbflh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDliJvlu7rmipXlvbHmnI3liqFcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVByb2plY3Rpb25TZXJ2aWNlKCk6IFByb2plY3Rpb25TZXJ2aWNlIHtcbiAgcmV0dXJuIG5ldyBQcm9qZWN0aW9uU2VydmljZSgpO1xufVxuXG4vKipcbiAqIOW/q+mAn+aKleW9seS7quihqOebmFxuICovXG5leHBvcnQgZnVuY3Rpb24gcHJvamVjdERhc2hib2FyZChcbiAgZGFzaGJvYXJkOiBhbnksXG4gIG9wdGlvbnM/OiBQcm9qZWN0aW9uT3B0aW9uc1xuKTogUHJvamVjdGlvblJlc3VsdCB7XG4gIGNvbnN0IHNlcnZpY2UgPSBuZXcgUHJvamVjdGlvblNlcnZpY2UoKTtcbiAgcmV0dXJuIHNlcnZpY2UucHJvamVjdChkYXNoYm9hcmQsIG9wdGlvbnMpO1xufVxuIl19