/**
 * Agent Skill Compatibility - Agent Skill 兼容性
 * 
 * 职责：
 * 1. 扩展 AgentSpec 的 skill 依赖表达
 * 2. 解析 requiredSkills / optionalSkills
 * 3. 判断某 agent 与某 skill 是否兼容
 * 4. 结合 4C 的 trust/validation/policy 决策，给出最终"能否加载到该 agent"
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  AgentSkillRequirement,
  AgentSkillSpec,
  AgentSkillLoadPlan,
  SkillLoadDecision,
  SkillPackageDescriptor,
  SkillPolicyDecision,
} from './types';
import { SkillRegistry } from './skill_registry';
import { SkillPolicyEvaluator, evaluateLoadPolicy } from './skill_policy';
import { SkillValidator } from './skill_validation';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 兼容性检查配置
 */
export interface CompatConfig {
  /** 运行时版本 */
  runtimeVersion?: string;
  
  /** 可用的 Agent 列表 */
  availableAgents?: string[];
}

/**
 * 兼容性检查结果
 */
export interface CompatCheckResult {
  /** 是否兼容 */
  compatible: boolean;
  
  /** 原因 */
  reason?: string;
  
  /** 不兼容类型 */
  incompatibilityType?: 'missing' | 'denied' | 'incompatible' | 'policy_block';
}

// ============================================================================
// Agent Skill 兼容性检查器
// ============================================================================

export class AgentSkillCompatChecker {
  private config: Required<CompatConfig>;
  private registry: SkillRegistry;
  private policyEvaluator: SkillPolicyEvaluator;
  private validator: SkillValidator;
  
  constructor(
    registry: SkillRegistry,
    policyEvaluator: SkillPolicyEvaluator,
    validator: SkillValidator,
    config: CompatConfig = {}
  ) {
    this.config = {
      runtimeVersion: config.runtimeVersion ?? '2026.4.0',
      availableAgents: config.availableAgents ?? [],
    };
    this.registry = registry;
    this.policyEvaluator = policyEvaluator;
    this.validator = validator;
  }
  
  /**
   * 解析 Agent Skill 需求
   */
  resolveAgentSkillRequirements(
    agentSpec: AgentSkillSpec
  ): {
    required: AgentSkillRequirement[];
    optional: AgentSkillRequirement[];
    denied: string[];
  } {
    return {
      required: agentSpec.requiredSkills || [],
      optional: agentSpec.optionalSkills || [],
      denied: agentSpec.deniedSkills || [],
    };
  }
  
  /**
   * 检查 Skill 兼容性
   */
  checkSkillCompatibility(
    agentSpec: AgentSkillSpec,
    skillPkg: SkillPackageDescriptor
  ): CompatCheckResult {
    const skillName = skillPkg.manifest.name;
    
    // 检查是否在拒绝列表中
    if (agentSpec.deniedSkills?.includes(skillName)) {
      return {
        compatible: false,
        reason: `Skill ${skillName} is explicitly denied by agent spec`,
        incompatibilityType: 'denied',
      };
    }
    
    // 检查兼容性
    const compatibility = skillPkg.manifest.compatibility;
    if (compatibility) {
      // 检查不兼容的 Agent
      if (compatibility.incompatibleAgents) {
        // 简化实现：实际应该检查当前 agent
      }
      
      // 检查必需的 Agent
      if (compatibility.requiredAgents && compatibility.requiredAgents.length > 0) {
        // 简化实现：实际应该检查当前 agent 是否在必需列表中
      }
    }
    
    // 检查策略
    const policyDecision = evaluateLoadPolicy(
      skillPkg,
      { id: 'current_agent' } // 简化实现
    );
    
    if (policyDecision.effect === 'deny') {
      return {
        compatible: false,
        reason: policyDecision.reason,
        incompatibilityType: 'policy_block',
      };
    }
    
    return {
      compatible: true,
    };
  }
  
