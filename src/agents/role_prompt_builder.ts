/**
 * Role Prompt Builder - 角色提示词构建器
 * 
 * 职责：
 * 1. 根据 SubagentRole 构造 system prompt
 * 2. 注入目标、约束、输出格式
 * 3. 注入工具边界与预算提示
 * 4. 注入上游上下文摘要
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type { SubagentRole } from './types';
import { AGENT_ROLE_DEFAULTS } from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 提示词构建输入
 */
export interface PromptBuildInput {
  // 角色
  role: SubagentRole;
  
  // 任务
  goal: string;
  inputs?: Record<string, unknown>;
  
  // 约束
  allowedTools: string[];
  forbiddenTools: string[];
  budget: {
    maxTurns: number;
    maxTokens?: number;
    timeoutMs: number;
  };
  
  // 上下文
  parentContext?: {
    summary?: string;
    artifacts?: Array<{ type: string; description: string; content?: string }>;
  };
  
  // 依赖任务结果
  dependencyResults?: Array<{
    role: string;
    summary: string;
    artifacts?: Array<{ type: string; description: string }>;
  }>;
  
  // 输出格式要求
  outputFormat?: 'json' | 'markdown' | 'text';
}

/**
 * 提示词构建结果
 */
export interface PromptBuildResult {
  systemPrompt: string;
  userPrompt: string;
}

// ============================================================================
// 角色提示词模板
// ============================================================================

/**
 * 角色系统提示词模板
 */
const ROLE_SYSTEM_TEMPLATES: Record<SubagentRole, string> = {
  planner: `你是一个任务规划专家。

职责：
- 分析任务目标，拆解为可执行的子任务
- 识别依赖关系和执行顺序
- 评估风险和复杂度
- 输出结构化执行计划

输出格式：
1. 任务分析（背景、目标、约束）
2. 子任务列表（每个任务包含：目标、预期产出、依赖）
3. 执行顺序（考虑依赖关系）
4. 风险评估（潜在问题、缓解措施）
5. 建议的工具和资源

约束：
- 不要执行代码修改
- 不要调用外部系统
- 专注于规划和拆解`,

  repo_reader: `你是一个代码库分析专家。

职责：
- 读取并理解项目结构
- 识别核心模块和入口点
- 分析代码组织方式
- 输出项目地图

输出格式：
1. 项目概览（语言、框架、构建系统）
2. 目录结构（核心目录说明）
3. 入口点（应用启动、CLI、服务等）
4. 核心模块（职责、依赖关系）
5. 测试结构（测试目录、测试框架）

约束：
- 只读操作，不修改任何文件
- 优先读取配置文件和入口文件
- 关注项目结构而非具体实现细节`,

  code_fixer: `你是一个代码修复与实现专家。

职责：
- 根据规划实现代码修改
- 遵循项目代码风格
- 确保修改可测试
- 输出代码补丁

输出格式：
1. 修改摘要（改动目的、影响范围）
2. 文件列表（每个文件的改动说明）
3. 代码补丁（统一 diff 格式）
4. 测试建议（需要验证的场景）
5. 注意事项（潜在风险、后续工作）

约束：
- 修改前必须理解现有代码
- 保持代码简洁、可读
- 避免不必要的改动
- 确保补丁可应用`,

  code_reviewer: `你是一个代码审查专家。

职责：
- 审查代码变更
- 识别潜在问题
- 评估风险等级
- 提供改进建议

输出格式：
1. 审查摘要（改动概述、整体评价）
2. 发现的问题（按严重程度分组）
   - Critical: 必须修复
   - High: 强烈建议修复
   - Medium: 建议修复
   - Low: 可选改进
3. 每个问题的详细信息
   - 位置（文件、行号）
   - 描述
   - 风险说明
   - 修复建议
4. 整体风险评估
5. 通过/不通过建议

约束：
- 客观、具体、可操作
- 区分问题严重程度
- 提供建设性建议`,

  verify_agent: `你是一个验证与测试专家。

职责：
- 验证代码修改是否正确
- 运行相关测试
- 检查回归风险
- 输出验证报告

输出格式：
1. 验证计划（验证目标、测试策略）
2. 执行的测试（测试名称、结果、耗时）
3. 覆盖率分析（改动覆盖情况）
4. 发现的问题（测试失败、边界情况）
5. 验证结论（通过/不通过、阻塞问题）

约束：
- 优先运行与改动相关的测试
- 关注回归风险
- 记录所有测试结果`,

  release_agent: `你是一个发布与部署专家。

职责：
- 准备发布内容
- 执行部署流程
- 验证部署结果
- 输出发布报告

输出格式：
1. 发布摘要（版本、改动、时间）
2. 发布步骤（执行的命令、结果）
3. 验证结果（健康检查、冒烟测试）
4. 回滚计划（如需回滚的步骤）
5. 后续跟进（监控、文档更新）

约束：
- 发布前必须确认所有测试通过
- 必须有回滚计划
- 高风险操作需要审批`,
};

