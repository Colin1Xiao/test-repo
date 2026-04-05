/**
 * Skill Runtime Adapter - Skill 运行时适配器
 * 
 * 职责：
 * 1. 把 registry + installer + trust/policy 的结果，转成 runtime 可加载对象
 * 2. 决定哪些 skill 在当前 ExecutionContext / AgentContext 下应被加载
 * 3. 为 agent 构造最小 skill context
 * 4. 把 skill capability 接到 Tool Runtime / MCP / Code Intelligence
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  AgentSkillSpec,
  AgentSkillContext,
  AgentSkillLoadPlan,
  SkillPackageDescriptor,
  SkillRuntimeView,
  SkillCapabilityType,
} from './types';
import { SkillRegistry } from './skill_registry';
import { AgentSkillCompatChecker } from './agent_skill_compat';
import { SkillPolicyEvaluator } from './skill_policy';
import { SkillValidator } from './skill_validation';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 运行时适配器配置
 */
export interface RuntimeAdapterConfig {
  /** 运行时版本 */
  runtimeVersion?: string;
  
  /** 可用的 Agent 列表 */
  availableAgents?: string[];
}

/**
 * 技能运行时状态
 */
export interface SkillRuntimeState {
  /** 已加载的 skills */
  loadedSkills: SkillRuntimeView[];
  
  /** 被阻塞的 skills */
  blockedSkills: string[];
  
  /** 等待审批的 skills */
  pendingSkills: string[];
  
  /** 缺失的 required skills */
  missingRequiredSkills: string[];
  
  /** 不可用的 optional skills */
  optionalUnavailableSkills: string[];
}

// ============================================================================
// Skill 运行时适配器
// ============================================================================

export class SkillRuntimeAdapter {
  private config: Required<RuntimeAdapterConfig>;
  private registry: SkillRegistry;
  private compatChecker: AgentSkillCompatChecker;
  
  constructor(
    registry: SkillRegistry,
    compatChecker: AgentSkillCompatChecker,
    config: RuntimeAdapterConfig = {}
  ) {
    this.config = {
      runtimeVersion: config.runtimeVersion ?? '2026.4.0',
      availableAgents: config.availableAgents ?? [],
    };
    this.registry = registry;
    this.compatChecker = compatChecker;
  }
  
  /**
   * 准备 Skill 运行时
   */
  async prepareSkillRuntime(
    agentSpec: AgentSkillSpec
  ): Promise<SkillRuntimeState> {
    // 构建加载计划
    const loadPlan = await this.compatChecker.buildAgentSkillLoadPlan(agentSpec);
    
    const loadedSkills: SkillRuntimeView[] = [];
    const blockedSkills: string[] = [];
    const pendingSkills: string[] = [];
    
    // 处理要加载的 skills
    for (const decision of loadPlan.toLoad) {
      const pkg = this.registry.getSkill(decision.skillName);
      if (pkg.found && pkg.package) {
        loadedSkills.push(this.buildRuntimeView(pkg.package));
      }
    }
    
    // 处理被阻塞的 skills
    for (const decision of loadPlan.toBlock) {
      blockedSkills.push(decision.skillName);
    }
    
    // 处理等待审批的 skills
    for (const decision of loadPlan.pending) {
      pendingSkills.push(decision.skillName);
    }
    
    return {
      loadedSkills,
      blockedSkills,
      pendingSkills,
      missingRequiredSkills: loadPlan.missingRequired,
      optionalUnavailableSkills: loadPlan.optionalUnavailable,
    };
  }
  
  /**
   * 为 Agent 加载 Skills
   */
  async loadSkillsForAgent(
    agentSpec: AgentSkillSpec
  ): Promise<AgentSkillContext> {
    const runtimeState = await this.prepareSkillRuntime(agentSpec);
    
    // 构建能力摘要
    const capabilitySummary = this.buildCapabilitySummary(runtimeState.loadedSkills);
    
    return {
      loadedSkills: runtimeState.loadedSkills.map(s => s.skillId),
      blockedSkills: runtimeState.blockedSkills,
      pendingSkills: runtimeState.pendingSkills,
      missingRequiredSkills: runtimeState.missingRequiredSkills,
      optionalUnavailableSkills: runtimeState.optionalUnavailableSkills,
      capabilitySummary,
    };
  }
  
  /**
   * 构建 Skill Context
   */
  buildSkillContext(
    agentRole: string,
    task: any,
    loadedSkills: SkillRuntimeView[]
  ): Record<string, unknown> {
    const context: Record<string, unknown> = {};
    
    // 按角色裁剪可见面
    switch (agentRole) {
      case 'planner':
        context.skillOverview = {
          loadedSkills: loadedSkills.map(s => ({
            name: s.skillName,
            capabilities: s.capabilities,
          })),
          mcpServers: [...new Set(loadedSkills.flatMap(s => s.mcpServers))],
        };
        break;
      
      case 'code_reviewer':
        context.codeIntelSkills = loadedSkills.filter(s =>
          s.capabilities.includes('code_intel')
        );
        break;
      
      case 'verify_agent':
        context.verificationSkills = loadedSkills.filter(s =>
          s.capabilities.includes('verification')
        );
        break;
      
      default:
        context.skills = loadedSkills;
    }
    
    return context;
  }
  
  /**
   * 解析被阻塞的 Skills
   */
  resolveBlockedSkills(
    agentSpec: AgentSkillSpec
  ): Promise<{
    blocked: string[];
    reasons: Record<string, string>;
  }> {
    return this.compatChecker.buildAgentSkillLoadPlan(agentSpec).then(plan => {
      const reasons: Record<string, string> = {};
      
      for (const decision of plan.toBlock) {
        reasons[decision.skillName] = decision.reason;
      }
      
      return {
        blocked: plan.toBlock.map(d => d.skillName),
        reasons,
      };
    });
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 构建运行时视图
   */
  private buildRuntimeView(pkg: SkillPackageDescriptor): SkillRuntimeView {
    return {
      skillId: pkg.id,
      skillName: pkg.manifest.name,
      version: pkg.manifest.version,
      capabilities: pkg.manifest.capabilities.map(c => c.type),
      tools: pkg.manifest.tools.map(t => t.name),
      mcpServers: pkg.manifest.mcpServers || [],
      enabled: pkg.enabled,
      trustLevel: pkg.manifest.trustLevel || 'workspace',
    };
  }
  
  /**
   * 构建能力摘要
   */
  private buildCapabilitySummary(
    loadedSkills: SkillRuntimeView[]
  ): Record<string, string[]> {
    const summary: Record<string, string[]> = {};
    
    for (const skill of loadedSkills) {
      for (const capability of skill.capabilities) {
        if (!summary[capability]) {
          summary[capability] = [];
        }
        summary[capability].push(skill.skillName);
      }
    }
    
    return summary;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建运行时适配器
 */
export function createSkillRuntimeAdapter(
  registry: SkillRegistry,
  compatChecker: AgentSkillCompatChecker,
  config?: RuntimeAdapterConfig
): SkillRuntimeAdapter {
  return new SkillRuntimeAdapter(registry, compatChecker, config);
}
