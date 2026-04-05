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
export declare class GovernancePolicyManager {
    private policy;
    constructor(config?: GovernancePolicyConfig);
    /**
     * 获取策略
     */
    getPolicy(): GovernancePolicy;
    /**
     * 获取并发配置
     */
    getConcurrencyConfig(): ConcurrencyConfig;
    /**
     * 获取队列配置
     */
    getQueueConfig(): ExecutionQueueConfig;
    /**
     * 获取预算配置
     */
    getBudgetConfig(): BudgetConfig;
    /**
     * 获取熔断配置
     */
    getCircuitBreakerConfig(): CircuitBreakerConfig;
    /**
     * 获取背压配置
     */
    getBackpressureConfig(): BackpressureConfig;
    /**
     * 获取角色权重
     */
    getRoleWeight(role: string): RoleWeightConfig | undefined;
    /**
     * 获取角色优先级
     */
    getRolePriority(role: string): number;
    /**
     * 检查角色是否允许 fan-out
     */
    isRoleFanoutAllowed(role: string): boolean;
    /**
     * 获取所有角色
     */
    getAllRoles(): string[];
    /**
     * 导出策略为 JSON
     */
    toJSON(): string;
    /**
     * 构建策略
     */
    private buildPolicy;
    /**
     * 获取环境默认值
     */
    private getDefaultsForEnvironment;
    /**
     * 开发环境默认值
     */
    private getDevelopmentDefaults;
    /**
     * 预发环境默认值
     */
    private getStagingDefaults;
    /**
     * 生产环境默认值
     */
    private getProductionDefaults;
}
/**
 * 创建治理策略管理器
 */
export declare function createGovernancePolicyManager(config?: GovernancePolicyConfig): GovernancePolicyManager;
/**
 * 获取开发环境策略
 */
export declare function getDevelopmentPolicy(): GovernancePolicy;
/**
 * 获取预发环境策略
 */
export declare function getStagingPolicy(): GovernancePolicy;
/**
 * 获取生产环境策略
 */
export declare function getProductionPolicy(): GovernancePolicy;
