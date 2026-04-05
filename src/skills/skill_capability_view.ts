/**
 * Skill Capability View - Skill 能力视图
 * 
 * 职责：
 * 1. 把已加载 skill 的 capability 汇总成统一视图
 * 2. 给 planner / repo_reader / code_reviewer / release_agent 等角色返回不同粒度的摘要
 * 3. 将 skill 提供的 tools / MCP dependencies / code_intel capabilities / verification abilities 做统一归纳
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  SkillRuntimeView,
  SkillCapabilitySummary,
  SkillCapabilityType,
  AgentCapabilitySummary,
} from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 能力视图配置
 */
export interface CapabilityViewConfig {
  /** 是否包含工具详情 */
  includeToolDetails?: boolean;
  
  /** 是否包含 MCP 依赖 */
  includeMcpDependencies?: boolean;
}

// ============================================================================
// Skill 能力视图
// ============================================================================

export class SkillCapabilityView {
  private config: Required<CapabilityViewConfig>;
  
  constructor(config: CapabilityViewConfig = {}) {
    this.config = {
      includeToolDetails: config.includeToolDetails ?? false,
      includeMcpDependencies: config.includeMcpDependencies ?? true,
    };
  }
  
  /**
   * 构建能力视图
   */
  buildCapabilityView(
    loadedSkills: SkillRuntimeView[]
  ): {
    capabilityTypes: SkillCapabilityType[];
    providedTools: string[];
    requiredMcpServers: string[];
    codeIntelHooks: string[];
    verificationHooks: string[];
    automationHooks: string[];
  } {
    const capabilityTypes = new Set<SkillCapabilityType>();
    const providedTools: string[] = [];
    const requiredMcpServers = new Set<string>();
    const codeIntelHooks: string[] = [];
    const verificationHooks: string[] = [];
    const automationHooks: string[] = [];
    
    for (const skill of loadedSkills) {
      // 收集能力类型
      for (const capability of skill.capabilities) {
        capabilityTypes.add(capability as SkillCapabilityType);
      }
      
      // 收集工具
      providedTools.push(...skill.tools);
      
      // 收集 MCP 依赖
      if (this.config.includeMcpDependencies) {
        requiredMcpServers.add(...skill.mcpServers);
      }
      
      // 收集代码智能 hooks
      if (skill.capabilities.includes('code_intel')) {
        codeIntelHooks.push(skill.skillName);
      }
      
      // 收集验证 hooks
      if (skill.capabilities.includes('verification')) {
        verificationHooks.push(skill.skillName);
      }
      
      // 收集自动化 hooks
      if (skill.capabilities.includes('automation')) {
        automationHooks.push(skill.skillName);
      }
    }
    
    return {
      capabilityTypes: Array.from(capabilityTypes),
      providedTools,
      requiredMcpServers: Array.from(requiredMcpServers),
      codeIntelHooks,
      verificationHooks,
      automationHooks,
    };
  }
  
  /**
   * 构建 Agent 能力摘要
   */
  buildAgentCapabilitySummary(
    agentRole: string,
    loadedSkills: SkillRuntimeView[]
  ): AgentCapabilitySummary {
    const capabilityView = this.buildCapabilityView(loadedSkills);
    
    // 构建可用能力摘要
    const availableCapabilities: SkillCapabilitySummary[] = [];
    
    for (const capabilityType of capabilityView.capabilityTypes) {
      const providedBy = loadedSkills
        .filter(s => s.capabilities.includes(capabilityType))
        .map(s => s.skillName);
      
      availableCapabilities.push({
        capabilityType,
        providedBy,
      });
    }
    
    // 计算缺失的能力（根据角色）
    const missingCapabilities = this.findMissingCapabilities(agentRole, capabilityView);
    
    return {
      agentRole,
      availableCapabilities,
      availableTools: capabilityView.providedTools,
      requiredMcpServers: capabilityView.requiredMcpServers,
      missingCapabilities,
    };
  }
  
  /**
   * 按能力类型查找 Skills
   */
  findSkillsByCapability(
    loadedSkills: SkillRuntimeView[],
    capabilityType: SkillCapabilityType
  ): SkillRuntimeView[] {
    return loadedSkills.filter(skill =>
      skill.capabilities.includes(capabilityType)
    );
  }
  
  /**
   * 按工具名称查找 Skills
   */
  findSkillsByTool(
    loadedSkills: SkillRuntimeView[],
    toolName: string
  ): SkillRuntimeView[] {
    return loadedSkills.filter(skill =>
      skill.tools.includes(toolName)
    );
  }
  
  /**
   * 查找需要特定 MCP Server 的 Skills
   */
  findSkillsRequiringMcpServer(
    loadedSkills: SkillRuntimeView[],
    serverName: string
  ): SkillRuntimeView[] {
    return loadedSkills.filter(skill =>
      skill.mcpServers.includes(serverName)
    );
  }
  
  /**
   * 获取能力描述
   */
  getCapabilityDescription(capabilityType: SkillCapabilityType): string {
    const descriptions: Record<SkillCapabilityType, string> = {
      tool_runtime: 'Runtime tool execution capabilities',
      code_intel: 'Code intelligence and analysis capabilities',
      mcp_integration: 'MCP server integration capabilities',
      verification: 'Testing and verification capabilities',
      repo_analysis: 'Repository analysis capabilities',
      review: 'Code review capabilities',
      release: 'Release and deployment capabilities',
      automation: 'Automation capabilities',
    };
    
    return descriptions[capabilityType] || 'Unknown capability';
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 查找缺失的能力
   */
  private findMissingCapabilities(
    agentRole: string,
    capabilityView: ReturnType<typeof SkillCapabilityView.prototype.buildCapabilityView>
  ): string[] {
    const missing: string[] = [];
    
    // 根据角色定义期望的能力
    const expectedCapabilities = this.getExpectedCapabilitiesForRole(agentRole);
    
    for (const expected of expectedCapabilities) {
      if (!capabilityView.capabilityTypes.includes(expected)) {
        missing.push(expected);
      }
    }
    
    return missing;
  }
  
  /**
   * 获取角色期望的能力
   */
  private getExpectedCapabilitiesForRole(agentRole: string): SkillCapabilityType[] {
    const roleCapabilities: Record<string, SkillCapabilityType[]> = {
      planner: ['repo_analysis', 'code_intel'],
      repo_reader: ['repo_analysis', 'code_intel'],
      code_reviewer: ['review', 'code_intel'],
      code_fixer: ['code_intel', 'tool_runtime'],
      verify_agent: ['verification', 'tool_runtime'],
      release_agent: ['release', 'automation'],
    };
    
    return roleCapabilities[agentRole] || [];
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建能力视图
 */
export function createSkillCapabilityView(config?: CapabilityViewConfig): SkillCapabilityView {
  return new SkillCapabilityView(config);
}

/**
 * 快速构建能力视图
 */
export function buildSkillCapabilityView(
  loadedSkills: SkillRuntimeView[],
  config?: CapabilityViewConfig
): ReturnType<SkillCapabilityView['buildCapabilityView']> {
  const view = new SkillCapabilityView(config);
  return view.buildCapabilityView(loadedSkills);
}

/**
 * 快速构建 Agent 能力摘要
 */
export function buildAgentCapabilitySummary(
  agentRole: string,
  loadedSkills: SkillRuntimeView[],
  config?: CapabilityViewConfig
): AgentCapabilitySummary {
  const view = new SkillCapabilityView(config);
  return view.buildAgentCapabilitySummary(agentRole, loadedSkills);
}
