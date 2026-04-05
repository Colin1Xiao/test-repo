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
export interface WorkspaceRegistryConfig {
    /** 默认 Workspace ID */
    defaultWorkspaceId?: string;
}
export declare class InMemoryWorkspaceRegistry implements WorkspaceRegistry {
    private config;
    private workspaces;
    constructor(config?: WorkspaceRegistryConfig);
    registerWorkspace(workspace: WorkspaceDescriptor): Promise<void>;
    getWorkspace(workspaceId: string): Promise<WorkspaceDescriptor | null>;
    listWorkspaces(): Promise<WorkspaceDescriptor[]>;
    getDefaultWorkspace(): Promise<WorkspaceDescriptor | null>;
    private registerDefaultWorkspaces;
    /**
     * 清除所有 Workspaces
     */
    clear(): void;
    /**
     * 获取 Workspaces 数量
     */
    size(): number;
}
export declare function createWorkspaceRegistry(config?: WorkspaceRegistryConfig): WorkspaceRegistry;
