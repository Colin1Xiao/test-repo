"use strict";
/**
 * Response Formatter - 响应格式化执行层
 *
 * 职责：
 * 1. 接收结构化响应内容
 * 2. 根据 style 渲染为最终展示结果
 * 3. 统一处理 section 顺序、摘要长度、metadata 展示策略
 * 4. 输出给 CLI / Telegram / dashboard 可消费结果
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseFormatter = void 0;
exports.createResponseFormatter = createResponseFormatter;
exports.formatResponse = formatResponse;
// ============================================================================
// 响应格式化器
// ============================================================================
class ResponseFormatter {
    constructor(registry, config = {}) {
        this.config = {
            defaultStyleId: config.defaultStyleId ?? 'minimal',
            maxLineWidth: config.maxLineWidth ?? 120,
            enableColor: config.enableColor ?? false,
        };
        this.registry = registry;
    }
    /**
     * 格式化响应
     */
    formatResponse(content, styleId, options) {
        // 获取风格
        const style = this.registry.getStyle(styleId);
        if (!style) {
            throw new Error(`Style not found: ${styleId}`);
        }
        // 应用覆盖选项
        const effectiveStyle = this.applyStyleOverrides(style, options);
        // 构建内容分段
        const sections = this.buildContentSections(content, effectiveStyle);
        // 格式化分段
        const formattedSections = this.formatSections(sections, effectiveStyle);
        // 构建最终文本
        const text = this.buildFormattedText(formattedSections, effectiveStyle);
        // 计算内容哈希
        const contentHash = this.calculateContentHash(content);
        return {
            text,
            sections: formattedSections,
            styleId: effectiveStyle.id,
            metadata: {
                renderedAt: Date.now(),
                contentHash,
                styleVersion: '1.0.0',
            },
        };
    }
    /**
     * 格式化分段
     */
    formatSections(sections, style) {
        const blocks = [];
        for (const section of sections) {
            const sectionBlocks = this.formatSection(section, style);
            blocks.push(...sectionBlocks);
        }
        return blocks;
    }
    /**
     * 应用风格覆盖
     */
    applyStyleOverrides(style, options) {
        if (!options || !options.styleOverrides) {
            return style;
        }
        return {
            ...style,
            ...options.styleOverrides,
        };
    }
    /**
     * 构建内容分段
     */
    buildContentSections(content, style) {
        const sections = [];
        // 按风格定义的顺序添加分段
        for (const sectionType of style.sectionOrder) {
            const section = this.createSection(sectionType, content, style);
            if (section) {
                sections.push(section);
            }
        }
        return sections;
    }
    /**
     * 创建分段
     */
    createSection(sectionType, content, style) {
        switch (sectionType) {
            case 'summary':
                return this.createSummarySection(content, style);
            case 'status':
                return this.createStatusSection(content, style);
            case 'actions':
                return this.createActionsSection(content, style);
            case 'warnings':
                return this.createWarningsSection(content, style);
            case 'evidence':
                return this.createEvidenceSection(content, style);
            case 'metrics':
                return this.createMetricsSection(content, style);
            case 'timeline':
                return this.createTimelineSection(content, style);
            case 'artifacts':
                return this.createArtifactsSection(content, style);
            case 'recommendations':
                return this.createRecommendationsSection(content, style);
            case 'metadata':
                return this.createMetadataSection(content, style);
            default:
                return null;
        }
    }
    /**
     * 创建摘要分段
     */
    createSummarySection(content, style) {
        if (!content.summary) {
            return null;
        }
        let summary = content.summary;
        // 应用长度限制
        if (style.maxSummaryLength && summary.length > style.maxSummaryLength) {
            summary = summary.slice(0, style.maxSummaryLength - 3) + '...';
        }
        return {
            type: 'summary',
            title: 'Summary',
            content: summary,
            importance: 'high',
            collapsible: false,
            defaultExpanded: true,
        };
    }
    /**
     * 创建状态分段
     */
    createStatusSection(content, style) {
        if (!content.status) {
            return null;
        }
        return {
            type: 'status',
            title: 'Status',
            content: content.status,
            importance: 'high',
            collapsible: false,
            defaultExpanded: true,
        };
    }
    /**
     * 创建行动项分段
     */
    createActionsSection(content, style) {
        if (!content.actions || content.actions.length === 0) {
            return null;
        }
        // 根据风格决定是否压缩
        if (style.verbosity === 'minimal' && content.actions.length > 3) {
            return {
                type: 'actions',
                title: 'Key Actions',
                content: content.actions.slice(0, 3).map(a => a.action),
                importance: 'high',
                collapsible: false,
                defaultExpanded: true,
            };
        }
        return {
            type: 'actions',
            title: 'Actions',
            content: content.actions.map(a => a.priority ? `[${a.priority.toUpperCase()}] ${a.action}` : a.action),
            importance: 'high',
            collapsible: style.verbosity !== 'minimal',
            defaultExpanded: true,
        };
    }
    /**
     * 创建警告分段
     */
    createWarningsSection(content, style) {
        if (!content.warnings || content.warnings.length === 0) {
            return null;
        }
        // 根据风格决定是否包含
        if (style.verbosity === 'minimal') {
            // 只保留 critical 警告
            const criticalWarnings = content.warnings.filter(w => w.severity === 'critical');
            if (criticalWarnings.length === 0) {
                return null;
            }
            return {
                type: 'warnings',
                title: 'Critical Warnings',
                content: criticalWarnings.map(w => w.warning),
                importance: 'critical',
                collapsible: false,
                defaultExpanded: true,
            };
        }
        return {
            type: 'warnings',
            title: 'Warnings',
            content: content.warnings.map(w => w.severity ? `[${w.severity.toUpperCase()}] ${w.warning}` : w.warning),
            importance: 'high',
            collapsible: style.verbosity !== 'verbose',
            defaultExpanded: true,
        };
    }
    /**
     * 创建证据分段
     */
    createEvidenceSection(content, style) {
        if (!content.evidence || content.evidence.length === 0) {
            return null;
        }
        // 根据风格决定是否包含
        if (style.verbosity === 'minimal' || style.verbosity === 'concise') {
            return null;
        }
        return {
            type: 'evidence',
            title: 'Evidence',
            content: content.evidence.map(e => `${e.type}: ${e.description}${e.reference ? ` (${e.reference})` : ''}`),
            importance: 'medium',
            collapsible: true,
            defaultExpanded: style.verbosity === 'verbose',
        };
    }
    /**
     * 创建指标分段
     */
    createMetricsSection(content, style) {
        if (!content.metrics || Object.keys(content.metrics).length === 0) {
            return null;
        }
        const metrics = content.metrics;
        // 根据风格决定格式
        if (style.preferTables) {
            return {
                type: 'metrics',
                title: 'Metrics',
                content: Object.entries(metrics).map(([key, value]) => `${key}: ${value}`),
                importance: 'medium',
                collapsible: style.verbosity !== 'verbose',
                defaultExpanded: true,
            };
        }
        return {
            type: 'metrics',
            title: 'Metrics',
            content: metrics,
            importance: 'medium',
            collapsible: style.verbosity !== 'verbose',
            defaultExpanded: true,
        };
    }
    /**
     * 创建时间线分段
     */
    createTimelineSection(content, style) {
        if (!content.timeline || content.timeline.length === 0) {
            return null;
        }
        // 根据风格决定是否包含
        if (style.verbosity === 'minimal' || style.verbosity === 'concise') {
            return null;
        }
        // 根据风格决定是否包含时间戳
        const events = style.includeTimestamps
            ? content.timeline.map(e => `[${new Date(e.timestamp).toISOString()}] ${e.event}${e.status ? ` (${e.status})` : ''}`)
            : content.timeline.map(e => `${e.event}${e.status ? ` (${e.status})` : ''}`);
        return {
            type: 'timeline',
            title: 'Timeline',
            content: events,
            importance: 'low',
            collapsible: true,
            defaultExpanded: style.verbosity === 'verbose',
        };
    }
    /**
     * 创建产物分段
     */
    createArtifactsSection(content, style) {
        if (!content.artifacts || content.artifacts.length === 0) {
            return null;
        }
        // 根据风格决定格式
        if (style.verbosity === 'minimal') {
            return {
                type: 'artifacts',
                title: 'Artifacts',
                content: content.artifacts.slice(0, 3).map(a => a.name),
                importance: 'medium',
                collapsible: true,
                defaultExpanded: false,
            };
        }
        return {
            type: 'artifacts',
            title: 'Artifacts',
            content: content.artifacts.map(a => `${a.type}: ${a.name}${a.reference ? ` (${a.reference})` : ''}`),
            importance: 'medium',
            collapsible: true,
            defaultExpanded: style.verbosity === 'verbose',
        };
    }
    /**
     * 创建建议分段
     */
    createRecommendationsSection(content, style) {
        if (!content.recommendations || content.recommendations.length === 0) {
            return null;
        }
        // 根据风格决定是否包含
        if (style.verbosity === 'minimal' && content.recommendations.length > 2) {
            return {
                type: 'recommendations',
                title: 'Key Recommendations',
                content: content.recommendations.slice(0, 2),
                importance: 'medium',
                collapsible: false,
                defaultExpanded: true,
            };
        }
        return {
            type: 'recommendations',
            title: 'Recommendations',
            content: content.recommendations,
            importance: 'medium',
            collapsible: style.verbosity !== 'verbose',
            defaultExpanded: true,
        };
    }
    /**
     * 创建元数据分段
     */
    createMetadataSection(content, style) {
        if (!content.metadata || !style.includeMetadata) {
            return null;
        }
        // 根据风格决定是否包含
        if (style.verbosity === 'minimal' || style.verbosity === 'concise') {
            return null;
        }
        return {
            type: 'metadata',
            title: 'Metadata',
            content: content.metadata,
            importance: 'low',
            collapsible: true,
            defaultExpanded: false,
        };
    }
    /**
     * 格式化单个分段
     */
    formatSection(section, style) {
        const blocks = [];
        // 添加标题
        if (section.title) {
            blocks.push({
                type: 'text',
                content: `## ${section.title}`,
                styleClass: `section-title ${section.importance}`,
            });
        }
        // 根据内容类型格式化
        if (typeof section.content === 'string') {
            blocks.push({
                type: 'text',
                content: section.content,
                styleClass: `section-content ${section.importance}`,
            });
        }
        else if (Array.isArray(section.content)) {
            // 列表
            blocks.push({
                type: 'list',
                content: section.content.join('\n'),
                styleClass: style.preferTables ? 'table' : (style.preferBullets ? 'bullet' : 'numbered'),
            });
        }
        else if (typeof section.content === 'object') {
            // 对象/表格
            const lines = [];
            if (style.preferTables) {
                // 表格格式
                lines.push('| Key | Value |');
                lines.push('|-----|-------|');
                for (const [key, value] of Object.entries(section.content)) {
                    lines.push(`| ${key} | ${value} |`);
                }
            }
            else {
                // 键值对格式
                for (const [key, value] of Object.entries(section.content)) {
                    lines.push(`- **${key}**: ${value}`);
                }
            }
            blocks.push({
                type: style.preferTables ? 'table' : 'list',
                content: lines.join('\n'),
                styleClass: 'metadata',
            });
        }
        return blocks;
    }
    /**
     * 构建最终文本
     */
    buildFormattedText(blocks, style) {
        const lines = [];
        for (const block of blocks) {
            switch (block.type) {
                case 'text':
                    lines.push(block.content);
                    break;
                case 'list':
                    if (block.styleClass === 'bullet') {
                        lines.push(block.content.split('\n').map(line => `- ${line}`).join('\n'));
                    }
                    else if (block.styleClass === 'numbered') {
                        lines.push(block.content.split('\n').map((line, i) => `${i + 1}. ${line}`).join('\n'));
                    }
                    else {
                        lines.push(block.content);
                    }
                    break;
                case 'table':
                    lines.push(block.content);
                    break;
                case 'code':
                    if (style.codeBlockStyle === 'fenced') {
                        lines.push('```');
                        lines.push(block.content);
                        lines.push('```');
                    }
                    else if (style.codeBlockStyle === 'diff') {
                        lines.push('```diff');
                        lines.push(block.content);
                        lines.push('```');
                    }
                    else {
                        lines.push(`\`${block.content}\``);
                    }
                    break;
                case 'quote':
                    lines.push(`> ${block.content}`);
                    break;
                case 'divider':
                    lines.push('---');
                    break;
            }
            // 添加空行
            lines.push('');
        }
        return lines.join('\n').trim();
    }
    /**
     * 计算内容哈希
     */
    calculateContentHash(content) {
        const str = JSON.stringify(content);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return `hash_${Math.abs(hash).toString(36)}`;
    }
}
exports.ResponseFormatter = ResponseFormatter;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建响应格式化器
 */
