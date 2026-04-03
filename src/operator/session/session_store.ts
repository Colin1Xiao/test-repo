/**
 * Session Store
 * Phase 2A-2A - 会话存储
 * 
 * 职责：
 * - 创建 Session
 * - 读取 Session
 * - 更新 Session
 * - 更新 Navigation State
 * - 关闭 Session
 */

import type {
  OperatorSession,
  OperatorSessionStatus,
  CreateSessionInput,
  UpdateNavigationInput,
  SessionStore,
} from '../types/session_types';

// ============================================================================
// 配置
// ============================================================================

export interface SessionStoreConfig {
  /** Session 过期时间（毫秒，默认 24 小时） */
  sessionTtlMs?: number;
  
  /** 自动清理过期 Session 间隔（毫秒） */
  cleanupIntervalMs?: number;
}

// ============================================================================
// 内存实现
// ============================================================================

export class InMemorySessionStore implements SessionStore {
  private config: Required<SessionStoreConfig>;
  private sessions: Map<string, OperatorSession> = new Map();
  private cleanupTimer?: NodeJS.Timeout;
  
  constructor(config: SessionStoreConfig = {}) {
    this.config = {
      sessionTtlMs: config.sessionTtlMs ?? 24 * 60 * 60 * 1000, // 24 小时
      cleanupIntervalMs: config.cleanupIntervalMs ?? 60 * 60 * 1000, // 1 小时
    };
    
    // 启动自动清理
    this.startCleanup();
  }
  
  async createSession(input: CreateSessionInput): Promise<OperatorSession> {
    const now = Date.now();
    
    const session: OperatorSession = {
      sessionId: input.sessionId ?? this.generateSessionId(input.surface),
      actorId: input.actorId,
      surface: input.surface,
      workspaceId: input.workspaceId,
      status: 'active',
      navigationState: {
        currentView: 'dashboard',
        lastCommandAt: now,
      },
      createdAt: now,
      updatedAt: now,
    };
    
    this.sessions.set(session.sessionId, session);
    
    return session;
  }
  
  async getSession(sessionId: string): Promise<OperatorSession | null> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }
    
    // 检查是否过期
    if (this.isExpired(session)) {
      await this.closeSession(sessionId);
      return null;
    }
    
    return session;
  }
  
  async saveSession(session: OperatorSession): Promise<void> {
    session.updatedAt = Date.now();
    this.sessions.set(session.sessionId, session);
  }
  
  async updateNavigationState(
    sessionId: string,
    navigationState: UpdateNavigationInput
  ): Promise<OperatorSession | null> {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      return null;
    }
    
    // 合并 navigation state
    session.navigationState = {
      ...session.navigationState,
      ...navigationState,
      lastCommandAt: Date.now(),
    };
    
    session.updatedAt = Date.now();
    this.sessions.set(sessionId, session);
    
    return session;
  }
  
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (session) {
      session.status = 'closed';
      session.updatedAt = Date.now();
      this.sessions.set(sessionId, session);
    }
    
    this.sessions.delete(sessionId);
  }
  
  async listActiveSessions(surface?: string): Promise<OperatorSession[]> {
    const now = Date.now();
    
    return Array.from(this.sessions.values())
      .filter(session => {
        // 状态检查
        if (session.status !== 'active') return false;
        
        // 过期检查
        if (now - session.updatedAt > this.config.sessionTtlMs) return false;
        
        // Surface 过滤
        if (surface && session.surface !== surface) return false;
        
        return true;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  private generateSessionId(surface: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `${surface}_${timestamp}_${random}`;
  }
  
  private isExpired(session: OperatorSession): boolean {
    const now = Date.now();
    return now - session.updatedAt > this.config.sessionTtlMs;
  }
  
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);
    
    // Node.js 退出时清理 timer
    if (typeof process !== 'undefined') {
      process.on('exit', () => this.stopCleanup());
    }
  }
  
  private cleanup(): void {
    const now = Date.now();
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.updatedAt > this.config.sessionTtlMs) {
        this.sessions.delete(sessionId);
      }
    }
  }
  
  private stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }
  
  // ============================================================================
  // 测试辅助方法
  // ============================================================================
  
  /**
   * 清除所有 Sessions
   */
  clear(): void {
    this.sessions.clear();
  }
  
  /**
   * 获取 Sessions 数量
   */
  size(): number {
    return this.sessions.size;
  }
  
  /**
   * 停止自动清理（用于测试）
   */
  stopAutoCleanup(): void {
    this.stopCleanup();
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createSessionStore(config?: SessionStoreConfig): SessionStore {
  return new InMemorySessionStore(config);
}
