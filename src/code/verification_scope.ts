/**
 * Verification Scope - 验证范围建议器
 * 
 * 职责：
 * 1. 根据影响报告生成验证范围建议
 * 2. 输出 smoke / targeted / broad 三档
 * 3. 给出范围原因
 * 4. 推荐测试文件
 * 5. 建议额外检查
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type { VerificationPlan, VerificationScope, RiskLevel, TestRef, ImpactReport, VerificationScopeConfig } from './types';

// ============================================================================
// 验证范围建议器
// ============================================================================

export class VerificationScopeAdvisor {
  private config: Required<VerificationScopeConfig>;
  
  constructor(config: VerificationScopeConfig = {}) {
    this.config = {
      riskThresholds: config.riskThresholds ?? {
        low: 0.3,
        medium: 0.6,
        high: 0.9,
      },
      maxSuggestedTests: config.maxSuggestedTests ?? 30,
    };
  }
  
  /**
   * 生成验证计划
   */
  async advise(impactReport: ImpactReport): Promise<VerificationPlan> {
    // 确定验证范围
    const scope = this.determineScope(impactReport);
    
    // 选择建议测试
    const suggestedTests = this.selectTests(impactReport.relatedTests, scope);
    
    // 生成额外检查
    const extraChecks = this.generateExtraChecks(impactReport);
    
    // 生成范围原因
    const whyThisScope = this.explainScope(scope, impactReport);
    
    // 计算预计测试数量
    const estimatedTestCount = this.estimateTestCount(suggestedTests, extraChecks);
    
    return {
      scope,
      suggestedTests,
      extraChecks,
      whyThisScope,
      risk: impactReport.risk,
      estimatedTestCount,
    };
  }
  
  /**
   * 确定验证范围
   */
  private determineScope(impactReport: ImpactReport): VerificationScope {
    const { risk, changedFiles, affectedEntrypoints, impactedSymbols, relatedTests } = impactReport;
    
    // Broad 范围条件
    if (this.shouldBroad(impactReport)) {
      return 'broad';
    }
    
    // Smoke 范围条件
    if (this.shouldSmoke(impactReport)) {
      return 'smoke';
    }
    
    // 默认 Targeted
    return 'targeted';
  }
  
  /**
   * 判断是否需要 Broad 验证
   */
  private shouldBroad(impactReport: ImpactReport): boolean {
    const { risk, affectedEntrypoints, impactedSymbols, relatedTests } = impactReport;
    
    // 高风险
    if (risk === 'high') {
      return true;
    }
    
    // 入口点受影响
    if (affectedEntrypoints.length > 0) {
      return true;
    }
    
    // 大量导出符号受影响
    const exportedSymbols = impactedSymbols.filter(s => s.exported);
    if (exportedSymbols.length > 5) {
      return true;
    }
    
    // 相关测试很分散
    if (relatedTests.length > 20) {
      return true;
    }
    
    // 核心模块变更
    const corePatterns = ['/core/', '/shared/', '/lib/', '/auth/', '/payment/', '/db/'];
    for (const file of impactReport.changedFiles) {
      for (const pattern of corePatterns) {
        if (file.includes(pattern)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * 判断是否只需 Smoke 验证
   */
  private shouldSmoke(impactReport: ImpactReport): boolean {
    const { changedFiles, relatedTests } = impactReport;
    
    // 只变更文档
    const docPatterns = ['.md', '.rst', 'README', 'CHANGELOG', 'CONTRIBUTING', 'docs/'];
    const allDocs = changedFiles.every(file =>
      docPatterns.some(pattern => file.includes(pattern))
    );
    if (allDocs) {
      return true;
    }
    
    // 只变更配置
    const configPatterns = ['.json', '.yaml', '.yml', '.toml', '.ini', 'config/'];
    const allConfig = changedFiles.every(file =>
      configPatterns.some(pattern => file.includes(pattern))
    );
    if (allConfig) {
      return true;
    }
    
    // 只变更测试文件
    const testPatterns = ['.test.', '.spec.', 'test_', '_test', '/tests/', '/__tests__/'];
    const allTests = changedFiles.every(file =>
      testPatterns.some(pattern => file.includes(pattern))
    );
    if (allTests) {
      return true;
    }
    
    // 没有相关测试
    if (relatedTests.length === 0) {
      return true;
    }
    
    return false;
  }
  
  /**
   * 选择建议测试
   */
  private selectTests(tests: TestRef[], scope: VerificationScope): TestRef[] {
    // 按置信度排序
    const sorted = [...tests].sort((a, b) => b.confidence - a.confidence);
    
    // 按范围限制数量
    const limits: Record<VerificationScope, number> = {
      smoke: 5,
      targeted: 15,
      broad: this.config.maxSuggestedTests,
    };
    
    return sorted.slice(0, limits[scope]);
  }
  
  /**
   * 生成额外检查
   */
  private generateExtraChecks(impactReport: ImpactReport): string[] {
    const checks: string[] = [];
    
    // 入口点变更 → 检查启动
    if (impactReport.affectedEntrypoints.length > 0) {
      checks.push('Verify application startup');
      checks.push('Run smoke tests on main entrypoints');
    }
    
    // API 变更 → 检查接口
    const apiChanges = impactReport.changedFiles.filter(f => f.includes('/api/'));
    if (apiChanges.length > 0) {
      checks.push('Verify API contract compatibility');
      checks.push('Run integration tests for affected endpoints');
    }
    
    // 数据库变更 → 检查迁移
    const dbChanges = impactReport.changedFiles.filter(f => 
      f.includes('/db/') || f.includes('/migration/')
    );
    if (dbChanges.length > 0) {
      checks.push('Verify database migrations');
      checks.push('Run data integrity checks');
    }
    
    // 认证变更 → 安全检查
    const authChanges = impactReport.changedFiles.filter(f => 
      f.includes('/auth/') || f.includes('/security/')
    );
    if (authChanges.length > 0) {
      checks.push('Run security tests');
      checks.push('Verify authentication flows');
    }
    
    // 大量符号变更 → 检查回归
    if (impactReport.impactedSymbols.length > 10) {
      checks.push('Run regression tests');
      checks.push('Check for breaking changes');
    }
    
    return checks;
  }
  
  /**
   * 解释范围选择原因
   */
  private explainScope(scope: VerificationScope, impactReport: ImpactReport): string {
    switch (scope) {
      case 'smoke':
        return this.explainSmoke(impactReport);
      case 'targeted':
        return this.explainTargeted(impactReport);
      case 'broad':
        return this.explainBroad(impactReport);
    }
  }
  
  /**
   * 解释 Smoke 范围
   */
  private explainSmoke(impactReport: ImpactReport): string {
    const reasons: string[] = [];
    
    if (impactReport.changedFiles.every(f => f.includes('.md') || f.includes('docs/'))) {
      reasons.push('Changes are documentation-only');
    }
    
    if (impactReport.changedFiles.every(f => 
      f.includes('.json') || f.includes('.yaml') || f.includes('config/')
    )) {
      reasons.push('Changes are configuration-only');
    }
    
    if (impactReport.relatedTests.length === 0) {
      reasons.push('No related tests found');
    }
    
    if (impactReport.risk === 'low') {
      reasons.push('Low risk assessment');
    }
    
    return reasons.length > 0 
      ? `Smoke verification recommended: ${reasons.join('; ')}`
      : 'Minimal changes detected, smoke verification sufficient';
  }
  
  /**
   * 解释 Targeted 范围
   */
  private explainTargeted(impactReport: ImpactReport): string {
    const reasons: string[] = [];
    
    reasons.push(`${impactReport.changedFiles.length} file(s) changed`);
    
    if (impactReport.relatedTests.length > 0) {
      reasons.push(`${impactReport.relatedTests.length} related test(s) identified`);
    }
    
    if (impactReport.impactedSymbols.length > 0) {
      reasons.push(`${impactReport.impactedSymbols.length} symbol(s) affected`);
    }
    
    reasons.push('Business logic changes require targeted verification');
    
    return `Targeted verification recommended: ${reasons.join('; ')}`;
  }
  
  /**
   * 解释 Broad 范围
   */
  private explainBroad(impactReport: ImpactReport): string {
    const reasons: string[] = [];
    
    if (impactReport.risk === 'high') {
      reasons.push('High risk assessment');
    }
    
    if (impactReport.affectedEntrypoints.length > 0) {
      reasons.push(`${impactReport.affectedEntrypoints.length} entrypoint(s) affected`);
    }
    
    const exportedSymbols = impactReport.impactedSymbols.filter(s => s.exported);
    if (exportedSymbols.length > 0) {
      reasons.push(`${exportedSymbols.length} exported symbol(s) affected`);
    }
    
    if (impactReport.relatedTests.length > 20) {
      reasons.push('Wide test impact detected');
    }
    
    const corePatterns = ['/core/', '/shared/', '/lib/'];
    const coreChanges = impactReport.changedFiles.filter(f => 
      corePatterns.some(p => f.includes(p))
    );
    if (coreChanges.length > 0) {
      reasons.push('Core module changes detected');
    }
    
    return `Broad verification required: ${reasons.join('; ')}`;
  }
  
  /**
   * 估计测试数量
   */
  private estimateTestCount(tests: TestRef[], extraChecks: string[]): number {
    return tests.length + extraChecks.length;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建验证范围建议器
 */
export function createVerificationScopeAdvisor(
  config?: VerificationScopeConfig
): VerificationScopeAdvisor {
  return new VerificationScopeAdvisor(config);
}

/**
 * 快速生成验证计划
 */
export async function generateVerificationPlan(
  impactReport: ImpactReport
): Promise<VerificationPlan> {
  const advisor = new VerificationScopeAdvisor();
  return await advisor.advise(impactReport);
}
