/**
 * Event Repository
 * Phase 2E-1 - 事件持久化存储
 *
 * 职责：
 * - Trading 事件存储/加载
 * - 事件查询
 * - 事件统计
 */
export type TradingEventType = 'release_requested' | 'deployment_pending' | 'deployment_failed' | 'system_alert' | 'risk_breach' | 'execution_anomaly';
export type TradingSeverity = 'low' | 'medium' | 'high' | 'critical';
export interface TradingEventRecord {
    eventId: string;
    type: TradingEventType;
    severity: TradingSeverity;
    source: {
        system: string;
        component: string;
        environment: string;
    };
    actor: {
        userId: string;
        username: string;
    };
    metadata: Record<string, any>;
    timestamp: number;
    processed: boolean;
    processedAt?: number;
    result?: {
        approvalCreated?: boolean;
        incidentCreated?: boolean;
        autoApproved?: boolean;
        ignored?: boolean;
    };
}
export interface EventQuery {
    type?: TradingEventType;
    severity?: TradingSeverity;
    source?: string;
    startTime?: number;
    endTime?: number;
    processed?: boolean;
    limit?: number;
    offset?: number;
}
export declare class EventRepository {
    private repository;
    constructor(dataDir: string);
    /**
     * 存储事件
     */
    store(event: Omit<TradingEventRecord, 'processed'>): Promise<TradingEventRecord>;
    /**
     * 标记事件已处理
     */
    markProcessed(eventId: string, result?: TradingEventRecord['result']): Promise<TradingEventRecord | null>;
    /**
     * 获取事件
     */
    getById(eventId: string): Promise<TradingEventRecord | null>;
    /**
     * 查询事件
     */
    query(query: EventQuery): Promise<{
        total: number;
        events: TradingEventRecord[];
    }>;
    /**
     * 获取未处理事件
     */
    getUnprocessed(limit?: number): Promise<TradingEventRecord[]>;
    /**
     * 获取最近事件
     */
    getRecent(hours?: number, limit?: number): Promise<TradingEventRecord[]>;
    /**
     * 获取事件统计
     */
    getStats(timeRangeMs?: number): Promise<{
        total: number;
        byType: Map<string, number>;
        bySeverity: Map<string, number>;
        bySource: Map<string, number>;
        processed: number;
        unprocessed: number;
    }>;
    /**
     * 删除事件
     */
    delete(eventId: string): Promise<void>;
    /**
     * 清理旧事件
     */
    cleanup(maxAgeDays?: number): Promise<number>;
}
export declare function createEventRepository(dataDir: string): EventRepository;