function createResponseFormatter(registry, config) {
    return new ResponseFormatter(registry, config);
}
/**
 * 快速格式化响应
 */
function formatResponse(registry, content, styleId, options) {
    const formatter = new ResponseFormatter(registry);
    return formatter.formatResponse(content, styleId, options);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzcG9uc2VfZm9ybWF0dGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V4L3Jlc3BvbnNlX2Zvcm1hdHRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7O0dBV0c7OztBQXVvQkgsMERBS0M7QUFLRCx3Q0FRQztBQXpuQkQsK0VBQStFO0FBQy9FLFNBQVM7QUFDVCwrRUFBK0U7QUFFL0UsTUFBYSxpQkFBaUI7SUFJNUIsWUFBWSxRQUF1QixFQUFFLFNBQWtDLEVBQUU7UUFDdkUsSUFBSSxDQUFDLE1BQU0sR0FBRztZQUNaLGNBQWMsRUFBRSxNQUFNLENBQUMsY0FBYyxJQUFJLFNBQVM7WUFDbEQsWUFBWSxFQUFFLE1BQU0sQ0FBQyxZQUFZLElBQUksR0FBRztZQUN4QyxXQUFXLEVBQUUsTUFBTSxDQUFDLFdBQVcsSUFBSSxLQUFLO1NBQ3pDLENBQUM7UUFDRixJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztJQUMzQixDQUFDO0lBRUQ7O09BRUc7SUFDSCxjQUFjLENBQ1osT0FBa0MsRUFDbEMsT0FBZSxFQUNmLE9BQTRCO1FBRTVCLE9BQU87UUFDUCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUU5QyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDWCxNQUFNLElBQUksS0FBSyxDQUFDLG9CQUFvQixPQUFPLEVBQUUsQ0FBQyxDQUFDO1FBQ2pELENBQUM7UUFFRCxTQUFTO1FBQ1QsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztRQUVoRSxTQUFTO1FBQ1QsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLE9BQU8sRUFBRSxjQUFjLENBQUMsQ0FBQztRQUVwRSxRQUFRO1FBQ1IsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsY0FBYyxD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LFFBQVEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztJQUMvQyxDQUFDO0NBQ0Y7QUExbEJELDhDQTBsQkM7QUFFRCwrRUFBK0U7QUFDL0UsT0FBTztBQUNQLCtFQUErRTtBQUUvRTs7R0FFRztBQUNILFNBQWdCLHVCQUF1QixDQUNyQyxRQUF1QixFQUN2QixNQUFnQztJQUVoQyxPQUFPLElBQUksaUJBQWlCLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ2pELENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLGNBQWMsQ0FDNUIsUUFBdUIsRUFDdkIsT0FBa0MsRUFDbEMsT0FBZSxFQUNmLE9BQTRCO0lBRTVCLE1BQU0sU0FBUyxHQUFHLElBQUksaUJBQWlCLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDbEQsT0FBTyxTQUFTLENBQUMsY0FBYyxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDN0QsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUmVzcG9uc2UgRm9ybWF0dGVyIC0g5ZON5bqU5qC85byP5YyW5omn6KGM5bGCXG4gKiBcbiAqIOiBjOi0o++8mlxuICogMS4g5o6l5pS257uT5p6E5YyW5ZON5bqU5YaF5a65XG4gKiAyLiDmoLnmja4gc3R5bGUg5riy5p+T5Li65pyA57uI5bGV56S657uT5p6cXG4gKiAzLiDnu5/kuIDlpITnkIYgc2VjdGlvbiDpobrluo/jgIHmkZjopoHplb/luqbjgIFtZXRhZGF0YSDlsZXnpLrnrZbnlaVcbiAqIDQuIOi+k+WHuue7mSBDTEkgLyBUZWxlZ3JhbSAvIGRhc2hib2FyZCDlj6/mtojotLnnu5PmnpxcbiAqIFxuICogQHZlcnNpb24gdjAuMS4wXG4gKiBAZGF0ZSAyMDI2LTA0LTAzXG4gKi9cblxuaW1wb3J0IHR5cGUge1xuICBPdXRwdXRTdHlsZURlc2NyaXB0b3IsXG4gIFN0cnVjdHVyZWRSZXNwb25zZUNvbnRlbnQsXG4gIFJlc3BvbnNlRm9ybWF0UmVxdWVzdCxcbiAgUmVzcG9uc2VGb3JtYXRSZXN1bHQsXG4gIFN0eWxlUmVuZGVyT3B0aW9ucyxcbiAgQ29udGVudFNlY3Rpb24sXG4gIEZvcm1hdHRlZEJsb2NrLFxuICBDb250ZW50U2VjdGlvblR5cGUsXG59IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgU3R5bGVSZWdpc3RyeSB9IGZyb20gJy4vc3R5bGVfcmVnaXN0cnknO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDnsbvlnovlrprkuYlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDmoLzlvI/ljJblmajphY3nva5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSZXNwb25zZUZvcm1hdHRlckNvbmZpZyB7XG4gIC8qKiDpu5jorqTpo47moLwgSUQgKi9cbiAgZGVmYXVsdFN0eWxlSWQ/OiBzdHJpbmc7XG4gIFxuICAvKiog5pyA5aSn6KGM5a69ICovXG4gIG1heExpbmVXaWR0aD86IG51bWJlcjtcbiAgXG4gIC8qKiDmmK/lkKblkK/nlKjpopzoibIgKi9cbiAgZW5hYmxlQ29sb3I/OiBib29sZWFuO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDlk43lupTmoLzlvI/ljJblmahcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIFJlc3BvbnNlRm9ybWF0dGVyIHtcbiAgcHJpdmF0ZSBjb25maWc6IFJlcXVpcmVkPFJlc3BvbnNlRm9ybWF0dGVyQ29uZmlnPjtcbiAgcHJpdmF0ZSByZWdpc3RyeTogU3R5bGVSZWdpc3RyeTtcbiAgXG4gIGNvbnN0cnVjdG9yKHJlZ2lzdHJ5OiBTdHlsZVJlZ2lzdHJ5LCBjb25maWc6IFJlc3BvbnNlRm9ybWF0dGVyQ29uZmlnID0ge30pIHtcbiAgICB0aGlzLmNvbmZpZyA9IHtcbiAgICAgIGRlZmF1bHRTdHlsZUlkOiBjb25maWcuZGVmYXVsdFN0eWxlSWQgPz8gJ21pbmltYWwnLFxuICAgICAgbWF4TGluZVdpZHRoOiBjb25maWcubWF4TGluZVdpZHRoID8/IDEyMCxcbiAgICAgIGVuYWJsZUNvbG9yOiBjb25maWcuZW5hYmxlQ29sb3IgPz8gZmFsc2UsXG4gICAgfTtcbiAgICB0aGlzLnJlZ2lzdHJ5ID0gcmVnaXN0cnk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmoLzlvI/ljJblk43lupRcbiAgICovXG4gIGZvcm1hdFJlc3BvbnNlKFxuICAgIGNvbnRlbnQ6IFN0cnVjdHVyZWRSZXNwb25zZUNvbnRlbnQsXG4gICAgc3R5bGVJZDogc3RyaW5nLFxuICAgIG9wdGlvbnM/OiBTdHlsZVJlbmRlck9wdGlvbnNcbiAgKTogUmVzcG9uc2VGb3JtYXRSZXN1bHQge1xuICAgIC8vIOiOt+WPlumjjuagvFxuICAgIGNvbnN0IHN0eWxlID0gdGhpcy5yZWdpc3RyeS5nZXRTdHlsZShzdHlsZUlkKTtcbiAgICBcbiAgICBpZiAoIXN0eWxlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFN0eWxlIG5vdCBmb3VuZDogJHtzdHlsZUlkfWApO1xuICAgIH1cbiAgICBcbiAgICAvLyDlupTnlKjopobnm5bpgInpoblcbiAgICBjb25zdCBlZmZlY3RpdmVTdHlsZSA9IHRoaXMuYXBwbHlTdHlsZU92ZXJyaWRlcyhzdHlsZSwgb3B0aW9ucyk7XG4gICAgXG4gICAgLy8g5p6E5bu65YaF5a655YiG5q61XG4gICAgY29uc3Qgc2VjdGlvbnMgPSB0aGlzLmJ1aWxkQ29udGVudFNlY3Rpb25zKGNvbnRlbnQsIGVmZmVjdGl2ZVN0eWxlKTtcbiAgICBcbiAgICAvLyDmoLzlvI/ljJbliIbmrrVcbiAgICBjb25zdCBmb3JtYXR0ZWRTZWN0aW9ucyA9IHRoaXMuZm9ybWF0U2VjdGlvbnMoc2VjdGlvbnMsIGVmZmVjdGl2ZVN0eWxlKTtcbiAgICBcbiAgICAvLyDmnoTlu7rmnIDnu4jmlofmnKxcbiAgICBjb25zdCB0ZXh0ID0gdGhpcy5idWlsZEZvcm1hdHRlZFRleHQoZm9ybWF0dGVkU2VjdGlvbnMsIGVmZmVjdGl2ZVN0eWxlKTtcbiAgICBcbiAgICAvLyDorqHnrpflhoXlrrnlk4jluIxcbiAgICBjb25zdCBjb250ZW50SGFzaCA9IHRoaXMuY2FsY3VsYXRlQ29udGVudEhhc2goY29udGVudCk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHRleHQsXG4gICAgICBzZWN0aW9uczogZm9ybWF0dGVkU2VjdGlvbnMsXG4gICAgICBzdHlsZUlkOiBlZmZlY3RpdmVTdHlsZS5pZCxcbiAgICAgIG1ldGFkYXRhOiB7XG4gICAgICAgIHJlbmRlcmVkQXQ6IERhdGUubm93KCksXG4gICAgICAgIGNvbnRlbnRIYXNoLFxuICAgICAgICBzdHlsZVZlcnNpb246ICcxLjAuMCcsXG4gICAgICB9LFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmoLzlvI/ljJbliIbmrrVcbiAgICovXG4gIGZvcm1hdFNlY3Rpb25zKFxuICAgIHNlY3Rpb25zOiBDb250ZW50U2VjdGlvbltdLFxuICAgIHN0eWxlOiBPdXRwdXRTdHlsZURlc2NyaXB0b3JcbiAgKTogRm9ybWF0dGVkQmxvY2tbXSB7XG4gICAgY29uc3QgYmxvY2tzOiBGb3JtYXR0ZWRCbG9ja1tdID0gW107XG4gICAgXG4gICAgZm9yIChjb25zdCBzZWN0aW9uIG9mIHNlY3Rpb25zKSB7XG4gICAgICBjb25zdCBzZWN0aW9uQmxvY2tzID0gdGhpcy5mb3JtYXRTZWN0aW9uKHNlY3Rpb24sIHN0eWxlKTtcbiAgICAgIGJsb2Nrcy5wdXNoKC4uLnNlY3Rpb25CbG9ja3MpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gYmxvY2tzO1xuICB9XG4gIFxuICAvKipcbiAgICog5bqU55So6aOO5qC86KaG55uWXG4gICAqL1xuICBwcml2YXRlIGFwcGx5U3R5bGVPdmVycmlkZXMoXG4gICAgc3R5bGU6IE91dHB1dFN0eWxlRGVzY3JpcHRvcixcbiAgICBvcHRpb25zPzogU3R5bGVSZW5kZXJPcHRpb25zXG4gICk6IE91dHB1dFN0eWxlRGVzY3JpcHRvciB7XG4gICAgaWYgKCFvcHRpb25zIHx8ICFvcHRpb25zLnN0eWxlT3ZlcnJpZGVzKSB7XG4gICAgICByZXR1cm4gc3R5bGU7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICAuLi5zdHlsZSxcbiAgICAgIC4uLm9wdGlvbnMuc3R5bGVPdmVycmlkZXMsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaehOW7uuWGheWuueWIhuautVxuICAgKi9cbiAgcHJpdmF0ZSBidWlsZENvbnRlbnRTZWN0aW9ucyhcbiAgICBjb250ZW50OiBTdHJ1Y3R1cmVkUmVzcG9uc2VDb250ZW50LFxuICAgIHN0eWxlOiBPdXRwdXRTdHlsZURlc2NyaXB0b3JcbiAgKTogQ29udGVudFNlY3Rpb25bXSB7XG4gICAgY29uc3Qgc2VjdGlvbnM6IENvbnRlbnRTZWN0aW9uW10gPSBbXTtcbiAgICBcbiAgICAvLyDmjInpo47moLzlrprkuYnnmoTpobrluo/mt7vliqDliIbmrrVcbiAgICBmb3IgKGNvbnN0IHNlY3Rpb25UeXBlIG9mIHN0eWxlLnNlY3Rpb25PcmRlcikge1xuICAgICAgY29uc3Qgc2VjdGlvbiA9IHRoaXMuY3JlYXRlU2VjdGlvbihzZWN0aW9uVHlwZSwgY29udGVudCwgc3R5bGUpO1xuICAgICAgXG4gICAgICBpZiAoc2VjdGlvbikge1xuICAgICAgICBzZWN0aW9ucy5wdXNoKHNlY3Rpb24pO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gc2VjdGlvbnM7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDliJvlu7rliIbmrrVcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlU2VjdGlvbihcbiAgICBzZWN0aW9uVHlwZTogQ29udGVudFNlY3Rpb25UeXBlLFxuICAgIGNvbnRlbnQ6IFN0cnVjdHVyZWRSZXNwb25zZUNvbnRlbnQsXG4gICAgc3R5bGU6IE91dHB1dFN0eWxlRGVzY3JpcHRvclxuICApOiBDb250ZW50U2VjdGlvbiB8IG51bGwge1xuICAgIHN3aXRjaCAoc2VjdGlvblR5cGUpIHtcbiAgICAgIGNhc2UgJ3N1bW1hcnknOlxuICAgICAgICByZXR1cm4gdGhpcy5jcmVhdGVTdW1tYXJ5U2VjdGlvbihjb250ZW50LCBzdHlsZSk7XG4gICAgICBcbiAgICAgIGNhc2UgJ3N0YXR1cyc6XG4gICAgICAgIHJldHVybiB0aGlzLmNyZWF0ZVN0YXR1c1NlY3Rpb24oY29udGVudCwgc3R5bGUpO1xuICAgICAgXG4gICAgICBjYXNlICdhY3Rpb25zJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuY3JlYXRlQWN0aW9uc1NlY3Rpb24oY29udGVudCwgc3R5bGUpO1xuICAgICAgXG4gICAgICBjYXNlICd3YXJuaW5ncyc6XG4gICAgICAgIHJldHVybiB0aGlzLmNyZWF0ZVdhcm5pbmdzU2VjdGlvbihjb250ZW50LCBzdHlsZSk7XG4gICAgICBcbiAgICAgIGNhc2UgJ2V2aWRlbmNlJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuY3JlYXRlRXZpZGVuY2VTZWN0aW9uKGNvbnRlbnQsIHN0eWxlKTtcbiAgICAgIFxuICAgICAgY2FzZSAnbWV0cmljcyc6XG4gICAgICAgIHJldHVybiB0aGlzLmNyZWF0ZU1ldHJpY3NTZWN0aW9uKGNvbnRlbnQsIHN0eWxlKTtcbiAgICAgIFxuICAgICAgY2FzZSAndGltZWxpbmUnOlxuICAgICAgICByZXR1cm4gdGhpcy5jcmVhdGVUaW1lbGluZVNlY3Rpb24oY29udGVudCwgc3R5bGUpO1xuICAgICAgXG4gICAgICBjYXNlICdhcnRpZmFjdHMnOlxuICAgICAgICByZXR1cm4gdGhpcy5jcmVhdGVBcnRpZmFjdHNTZWN0aW9uKGNvbnRlbnQsIHN0eWxlKTtcbiAgICAgIFxuICAgICAgY2FzZSAncmVjb21tZW5kYXRpb25zJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuY3JlYXRlUmVjb21tZW5kYXRpb25zU2VjdGlvbihjb250ZW50LCBzdHlsZSk7XG4gICAgICBcbiAgICAgIGNhc2UgJ21ldGFkYXRhJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuY3JlYXRlTWV0YWRhdGFTZWN0aW9uKGNvbnRlbnQsIHN0eWxlKTtcbiAgICAgIFxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog5Yib5bu65pGY6KaB5YiG5q61XG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZVN1bW1hcnlTZWN0aW9uKFxuICAgIGNvbnRlbnQ6IFN0cnVjdHVyZWRSZXNwb25zZUNvbnRlbnQsXG4gICAgc3R5bGU6IE91dHB1dFN0eWxlRGVzY3JpcHRvclxuICApOiBDb250ZW50U2VjdGlvbiB8IG51bGwge1xuICAgIGlmICghY29udGVudC5zdW1tYXJ5KSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgXG4gICAgbGV0IHN1bW1hcnkgPSBjb250ZW50LnN1bW1hcnk7XG4gICAgXG4gICAgLy8g5bqU55So6ZW/5bqm6ZmQ5Yi2XG4gICAgaWYgKHN0eWxlLm1heFN1bW1hcnlMZW5ndGggJiYgc3VtbWFyeS5sZW5ndGggPiBzdHlsZS5tYXhTdW1tYXJ5TGVuZ3RoKSB7XG4gICAgICBzdW1tYXJ5ID0gc3VtbWFyeS5zbGljZSgwLCBzdHlsZS5tYXhTdW1tYXJ5TGVuZ3RoIC0gMykgKyAnLi4uJztcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdzdW1tYXJ5JyxcbiAgICAgIHRpdGxlOiAnU3VtbWFyeScsXG4gICAgICBjb250ZW50OiBzdW1tYXJ5LFxuICAgICAgaW1wb3J0YW5jZTogJ2hpZ2gnLFxuICAgICAgY29sbGFwc2libGU6IGZhbHNlLFxuICAgICAgZGVmYXVsdEV4cGFuZGVkOiB0cnVlLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDliJvlu7rnirbmgIHliIbmrrVcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlU3RhdHVzU2VjdGlvbihcbiAgICBjb250ZW50OiBTdHJ1Y3R1cmVkUmVzcG9uc2VDb250ZW50LFxuICAgIHN0eWxlOiBPdXRwdXRTdHlsZURlc2NyaXB0b3JcbiAgKTogQ29udGVudFNlY3Rpb24gfCBudWxsIHtcbiAgICBpZiAoIWNvbnRlbnQuc3RhdHVzKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdzdGF0dXMnLFxuICAgICAgdGl0bGU6ICdTdGF0dXMnLFxuICAgICAgY29udGVudDogY29udGVudC5zdGF0dXMsXG4gICAgICBpbXBvcnRhbmNlOiAnaGlnaCcsXG4gICAgICBjb2xsYXBzaWJsZTogZmFsc2UsXG4gICAgICBkZWZhdWx0RXhwYW5kZWQ6IHRydWUsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOWIm+W7uuihjOWKqOmhueWIhuautVxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVBY3Rpb25zU2VjdGlvbihcbiAgICBjb250ZW50OiBTdHJ1Y3R1cmVkUmVzcG9uc2VDb250ZW50LFxuICAgIHN0eWxlOiBPdXRwdXRTdHlsZURlc2NyaXB0b3JcbiAgKTogQ29udGVudFNlY3Rpb24gfCBudWxsIHtcbiAgICBpZiAoIWNvbnRlbnQuYWN0aW9ucyB8fCBjb250ZW50LmFjdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgXG4gICAgLy8g5qC55o2u6aOO5qC85Yaz5a6a5piv5ZCm5Y6L57ypXG4gICAgaWYgKHN0eWxlLnZlcmJvc2l0eSA9PT0gJ21pbmltYWwnICYmIGNvbnRlbnQuYWN0aW9ucy5sZW5ndGggPiAzKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlOiAnYWN0aW9ucycsXG4gICAgICAgIHRpdGxlOiAnS2V5IEFjdGlvbnMnLFxuICAgICAgICBjb250ZW50OiBjb250ZW50LmFjdGlvbnMuc2xpY2UoMCwgMykubWFwKGEgPT4gYS5hY3Rpb24pLFxuICAgICAgICBpbXBvcnRhbmNlOiAnaGlnaCcsXG4gICAgICAgIGNvbGxhcHNpYmxlOiBmYWxzZSxcbiAgICAgICAgZGVmYXVsdEV4cGFuZGVkOiB0cnVlLFxuICAgICAgfTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdhY3Rpb25zJyxcbiAgICAgIHRpdGxlOiAnQWN0aW9ucycsXG4gICAgICBjb250ZW50OiBjb250ZW50LmFjdGlvbnMubWFwKGEgPT4gXG4gICAgICAgIGEucHJpb3JpdHkgPyBgWyR7YS5wcmlvcml0eS50b1VwcGVyQ2FzZSgpfV0gJHthLmFjdGlvbn1gIDogYS5hY3Rpb25cbiAgICAgICksXG4gICAgICBpbXBvcnRhbmNlOiAnaGlnaCcsXG4gICAgICBjb2xsYXBzaWJsZTogc3R5bGUudmVyYm9zaXR5ICE9PSAnbWluaW1hbCcsXG4gICAgICBkZWZhdWx0RXhwYW5kZWQ6IHRydWUsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOWIm+W7uuitpuWRiuWIhuautVxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVXYXJuaW5nc1NlY3Rpb24oXG4gICAgY29udGVudDogU3RydWN0dXJlZFJlc3BvbnNlQ29udGVudCxcbiAgICBzdHlsZTogT3V0cHV0U3R5bGVEZXNjcmlwdG9yXG4gICk6IENvbnRlbnRTZWN0aW9uIHwgbnVsbCB7XG4gICAgaWYgKCFjb250ZW50Lndhcm5pbmdzIHx8IGNvbnRlbnQud2FybmluZ3MubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgXG4gICAgLy8g5qC55o2u6aOO5qC85Yaz5a6a5piv5ZCm5YyF5ZCrXG4gICAgaWYgKHN0eWxlLnZlcmJvc2l0eSA9PT0gJ21pbmltYWwnKSB7XG4gICAgICAvLyDlj6rkv53nlZkgY3JpdGljYWwg6K2m5ZGKXG4gICAgICBjb25zdCBjcml0aWNhbFdhcm5pbmdzID0gY29udGVudC53YXJuaW5ncy5maWx0ZXIodyA9PiB3LnNldmVyaXR5ID09PSAnY3JpdGljYWwnKTtcbiAgICAgIGlmIChjcml0aWNhbFdhcm5pbmdzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHlwZTogJ3dhcm5pbmdzJyxcbiAgICAgICAgdGl0bGU6ICdDcml0aWNhbCBXYXJuaW5ncycsXG4gICAgICAgIGNvbnRlbnQ6IGNyaXRpY2FsV2FybmluZ3MubWFwKHcgPT4gdy53YXJuaW5nKSxcbiAgICAgICAgaW1wb3J0YW5jZTogJ2NyaXRpY2FsJyxcbiAgICAgICAgY29sbGFwc2libGU6IGZhbHNlLFxuICAgICAgICBkZWZhdWx0RXhwYW5kZWQ6IHRydWUsXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ3dhcm5pbmdzJyxcbiAgICAgIHRpdGxlOiAnV2FybmluZ3MnLFxuICAgICAgY29udGVudDogY29udGVudC53YXJuaW5ncy5tYXAodyA9PiBcbiAgICAgICAgdy5zZXZlcml0eSA/IGBbJHt3LnNldmVyaXR5LnRvVXBwZXJDYXNlKCl9XSAke3cud2FybmluZ31gIDogdy53YXJuaW5nXG4gICAgICApLFxuICAgICAgaW1wb3J0YW5jZTogJ2hpZ2gnLFxuICAgICAgY29sbGFwc2libGU6IHN0eWxlLnZlcmJvc2l0eSAhPT0gJ3ZlcmJvc2UnLFxuICAgICAgZGVmYXVsdEV4cGFuZGVkOiB0cnVlLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDliJvlu7ror4Hmja7liIbmrrVcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlRXZpZGVuY2VTZWN0aW9uKFxuICAgIGNvbnRlbnQ6IFN0cnVjdHVyZWRSZXNwb25zZUNvbnRlbnQsXG4gICAgc3R5bGU6IE91dHB1dFN0eWxlRGVzY3JpcHRvclxuICApOiBDb250ZW50U2VjdGlvbiB8IG51bGwge1xuICAgIGlmICghY29udGVudC5ldmlkZW5jZSB8fCBjb250ZW50LmV2aWRlbmNlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIFxuICAgIC8vIOagueaNrumjjuagvOWGs+WumuaYr+WQpuWMheWQq1xuICAgIGlmIChzdHlsZS52ZXJib3NpdHkgPT09ICdtaW5pbWFsJyB8fCBzdHlsZS52ZXJib3NpdHkgPT09ICdjb25jaXNlJykge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiAnZXZpZGVuY2UnLFxuICAgICAgdGl0bGU6ICdFdmlkZW5jZScsXG4gICAgICBjb250ZW50OiBjb250ZW50LmV2aWRlbmNlLm1hcChlID0+IFxuICAgICAgICBgJHtlLnR5cGV9OiAke2UuZGVzY3JpcHRpb259JHtlLnJlZmVyZW5jZSA/IGAgKCR7ZS5yZWZlcmVuY2V9KWAgOiAnJ31gXG4gICAgICApLFxuICAgICAgaW1wb3J0YW5jZTogJ21lZGl1bScsXG4gICAgICBjb2xsYXBzaWJsZTogdHJ1ZSxcbiAgICAgIGRlZmF1bHRFeHBhbmRlZDogc3R5bGUudmVyYm9zaXR5ID09PSAndmVyYm9zZScsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOWIm+W7uuaMh+agh+WIhuautVxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVNZXRyaWNzU2VjdGlvbihcbiAgICBjb250ZW50OiBTdHJ1Y3R1cmVkUmVzcG9uc2VDb250ZW50LFxuICAgIHN0eWxlOiBPdXRwdXRTdHlsZURlc2NyaXB0b3JcbiAgKTogQ29udGVudFNlY3Rpb24gfCBudWxsIHtcbiAgICBpZiAoIWNvbnRlbnQubWV0cmljcyB8fCBPYmplY3Qua2V5cyhjb250ZW50Lm1ldHJpY3MpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IG1ldHJpY3MgPSBjb250ZW50Lm1ldHJpY3M7XG4gICAgXG4gICAgLy8g5qC55o2u6aOO5qC85Yaz5a6a5qC85byPXG4gICAgaWYgKHN0eWxlLnByZWZlclRhYmxlcykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHlwZTogJ21ldHJpY3MnLFxuICAgICAgICB0aXRsZTogJ01ldHJpY3MnLFxuICAgICAgICBjb250ZW50OiBPYmplY3QuZW50cmllcyhtZXRyaWNzKS5tYXAoKFtrZXksIHZhbHVlXSkgPT4gYCR7a2V5fTogJHt2YWx1ZX1gKSxcbiAgICAgICAgaW1wb3J0YW5jZTogJ21lZGl1bScsXG4gICAgICAgIGNvbGxhcHNpYmxlOiBzdHlsZS52ZXJib3NpdHkgIT09ICd2ZXJib3NlJyxcbiAgICAgICAgZGVmYXVsdEV4cGFuZGVkOiB0cnVlLFxuICAgICAgfTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdtZXRyaWNzJyxcbiAgICAgIHRpdGxlOiAnTWV0cmljcycsXG4gICAgICBjb250ZW50OiBtZXRyaWNzLFxuICAgICAgaW1wb3J0YW5jZTogJ21lZGl1bScsXG4gICAgICBjb2xsYXBzaWJsZTogc3R5bGUudmVyYm9zaXR5ICE9PSAndmVyYm9zZScsXG4gICAgICBkZWZhdWx0RXhwYW5kZWQ6IHRydWUsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOWIm+W7uuaXtumXtOe6v+WIhuautVxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVUaW1lbGluZVNlY3Rpb24oXG4gICAgY29udGVudDogU3RydWN0dXJlZFJlc3BvbnNlQ29udGVudCxcbiAgICBzdHlsZTogT3V0cHV0U3R5bGVEZXNjcmlwdG9yXG4gICk6IENvbnRlbnRTZWN0aW9uIHwgbnVsbCB7XG4gICAgaWYgKCFjb250ZW50LnRpbWVsaW5lIHx8IGNvbnRlbnQudGltZWxpbmUubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgXG4gICAgLy8g5qC55o2u6aOO5qC85Yaz5a6a5piv5ZCm5YyF5ZCrXG4gICAgaWYgKHN0eWxlLnZlcmJvc2l0eSA9PT0gJ21pbmltYWwnIHx8IHN0eWxlLnZlcmJvc2l0eSA9PT0gJ2NvbmNpc2UnKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgXG4gICAgLy8g5qC55o2u6aOO5qC85Yaz5a6a5piv5ZCm5YyF5ZCr5pe26Ze05oizXG4gICAgY29uc3QgZXZlbnRzID0gc3R5bGUuaW5jbHVkZVRpbWVzdGFtcHNcbiAgICAgID8gY29udGVudC50aW1lbGluZS5tYXAoZSA9PiBgWyR7bmV3IERhdGUoZS50aW1lc3RhbXApLnRvSVNPU3RyaW5nKCl9XSAke2UuZXZlbnR9JHtlLnN0YXR1cyA/IGAgKCR7ZS5zdGF0dXN9KWAgOiAnJ31gKVxuICAgICAgOiBjb250ZW50LnRpbWVsaW5lLm1hcChlID0+IGAke2UuZXZlbnR9JHtlLnN0YXR1cyA/IGAgKCR7ZS5zdGF0dXN9KWAgOiAnJ31gKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ3RpbWVsaW5lJyxcbiAgICAgIHRpdGxlOiAnVGltZWxpbmUnLFxuICAgICAgY29udGVudDogZXZlbnRzLFxuICAgICAgaW1wb3J0YW5jZTogJ2xvdycsXG4gICAgICBjb2xsYXBzaWJsZTogdHJ1ZSxcbiAgICAgIGRlZmF1bHRFeHBhbmRlZDogc3R5bGUudmVyYm9zaXR5ID09PSAndmVyYm9zZScsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOWIm+W7uuS6p+eJqeWIhuautVxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVBcnRpZmFjdHNTZWN0aW9uKFxuICAgIGNvbnRlbnQ6IFN0cnVjdHVyZWRSZXNwb25zZUNvbnRlbnQsXG4gICAgc3R5bGU6IE91dHB1dFN0eWxlRGVzY3JpcHRvclxuICApOiBDb250ZW50U2VjdGlvbiB8IG51bGwge1xuICAgIGlmICghY29udGVudC5hcnRpZmFjdHMgfHwgY29udGVudC5hcnRpZmFjdHMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgXG4gICAgLy8g5qC55o2u6aOO5qC85Yaz5a6a5qC85byPXG4gICAgaWYgKHN0eWxlLnZlcmJvc2l0eSA9PT0gJ21pbmltYWwnKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlOiAnYXJ0aWZhY3RzJyxcbiAgICAgICAgdGl0bGU6ICdBcnRpZmFjdHMnLFxuICAgICAgICBjb250ZW50OiBjb250ZW50LmFydGlmYWN0cy5zbGljZSgwLCAzKS5tYXAoYSA9PiBhLm5hbWUpLFxuICAgICAgICBpbXBvcnRhbmNlOiAnbWVkaXVtJyxcbiAgICAgICAgY29sbGFwc2libGU6IHRydWUsXG4gICAgICAgIGRlZmF1bHRFeHBhbmRlZDogZmFsc2UsXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogJ2FydGlmYWN0cycsXG4gICAgICB0aXRsZTogJ0FydGlmYWN0cycsXG4gICAgICBjb250ZW50OiBjb250ZW50LmFydGlmYWN0cy5tYXAoYSA9PiBcbiAgICAgICAgYCR7YS50eXBlfTogJHthLm5hbWV9JHthLnJlZmVyZW5jZSA/IGAgKCR7YS5yZWZlcmVuY2V9KWAgOiAnJ31gXG4gICAgICApLFxuICAgICAgaW1wb3J0YW5jZTogJ21lZGl1bScsXG4gICAgICBjb2xsYXBzaWJsZTogdHJ1ZSxcbiAgICAgIGRlZmF1bHRFeHBhbmRlZDogc3R5bGUudmVyYm9zaXR5ID09PSAndmVyYm9zZScsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOWIm+W7uuW7uuiuruWIhuautVxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVSZWNvbW1lbmRhdGlvbnNTZWN0aW9uKFxuICAgIGNvbnRlbnQ6IFN0cnVjdHVyZWRSZXNwb25zZUNvbnRlbnQsXG4gICAgc3R5bGU6IE91dHB1dFN0eWxlRGVzY3JpcHRvclxuICApOiBDb250ZW50U2VjdGlvbiB8IG51bGwge1xuICAgIGlmICghY29udGVudC5yZWNvbW1lbmRhdGlvbnMgfHwgY29udGVudC5yZWNvbW1lbmRhdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgXG4gICAgLy8g5qC55o2u6aOO5qC85Yaz5a6a5piv5ZCm5YyF5ZCrXG4gICAgaWYgKHN0eWxlLnZlcmJvc2l0eSA9PT0gJ21pbmltYWwnICYmIGNvbnRlbnQucmVjb21tZW5kYXRpb25zLmxlbmd0aCA+IDIpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGU6ICdyZWNvbW1lbmRhdGlvbnMnLFxuICAgICAgICB0aXRsZTogJ0tleSBSZWNvbW1lbmRhdGlvbnMnLFxuICAgICAgICBjb250ZW50OiBjb250ZW50LnJlY29tbWVuZGF0aW9ucy5zbGljZSgwLCAyKSxcbiAgICAgICAgaW1wb3J0YW5jZTogJ21lZGl1bScsXG4gICAgICAgIGNvbGxhcHNpYmxlOiBmYWxzZSxcbiAgICAgICAgZGVmYXVsdEV4cGFuZGVkOiB0cnVlLFxuICAgICAgfTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdyZWNvbW1lbmRhdGlvbnMnLFxuICAgICAgdGl0bGU6ICdSZWNvbW1lbmRhdGlvbnMnLFxuICAgICAgY29udGVudDogY29udGVudC5yZWNvbW1lbmRhdGlvbnMsXG4gICAgICBpbXBvcnRhbmNlOiAnbWVkaXVtJyxcbiAgICAgIGNvbGxhcHNpYmxlOiBzdHlsZS52ZXJib3NpdHkgIT09ICd2ZXJib3NlJyxcbiAgICAgIGRlZmF1bHRFeHBhbmRlZDogdHJ1ZSxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog5Yib5bu65YWD5pWw5o2u5YiG5q61XG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZU1ldGFkYXRhU2VjdGlvbihcbiAgICBjb250ZW50OiBTdHJ1Y3R1cmVkUmVzcG9uc2VDb250ZW50LFxuICAgIHN0eWxlOiBPdXRwdXRTdHlsZURlc2NyaXB0b3JcbiAgKTogQ29udGVudFNlY3Rpb24gfCBudWxsIHtcbiAgICBpZiAoIWNvbnRlbnQubWV0YWRhdGEgfHwgIXN0eWxlLmluY2x1ZGVNZXRhZGF0YSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIFxuICAgIC8vIOagueaNrumjjuagvOWGs+WumuaYr+WQpuWMheWQq1xuICAgIGlmIChzdHlsZS52ZXJib3NpdHkgPT09ICdtaW5pbWFsJyB8fCBzdHlsZS52ZXJib3NpdHkgPT09ICdjb25jaXNlJykge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiAnbWV0YWRhdGEnLFxuICAgICAgdGl0bGU6ICdNZXRhZGF0YScsXG4gICAgICBjb250ZW50OiBjb250ZW50Lm1ldGFkYXRhLFxuICAgICAgaW1wb3J0YW5jZTogJ2xvdycsXG4gICAgICBjb2xsYXBzaWJsZTogdHJ1ZSxcbiAgICAgIGRlZmF1bHRFeHBhbmRlZDogZmFsc2UsXG4gICAgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOagvOW8j+WMluWNleS4quWIhuautVxuICAgKi9cbiAgcHJpdmF0ZSBmb3JtYXRTZWN0aW9uKFxuICAgIHNlY3Rpb246IENvbnRlbnRTZWN0aW9uLFxuICAgIHN0eWxlOiBPdXRwdXRTdHlsZURlc2NyaXB0b3JcbiAgKTogRm9ybWF0dGVkQmxvY2tbXSB7XG4gICAgY29uc3QgYmxvY2tzOiBGb3JtYXR0ZWRCbG9ja1tdID0gW107XG4gICAgXG4gICAgLy8g5re75Yqg5qCH6aKYXG4gICAgaWYgKHNlY3Rpb24udGl0bGUpIHtcbiAgICAgIGJsb2Nrcy5wdXNoKHtcbiAgICAgICAgdHlwZTogJ3RleHQnLFxuICAgICAgICBjb250ZW50OiBgIyMgJHtzZWN0aW9uLnRpdGxlfWAsXG4gICAgICAgIHN0eWxlQ2xhc3M6IGBzZWN0aW9uLXRpdGxlICR7c2VjdGlvbi5pbXBvcnRhbmNlfWAsXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgLy8g5qC55o2u5YaF5a6557G75Z6L5qC85byP5YyWXG4gICAgaWYgKHR5cGVvZiBzZWN0aW9uLmNvbnRlbnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICBibG9ja3MucHVzaCh7XG4gICAgICAgIHR5cGU6ICd0ZXh0JyxcbiAgICAgICAgY29udGVudDogc2VjdGlvbi5jb250ZW50LFxuICAgICAgICBzdHlsZUNsYXNzOiBgc2VjdGlvbi1jb250ZW50ICR7c2VjdGlvbi5pbXBvcnRhbmNlfWAsXG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoc2VjdGlvbi5jb250ZW50KSkge1xuICAgICAgLy8g5YiX6KGoXG4gICAgICBibG9ja3MucHVzaCh7XG4gICAgICAgIHR5cGU6ICdsaXN0JyxcbiAgICAgICAgY29udGVudDogc2VjdGlvbi5jb250ZW50LmpvaW4oJ1xcbicpLFxuICAgICAgICBzdHlsZUNsYXNzOiBzdHlsZS5wcmVmZXJUYWJsZXMgPyAndGFibGUnIDogKHN0eWxlLnByZWZlckJ1bGxldHMgPyAnYnVsbGV0JyA6ICdudW1iZXJlZCcpLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2Ygc2VjdGlvbi5jb250ZW50ID09PSAnb2JqZWN0Jykge1xuICAgICAgLy8g5a+56LGhL+ihqOagvFxuICAgICAgY29uc3QgbGluZXM6IHN0cmluZ1tdID0gW107XG4gICAgICBcbiAgICAgIGlmIChzdHlsZS5wcmVmZXJUYWJsZXMpIHtcbiAgICAgICAgLy8g6KGo5qC85qC85byPXG4gICAgICAgIGxpbmVzLnB1c2goJ3wgS2V5IHwgVmFsdWUgfCcpO1xuICAgICAgICBsaW5lcy5wdXNoKCd8LS0tLS18LS0tLS0tLXwnKTtcbiAgICAgICAgXG4gICAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKHNlY3Rpb24uY29udGVudCkpIHtcbiAgICAgICAgICBsaW5lcy5wdXNoKGB8ICR7a2V5fSB8ICR7dmFsdWV9IHxgKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8g6ZSu5YC85a+55qC85byPXG4gICAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKHNlY3Rpb24uY29udGVudCkpIHtcbiAgICAgICAgICBsaW5lcy5wdXNoKGAtICoqJHtrZXl9Kio6ICR7dmFsdWV9YCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgYmxvY2tzLnB1c2goe1xuICAgICAgICB0eXBlOiBzdHlsZS5wcmVmZXJUYWJsZXMgPyAndGFibGUnIDogJ2xpc3QnLFxuICAgICAgICBjb250ZW50OiBsaW5lcy5qb2luKCdcXG4nKSxcbiAgICAgICAgc3R5bGVDbGFzczogJ21ldGFkYXRhJyxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gYmxvY2tzO1xuICB9XG4gIFxuICAvKipcbiAgICog5p6E5bu65pyA57uI5paH5pysXG4gICAqL1xuICBwcml2YXRlIGJ1aWxkRm9ybWF0dGVkVGV4dChcbiAgICBibG9ja3M6IEZvcm1hdHRlZEJsb2NrW10sXG4gICAgc3R5bGU6IE91dHB1dFN0eWxlRGVzY3JpcHRvclxuICApOiBzdHJpbmcge1xuICAgIGNvbnN0IGxpbmVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIFxuICAgIGZvciAoY29uc3QgYmxvY2sgb2YgYmxvY2tzKSB7XG4gICAgICBzd2l0Y2ggKGJsb2NrLnR5cGUpIHtcbiAgICAgICAgY2FzZSAndGV4dCc6XG4gICAgICAgICAgbGluZXMucHVzaChibG9jay5jb250ZW50KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgXG4gICAgICAgIGNhc2UgJ2xpc3QnOlxuICAgICAgICAgIGlmIChibG9jay5zdHlsZUNsYXNzID09PSAnYnVsbGV0Jykge1xuICAgICAgICAgICAgbGluZXMucHVzaChibG9jay5jb250ZW50LnNwbGl0KCdcXG4nKS5tYXAobGluZSA9PiBgLSAke2xpbmV9YCkuam9pbignXFxuJykpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoYmxvY2suc3R5bGVDbGFzcyA9PT0gJ251bWJlcmVkJykge1xuICAgICAgICAgICAgbGluZXMucHVzaChibG9jay5jb250ZW50LnNwbGl0KCdcXG4nKS5tYXAoKGxpbmUsIGkpID0+IGAke2kgKyAxfS4gJHtsaW5lfWApLmpvaW4oJ1xcbicpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGluZXMucHVzaChibG9jay5jb250ZW50KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIFxuICAgICAgICBjYXNlICd0YWJsZSc6XG4gICAgICAgICAgbGluZXMucHVzaChibG9jay5jb250ZW50KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgXG4gICAgICAgIGNhc2UgJ2NvZGUnOlxuICAgICAgICAgIGlmIChzdHlsZS5jb2RlQmxvY2tTdHlsZSA9PT0gJ2ZlbmNlZCcpIHtcbiAgICAgICAgICAgIGxpbmVzLnB1c2goJ2BgYCcpO1xuICAgICAgICAgICAgbGluZXMucHVzaChibG9jay5jb250ZW50KTtcbiAgICAgICAgICAgIGxpbmVzLnB1c2goJ2BgYCcpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoc3R5bGUuY29kZUJsb2NrU3R5bGUgPT09ICdkaWZmJykge1xuICAgICAgICAgICAgbGluZXMucHVzaCgnYGBgZGlmZicpO1xuICAgICAgICAgICAgbGluZXMucHVzaChibG9jay5jb250ZW50KTtcbiAgICAgICAgICAgIGxpbmVzLnB1c2goJ2BgYCcpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsaW5lcy5wdXNoKGBcXGAke2Jsb2NrLmNvbnRlbnR9XFxgYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBcbiAgICAgICAgY2FzZSAncXVvdGUnOlxuICAgICAgICAgIGxpbmVzLnB1c2goYD4gJHtibG9jay5jb250ZW50fWApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBcbiAgICAgICAgY2FzZSAnZGl2aWRlcic6XG4gICAgICAgICAgbGluZXMucHVzaCgnLS0tJyk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIOa3u+WKoOepuuihjFxuICAgICAgbGluZXMucHVzaCgnJyk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKS50cmltKCk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDorqHnrpflhoXlrrnlk4jluIxcbiAgICovXG4gIHByaXZhdGUgY2FsY3VsYXRlQ29udGVudEhhc2goY29udGVudDogU3RydWN0dXJlZFJlc3BvbnNlQ29udGVudCk6IHN0cmluZyB7XG4gICAgY29uc3Qgc3RyID0gSlNPTi5zdHJpbmdpZnkoY29udGVudCk7XG4gICAgbGV0IGhhc2ggPSAwO1xuICAgIFxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBjaGFyID0gc3RyLmNoYXJDb2RlQXQoaSk7XG4gICAgICBoYXNoID0gKChoYXNoIDw8IDUpIC0gaGFzaCkgKyBjaGFyO1xuICAgICAgaGFzaCA9IGhhc2ggJiBoYXNoO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gYGhhc2hfJHtNYXRoLmFicyhoYXNoKS50b1N0cmluZygzNil9YDtcbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDkvr/mjbflh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDliJvlu7rlk43lupTmoLzlvI/ljJblmahcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVJlc3BvbnNlRm9ybWF0dGVyKFxuICByZWdpc3RyeTogU3R5bGVSZWdpc3RyeSxcbiAgY29uZmlnPzogUmVzcG9uc2VGb3JtYXR0ZXJDb25maWdcbik6IFJlc3BvbnNlRm9ybWF0dGVyIHtcbiAgcmV0dXJuIG5ldyBSZXNwb25zZUZvcm1hdHRlcihyZWdpc3RyeSwgY29uZmlnKTtcbn1cblxuLyoqXG4gKiDlv6vpgJ/moLzlvI/ljJblk43lupRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdFJlc3BvbnNlKFxuICByZWdpc3RyeTogU3R5bGVSZWdpc3RyeSxcbiAgY29udGVudDogU3RydWN0dXJlZFJlc3BvbnNlQ29udGVudCxcbiAgc3R5bGVJZDogc3RyaW5nLFxuICBvcHRpb25zPzogU3R5bGVSZW5kZXJPcHRpb25zXG4pOiBSZXNwb25zZUZvcm1hdFJlc3VsdCB7XG4gIGNvbnN0IGZvcm1hdHRlciA9IG5ldyBSZXNwb25zZUZvcm1hdHRlcihyZWdpc3RyeSk7XG4gIHJldHVybiBmb3JtYXR0ZXIuZm9ybWF0UmVzcG9uc2UoY29udGVudCwgc3R5bGVJZCwgb3B0aW9ucyk7XG59XG4iXX0=