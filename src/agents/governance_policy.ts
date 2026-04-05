/**
 * Governance Policy - 治理策略
 * 
 * 职责：
 * 1. 定义默认并发数
 * 2. 定义各角色权重
 * 3. 定义 budget 配额
 * 4. 定义 queue TTL
 * 5. 定义熔断阈值
 * 6. 定义 backpressure 阈值
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type { ConcurrencyConfig } from './concurrency_limiter';
import type { ExecutionQueueConfig } from './execution_queue';
import type { BudgetConfig } from './budget_governor';
import type { CircuitBreakerConfig } from './circuit_breaker';
import type { BackpressureConfig } from './backpressure';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 角色权重配置
 */
export interface RoleWeightConfig {
  /** 优先级（1-10） */
  priority: number;
  
  /** 并发权重 */
  concurrencyWeight: number;
  
  /** 预算权重 */
  budgetWeight: number;
  
  /** 是否允许 fan-out */
  allowFanout: boolean;
}

/**
 * 治理策略配置
 */
export interface GovernancePolicyConfig {
  /** 策略名称 */
  name?: string;
  
  /** 描述 */
  description?: string;
  
  /** 环境（development/staging/production） */
  environment?: 'development' | 'staging' | 'production';
  
  /** 并发配置 */
  concurrency?: ConcurrencyConfig;
  
  /** 队列配置 */
  queue?: ExecutionQueueConfig;
  
  /** 预算配置 */
  budget?: BudgetConfig;
  
  /** 熔断配置 */
  circuitBreaker?: CircuitBreakerConfig;
  
  /** 背压配置 */
  backpressure?: BackpressureConfig;
  
  /** 角色权重 */
  roleWeights?: Record<string, RoleWeightConfig>;
}

/**
 * 完整治理策略
 */
export interface GovernancePolicy {
  name: string;
  description: string;
  environment: 'development' | 'staging' | 'production';
  
  concurrency: Required<ConcurrencyConfig>;
  queue: Required<ExecutionQueueConfig>;
  budget: Required<BudgetConfig>;
  circuitBreaker: Required<CircuitBreakerConfig>;
  backpressure: Required<BackpressureConfig>;
  
  roleWeights: Record<string, RoleWeightConfig>;
}

// ============================================================================
// 治理策略
// ============================================================================

export class GovernancePolicyManager {
  private policy: GovernancePolicy;
  
  constructor(config: GovernancePolicyConfig = {}) {
    this.policy = this.buildPolicy(config);
  }
  
  /**
   * 获取策略
   */
  getPolicy(): GovernancePolicy {
    return { ...this.policy };
  }
  
  /**
   * 获取并发配置
   */
  getConcurrencyConfig(): ConcurrencyConfig {
    return { ...this.policy.concurrency };
  }
  
  /**
   * 获取队列配置
   */
  getQueueConfig(): ExecutionQueueConfig {
    return { ...this.policy.queue };
  }
  
  /**
   * 获取预算配置
   */
  getBudgetConfig(): BudgetConfig {
    return { ...this.policy.budget };
  }
  
  /**
   * 获取熔断配置
   */
  getCircuitBreakerConfig(): CircuitBreakerConfig {
    return { ...this.policy.circuitBreaker };
  }
  
  /**
   * 获取背压配置
   */
  getBackpressureConfig(): BackpressureConfig {
    return { ...this.policy.backpressure };
  }
  
  /**
   * 获取角色权重
   */
  getRoleWeight(role: string): RoleWeightConfig | undefined {
    return this.policy.roleWeights[role];
  }
  
  /**
   * 获取角色优先级
   */
  getRolePriority(role: string): number {
    return this.policy.roleWeights[role]?.priority || 5;
  }
  
  /**
   * 检查角色是否允许 fan-out
   */
  isRoleFanoutAllowed(role: string): boolean {
    return this.policy.roleWeights[role]?.allowFanout ?? true;
  }
  
  /**
   * 获取所有角色
   */
  getAllRoles(): string[] {
    return Object.keys(this.policy.roleWeights);
  }
  
