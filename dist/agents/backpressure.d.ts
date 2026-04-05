/**
 * Backpressure - 背压策略
 *
 * 职责：
 * 1. 系统压力检测
 * 2. 降低并发上限
 * 3. 降低 fan-out 宽度
 * 4. 禁止低优先级角色入场
 * 5. 缩短 maxTurns
 * 6. 关闭 aggressive retry
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
/**
 * 压力级别
 */
export type PressureLevel = 'low' | 'medium' | 'high' | 'critical';
/**
 * 压力指标
 */
export interface PressureMetrics {
    queueLength: number;
    avgWaitTimeMs: number;
    currentConcurrency: number;
    maxConcurrency: number;
    concurrencyUtilization: number;
    failureRate: number;
    timeoutRate: number;
    availableMemory?: number;
    availableCpu?: number;
}
/**
 * 背压配置
 */
export interface BackpressureConfig {
    /** 压力检查间隔（毫秒） */
    checkIntervalMs?: number;
    /** 队列长度阈值 */
    queueLengthThresholds?: {
        medium: number;
        high: number;
        critical: number;
    };
    /** 等待时间阈值（毫秒） */
    waitTimeThresholds?: {
        medium: number;
        high: number;
        critical: number;
    };
    /** 失败率阈值（百分比） */
    failureRateThresholds?: {
        medium: number;
        high: number;
        critical: number;
    };
}
/**
 * 背压动作
 */
export interface BackpressureAction {
    /** 动作类型 */
    type: 'reduce_concurrency' | 'reduce_fanout' | 'block_low_priority' | 'shorten_turns' | 'disable_retry' | 'shed_load';
    /** 动作参数 */
    params: Record<string, number | boolean | string>;
    /** 原因 */
    reason: string;
    /** 压力级别 */
    pressureLevel: PressureLevel;
}
/**
 * 背压状态
 */
export interface BackpressureState {
    pressureLevel: PressureLevel;
    activeActions: BackpressureAction[];
    metrics: PressureMetrics;
    lastCheckAt: number;
    pressureSince?: number;
}
export declare class BackpressureController {
    private config;
    private state;
    private actionHistory;
    private listeners;
    constructor(config?: BackpressureConfig);
    /**
     * 检查压力
     */
    checkPressure(metrics: PressureMetrics): BackpressureState;
    /**
     * 获取当前状态
     */
    getState(): BackpressureState;
    /**
     * 获取当前压力级别
     */
    getPressureLevel(): PressureLevel;
    /**
     * 获取当前动作
     */
    getActiveActions(): BackpressureAction[];
    /**
     * 添加监听器
     */
    onStateChange(listener: (state: BackpressureState) => void): void;
    /**
     * 移除监听器
     */
    offStateChange(listener: (state: BackpressureState) => void): void;
    /**
     * 获取动作历史
     */
    getActionHistory(): BackpressureAction[];
    /**
     * 重置状态
     */
    reset(): void;
    /**
     * 计算压力级别
     */
    private calculatePressureLevel;
    /**
     * 生成背压动作
     */
    private generateActions;
    /**
     * 通知监听器
     */
    private notifyListeners;
}
/**
 * 创建背压控制器
 */
export declare function createBackpressureController(config?: BackpressureConfig): BackpressureController;
/**
 * 默认背压配置
 */
export declare const DEFAULT_BACKPRESSURE_CONFIG: BackpressureConfig;
