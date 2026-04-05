/**
 * PR Task Mapper
 * Phase 2B-1 - PR 任务映射器
 *
 * 职责：
 * - 将 PR 事件映射到 Operator Task
 * - 支持 PR opened → task
 * - 支持 PR check failed → blocked task
 * - 支持 PR merged → completed task
 */
import type { GitHubPREvent, MappedTask } from './github_types';
export interface PRTaskMapperConfig {
    /** 默认优先级 */
    defaultPriority?: 'low' | 'medium' | 'high' | 'critical';
    /** 按 Label 调整优先级 */
    priorityByLabel?: Record<string, 'low' | 'medium' | 'high' | 'critical'>;
    /** 自动标记 Blocked 任务 */
    autoMarkBlocked?: boolean;
}
export declare class PRTaskMapper {
    private config;
    constructor(config?: PRTaskMapperConfig);
    /**
     * 映射 PR 到 Task
     */
    mapPRToTask(event: GitHubPREvent): MappedTask;
    /**
     * 映射 PR 状态变化
     */
    mapPRStateChange(event: GitHubPREvent, existingTask: MappedTask): Partial<MappedTask>;
    private calculatePriority;
    private buildDescription;
}
export declare function createPRTaskMapper(config?: PRTaskMapperConfig): PRTaskMapper;
