"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GovernancePolicyManager = void 0;
exports.createGovernancePolicyManager = createGovernancePolicyManager;
exports.getDevelopmentPolicy = getDevelopmentPolicy;
exports.getStagingPolicy = getStagingPolicy;
exports.getProductionPolicy = getProductionPolicy;
// ============================================================================
// 治理策略
// ============================================================================
class GovernancePolicyManager {
    constructor(config = {}) {
        this.policy = this.buildPolicy(config);
    }
    /**
     * 获取策略
     */
    getPolicy() {
        return { ...this.policy };
    }
    /**
     * 获取并发配置
     */
    getConcurrencyConfig() {
        return { ...this.policy.concurrency };
    }
    /**
     * 获取队列配置
     */
    getQueueConfig() {
        return { ...this.policy.queue };
    }
    /**
     * 获取预算配置
     */
    getBudgetConfig() {
        return { ...this.policy.budget };
    }
    /**
     * 获取熔断配置
     */
    getCircuitBreakerConfig() {
        return { ...this.policy.circuitBreaker };
    }
    /**
     * 获取背压配置
     */
    getBackpressureConfig() {
        return { ...this.policy.backpressure };
    }
    /**
     * 获取角色权重
     */
    getRoleWeight(role) {
        return this.policy.roleWeights[role];
    }
    /**
     * 获取角色优先级
     */
    getRolePriority(role) {
        return this.policy.roleWeights[role]?.priority || 5;
    }
    /**
     * 检查角色是否允许 fan-out
     */
    isRoleFanoutAllowed(role) {
        return this.policy.roleWeights[role]?.allowFanout ?? true;
    }
    /**
     * 获取所有角色
     */
    getAllRoles() {
        return Object.keys(this.policy.roleWeights);
    }
    /**
     * 导出策略为 JSON
     */
    toJSON() {
        return JSON.stringify(this.policy, null, 2);
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    /**
     * 构建策略
     */
    buildPolicy(config) {
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
    getDefaultsForEnvironment(environment) {
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
    getDevelopmentDefaults() {
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
    getStagingDefaults() {
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
    getProductionDefaults() {
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
exports.GovernancePolicyManager = GovernancePolicyManager;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建治理策略管理器
 */
function createGovernancePolicyManager(config) {
    return new GovernancePolicyManager(config);
}
/**
 * 获取开发环境策略
 */
function getDevelopmentPolicy() {
    const manager = new GovernancePolicyManager({ environment: 'development' });
    return manager.getPolicy();
}
/**
 * 获取预发环境策略
 */
function getStagingPolicy() {
    const manager = new GovernancePolicyManager({ environment: 'staging' });
    return manager.getPolicy();
}
/**
 * 获取生产环境策略
 */
function getProductionPolicy() {
    const manager = new GovernancePolicyManager({ environment: 'production' });
    return manager.getPolicy();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ292ZXJuYW5jZV9wb2xpY3kuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvYWdlbnRzL2dvdmVybmFuY2VfcG9saWN5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7OztHQWFHOzs7QUF5aUJILHNFQUlDO0FBS0Qsb0RBR0M7QUFLRCw0Q0FHQztBQUtELGtEQUdDO0FBdmZELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FLE1BQWEsdUJBQXVCO0lBR2xDLFlBQVksU0FBaUMsRUFBRTtRQUM3QyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDekMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsU0FBUztRQUNQLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUM1QixDQUFDO0lBRUQ7O09BRUc7SUFDSCxvQkFBb0I7UUFDbEIsT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUN4QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxjQUFjO1FBQ1osT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUNsQyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxlQUFlO1FBQ2IsT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUNuQyxDQUFDO0lBRUQ7O09BRUc7SUFDSCx1QkFBdUI7UUFDckIsT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjLEVBQUUsQ0FBQztJQUMzQyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxxQkFBcUI7UUFDbkIsT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLEVBQUUsQ0FBQztJQUN6QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxhQUFhLENBQUMs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QU8sSUFBSSx1QkFBdUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUM3QyxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixvQkFBb0I7SUFDbEMsTUFBTSxPQUFPLEdBQUcsSUFBSSx1QkFBdUIsQ0FBQyxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUUsQ0FBQyxDQUFDO0lBQzVFLE9BQU8sT0FBTyxDQUFDLFNBQVMsRUFBRSxDQUFDO0FBQzdCLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLGdCQUFnQjtJQUM5QixNQUFNLE9BQU8sR0FBRyxJQUFJLHVCQUF1QixDQUFDLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7SUFDeEUsT0FBTyxPQUFPLENBQUMsU0FBUyxFQUFFLENBQUM7QUFDN0IsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0IsbUJBQW1CO0lBQ2pDLE1BQU0sT0FBTyxHQUFHLElBQUksdUJBQXVCLENBQUMsRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFLENBQUMsQ0FBQztJQUMzRSxPQUFPLE9BQU8sQ0FBQyxTQUFTLEVBQUUsQ0FBQztBQUM3QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBHb3Zlcm5hbmNlIFBvbGljeSAtIOayu+eQhuetlueVpVxuICogXG4gKiDogYzotKPvvJpcbiAqIDEuIOWumuS5iem7mOiupOW5tuWPkeaVsFxuICogMi4g5a6a5LmJ5ZCE6KeS6Imy5p2D6YeNXG4gKiAzLiDlrprkuYkgYnVkZ2V0IOmFjeminVxuICogNC4g5a6a5LmJIHF1ZXVlIFRUTFxuICogNS4g5a6a5LmJ54aU5pat6ZiI5YC8XG4gKiA2LiDlrprkuYkgYmFja3ByZXNzdXJlIOmYiOWAvFxuICogXG4gKiBAdmVyc2lvbiB2MC4xLjBcbiAqIEBkYXRlIDIwMjYtMDQtMDNcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IENvbmN1cnJlbmN5Q29uZmlnIH0gZnJvbSAnLi9jb25jdXJyZW5jeV9saW1pdGVyJztcbmltcG9ydCB0eXBlIHsgRXhlY3V0aW9uUXVldWVDb25maWcgfSBmcm9tICcuL2V4ZWN1dGlvbl9xdWV1ZSc7XG5pbXBvcnQgdHlwZSB7IEJ1ZGdldENvbmZpZyB9IGZyb20gJy4vYnVkZ2V0X2dvdmVybm9yJztcbmltcG9ydCB0eXBlIHsgQ2lyY3VpdEJyZWFrZXJDb25maWcgfSBmcm9tICcuL2NpcmN1aXRfYnJlYWtlcic7XG5pbXBvcnQgdHlwZSB7IEJhY2twcmVzc3VyZUNvbmZpZyB9IGZyb20gJy4vYmFja3ByZXNzdXJlJztcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g57G75Z6L5a6a5LmJXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog6KeS6Imy5p2D6YeN6YWN572uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUm9sZVdlaWdodENvbmZpZyB7XG4gIC8qKiDkvJjlhYjnuqfvvIgxLTEw77yJICovXG4gIHByaW9yaXR5OiBudW1iZXI7XG4gIFxuICAvKiog5bm25Y+R5p2D6YeNICovXG4gIGNvbmN1cnJlbmN5V2VpZ2h0OiBudW1iZXI7XG4gIFxuICAvKiog6aKE566X5p2D6YeNICovXG4gIGJ1ZGdldFdlaWdodDogbnVtYmVyO1xuICBcbiAgLyoqIOaYr+WQpuWFgeiuuCBmYW4tb3V0ICovXG4gIGFsbG93RmFub3V0OiBib29sZWFuO1xufVxuXG4vKipcbiAqIOayu+eQhuetlueVpemFjee9rlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEdvdmVybmFuY2VQb2xpY3lDb25maWcge1xuICAvKiog562W55Wl5ZCN56ewICovXG4gIG5hbWU/OiBzdHJpbmc7XG4gIFxuICAvKiog5o+P6L+wICovXG4gIGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuICBcbiAgLyoqIOeOr+Wig++8iGRldmVsb3BtZW50L3N0YWdpbmcvcHJvZHVjdGlvbu+8iSAqL1xuICBlbnZpcm9ubWVudD86ICdkZXZlbG9wbWVudCcgfCAnc3RhZ2luZycgfCAncHJvZHVjdGlvbic7XG4gIFxuICAvKiog5bm25Y+R6YWN572uICovXG4gIGNvbmN1cnJlbmN5PzogQ29uY3VycmVuY3lDb25maWc7XG4gIFxuICAvKiog6Zif5YiX6YWN572uICovXG4gIHF1ZXVlPzogRXhlY3V0aW9uUXVldWVDb25maWc7XG4gIFxuICAvKiog6aKE566X6YWN572uICovXG4gIGJ1ZGdldD86IEJ1ZGdldENvbmZpZztcbiAgXG4gIC8qKiDnhpTmlq3phY3nva4gKi9cbiAgY2lyY3VpdEJyZWFrZXI/OiBDaXJjdWl0QnJlYWtlckNvbmZpZztcbiAgXG4gIC8qKiDog4zljovphY3nva4gKi9cbiAgYmFja3ByZXNzdXJlPzogQmFja3ByZXNzdXJlQ29uZmlnO1xuICBcbiAgLyoqIOinkuiJsuadg+mHjSAqL1xuICByb2xlV2VpZ2h0cz86IFJlY29yZDxzdHJpbmcsIFJvbGVXZWlnaHRDb25maWc+O1xufVxuXG4vKipcbiAqIOWujOaVtOayu+eQhuetlueVpVxuICovXG5leHBvcnQgaW50ZXJmYWNlIEdvdmVybmFuY2VQb2xpY3kge1xuICBuYW1lOiBzdHJpbmc7XG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG4gIGVudmlyb25tZW50OiAnZGV2ZWxvcG1lbnQnIHwgJ3N0YWdpbmcnIHwgJ3Byb2R1Y3Rpb24nO1xuICBcbiAgY29uY3VycmVuY3k6IFJlcXVpcmVkPENvbmN1cnJlbmN5Q29uZmlnPjtcbiAgcXVldWU6IFJlcXVpcmVkPEV4ZWN1dGlvblF1ZXVlQ29uZmlnPjtcbiAgYnVkZ2V0OiBSZXF1aXJlZDxCdWRnZXRDb25maWc+O1xuICBjaXJjdWl0QnJlYWtlcjogUmVxdWlyZWQ8Q2lyY3VpdEJyZWFrZXJDb25maWc+O1xuICBiYWNrcHJlc3N1cmU6IFJlcXVpcmVkPEJhY2twcmVzc3VyZUNvbmZpZz47XG4gIFxuICByb2xlV2VpZ2h0czogUmVjb3JkPHN0cmluZywgUm9sZVdlaWdodENvbmZpZz47XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOayu+eQhuetlueVpVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgR292ZXJuYW5jZVBvbGljeU1hbmFnZXIge1xuICBwcml2YXRlIHBvbGljeTogR292ZXJuYW5jZVBvbGljeTtcbiAgXG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogR292ZXJuYW5jZVBvbGljeUNvbmZpZyA9IHt9KSB7XG4gICAgdGhpcy5wb2xpY3kgPSB0aGlzLmJ1aWxkUG9saWN5KGNvbmZpZyk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDojrflj5bnrZbnlaVcbiAgICovXG4gIGdldFBvbGljeSgpOiBHb3Zlcm5hbmNlUG9saWN5IHtcbiAgICByZXR1cm4geyAuLi50aGlzLnBvbGljeSB9O1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W5bm25Y+R6YWN572uXG4gICAqL1xuICBnZXRDb25jdXJyZW5jeUNvbmZpZygpOiBDb25jdXJyZW5jeUNvbmZpZyB7XG4gICAgcmV0dXJuIHsgLi4udGhpcy5wb2xpY3kuY29uY3VycmVuY3kgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOiOt+WPlumYn+WIl+mFjee9rlxuICAgKi9cbiAgZ2V0UXVldWVDb25maWcoKTogRXhlY3V0aW9uUXVldWVDb25maWcge1xuICAgIHJldHVybiB7IC4uLnRoaXMucG9saWN5LnF1ZXVlIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDojrflj5bpooTnrpfphY3nva5cbiAgICovXG4gIGdldEJ1ZGdldENvbmZpZygpOiBCdWRnZXRDb25maWcge1xuICAgIHJldHVybiB7IC4uLnRoaXMucG9saWN5LmJ1ZGdldCB9O1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W54aU5pat6YWN572uXG4gICAqL1xuICBnZXRDaXJjdWl0QnJlYWtlckNvbmZpZygpOiBDaXJjdWl0QnJlYWtlckNvbmZpZyB7XG4gICAgcmV0dXJuIHsgLi4udGhpcy5wb2xpY3kuY2lyY3VpdEJyZWFrZXIgfTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOiOt+WPluiDjOWOi+mFjee9rlxuICAgKi9cbiAgZ2V0QmFja3ByZXNzdXJlQ29uZmlnKCk6IEJhY2twcmVzc3VyZUNvbmZpZyB7XG4gICAgcmV0dXJuIHsgLi4udGhpcy5wb2xpY3kuYmFja3ByZXNzdXJlIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDojrflj5bop5LoibLmnYPph41cbiAgICovXG4gIGdldFJvbGVXZWlnaHQocm9sZTogc3RyaW5nKTogUm9sZVdlaWdodENvbmZpZyB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMucG9saWN5LnJvbGVXZWlnaHRzW3JvbGVdO1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W6KeS6Imy5LyY5YWI57qnXG4gICAqL1xuICBnZXRSb2xlUHJpb3JpdHkocm9sZTogc3RyaW5nKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5wb2xpY3kucm9sZVdlaWdodHNbcm9sZV0/LnByaW9yaXR5IHx8IDU7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmo4Dmn6Xop5LoibLmmK/lkKblhYHorrggZmFuLW91dFxuICAgKi9cbiAgaXNSb2xlRmFub3V0QWxsb3dlZChyb2xlOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5wb2xpY3kucm9sZVdlaWdodHNbcm9sZV0/LmFsbG93RmFub3V0ID8/IHRydWU7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDojrflj5bmiYDmnInop5LoibJcbiAgICovXG4gIGdldEFsbFJvbGVzKCk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5wb2xpY3kucm9sZVdlaWdodHMpO1xuICB9XG4gIFxuICAvKipcbiAgICog5a+85Ye6562W55Wl5Li6IEpTT05cbiAgICovXG4gIHRvSlNPTigpOiBzdHJpbmcge1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh0aGlzLnBvbGljeSwgbnVsbCwgMik7XG4gIH1cbiAgXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8g5YaF6YOo5pa55rOVXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgXG4gIC8qKlxuICAgKiDmnoTlu7rnrZbnlaVcbiAgICovXG4gIHByaXZhdGUgYnVpbGRQb2xpY3koY29uZmlnOiBHb3Zlcm5hbmNlUG9saWN5Q29uZmlnKTogR292ZXJuYW5jZVBvbGljeSB7XG4gICAgY29uc3QgZW52aXJvbm1lbnQgPSBjb25maWcuZW52aXJvbm1lbnQgfHwgJ2RldmVsb3BtZW50JztcbiAgICBjb25zdCBkZWZhdWx0cyA9IHRoaXMuZ2V0RGVmYXVsdHNGb3JFbnZpcm9ubWVudChlbnZpcm9ubWVudCk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIG5hbWU6IGNvbmZpZy5uYW1lIHx8IGAke2Vudmlyb25tZW50fS1kZWZhdWx0YCxcbiAgICAgIGRlc2NyaXB0aW9uOiBjb25maWcuZGVzY3JpcHRpb24gfHwgYERlZmF1bHQgZ292ZXJuYW5jZSBwb2xpY3kgZm9yICR7ZW52aXJvbm1lbnR9YCxcbiAgICAgIGVudmlyb25tZW50LFxuICAgICAgXG4gICAgICBjb25jdXJyZW5jeToge1xuICAgICAgICAuLi5kZWZhdWx0cy5jb25jdXJyZW5jeSxcbiAgICAgICAgLi4uY29uZmlnLmNvbmN1cnJlbmN5LFxuICAgICAgfSxcbiAgICAgIHF1ZXVlOiB7XG4gICAgICAgIC4uLmRlZmF1bHRzLnF1ZXVlLFxuICAgICAgICAuLi5jb25maWcucXVldWUsXG4gICAgICB9LFxuICAgICAgYnVkZ2V0OiB7XG4gICAgICAgIC4uLmRlZmF1bHRzLmJ1ZGdldCxcbiAgICAgICAgLi4uY29uZmlnLmJ1ZGdldCxcbiAgICAgIH0sXG4gICAgICBjaXJjdWl0QnJlYWtlcjoge1xuICAgICAgICAuLi5kZWZhdWx0cy5jaXJjdWl0QnJlYWtlcixcbiAgICAgICAgLi4uY29uZmlnLmNpcmN1aXRCcmVha2VyLFxuICAgICAgfSxcbiAgICAgIGJhY2twcmVzc3VyZToge1xuICAgICAgICAuLi5kZWZhdWx0cy5iYWNrcHJlc3N1cmUsXG4gICAgICAgIC4uLmNvbmZpZy5iYWNrcHJlc3N1cmUsXG4gICAgICB9LFxuICAgICAgXG4gICAgICByb2xlV2VpZ2h0czoge1xuICAgICAgICAuLi5kZWZhdWx0cy5yb2xlV2VpZ2h0cyxcbiAgICAgICAgLi4uY29uZmlnLnJvbGVXZWlnaHRzLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W546v5aKD6buY6K6k5YC8XG4gICAqL1xuICBwcml2YXRlIGdldERlZmF1bHRzRm9yRW52aXJvbm1lbnQoXG4gICAgZW52aXJvbm1lbnQ6ICdkZXZlbG9wbWVudCcgfCAnc3RhZ2luZycgfCAncHJvZHVjdGlvbidcbiAgKTogT21pdDxHb3Zlcm5hbmNlUG9saWN5LCAnbmFtZScgfCAnZGVzY3JpcHRpb24nIHwgJ2Vudmlyb25tZW50Jz4ge1xuICAgIHN3aXRjaCAoZW52aXJvbm1lbnQpIHtcbiAgICAgIGNhc2UgJ3Byb2R1Y3Rpb24nOlxuICAgICAgICByZXR1cm4gdGhpcy5nZXRQcm9kdWN0aW9uRGVmYXVsdHMoKTtcbiAgICAgIGNhc2UgJ3N0YWdpbmcnOlxuICAgICAgICByZXR1cm4gdGhpcy5nZXRTdGFnaW5nRGVmYXVsdHMoKTtcbiAgICAgIGNhc2UgJ2RldmVsb3BtZW50JzpcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiB0aGlzLmdldERldmVsb3BtZW50RGVmYXVsdHMoKTtcbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDlvIDlj5Hnjq/looPpu5jorqTlgLxcbiAgICovXG4gIHByaXZhdGUgZ2V0RGV2ZWxvcG1lbnREZWZhdWx0cygpOiBPbWl0PEdvdmVybmFuY2VQb2xpY3ksICduYW1lJyB8ICdkZXNjcmlwdGlvbicgfCAnZW52aXJvbm1lbnQnPiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbmN1cnJlbmN5OiB7XG4gICAgICAgIG1heEdsb2JhbENvbmN1cnJlbmN5OiAxNixcbiAgICAgICAgbWF4VGVhbUNvbmN1cnJlbmN5OiA1LFxuICAgICAgICBtYXhSb2xlQ29uY3VycmVuY3k6IHtcbiAgICAgICAgICBwbGFubmVyOiA0LFxuICAgICAgICAgIHJlcG9fcmVhZGVyOiA0LFxuICAgICAgICAgIGNvZGVfZml4ZXI6IDQsXG4gICAgICAgICAgY29kZV9yZXZpZXdlcjogMixcbiAgICAgICAgICB2ZXJpZnlfYWdlbnQ6IDIsXG4gICAgICAgICAgcmVsZWFzZV9hZ2VudDogMixcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBxdWV1ZToge1xuICAgICAgICBtYXhRdWV1ZVNpemU6IDIwMDAsXG4gICAgICAgIGRlZmF1bHRUaW1lb3V0TXM6IDYwMDAwMCxcbiAgICAgICAgZXhwaXJ5Q2hlY2tJbnRlcnZhbE1zOiAxMDAwMCxcbiAgICAgICAgcHJpb3JpdHlXZWlnaHQ6IDEsXG4gICAgICB9LFxuICAgICAgYnVkZ2V0OiB7XG4gICAgICAgIG1heEdsb2JhbENvbmN1cnJlbmN5OiAxNixcbiAgICAgICAgbWF4VGVhbUNvbmN1cnJlbmN5OiA1LFxuICAgICAgICB0ZWFtVG9rZW5CdWRnZXQ6IHt9LFxuICAgICAgICByb2xlVG9rZW5CdWRnZXQ6IHtcbiAgICAgICAgICBwbGFubmVyOiAxMDAwMDAsXG4gICAgICAgICAgcmVwb19yZWFkZXI6IDIwMDAwMCxcbiAgICAgICAgICBjb2RlX2ZpeGVyOiAzMDAwMDAsXG4gICAgICAgICAgY29kZV9yZXZpZXdlcjogMTUwMDAwLFxuICAgICAgICAgIHZlcmlmeV9hZ2VudDogMjAwMDAwLFxuICAgICAgICAgIHJlbGVhc2VfYWdlbnQ6IDEwMDAwMCxcbiAgICAgICAgfSxcbiAgICAgICAgdGVhbVRpbWVCdWRnZXRNczoge30sXG4gICAgICAgIG1heFJldHJpZXNQZXJUYXNrOiAzLFxuICAgICAgICBtYXhSZXRyaWVzUGVyVGVhbTogMjAsXG4gICAgICB9LFxuICAgICAgY2lyY3VpdEJyZWFrZXI6IHtcbiAgICAgICAgZmFpbHVyZVRocmVzaG9sZDogNjAsXG4gICAgICAgIHRpbWVvdXRUaHJlc2hvbGQ6IDQwLFxuICAgICAgICBtaW5DYWxsczogNSxcbiAgICAgICAgb3BlbkR1cmF0aW9uTXM6IDE1MDAwLFxuICAgICAgICBoYWxmT3Blbk1heENhbGxzOiAzLFxuICAgICAgICBoYWxmT3BlblN1Y2Nlc3NUaHJlc2hvbGQ6IDIsXG4gICAgICB9LFxuICAgICAgYmFja3ByZXNzdXJlOiB7XG4gICAgICAgIGNoZWNrSW50ZXJ2YWxNczogMTAwMCxcbiAgICAgICAgcXVldWVMZW5ndGhUaHJlc2hvbGRzOiB7XG4gICAgICAgICAgbWVkaXVtOiAxMDAsXG4gICAgICAgICAgaGlnaDogMjAwLFxuICAgICAgICAgIGNyaXRpY2FsOiA0MDAsXG4gICAgICAgIH0sXG4gICAgICAgIHdhaXRUaW1lVGhyZXNob2xkczoge1xuICAgICAgICAgIG1lZGl1bTogMTAwMDAsXG4gICAgICAgICAgaGlnaDogMjAwMDAsXG4gICAgICAgICAgY3JpdGljYWw6IDYwMDAwLFxuICAgICAgICB9LFxuICAgICAgICBmYWlsdXJlUmF0ZVRocmVzaG9sZHM6IHtcbiAgICAgICAgICBtZWRpdW06IDMwLFxuICAgICAgICAgIGhpZ2g6IDUwLFxuICAgICAgICAgIGNyaXRpY2FsOiA3MCxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICByb2xlV2VpZ2h0czoge1xuICAgICAgICBwbGFubmVyOiB7XG4gICAgICAgICAgcHJpb3JpdHk6IDUsXG4gICAgICAgICAgY29uY3VycmVuY3lXZWlnaHQ6IDEuMCxcbiAgICAgICAgICBidWRnZXRXZWlnaHQ6IDEuMCxcbiAgICAgICAgICBhbGxvd0Zhbm91dDogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgcmVwb19yZWFkZXI6IHtcbiAgICAgICAgICBwcmlvcml0eTogNCxcbiAgICAgICAgICBjb25jdXJyZW5jeVdlaWdodDogMS4yLFxuICAgICAgICAgIGJ1ZGdldFdlaWdodDogMS4yLFxuICAgICAgICAgIGFsbG93RmFub3V0OiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBjb2RlX2ZpeGVyOiB7XG4gICAgICAgICAgcHJpb3JpdHk6IDYsXG4gICAgICAgICAgY29uY3VycmVuY3lXZWlnaHQ6IDEuNSxcbiAgICAgICAgICBidWRnZXRXZWlnaHQ6IDEuNSxcbiAgICAgICAgICBhbGxvd0Zhbm91dDogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgY29kZV9yZXZpZXdlcjoge1xuICAgICAgICAgIHByaW9yaXR5OiA1LFxuICAgICAgICAgIGNvbmN1cnJlbmN5V2VpZ2h0OiAxLjAsXG4gICAgICAgICAgYnVkZ2V0V2VpZ2h0OiAwLjgsXG4gICAgICAgICAgYWxsb3dGYW5vdXQ6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgICB2ZXJpZnlfYWdlbnQ6IHtcbiAgICAgICAgICBwcmlvcml0eTogNyxcbiAgICAgICAgICBjb25jdXJyZW5jeVdlaWdodDogMS4yLFxuICAgICAgICAgIGJ1ZGdldFdlaWdodDogMS4wLFxuICAgICAgICAgIGFsbG93RmFub3V0OiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgICAgcmVsZWFzZV9hZ2VudDoge1xuICAgICAgICAgIHByaW9yaXR5OiA4LFxuICAgICAgICAgIGNvbmN1cnJlbmN5V2VpZ2h0OiAwLjgsXG4gICAgICAgICAgYnVkZ2V0V2VpZ2h0OiAwLjUsXG4gICAgICAgICAgYWxsb3dGYW5vdXQ6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9O1xuICB9XG4gIFxuICAvKipcbiAgICog6aKE5Y+R546v5aKD6buY6K6k5YC8XG4gICAqL1xuICBwcml2YXRlIGdldFN0YWdpbmdEZWZhdWx0cygpOiBPbWl0PEdvdmVybmFuY2VQb2xpY3ksICduYW1lJyB8ICdkZXNjcmlwdGlvbicgfCAnZW52aXJvbm1lbnQnPiB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbmN1cnJlbmN5OiB7XG4gICAgICAgIG1heEdsb2JhbENvbmN1cnJlbmN5OiAxMCxcbiAgICAgICAgbWF4VGVhbUNvbmN1cnJlbmN5OiAzLFxuICAgICAgICBtYXhSb2xlQ29uY3VycmVuY3k6IHtcbiAgICAgICAgICBwbGFubmVyOiAyLFxuICAgICAgICAgIHJlcG9fcmVhZGVyOiAyLFxuICAgICAgICAgIGNvZGVfZml4ZXI6IDIsXG4gICAgICAgICAgY29kZV9yZXZpZXdlcjogMSxcbiAgICAgICAgICB2ZXJpZnlfYWdlbnQ6IDEsXG4gICAgICAgICAgcmVsZWFzZV9hZ2VudDogMSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBxdWV1ZToge1xuICAgICAgICBtYXhRdWV1ZVNpemU6IDEwMDAsXG4gICAgICAgIGRlZmF1bHRUaW1lb3V0TXM6IDMwMDAwMCxcbiAgICAgICAgZXhwaXJ5Q2hlY2tJbnRlcnZhbE1zOiAxMDAwMCxcbiAgICAgICAgcHJpb3JpdHlXZWlnaHQ6IDEsXG4gICAgICB9LFxuICAgICAgYnVkZ2V0OiB7XG4gICAgICAgIG1heEdsb2JhbENvbmN1cnJlbmN5OiAxMCxcbiAgICAgICAgbWF4VGVhbUNvbmN1cnJlbmN5OiAzLFxuICAgICAgICB0ZWFtVG9rZW5CdWRnZXQ6IHt9LFxuICAgICAgICByb2xlVG9rZW5CdWRnZXQ6IHtcbiAgICAgICAgICBwbGFubmVyOiA1MDAwMCxcbiAgICAgICAgICByZXBvX3JlYWRlcjogMTAwMDAwLFxuICAgICAgICAgIGNvZGVfZml4ZXI6IDE1MDAwMCxcbiAgICAgICAgICBjb2RlX3Jldmlld2VyOiA4MDAwMCxcbiAgICAgICAgICB2ZXJpZnlfYWdlbnQ6IDEwMDAwMCxcbiAgICAgICAgICByZWxlYXNlX2FnZW50OiA1MDAwMCxcbiAgICAgICAgfSxcbiAgICAgICAgdGVhbVRpbWVCdWRnZXRNczoge30sXG4gICAgICAgIG1heFJldHJpZXNQZXJUYXNrOiAyLFxuICAgICAgICBtYXhSZXRyaWVzUGVyVGVhbTogMTAsXG4gICAgICB9LFxuICAgICAgY2lyY3VpdEJyZWFrZXI6IHtcbiAgICAgICAgZmFpbHVyZVRocmVzaG9sZDogNTAsXG4gICAgICAgIHRpbWVvdXRUaHJlc2hvbGQ6IDMwLFxuICAgICAgICBtaW5DYWxsczogMTAsXG4gICAgICAgIG9wZW5EdXJhdGlvbk1zOiAzMDAwMCxcbiAgICAgICAgaGFsZk9wZW5NYXhDYWxsczogNSxcbiAgICAgICAgaGFsZk9wZW5TdWNjZXNzVGhyZXNob2xkOiAzLFxuICAgICAgfSxcbiAgICAgIGJhY2twcmVzc3VyZToge1xuICAgICAgICBjaGVja0ludGVydmFsTXM6IDEwMDAsXG4gICAgICAgIHF1ZXVlTGVuZ3RoVGhyZXNob2xkczoge1xuICAgICAgICAgIG1lZGl1bTogNTAsXG4gICAgICAgICAgaGlnaDogMTAwLFxuICAgICAgICAgIGNyaXRpY2FsOiAyMDAsXG4gICAgICAgIH0sXG4gICAgICAgIHdhaXRUaW1lVGhyZXNob2xkczoge1xuICAgICAgICAgIG1lZGl1bTogNTAwMCxcbiAgICAgICAgICBoaWdoOiAxMDAwMCxcbiAgICAgICAgICBjcml0aWNhbDogMzAwMDAsXG4gICAgICAgIH0sXG4gICAgICAgIGZhaWx1cmVSYXRlVGhyZXNob2xkczoge1xuICAgICAgICAgIG1lZGl1bTogMjAsXG4gICAgICAgICAgaGlnaDogNDAsXG4gICAgICAgICAgY3JpdGljYWw6IDYwLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHJvbGVXZWlnaHRzOiB7XG4gICAgICAgIHBsYW5uZXI6IHtcbiAgICAgICAgICBwcmlvcml0eTogNSxcbiAgICAgICAgICBjb25jdXJyZW5jeVdlaWdodDogMS4wLFxuICAgICAgICAgIGJ1ZGdldFdlaWdodDogMS4wLFxuICAgICAgICAgIGFsbG93RmFub3V0OiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICByZXBvX3JlYWRlcjoge1xuICAgICAgICAgIHByaW9yaXR5OiA0LFxuICAgICAgICAgIGNvbmN1cnJlbmN5V2VpZ2h0OiAxLjAsXG4gICAgICAgICAgYnVkZ2V0V2VpZ2h0OiAxLjAsXG4gICAgICAgICAgYWxsb3dGYW5vdXQ6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIGNvZGVfZml4ZXI6IHtcbiAgICAgICAgICBwcmlvcml0eTogNixcbiAgICAgICAgICBjb25jdXJyZW5jeVdlaWdodDogMS4yLFxuICAgICAgICAgIGJ1ZGdldFdlaWdodDogMS4yLFxuICAgICAgICAgIGFsbG93RmFub3V0OiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBjb2RlX3Jldmlld2VyOiB7XG4gICAgICAgICAgcHJpb3JpdHk6IDUsXG4gICAgICAgICAgY29uY3VycmVuY3lXZWlnaHQ6IDEuMCxcbiAgICAgICAgICBidWRnZXRXZWlnaHQ6IDAuOCxcbiAgICAgICAgICBhbGxvd0Zhbm91dDogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICAgIHZlcmlmeV9hZ2VudDoge1xuICAgICAgICAgIHByaW9yaXR5OiA3LFxuICAgICAgICAgIGNvbmN1cnJlbmN5V2VpZ2h0OiAxLjAsXG4gICAgICAgICAgYnVkZ2V0V2VpZ2h0OiAxLjAsXG4gICAgICAgICAgYWxsb3dGYW5vdXQ6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgICByZWxlYXNlX2FnZW50OiB7XG4gICAgICAgICAgcHJpb3JpdHk6IDgsXG4gICAgICAgICAgY29uY3VycmVuY3lXZWlnaHQ6IDAuOCxcbiAgICAgICAgICBidWRnZXRXZWlnaHQ6IDAuNSxcbiAgICAgICAgICBhbGxvd0Zhbm91dDogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnlJ/kuqfnjq/looPpu5jorqTlgLxcbiAgICovXG4gIHByaXZhdGUgZ2V0UHJvZHVjdGlvbkRlZmF1bHRzKCk6IE9taXQ8R292ZXJuYW5jZVBvbGljeSwgJ25hbWUnIHwgJ2Rlc2NyaXB0aW9uJyB8ICdlbnZpcm9ubWVudCc+IHtcbiAgICByZXR1cm4ge1xuICAgICAgY29uY3VycmVuY3k6IHtcbiAgICAgICAgbWF4R2xvYmFsQ29uY3VycmVuY3k6IDYsXG4gICAgICAgIG1heFRlYW1Db25jdXJyZW5jeTogMixcbiAgICAgICAgbWF4Um9sZUNvbmN1cnJlbmN5OiB7XG4gICAgICAgICAgcGxhbm5lcjogMSxcbiAgICAgICAgICByZXBvX3JlYWRlcjogMSxcbiAgICAgICAgICBjb2RlX2ZpeGVyOiAxLFxuICAgICAgICAgIGNvZGVfcmV2aWV3ZXI6IDEsXG4gICAgICAgICAgdmVyaWZ5X2FnZW50OiAxLFxuICAgICAgICAgIHJlbGVhc2VfYWdlbnQ6IDEsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgcXVldWU6IHtcbiAgICAgICAgbWF4UXVldWVTaXplOiA1MDAsXG4gICAgICAgIGRlZmF1bHRUaW1lb3V0TXM6IDE4MDAwMCxcbiAgICAgICAgZXhwaXJ5Q2hlY2tJbnRlcnZhbE1zOiA1MDAwLFxuICAgICAgICBwcmlvcml0eVdlaWdodDogMSxcbiAgICAgIH0sXG4gICAgICBidWRnZXQ6IHtcbiAgICAgICAgbWF4R2xvYmFsQ29uY3VycmVuY3k6IDYsXG4gICAgICAgIG1heFRlYW1Db25jdXJyZW5jeTogMixcbiAgICAgICAgdGVhbVRva2VuQnVkZ2V0OiB7fSxcbiAgICAgICAgcm9sZVRva2VuQnVkZ2V0OiB7XG4gICAgICAgICAgcGxhbm5lcjogMzAwMDAsXG4gICAgICAgICAgcmVwb19yZWFkZXI6IDUwMDAwLFxuICAgICAgICAgIGNvZGVfZml4ZXI6IDgwMDAwLFxuICAgICAgICAgIGNvZGVfcmV2aWV3ZXI6IDQwMDAwLFxuICAgICAgICAgIHZlcmlmeV9hZ2VudDogNTAwMDAsXG4gICAgICAgICAgcmVsZWFzZV9hZ2VudDogMzAwMDAsXG4gICAgICAgIH0sXG4gICAgICAgIHRlYW1UaW1lQnVkZ2V0TXM6IHt9LFxuICAgICAgICBtYXhSZXRyaWVzUGVyVGFzazogMSxcbiAgICAgICAgbWF4UmV0cmllc1BlclRlYW06IDUsXG4gICAgICB9LFxuICAgICAgY2lyY3VpdEJyZWFrZXI6IHtcbiAgICAgICAgZmFpbHVyZVRocmVzaG9sZDogNDAsXG4gICAgICAgIHRpbWVvdXRUaHJlc2hvbGQ6IDIwLFxuICAgICAgICBtaW5DYWxsczogMTUsXG4gICAgICAgIG9wZW5EdXJhdGlvbk1zOiA2MDAwMCxcbiAgICAgICAgaGFsZk9wZW5NYXhDYWxsczogMyxcbiAgICAgICAgaGFsZk9wZW5TdWNjZXNzVGhyZXNob2xkOiAzLFxuICAgICAgfSxcbiAgICAgIGJhY2twcmVzc3VyZToge1xuICAgICAgICBjaGVja0ludGVydmFsTXM6IDUwMCxcbiAgICAgICAgcXVldWVMZW5ndGhUaHJlc2hvbGRzOiB7XG4gICAgICAgICAgbWVkaXVtOiAzMCxcbiAgICAgICAgICBoaWdoOiA2MCxcbiAgICAgICAgICBjcml0aWNhbDogMTAwLFxuICAgICAgICB9LFxuICAgICAgICB3YWl0VGltZVRocmVzaG9sZHM6IHtcbiAgICAgICAgICBtZWRpdW06IDMwMDAsXG4gICAgICAgICAgaGlnaDogNjAwMCxcbiAgICAgICAgICBjcml0aWNhbDogMTUwMDAsXG4gICAgICAgIH0sXG4gICAgICAgIGZhaWx1cmVSYXRlVGhyZXNob2xkczoge1xuICAgICAgICAgIG1lZGl1bTogMTUsXG4gICAgICAgICAgaGlnaDogMzAsXG4gICAgICAgICAgY3JpdGljYWw6IDUwLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHJvbGVXZWlnaHRzOiB7XG4gICAgICAgIHBsYW5uZXI6IHtcbiAgICAgICAgICBwcmlvcml0eTogNSxcbiAgICAgICAgICBjb25jdXJyZW5jeVdlaWdodDogMS4wLFxuICAgICAgICAgIGJ1ZGdldFdlaWdodDogMS4wLFxuICAgICAgICAgIGFsbG93RmFub3V0OiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgICAgcmVwb19yZWFkZXI6IHtcbiAgICAgICAgICBwcmlvcml0eTogNCxcbiAgICAgICAgICBjb25jdXJyZW5jeVdlaWdodDogMS4wLFxuICAgICAgICAgIGJ1ZGdldFdlaWdodDogMS4wLFxuICAgICAgICAgIGFsbG93RmFub3V0OiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgICAgY29kZV9maXhlcjoge1xuICAgICAgICAgIHByaW9yaXR5OiA2LFxuICAgICAgICAgIGNvbmN1cnJlbmN5V2VpZ2h0OiAxLjAsXG4gICAgICAgICAgYnVkZ2V0V2VpZ2h0OiAxLjAsXG4gICAgICAgICAgYWxsb3dGYW5vdXQ6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgICBjb2RlX3Jldmlld2VyOiB7XG4gICAgICAgICAgcHJpb3JpdHk6IDUsXG4gICAgICAgICAgY29uY3VycmVuY3lXZWlnaHQ6IDEuMCxcbiAgICAgICAgICBidWRnZXRXZWlnaHQ6IDAuOCxcbiAgICAgICAgICBhbGxvd0Zhbm91dDogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICAgIHZlcmlmeV9hZ2VudDoge1xuICAgICAgICAgIHByaW9yaXR5OiA3LFxuICAgICAgICAgIGNvbmN1cnJlbmN5V2VpZ2h0OiAxLjAsXG4gICAgICAgICAgYnVkZ2V0V2VpZ2h0OiAxLjAsXG4gICAgICAgICAgYWxsb3dGYW5vdXQ6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgICByZWxlYXNlX2FnZW50OiB7XG4gICAgICAgICAgcHJpb3JpdHk6IDksXG4gICAgICAgICAgY29uY3VycmVuY3lXZWlnaHQ6IDAuNSxcbiAgICAgICAgICBidWRnZXRXZWlnaHQ6IDAuNSxcbiAgICAgICAgICBhbGxvd0Zhbm91dDogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH07XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5L6/5o235Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5Yib5bu65rK755CG562W55Wl566h55CG5ZmoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVHb3Zlcm5hbmNlUG9saWN5TWFuYWdlcihcbiAgY29uZmlnPzogR292ZXJuYW5jZVBvbGljeUNvbmZpZ1xuKTogR292ZXJuYW5jZVBvbGljeU1hbmFnZXIge1xuICByZXR1cm4gbmV3IEdvdmVybmFuY2VQb2xpY3lNYW5hZ2VyKGNvbmZpZyk7XG59XG5cbi8qKlxuICog6I635Y+W5byA5Y+R546v5aKD562W55WlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXREZXZlbG9wbWVudFBvbGljeSgpOiBHb3Zlcm5hbmNlUG9saWN5IHtcbiAgY29uc3QgbWFuYWdlciA9IG5ldyBHb3Zlcm5hbmNlUG9saWN5TWFuYWdlcih7IGVudmlyb25tZW50OiAnZGV2ZWxvcG1lbnQnIH0pO1xuICByZXR1cm4gbWFuYWdlci5nZXRQb2xpY3koKTtcbn1cblxuLyoqXG4gKiDojrflj5bpooTlj5Hnjq/looPnrZbnlaVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFN0YWdpbmdQb2xpY3koKTogR292ZXJuYW5jZVBvbGljeSB7XG4gIGNvbnN0IG1hbmFnZXIgPSBuZXcgR292ZXJuYW5jZVBvbGljeU1hbmFnZXIoeyBlbnZpcm9ubWVudDogJ3N0YWdpbmcnIH0pO1xuICByZXR1cm4gbWFuYWdlci5nZXRQb2xpY3koKTtcbn1cblxuLyoqXG4gKiDojrflj5bnlJ/kuqfnjq/looPnrZbnlaVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFByb2R1Y3Rpb25Qb2xpY3koKTogR292ZXJuYW5jZVBvbGljeSB7XG4gIGNvbnN0IG1hbmFnZXIgPSBuZXcgR292ZXJuYW5jZVBvbGljeU1hbmFnZXIoeyBlbnZpcm9ubWVudDogJ3Byb2R1Y3Rpb24nIH0pO1xuICByZXR1cm4gbWFuYWdlci5nZXRQb2xpY3koKTtcbn1cbiJdfQ==