  /**
   * 构建 Agent Skill 加载计划
   */
  async buildAgentSkillLoadPlan(
    agentSpec: AgentSkillSpec
  ): Promise<AgentSkillLoadPlan> {
    const toLoad: SkillLoadDecision[] = [];
    const toSkip: SkillLoadDecision[] = [];
    const toBlock: SkillLoadDecision[] = [];
    const pending: SkillLoadDecision[] = [];
    const missingRequired: string[] = [];
    const optionalUnavailable: string[] = [];
    
    const { required, optional, denied } = this.resolveAgentSkillRequirements(agentSpec);
    
    // 处理 required skills
    for (const req of required) {
      const queryResult = this.registry.getSkill(req.name, req.versionRange);
      
      if (!queryResult.found || !queryResult.package) {
        missingRequired.push(req.name);
        continue;
      }
      
      const pkg = queryResult.package;
      const decision = await this.evaluateSkillLoadDecision(pkg, agentSpec);
      
      switch (decision.effect) {
        case 'load':
          toLoad.push(decision);
          break;
        case 'block':
          toBlock.push(decision);
          missingRequired.push(req.name);
          break;
        case 'pending':
          pending.push(decision);
          break;
        case 'skip':
          toSkip.push(decision);
          missingRequired.push(req.name);
          break;
      }
    }
    
    // 处理 optional skills
    for (const opt of optional) {
      const queryResult = this.registry.getSkill(opt.name, opt.versionRange);
      
      if (!queryResult.found || !queryResult.package) {
        optionalUnavailable.push(opt.name);
        continue;
      }
      
      const pkg = queryResult.package;
      const decision = await this.evaluateSkillLoadDecision(pkg, agentSpec);
      
      switch (decision.effect) {
        case 'load':
          toLoad.push(decision);
          break;
        case 'block':
          toBlock.push(decision);
          break;
        case 'pending':
          pending.push(decision);
          break;
        case 'skip':
          toSkip.push(decision);
          break;
      }
    }
    
    return {
      toLoad,
      toSkip,
      toBlock,
      pending,
      missingRequired,
      optionalUnavailable,
    };
  }
  
  /**
   * 评估 Skill 加载决策
   */
  private async evaluateSkillLoadDecision(
    pkg: SkillPackageDescriptor,
    agentSpec: AgentSkillSpec
  ): Promise<SkillLoadDecision> {
    const skillName = pkg.manifest.name;
    
    // 检查是否在拒绝列表中
    if (agentSpec.deniedSkills?.includes(skillName)) {
      return {
        skillName,
        effect: 'block',
        reason: `Skill ${skillName} is denied by agent spec`,
        trustLevel: pkg.manifest.trustLevel,
      };
    }
    
    // 验证 skill
    const validation = await this.validator.validateSkillPackage(pkg);
    
    if (!validation.valid) {
      return {
        skillName,
        effect: 'block',
        reason: `Skill validation failed: ${validation.errors.join('; ')}`,
        trustLevel: pkg.manifest.trustLevel,
      };
    }
    
    // 检查兼容性
    const compat = this.checkSkillCompatibility(agentSpec, pkg);
    
    if (!compat.compatible) {
      return {
        skillName,
        effect: 'block',
        reason: compat.reason || 'Incompatible',
        trustLevel: pkg.manifest.trustLevel,
        incompatibilityType: compat.incompatibilityType,
      };
    }
    
    // 评估策略
    const policyDecision: SkillPolicyDecision = evaluateLoadPolicy(
      pkg,
      { id: 'current_agent' }
    );
    
    switch (policyDecision.effect) {
      case 'allow':
        return {
          skillName,
          effect: 'load',
          reason: policyDecision.reason,
          trustLevel: pkg.manifest.trustLevel,
          requiresApproval: false,
        };
      
      case 'ask':
        return {
          skillName,
          effect: 'pending',
          reason: policyDecision.reason,
          trustLevel: pkg.manifest.trustLevel,
          requiresApproval: true,
        };
      
      case 'deny':
        return {
          skillName,
          effect: 'block',
          reason: policyDecision.reason,
          trustLevel: pkg.manifest.trustLevel,
        };
      
      default:
        return {
          skillName,
          effect: 'skip',
          reason: 'Unknown policy decision',
          trustLevel: pkg.manifest.trustLevel,
        };
    }
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建兼容性检查器
 */
export function createAgentSkillCompatChecker(
  registry: SkillRegistry,
  policyEvaluator: SkillPolicyEvaluator,
  validator: SkillValidator,
  config?: CompatConfig
): AgentSkillCompatChecker {
  return new AgentSkillCompatChecker(registry, policyEvaluator, validator, config);
}
