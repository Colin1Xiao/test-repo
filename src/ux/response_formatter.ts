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

import type {
  OutputStyleDescriptor,
  StructuredResponseContent,
  ResponseFormatRequest,
  ResponseFormatResult,
  StyleRenderOptions,
  ContentSection,
  FormattedBlock,
  ContentSectionType,
} from './types';
import { StyleRegistry } from './style_registry';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 格式化器配置
 */
export interface ResponseFormatterConfig {
  /** 默认风格 ID */
  defaultStyleId?: string;
  
  /** 最大行宽 */
  maxLineWidth?: number;
  
  /** 是否启用颜色 */
  enableColor?: boolean;
}

// ============================================================================
// 响应格式化器
// ============================================================================

export class ResponseFormatter {
  private config: Required<ResponseFormatterConfig>;
  private registry: StyleRegistry;
  
  constructor(registry: StyleRegistry, config: ResponseFormatterConfig = {}) {
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
  formatResponse(
    content: StructuredResponseContent,
    styleId: string,
    options?: StyleRenderOptions
  ): ResponseFormatResult {
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
  formatSections(
    sections: ContentSection[],
    style: OutputStyleDescriptor
  ): FormattedBlock[] {
    const blocks: FormattedBlock[] = [];
    
    for (const section of sections) {
      const sectionBlocks = this.formatSection(section, style);
      blocks.push(...sectionBlocks);
    }
    
    return blocks;
  }
  
  /**
   * 应用风格覆盖
   */
  private applyStyleOverrides(
    style: OutputStyleDescriptor,
    options?: StyleRenderOptions
  ): OutputStyleDescriptor {
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
  private buildContentSections(
    content: StructuredResponseContent,
    style: OutputStyleDescriptor
  ): ContentSection[] {
    const sections: ContentSection[] = [];
    
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
  private createSection(
    sectionType: ContentSectionType,
    content: StructuredResponseContent,
    style: OutputStyleDescriptor
  ): ContentSection | null {
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
  private createSummarySection(
    content: StructuredResponseContent,
    style: OutputStyleDescriptor
  ): ContentSection | null {
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
  private createStatusSection(
    content: StructuredResponseContent,
    style: OutputStyleDescriptor
  ): ContentSection | null {
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
  private createActionsSection(
    content: StructuredResponseContent,
    style: OutputStyleDescriptor
  ): ContentSection | null {
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
      content: content.actions.map(a => 
        a.priority ? `[${a.priority.toUpperCase()}] ${a.action}` : a.action
      ),
      importance: 'high',
      collapsible: style.verbosity !== 'minimal',
      defaultExpanded: true,
    };
  }
  
  /**
   * 创建警告分段
   */
  private createWarningsSection(
    content: StructuredResponseContent,
    style: OutputStyleDescriptor
  ): ContentSection | null {
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
      content: content.warnings.map(w => 
        w.severity ? `[${w.severity.toUpperCase()}] ${w.warning}` : w.warning
      ),
      importance: 'high',
      collapsible: style.verbosity !== 'verbose',
      defaultExpanded: true,
    };
  }
  
  /**
   * 创建证据分段
   */
  private createEvidenceSection(
    content: StructuredResponseContent,
    style: OutputStyleDescriptor
  ): ContentSection | null {
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
      content: content.evidence.map(e => 
        `${e.type}: ${e.description}${e.reference ? ` (${e.reference})` : ''}`
      ),
      importance: 'medium',
      collapsible: true,
      defaultExpanded: style.verbosity === 'verbose',
    };
  }
  
  /**
   * 创建指标分段
   */
  private createMetricsSection(
    content: StructuredResponseContent,
    style: OutputStyleDescriptor
  ): ContentSection | null {
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
  private createTimelineSection(
    content: StructuredResponseContent,
    style: OutputStyleDescriptor
  ): ContentSection | null {
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
  private createArtifactsSection(
    content: StructuredResponseContent,
    style: OutputStyleDescriptor
  ): ContentSection | null {
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
      content: content.artifacts.map(a => 
        `${a.type}: ${a.name}${a.reference ? ` (${a.reference})` : ''}`
      ),
      importance: 'medium',
      collapsible: true,
      defaultExpanded: style.verbosity === 'verbose',
    };
  }
  
  /**
   * 创建建议分段
   */
  private createRecommendationsSection(
    content: StructuredResponseContent,
    style: OutputStyleDescriptor
  ): ContentSection | null {
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
  private createMetadataSection(
    content: StructuredResponseContent,
    style: OutputStyleDescriptor
  ): ContentSection | null {
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
  private formatSection(
    section: ContentSection,
    style: OutputStyleDescriptor
  ): FormattedBlock[] {
    const blocks: FormattedBlock[] = [];
    
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
    } else if (Array.isArray(section.content)) {
      // 列表
      blocks.push({
        type: 'list',
        content: section.content.join('\n'),
        styleClass: style.preferTables ? 'table' : (style.preferBullets ? 'bullet' : 'numbered'),
      });
    } else if (typeof section.content === 'object') {
      // 对象/表格
      const lines: string[] = [];
      
      if (style.preferTables) {
        // 表格格式
        lines.push('| Key | Value |');
        lines.push('|-----|-------|');
        
        for (const [key, value] of Object.entries(section.content)) {
          lines.push(`| ${key} | ${value} |`);
        }
      } else {
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
  private buildFormattedText(
    blocks: FormattedBlock[],
    style: OutputStyleDescriptor
  ): string {
    const lines: string[] = [];
    
    for (const block of blocks) {
      switch (block.type) {
        case 'text':
          lines.push(block.content);
          break;
        
        case 'list':
          if (block.styleClass === 'bullet') {
            lines.push(block.content.split('\n').map(line => `- ${line}`).join('\n'));
          } else if (block.styleClass === 'numbered') {
            lines.push(block.content.split('\n').map((line, i) => `${i + 1}. ${line}`).join('\n'));
          } else {
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
          } else if (style.codeBlockStyle === 'diff') {
            lines.push('```diff');
            lines.push(block.content);
            lines.push('```');
          } else {
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
  private calculateContentHash(content: StructuredResponseContent): string {
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

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建响应格式化器
 */
export function createResponseFormatter(
  registry: StyleRegistry,
  config?: ResponseFormatterConfig
): ResponseFormatter {
  return new ResponseFormatter(registry, config);
}

/**
 * 快速格式化响应
 */
export function formatResponse(
  registry: StyleRegistry,
  content: StructuredResponseContent,
  styleId: string,
  options?: StyleRenderOptions
): ResponseFormatResult {
  const formatter = new ResponseFormatter(registry);
  return formatter.formatResponse(content, styleId, options);
}
