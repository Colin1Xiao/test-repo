/**
 * Result Normalizer - 结果标准化器
 * 
 * 职责：
 * 1. 去除无效包装
 * 2. 提取结构化 summary
 * 3. 提取 findings / blockers / confidence
 * 4. 转为 SubagentResult
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type { SubagentResult, SubagentRole, ArtifactRef, Finding, PatchRef } from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 标准化输入
 */
export interface NormalizationInput {
  // 身份
  subagentTaskId: string;
  parentTaskId: string;
  teamId: string;
  role: SubagentRole;
  
  // 原始内容
  rawContent: string;
  
  // 使用情况
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  
  // 性能
  latencyMs: number;
  turnsUsed: number;
  
  // 完成原因
  finishReason: 'stop' | 'length' | 'timeout' | 'error' | 'tool_call';
  
  // 错误
  error?: {
    type: string;
    message: string;
    recoverable: boolean;
  };
}

/**
 * 解析后的中间结果
 */
export interface ParsedResult {
  summary: string;
  confidence?: number;
  artifacts?: ArtifactRef[];
  patches?: PatchRef[];
  findings?: Finding[];
  blockers?: string[];
  recommendations?: string[];
  nextSteps?: string[];
}

// ============================================================================
// 结果标准化器
// ============================================================================

export class ResultNormalizer {
  /**
   * 标准化结果
   */
  normalize(input: NormalizationInput): SubagentResult {
    // 处理错误情况
    if (input.error) {
      return this.createErrorResult(input);
    }
    
    // 解析内容
    const parsed = this.parseContent(input.rawContent, input.role);
    
    // 构建标准化结果
    return {
      subagentTaskId: input.subagentTaskId,
      parentTaskId: input.parentTaskId,
      teamId: input.teamId,
      agent: input.role,
      
      // 解析结果
      summary: parsed.summary,
      confidence: parsed.confidence,
      artifacts: parsed.artifacts,
      patches: parsed.patches,
      findings: parsed.findings,
      blockers: parsed.blockers,
      recommendations: parsed.recommendations,
      nextSteps: parsed.nextSteps,
      
      // 使用情况
      turnsUsed: input.turnsUsed,
      tokensUsed: input.usage?.totalTokens,
      durationMs: input.latencyMs,
    };
  }
  
  /**
   * 创建错误结果
   */
  private createErrorResult(input: NormalizationInput): SubagentResult {
    return {
      subagentTaskId: input.subagentTaskId,
      parentTaskId: input.parentTaskId,
      teamId: input.teamId,
      agent: input.role,
      summary: `任务失败：${input.error?.message || '未知错误'}`,
      confidence: 0,
      turnsUsed: input.turnsUsed,
      tokensUsed: input.usage?.totalTokens || 0,
      durationMs: input.latencyMs,
      error: input.error,
    };
  }
  
  /**
   * 解析内容
   */
  private parseContent(content: string, role: SubagentRole): ParsedResult {
    // 清理内容（去除 markdown 代码块包装等）
    const cleaned = this.cleanContent(content);
    
    // 根据角色提取结构化信息
    switch (role) {
      case 'planner':
        return this.parsePlannerResult(cleaned);
      case 'repo_reader':
        return this.parseRepoReaderResult(cleaned);
      case 'code_fixer':
        return this.parseCodeFixerResult(cleaned);
      case 'code_reviewer':
        return this.parseCodeReviewerResult(cleaned);
      case 'verify_agent':
        return this.parseVerifyAgentResult(cleaned);
      case 'release_agent':
        return this.parseReleaseAgentResult(cleaned);
      default:
        return this.parseGenericResult(cleaned);
    }
  }
  
  /**
   * 清理内容
   */
  private cleanContent(content: string): string {
    // 去除 markdown 代码块包装
    let cleaned = content.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '');
    
    // 去除多余空白
    cleaned = cleaned.trim();
    
    // 去除常见无效前缀
    const prefixes = [
      '好的，',
      '好的，我',
      '让我',
      '我来',
      '以下是',
      '这是',
    ];
    
    for (const prefix of prefixes) {
      if (cleaned.startsWith(prefix)) {
        cleaned = cleaned.slice(prefix.length);
      }
    }
    
