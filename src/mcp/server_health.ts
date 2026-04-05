/**
 * Server Health - Server 健康检查
 * 
 * 职责：
 * 1. 跟踪 server health
 * 2. 标记 available / degraded / unavailable
 * 3. 给 orchestrator / planner / release_agent 提供 admission 信息
 * 4. 与并发治理、backpressure、熔断衔接
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  McpServerHealthStatus,
  McpServerHealthReport,
  McpHealthSnapshot,
} from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 健康检查配置
 */
export interface ServerHealthConfig {
  /** 健康检查间隔（毫秒） */
  checkIntervalMs?: number;
  
  /** 降级阈值（错误率） */
  degradedThreshold?: number;
  
  /** 不可用阈值（错误率） */
  unavailableThreshold?: number;
  
  /** 健康窗口大小 */
  healthWindowSize?: number;
}

/**
 * 健康记录
 */
interface HealthRecord {
  timestamp: number;
  success: boolean;
  responseTimeMs?: number;
  error?: string;
}

// ============================================================================
// Server 健康管理器
// ============================================================================

export class ServerHealthManager {
  private config: Required<ServerHealthConfig>;
  
  // 健康记录：serverId → records
  private healthRecords: Map<string, HealthRecord[]> = new Map();
  
  // 当前状态：serverId → status
  private currentStatus: Map<string, McpServerHealthStatus> = new Map();
  
  // 最后报告：serverId → report
  private lastReports: Map<string, McpServerHealthReport> = new Map();
  
  constructor(config: ServerHealthConfig = {}) {
    this.config = {
      checkIntervalMs: config.checkIntervalMs ?? 30000, // 30 秒
      degradedThreshold: config.degradedThreshold ?? 0.2, // 20% 错误率
      unavailableThreshold: config.unavailableThreshold ?? 0.5, // 50% 错误率
      healthWindowSize: config.healthWindowSize ?? 10, // 10 个样本
    };
  }
  
  /**
   * 报告 Server 健康状态
   */
  reportServerHealth(
    serverId: string,
    status: McpServerHealthStatus,
    details?: {
      lastCheckAt?: number;
      error?: string;
      responseTimeMs?: number;
      successRate?: number;
    }
  ): void {
    const report: McpServerHealthReport = {
      serverId,
      status,
      details,
      reportedAt: Date.now(),
    };
    
    this.lastReports.set(serverId, report);
    this.currentStatus.set(serverId, status);
  }
  
  /**
   * 记录健康检查
   */
  recordHealthCheck(
    serverId: string,
    success: boolean,
    responseTimeMs?: number,
    error?: string
  ): void {
    const record: HealthRecord = {
      timestamp: Date.now(),
      success,
      responseTimeMs,
      error,
    };
    
    // 获取或创建记录列表
    let records = this.healthRecords.get(serverId);
    if (!records) {
      records = [];
      this.healthRecords.set(serverId, records);
    }
    
    // 添加记录
    records.push(record);
    
    // 限制窗口大小
    if (records.length > this.config.healthWindowSize) {
      records.shift();
    }
    
    // 更新状态
    this.updateServerStatus(serverId);
  }
  
  /**
   * 获取 Server 健康状态
   */
  getServerHealth(serverId: string): McpServerHealthReport | null {
    return this.lastReports.get(serverId) || null;
  }
  
  /**
   * 检查 Server 是否可用
   */
  isServerUsable(
    serverId: string,
    requirementLevel?: 'required' | 'optional'
  ): boolean {
    const status = this.currentStatus.get(serverId) || 'unknown';
    
    switch (status) {
      case 'healthy':
        return true;
        
      case 'degraded':
        // required server 在降级时仍可用，但应该降低优先级
        return true;
        
      case 'unavailable':
        // required server 不可用时返回 false
        // optional server 不可用时返回 true（但功能受限）
        return requirementLevel !== 'required';
        
      case 'unknown':
        // 未知状态默认允许
        return true;
        
      default:
        return false;
    }
  }
  
  /**
   * 构建健康摘要
   */
  buildHealthSummary(serverIds: string[]): McpHealthSnapshot {
    const servers: Record<string, McpServerHealthReport> = {};
    let healthyCount = 0;
    let degradedCount = 0;
    let unavailableCount = 0;
    
    for (const serverId of serverIds) {
      const report = this.getServerHealth(serverId);
      
      if (report) {
        servers[serverId] = report;
        
        switch (report.status) {
          case 'healthy':
            healthyCount++;
            break;
          case 'degraded':
            degradedCount++;
            break;
          case 'unavailable':
            unavailableCount++;
            break;
        }
      } else {
        // 无报告视为 unknown
        servers[serverId] = {
          serverId,
          status: 'unknown',
          reportedAt: Date.now(),
        };
      }
    }
    
    return {
      servers,
      healthyCount,
      degradedCount,
      unavailableCount,
      snapshotAt: Date.now(),
    };
  }
  
  /**
   * 获取所有 Server 状态
   */
  getAllServerStatus(): Record<string, McpServerHealthStatus> {
    return Object.fromEntries(this.currentStatus.entries());
  }
  
  /**
   * 清除 Server 健康记录
   */
  clearServerHealth(serverId: string): void {
    this.healthRecords.delete(serverId);
    this.currentStatus.delete(serverId);
    this.lastReports.delete(serverId);
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 更新 Server 状态
   */
  private updateServerStatus(serverId: string): void {
    const records = this.healthRecords.get(serverId);
    
    if (!records || records.length === 0) {
      this.currentStatus.set(serverId, 'unknown');
      return;
    }
    
    // 计算错误率
    const failures = records.filter(r => !r.success).length;
    const errorRate = failures / records.length;
    
    // 确定状态
    let status: McpServerHealthStatus;
    
    if (errorRate >= this.config.unavailableThreshold) {
      status = 'unavailable';
    } else if (errorRate >= this.config.degradedThreshold) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }
    
    this.currentStatus.set(serverId, status);
    
    // 更新报告
    const lastRecord = records[records.length - 1];
    this.lastReports.set(serverId, {
      serverId,
      status,
      details: {
        lastCheckAt: lastRecord.timestamp,
        error: lastRecord.error,
        responseTimeMs: lastRecord.responseTimeMs,
        successRate: 1 - errorRate,
      },
      reportedAt: Date.now(),
    });
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建 Server 健康管理器
 */
export function createServerHealthManager(config?: ServerHealthConfig): ServerHealthManager {
  return new ServerHealthManager(config);
}