// ============================================================================
// 提示词构建器
// ============================================================================

export class RolePromptBuilder {
  /**
   * 构建提示词
   */
  build(input: PromptBuildInput): PromptBuildResult {
    const systemPrompt = this.buildSystemPrompt(input);
    const userPrompt = this.buildUserPrompt(input);
    
    return { systemPrompt, userPrompt };
  }
  
  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(input: PromptBuildInput): string {
    const roleTemplate = ROLE_SYSTEM_TEMPLATES[input.role];
    
    if (!roleTemplate) {
      throw new Error(`Unknown agent role: ${input.role}`);
    }
    
    const sections: string[] = [roleTemplate];
    
    // 添加工具约束
    sections.push(this.buildToolConstraints(input));
    
    // 添加预算提示
    sections.push(this.buildBudgetHint(input));
    
    // 添加输出格式要求
    if (input.outputFormat) {
      sections.push(this.buildOutputFormatHint(input.outputFormat));
    }
    
    return sections.join('\n\n---\n\n');
  }
  
  /**
   * 构建用户提示词
   */
  private buildUserPrompt(input: PromptBuildInput): string {
    const lines: string[] = [];
    
    // 任务目标
    lines.push(`## 任务目标\n\n${input.goal}\n`);
    
    // 上游上下文
    if (input.parentContext?.summary) {
      lines.push('## 上游上下文\n\n' + input.parentContext.summary + '\n');
      
      if (input.parentContext.artifacts && input.parentContext.artifacts.length > 0) {
        lines.push('### 相关产出物\n');
        for (const artifact of input.parentContext.artifacts) {
          lines.push(`- [${artifact.type}] ${artifact.description}`);
          if (artifact.content) {
            lines.push(`  \`\`\`\n  ${artifact.content}\n  \`\`\``);
          }
        }
        lines.push('');
      }
    }
    
    // 依赖任务结果
    if (input.dependencyResults && input.dependencyResults.length > 0) {
      lines.push('## 依赖任务结果\n');
      for (const dep of input.dependencyResults) {
        lines.push(`### ${dep.role}\n\n${dep.summary}\n`);
        if (dep.artifacts && dep.artifacts.length > 0) {
          lines.push('产出物:');
          for (const artifact of dep.artifacts) {
            lines.push(`- [${artifact.type}] ${artifact.description}`);
          }
          lines.push('');
        }
      }
    }
    
    // 输入参数
    if (input.inputs && Object.keys(input.inputs).length > 0) {
      lines.push('## 输入参数\n');
      for (const [key, value] of Object.entries(input.inputs)) {
        lines.push(`- ${key}: ${value}`);
      }
      lines.push('');
    }
    
    // 执行指令
    lines.push('## 执行指令\n\n请开始执行任务。按照上述输出格式要求，提供完整的执行结果。');
    
    return lines.join('\n');
  }
  
  /**
   * 构建工具约束
   */
  private buildToolConstraints(input: PromptBuildInput): string {
    const sections: string[] = ['## 工具权限\n'];
    
    if (input.allowedTools.length > 0) {
      sections.push(`**允许的工具**: ${input.allowedTools.join(', ')}`);
    }
    
    if (input.forbiddenTools.length > 0) {
      sections.push(`**禁止的工具**: ${input.forbiddenTools.join(', ')}`);
      sections.push('');
      sections.push('⚠️ 注意：使用禁止的工具会导致任务失败。');
    }
    
    return sections.join('\n');
  }
  
  /**
   * 构建预算提示
   */
  private buildBudgetHint(input: PromptBuildInput): string {
    return `## 资源预算

- **最大对话轮次**: ${input.budget.maxTurns}
- **最大 Token**: ${input.budget.maxTokens || '不限'}
- **超时时间**: ${input.budget.timeoutMs / 1000} 秒

⚠️ 注意：超出预算会导致任务终止。请高效使用资源。`;
  }
  
  /**
   * 构建输出格式提示
   */
  private buildOutputFormatHint(format: 'json' | 'markdown' | 'text'): string {
    const formatHints: Record<string, string> = {
      json: '## 输出格式\n\n请以 JSON 格式输出结果。确保 JSON 有效、可解析。',
      markdown: '## 输出格式\n\n请以 Markdown 格式输出结果。使用清晰的标题和列表结构。',
      text: '## 输出格式\n\n请以纯文本格式输出结果。保持简洁、结构化。',
    };
    
    return formatHints[format];
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建提示词构建器
 */
export function createRolePromptBuilder(): RolePromptBuilder {
  return new RolePromptBuilder();
}

/**
 * 快速构建提示词
 */
export function buildRolePrompt(input: PromptBuildInput): PromptBuildResult {
  const builder = new RolePromptBuilder();
  return builder.build(input);
}

/**
 * 获取角色系统提示词
 */
export function getRoleSystemPrompt(role: SubagentRole): string {
  return ROLE_SYSTEM_TEMPLATES[role] || '';
}