    return cleaned.trim();
  }
  
  /**
   * 解析 planner 结果
   */
  private parsePlannerResult(content: string): ParsedResult {
    const result: ParsedResult = {
      summary: this.extractSection(content, '任务分析') || 
               this.extractSection(content, '分析') ||
               content.slice(0, 200),
    };
    
    // 尝试提取置信度
    result.confidence = this.extractConfidence(content);
    
    // 尝试提取建议
    result.recommendations = this.extractList(content, '建议');
    result.nextSteps = this.extractList(content, '执行顺序') || 
                       this.extractList(content, '下一步');
    
    // 尝试提取风险评估
    const risks = this.extractList(content, '风险');
    if (risks && risks.length > 0) {
      result.blockers = risks;
    }
    
    // 创建计划文档 artifact
    result.artifacts = [
      {
        type: 'text',
        content: content,
        description: '任务执行计划',
      },
    ];
    
    return result;
  }
  
  /**
   * 解析 repo_reader 结果
   */
  private parseRepoReaderResult(content: string): ParsedResult {
    const result: ParsedResult = {
      summary: this.extractSection(content, '项目概览') || 
               this.extractSection(content, '概览') ||
               content.slice(0, 200),
    };
    
    result.confidence = this.extractConfidence(content);
    
    // 创建项目结构 artifact
    result.artifacts = [
      {
        type: 'text',
        content: content,
        description: '项目结构分析',
      },
    ];
    
    return result;
  }
  
  /**
   * 解析 code_fixer 结果
   */
  private parseCodeFixerResult(content: string): ParsedResult {
    const result: ParsedResult = {
      summary: this.extractSection(content, '修改摘要') || 
               this.extractSection(content, '摘要') ||
               content.slice(0, 200),
    };
    
    result.confidence = this.extractConfidence(content);
    
    // 尝试提取补丁
    const patches = this.extractPatches(content);
    if (patches.length > 0) {
      result.patches = patches;
    }
    
    // 尝试提取测试建议
    result.recommendations = this.extractList(content, '测试建议');
    
    // 尝试提取注意事项
    const notes = this.extractList(content, '注意事项');
    if (notes && notes.length > 0) {
      result.blockers = notes.filter(n => n.includes('风险') || n.includes('必须'));
    }
    
    return result;
  }
  
  /**
   * 解析 code_reviewer 结果
   */
  private parseCodeReviewerResult(content: string): ParsedResult {
    const result: ParsedResult = {
      summary: this.extractSection(content, '审查摘要') || 
               this.extractSection(content, '摘要') ||
               content.slice(0, 200),
    };
    
    result.confidence = this.extractConfidence(content);
    
    // 提取发现的问题
    result.findings = this.extractFindings(content);
    
    // 提取风险评估
    const riskLevel = this.extractRiskLevel(content);
    if (riskLevel) {
      result.blockers = riskLevel === 'high' || riskLevel === 'critical' 
        ? ['高风险问题需要修复'] 
        : undefined;
    }
    
    // 提取建议
    result.recommendations = this.extractList(content, '建议');
    
    return result;
  }
  
  /**
   * 解析 verify_agent 结果
   */
  private parseVerifyAgentResult(content: string): ParsedResult {
    const result: ParsedResult = {
      summary: this.extractSection(content, '验证结论') || 
               this.extractSection(content, '结论') ||
               content.slice(0, 200),
    };
    
    result.confidence = this.extractConfidence(content);
    
    // 提取阻塞问题
    result.blockers = this.extractList(content, '阻塞问题') || 
                      this.extractList(content, '失败');
    
    // 提取建议
    result.recommendations = this.extractList(content, '建议');
    
    return result;
  }
  
  /**
   * 解析 release_agent 结果
   */
  private parseReleaseAgentResult(content: string): ParsedResult {
    const result: ParsedResult = {
      summary: this.extractSection(content, '发布摘要') || 
               this.extractSection(content, '摘要') ||
               content.slice(0, 200),
    };
    
    result.confidence = this.extractConfidence(content);
    
    // 创建发布说明 artifact
    result.artifacts = [
      {
        type: 'text',
        content: content,
        description: '发布报告',
      },
    ];
    
    // 提取后续跟进
    result.nextSteps = this.extractList(content, '后续跟进');
    
    return result;
  }
  
  /**
   * 解析通用结果
   */
  private parseGenericResult(content: string): ParsedResult {
    return {
      summary: content.slice(0, 500),
      confidence: this.extractConfidence(content),
    };
  }
  
  // ============================================================================
  // 提取工具方法
  // ============================================================================
  
  /**
   * 提取章节内容
   */
  private extractSection(content: string, sectionName: string): string {
    const patterns = [
      new RegExp(`##\\s*${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`, 'i'),
      new RegExp(`###\\s*${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n###|\\n##|$)`, 'i'),
      new RegExp(`\\*\\*${sectionName}\\*\\*[:\\s]*([\\s\\S]*?)(?=\\n\\*\\*|$)`, 'i'),
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return '';
  }
  
  /**
   * 提取列表
   */
  private extractList(content: string, sectionName?: string): string[] {
    let text = content;
    
    // 如果有章节名，先提取章节
    if (sectionName) {
      const section = this.extractSection(content, sectionName);
      if (section) text = section;
    }
    
    // 提取列表项
    const listPatterns = [
      /^[\s]*[-*•]\s*(.+)$/gm,
      /^[\s]*\d+\.\s*(.+)$/gm,
      /^[\s]*[▪▸▹]\s*(.+)$/gm,
    ];
    
    const items: string[] = [];
    
    for (const pattern of listPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        items.push(match[1].trim());
      }
    }
    
    return items.length > 0 ? items : undefined as any;
  }
  
  /**
   * 提取置信度
   */
  private extractConfidence(content: string): number | undefined {
    // 尝试提取百分比
    const percentageMatch = content.match(/置信度[:：]?\s*(\d+)%/i);
    if (percentageMatch) {
      return parseInt(percentageMatch[1]) / 100;
    }
    
    // 尝试提取小数
    const decimalMatch = content.match(/置信度[:：]?\s*(0\.\d+)/i);
    if (decimalMatch) {
      return parseFloat(decimalMatch[1]);
    }
    
    // 尝试提取信心级别
    if (content.includes('高信心') || content.includes('高置信度')) {
      return 0.9;
    }
    if (content.includes('中信心') || content.includes('中等置信度')) {
      return 0.7;
    }
    if (content.includes('低信心') || content.includes('低置信度')) {
      return 0.5;
    }
    
    // 默认
    return undefined;
  }
  
  /**
   * 提取补丁
   */
  private extractPatches(content: string): PatchRef[] {
    const patches: PatchRef[] = [];
    
    // 提取 diff 块
    const diffPattern = /```diff\n([\s\S]*?)```/g;
    let match;
    
    while ((match = diffPattern.exec(content)) !== null) {
      const diff = match[1];
      
      // 提取文件名
      const fileMatch = diff.match(/--- a\/(.+)$/m);
      const fileId = fileMatch ? fileMatch[1] : 'unknown';
      
      // 计算行数
      const linesAdded = (diff.match(/^\+[^+]/gm) || []).length;
      const linesDeleted = (diff.match(/^-[^-]/gm) || []).length;
      
      patches.push({
        fileId,
        diff,
        hunks: 1,
        linesAdded,
        linesDeleted,
      });
    }
    
    return patches;
  }
  
  /**
   * 提取发现的问题
   */
  private extractFindings(content: string): Finding[] {
    const findings: Finding[] = [];
    
    // 提取问题章节
    const sections = ['Critical', 'High', 'Medium', 'Low', '问题', '发现'];
    
    for (const section of sections) {
      const items = this.extractList(content, section);
      if (items) {
        const severity = section.toLowerCase() as Finding['severity'];
        
        for (const item of items) {
          findings.push({
            type: 'issue',
            severity: this.mapSeverity(section),
            description: item,
          });
        }
      }
    }
    
    return findings.length > 0 ? findings : undefined as any;
  }
  
  /**
   * 映射严重程度
   */
  private mapSeverity(level: string): Finding['severity'] {
    const lower = level.toLowerCase();
    
    if (lower.includes('critical') || lower === 'critical') return 'critical';
    if (lower.includes('high') || lower === 'high') return 'high';
    if (lower.includes('medium') || lower === 'medium') return 'medium';
    if (lower.includes('low') || lower === 'low') return 'low';
    
    return 'medium';
  }
  
  /**
   * 提取风险等级
   */
  private extractRiskLevel(content: string): 'low' | 'medium' | 'high' | 'critical' | null {
    const patterns = [
      { pattern: /风险等级[:：]?\s*Critical/i, level: 'critical' },
      { pattern: /风险等级[:：]?\s*High/i, level: 'high' },
      { pattern: /风险等级[:：]?\s*Medium/i, level: 'medium' },
      { pattern: /风险等级[:：]?\s*Low/i, level: 'low' },
    ];
    
    for (const { pattern, level } of patterns) {
      if (pattern.test(content)) {
        return level as any;
      }
    }
    
    return null;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建结果标准化器
 */
export function createResultNormalizer(): ResultNormalizer {
  return new ResultNormalizer();
}

/**
 * 快速标准化结果
 */
export function normalizeResult(input: NormalizationInput): SubagentResult {
  const normalizer = new ResultNormalizer();
  return normalizer.normalize(input);
}
