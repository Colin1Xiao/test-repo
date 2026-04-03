/**
 * Workspace Registry
 * Phase 2A-2A - Workspace 注册表
 * 
 * 职责：
 * - 管理可用 Workspace
 * - 提供默认 Workspace
 * - 支持查询 / 枚举
 */

import type { WorkspaceDescriptor, WorkspaceRegistry } from '../types/session_types';

// ============================================================================
// 配置
// ============================================================================

export interface WorkspaceRegistryConfig {
  /** 默认 Workspace ID */
  defaultWorkspaceId?: string;
}

// ============================================================================
// 内存实现
// ============================================================================

export class InMemoryWorkspaceRegistry implements WorkspaceRegistry {
  private config: Required<WorkspaceRegistryConfig>;
  private workspaces: Map<string, WorkspaceDescriptor> = new Map();
  
  constructor(config: WorkspaceRegistryConfig = {}) {
    this.config = {
      defaultWorkspaceId: config.defaultWorkspaceId ?? 'local-default',
    };
    
    // 注册默认 Workspaces
    this.registerDefaultWorkspaces();
  }
  
  async registerWorkspace(workspace: WorkspaceDescriptor): Promise<void> {
    this.workspaces.set(workspace.workspaceId, workspace);
  }
  
  async getWorkspace(workspaceId: string): Promise<WorkspaceDescriptor | null> {
    return this.workspaces.get(workspaceId) || null;
  }
  
  async listWorkspaces(): Promise<WorkspaceDescriptor[]> {
    return Array.from(this.workspaces.values())
      .sort((a, b) => {
        // 默认 Workspace 排前面
        if (a.isDefault) return -1;
        if (b.isDefault) return 1;
        
        // 按名称排序
        return a.name.localeCompare(b.name);
      });
  }
  
  async getDefaultWorkspace(): Promise<WorkspaceDescriptor | null> {
    // 优先返回标记为默认的
    const defaultWorkspace = Array.from(this.workspaces.values())
      .find(w => w.isDefault);
    
    if (defaultWorkspace) {
      return defaultWorkspace;
    }
    
    // 其次返回配置的默认 ID
    const configuredDefault = this.workspaces.get(this.config.defaultWorkspaceId);
    if (configuredDefault) {
      return configuredDefault;
    }
    
    // 最后返回第一个
    const workspaces = Array.from(this.workspaces.values());
    return workspaces.length > 0 ? workspaces[0] : null;
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  private registerDefaultWorkspaces(): void {
    // 本地默认 Workspace
    this.workspaces.set('local-default', {
      workspaceId: 'local-default',
      name: '本地默认',
      description: '本地开发环境默认 Workspace',
      environment: 'local',
      isDefault: true,
      metadata: {
        createdAt: Date.now(),
      },
    });
    
    // 演示 Workspace
    this.workspaces.set('demo-default', {
      workspaceId: 'demo-default',
      name: '演示环境',
      description: '演示/测试环境 Workspace',
      environment: 'demo',
      metadata: {
        createdAt: Date.now(),
      },
    });
    
    // 生产环境 Workspace（可选）
    this.workspaces.set('production', {
      workspaceId: 'production',
      name: '生产环境',
      description: '生产环境 Workspace',
      environment: 'production',
      metadata: {
        createdAt: Date.now(),
      },
    });
  }
  
  // ============================================================================
  // 测试辅助方法
  // ============================================================================
  
  /**
   * 清除所有 Workspaces
   */
  clear(): void {
    this.workspaces.clear();
    this.registerDefaultWorkspaces();
  }
  
  /**
   * 获取 Workspaces 数量
   */
  size(): number {
    return this.workspaces.size;
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createWorkspaceRegistry(config?: WorkspaceRegistryConfig): WorkspaceRegistry {
  return new InMemoryWorkspaceRegistry(config);
}