  /**
   * 导出策略为 JSON
   */
  toJSON(): string {
    return JSON.stringify(this.policy, null, 2);
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 构建策略
   */
  private buildPolicy(config: GovernancePolicyConfig): GovernancePolicy {
    const environment = config.environment || 'development';
    const defaults = this.getDefaultsForEnvironment(environment);
    
    return {
      name: config.name || `${environment}-default`,
      description: config.description || `Default governance policy for ${environment}`,
      environment,
      
      concurrency: {
        ...defaults.concurrency,
        ...config.concurrency,
      },
      queue: {
        ...defaults.queue,
        ...config.queue,
      },
      budget: {
        ...defaults.budget,
        ...config.budget,
      },
      circuitBreaker: {
        ...defaults.circuitBreaker,
        ...config.circuitBreaker,
      },
      backpressure: {
        ...defaults.backpressure,
        ...config.backpressure,
      },
      
      roleWeights: {
        ...defaults.roleWeights,
        ...config.roleWeights,
      },
    };
  }
  
  /**
   * 获取环境默认值
   */
  private getDefaultsForEnvironment(
    environment: 'development' | 'staging' | 'production'
  ): Omit<GovernancePolicy, 'name' | 'description' | 'environment'> {
    switch (environment) {
      case 'production':
        return this.getProductionDefaults();
      case 'staging':
        return this.getStagingDefaults();
      case 'development':
      default:
        return this.getDevelopmentDefaults();
    }
  }
  
  /**
   * 开发环境默认值
   */
  private getDevelopmentDefaults(): Omit<GovernancePolicy, 'name' | 'description' | 'environment'> {
    return {
      concurrency: {
        maxGlobalConcurrency: 16,
        maxTeamConcurrency: 5,
        maxRoleConcurrency: {
          planner: 4,
          repo_reader: 4,
          code_fixer: 4,
          code_reviewer: 2,
          verify_agent: 2,
          release_agent: 2,
        },
      },
      queue: {
        maxQueueSize: 2000,
        defaultTimeoutMs: 600000,
        expiryCheckIntervalMs: 10000,
        priorityWeight: 1,
      },
      budget: {
        maxGlobalConcurrency: 16,
        maxTeamConcurrency: 5,
        teamTokenBudget: {},
        roleTokenBudget: {
          planner: 100000,
          repo_reader: 200000,
          code_fixer: 300000,
          code_reviewer: 150000,
          verify_agent: 200000,
          release_agent: 100000,
        },
        teamTimeBudgetMs: {},
        maxRetriesPerTask: 3,
        maxRetriesPerTeam: 20,
      },
      circuitBreaker: {
        failureThreshold: 60,
        timeoutThreshold: 40,
        minCalls: 5,
        openDurationMs: 15000,
        halfOpenMaxCalls: 3,
        halfOpenSuccessThreshold: 2,
      },
      backpressure: {
        checkIntervalMs: 1000,
        queueLengthThresholds: {
          medium: 100,
          high: 200,
          critical: 400,
        },
        waitTimeThresholds: {
          medium: 10000,
          high: 20000,
          critical: 60000,
        },
        failureRateThresholds: {
          medium: 30,
          high: 50,
          critical: 70,
        },
      },
      roleWeights: {
        planner: {
          priority: 5,
          concurrencyWeight: 1.0,
          budgetWeight: 1.0,
          allowFanout: true,
        },
        repo_reader: {
          priority: 4,
          concurrencyWeight: 1.2,
          budgetWeight: 1.2,
          allowFanout: true,
        },
        code_fixer: {
          priority: 6,
          concurrencyWeight: 1.5,
          budgetWeight: 1.5,
          allowFanout: true,
        },
        code_reviewer: {
          priority: 5,
          concurrencyWeight: 1.0,
          budgetWeight: 0.8,
          allowFanout: false,
        },
        verify_agent: {
          priority: 7,
          concurrencyWeight: 1.2,
          budgetWeight: 1.0,
          allowFanout: false,
        },
        release_agent: {
          priority: 8,
          concurrencyWeight: 0.8,
          budgetWeight: 0.5,
          allowFanout: false,
        },
      },
    };
  }
  
  /**
   * 预发环境默认值
   */
  private getStagingDefaults(): Omit<GovernancePolicy, 'name' | 'description' | 'environment'> {
    return {
      concurrency: {
        maxGlobalConcurrency: 10,
        maxTeamConcurrency: 3,
        maxRoleConcurrency: {
          planner: 2,
          repo_reader: 2,
          code_fixer: 2,
          code_reviewer: 1,
          verify_agent: 1,
          release_agent: 1,
        },
      },
      queue: {
        maxQueueSize: 1000,
        defaultTimeoutMs: 300000,
        expiryCheckIntervalMs: 10000,
        priorityWeight: 1,
      },
      budget: {
        maxGlobalConcurrency: 10,
        maxTeamConcurrency: 3,
        teamTokenBudget: {},
        roleTokenBudget: {
          planner: 50000,
          repo_reader: 100000,
          code_fixer: 150000,
          code_reviewer: 80000,
          verify_agent: 100000,
          release_agent: 50000,
        },
        teamTimeBudgetMs: {},
        maxRetriesPerTask: 2,
        maxRetriesPerTeam: 10,
      },
      circuitBreaker: {
        failureThreshold: 50,
        timeoutThreshold: 30,
        minCalls: 10,
        openDurationMs: 30000,
        halfOpenMaxCalls: 5,
        halfOpenSuccessThreshold: 3,
      },
      backpressure: {
        checkIntervalMs: 1000,
        queueLengthThresholds: {
          medium: 50,
          high: 100,
          critical: 200,
        },
        waitTimeThresholds: {
          medium: 5000,
          high: 10000,
          critical: 30000,
        },
        failureRateThresholds: {
          medium: 20,
          high: 40,
          critical: 60,
        },
      },
      roleWeights: {
        planner: {
          priority: 5,
          concurrencyWeight: 1.0,
          budgetWeight: 1.0,
          allowFanout: true,
        },
        repo_reader: {
          priority: 4,
          concurrencyWeight: 1.0,
          budgetWeight: 1.0,
          allowFanout: true,
        },
        code_fixer: {
          priority: 6,
          concurrencyWeight: 1.2,
          budgetWeight: 1.2,
          allowFanout: true,
        },
        code_reviewer: {
          priority: 5,
          concurrencyWeight: 1.0,
          budgetWeight: 0.8,
          allowFanout: false,
        },
        verify_agent: {
          priority: 7,
          concurrencyWeight: 1.0,
          budgetWeight: 1.0,
          allowFanout: false,
        },
        release_agent: {
          priority: 8,
          concurrencyWeight: 0.8,
          budgetWeight: 0.5,
          allowFanout: false,
        },
      },
    };
  }
  
  /**
   * 生产环境默认值
   */
  private getProductionDefaults(): Omit<GovernancePolicy, 'name' | 'description' | 'environment'> {
    return {
      concurrency: {
        maxGlobalConcurrency: 6,
        maxTeamConcurrency: 2,
        maxRoleConcurrency: {
          planner: 1,
          repo_reader: 1,
          code_fixer: 1,
          code_reviewer: 1,
          verify_agent: 1,
          release_agent: 1,
        },
      },
      queue: {
        maxQueueSize: 500,
        defaultTimeoutMs: 180000,
        expiryCheckIntervalMs: 5000,
        priorityWeight: 1,
      },
      budget: {
        maxGlobalConcurrency: 6,
        maxTeamConcurrency: 2,
        teamTokenBudget: {},
        roleTokenBudget: {
          planner: 30000,
          repo_reader: 50000,
          code_fixer: 80000,
          code_reviewer: 40000,
          verify_agent: 50000,
          release_agent: 30000,
        },
        teamTimeBudgetMs: {},
        maxRetriesPerTask: 1,
        maxRetriesPerTeam: 5,
      },
      circuitBreaker: {
        failureThreshold: 40,
        timeoutThreshold: 20,
        minCalls: 15,
        openDurationMs: 60000,
        halfOpenMaxCalls: 3,
        halfOpenSuccessThreshold: 3,
      },
      backpressure: {
        checkIntervalMs: 500,
        queueLengthThresholds: {
          medium: 30,
          high: 60,
          critical: 100,
        },
        waitTimeThresholds: {
          medium: 3000,
          high: 6000,
          critical: 15000,
        },
        failureRateThresholds: {
          medium: 15,
          high: 30,
          critical: 50,
        },
      },
      roleWeights: {
        planner: {
          priority: 5,
          concurrencyWeight: 1.0,
          budgetWeight: 1.0,
          allowFanout: false,
        },
        repo_reader: {
          priority: 4,
          concurrencyWeight: 1.0,
          budgetWeight: 1.0,
          allowFanout: false,
        },
        code_fixer: {
          priority: 6,
          concurrencyWeight: 1.0,
          budgetWeight: 1.0,
          allowFanout: false,
        },
        code_reviewer: {
          priority: 5,
          concurrencyWeight: 1.0,
          budgetWeight: 0.8,
          allowFanout: false,
        },
        verify_agent: {
          priority: 7,
          concurrencyWeight: 1.0,
          budgetWeight: 1.0,
          allowFanout: false,
        },
        release_agent: {
          priority: 9,
          concurrencyWeight: 0.5,
          budgetWeight: 0.5,
          allowFanout: false,
        },
      },
    };
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建治理策略管理器
 */
export function createGovernancePolicyManager(
  config?: GovernancePolicyConfig
): GovernancePolicyManager {
  return new GovernancePolicyManager(config);
}

/**
 * 获取开发环境策略
 */
export function getDevelopmentPolicy(): GovernancePolicy {
  const manager = new GovernancePolicyManager({ environment: 'development' });
  return manager.getPolicy();
}

/**
 * 获取预发环境策略
 */
export function getStagingPolicy(): GovernancePolicy {
  const manager = new GovernancePolicyManager({ environment: 'staging' });
  return manager.getPolicy();
}

/**
 * 获取生产环境策略
 */
export function getProductionPolicy(): GovernancePolicy {
  const manager = new GovernancePolicyManager({ environment: 'production' });
  return manager.getPolicy();
}
