/**
 * Skill Trust - Skill 信任评估
 * 
 * 职责：
 * 1. 定义 trust level 语义
 * 2. 计算 package 的 trust posture
 * 3. 区分 source trust 与 package trust
 * 4. 输出统一 trust decision 基础对象
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  SkillPackageDescriptor,
  SkillTrustLevel,
  SkillSourceType,
  SkillTrustSummary,
  SkillTrustSignal,
} from './types';
import { isBuiltinSource, isWorkspaceSource, isExternalSource } from './skill_source';

// ============================================================================
// 信任评估
// ============================================================================

/**
 * 信任评估器
 */
export class SkillTrustEvaluator {
  /**
   * 评估信任级别
   */
  evaluateTrust(
    pkg: SkillPackageDescriptor,
    sourceType?: SkillSourceType
  ): SkillTrustSummary {
    const source = sourceType || pkg.source;
    const manifestTrustLevel = pkg.manifest.trustLevel;
    
    // 确定信任级别
    const trustLevel = this.determineTrustLevel(pkg, source);
    
    // 收集信任信号
    const trustSignals = this.collectTrustSignals(pkg, source);
    
    // 生成警告
    const warnings = this.generateWarnings(pkg, trustLevel);
    
    // 判断是否可信
    const isTrusted = this.isTrustedLevel(trustLevel);
    
    // 判断是否需要审批
    const requiresApproval = this.requiresApproval(trustLevel, source);
    
    return {
      trustLevel,
      sourceType: source,
      isTrusted,
      requiresApproval,
      trustSignals,
      warnings,
    };
  }
  
  /**
   * 确定信任级别
   */
  private determineTrustLevel(
    pkg: SkillPackageDescriptor,
    source: SkillSourceType
  ): SkillTrustLevel {
    // 如果 manifest 明确声明了 trustLevel，优先使用
    if (pkg.manifest.trustLevel) {
      return pkg.manifest.trustLevel;
    }
    
    // 根据来源推断
    switch (source) {
      case 'builtin':
        return 'builtin';
      
      case 'workspace':
        return 'workspace';
      
      case 'external':
        // 外部来源默认 untrusted，需要验证
        return 'untrusted';
      
      default:
        return 'workspace';
    }
  }
  
  /**
   * 收集信任信号
   */
  private collectTrustSignals(
    pkg: SkillPackageDescriptor,
    source: SkillSourceType
  ): SkillTrustSignal[] {
    const signals: SkillTrustSignal[] = [];
    
    // builtin 信号
    if (source === 'builtin') {
      signals.push({
        type: 'builtin',
        value: 'System built-in skill',
        confidence: 1.0,
      });
    }
    
    // workspace 本地信号
    if (source === 'workspace') {
      signals.push({
        type: 'workspace_local',
        value: 'Local workspace skill',
        confidence: 0.8,
      });
    }
    
    // 校验和信号（如果有）
    if (pkg.metadata?.checksum) {
      signals.push({
        type: 'checksum_valid',
        value: pkg.metadata.checksum as string,
        confidence: 0.9,
      });
    }
    
    // 发布者信号（如果有）
    if (pkg.manifest.author) {
      signals.push({
        type: 'verified_publisher',
        value: pkg.manifest.author,
        confidence: 0.7,
      });
    }
    
    return signals;
  }
  
  /**
   * 生成警告
   */
  private generateWarnings(
    pkg: SkillPackageDescriptor,
    trustLevel: SkillTrustLevel
  ): string[] {
    const warnings: string[] = [];
    
    // untrusted 警告
    if (trustLevel === 'untrusted') {
      warnings.push('This skill is from an untrusted source and requires verification');
    }
    
    // external 警告
    if (pkg.source === 'external' && trustLevel !== 'verified') {
      warnings.push('External skills should be reviewed before enabling');
    }
    
    // 无作者信息警告
    if (!pkg.manifest.author) {
      warnings.push('No author information provided');
    }
    
    // 无许可证警告
    if (!pkg.manifest.license) {
      warnings.push('No license information provided');
    }
    
    return warnings;
  }
  
  /**
   * 检查是否是可信级别
   */
  isTrustedLevel(trustLevel: SkillTrustLevel): boolean {
    return ['builtin', 'verified', 'workspace'].includes(trustLevel);
  }
  
  /**
   * 检查是否需要审批
   */
  requiresApproval(trustLevel: SkillTrustLevel, source: SkillSourceType): boolean {
    // builtin 不需要审批
    if (trustLevel === 'builtin') {
      return false;
    }
    
    // untrusted 需要审批
    if (trustLevel === 'untrusted') {
      return true;
    }
    
    // external 来源需要审批
    if (source === 'external') {
      return true;
    }
    
    // verified 和 workspace 不需要审批
    return false;
  }
  
  /**
   * 检查 skill 是否可信
   */
  isTrusted(pkg: SkillPackageDescriptor): boolean {
    const summary = this.evaluateTrust(pkg);
    return summary.isTrusted;
  }
  
  /**
   * 获取信任摘要
   */
  getTrustSummary(pkg: SkillPackageDescriptor): SkillTrustSummary {
    return this.evaluateTrust(pkg);
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建信任评估器
 */
export function createSkillTrustEvaluator(): SkillTrustEvaluator {
  return new SkillTrustEvaluator();
}

/**
 * 快速评估信任
 */
export function evaluateSkillTrust(
  pkg: SkillPackageDescriptor
): SkillTrustSummary {
  const evaluator = new SkillTrustEvaluator();
  return evaluator.evaluateTrust(pkg);
}

/**
 * 快速检查是否可信
 */
export function isSkillTrusted(pkg: SkillPackageDescriptor): boolean {
  const evaluator = new SkillTrustEvaluator();
  return evaluator.isTrusted(pkg);
}

/**
 * 快速检查是否需要审批
 */
export function doesSkillRequireApproval(pkg: SkillPackageDescriptor): boolean {
  const evaluator = new SkillTrustEvaluator();
  const summary = evaluator.evaluateTrust(pkg);
  return summary.requiresApproval;
}
