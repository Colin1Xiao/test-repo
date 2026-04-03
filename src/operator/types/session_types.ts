/**
 * Session Types
 * Phase 2A-2A - 会话与 Workspace 核心类型
 */

// ============================================================================
// 基础类型
// ============================================================================

/**
 * Session 状态
 */
export type OperatorSessionStatus = "active" | "idle" | "closed";

/**
 * Surface 类型
 */
export type OperatorSurface = "cli" | "telegram" | "web";

/**
 * Workspace 环境
 */
export type WorkspaceEnvironment = "local" | "demo" | "staging" | "production";

// ============================================================================
// Navigation State
// ============================================================================

/**
 * 导航状态
 */
export interface OperatorNavigationState {
  /** 当前视图 */
  currentView: string;
  
  /** 选中项 ID */
  selectedItemId?: string;
  
  /** 选中目标类型 */
  selectedTargetType?: string;
  
  /** 上一个视图 */
  previousView?: string;
  
  /** 视图模式 */
  mode?: string;
  
  /** 过滤器 */
  filter?: Record<string, unknown>;
  
  /** 排序 */
  sort?: string;
  
  /** 页码 */
  page?: number;
  
  /** 每页数量 */
  pageSize?: number;
  
  /** 最后命令时间 */
  lastCommandAt?: number;
}

// ============================================================================
// Operator Session
// ============================================================================

/**
 * Operator 会话
 */
export interface OperatorSession {
  /** Session ID */
  sessionId: string;
  
  /** Actor ID (用户/机器人 ID) */
  actorId?: string;
  
  /** Surface 类型 */
  surface: OperatorSurface;
  
  /** Workspace ID */
  workspaceId?: string;
  
  /** Session 状态 */
  status: OperatorSessionStatus;
  
  /** 导航状态 */
  navigationState: OperatorNavigationState;
  
  /** 创建时间 */
  createdAt: number;
  
  /** 更新时间 */
  updatedAt: number;
  
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Session 操作输入
// ============================================================================

/**
 * 创建 Session 输入
 */
export interface CreateSessionInput {
  /** Actor ID */
  actorId?: string;
  
  /** Surface 类型 */
  surface: OperatorSurface;
  
  /** Workspace ID */
  workspaceId?: string;
  
  /** Session ID (可选，用于恢复) */
  sessionId?: string;
}

/**
 * 更新 Navigation State 输入
 */
export interface UpdateNavigationInput {
  /** 当前视图 */
  currentView?: string;
  
  /** 选中项 ID */
  selectedItemId?: string;
  
  /** 选中目标类型 */
  selectedTargetType?: string;
  
  /** 上一个视图 */
  previousView?: string;
  
  /** 视图模式 */
  mode?: string;
  
  /** 过滤器 */
  filter?: Record<string, unknown>;
  
  /** 排序 */
  sort?: string;
  
  /** 页码 */
  page?: number;
  
  /** 每页数量 */
  pageSize?: number;
}

// ============================================================================
// Workspace
// ============================================================================

/**
 * Workspace 描述
 */
export interface WorkspaceDescriptor {
  /** Workspace ID */
  workspaceId: string;
  
  /** Workspace 名称 */
  name: string;
  
  /** Workspace 描述 */
  description?: string;
  
  /** 环境 */
  environment?: WorkspaceEnvironment;
  
  /** 是否默认 */
  isDefault?: boolean;
  
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * Workspace 切换结果
 */
export interface WorkspaceSwitchResult {
  /** 切换后的 Session */
  session: OperatorSession;
  
  /** 之前的 Workspace ID */
  previousWorkspaceId?: string;
  
  /** 当前 Workspace ID */
  currentWorkspaceId?: string;
  
  /** 是否实际切换 */
  changed: boolean;
  
  /** 切换时间 */
  switchedAt: number;
}

// ============================================================================
// Session Store 接口
// ============================================================================

/**
 * Session Store
 */
export interface SessionStore {
  /**
   * 创建 Session
   */
  createSession(input: CreateSessionInput): Promise<OperatorSession>;
  
  /**
   * 获取 Session
   */
  getSession(sessionId: string): Promise<OperatorSession | null>;
  
  /**
   * 保存 Session
   */
  saveSession(session: OperatorSession): Promise<void>;
  
  /**
   * 更新 Navigation State
   */
  updateNavigationState(
    sessionId: string,
    navigationState: OperatorNavigationState
  ): Promise<OperatorSession | null>;
  
  /**
   * 关闭 Session
   */
  closeSession(sessionId: string): Promise<void>;
  
  /**
   * 列出活跃 Sessions
   */
  listActiveSessions(surface?: OperatorSurface): Promise<OperatorSession[]>;
}

// ============================================================================
// Workspace Registry 接口
// ============================================================================

/**
 * Workspace Registry
 */
export interface WorkspaceRegistry {
  /**
   * 注册 Workspace
   */
  registerWorkspace(workspace: WorkspaceDescriptor): Promise<void>;
  
  /**
   * 获取 Workspace
   */
  getWorkspace(workspaceId: string): Promise<WorkspaceDescriptor | null>;
  
  /**
   * 列出所有 Workspaces
   */
  listWorkspaces(): Promise<WorkspaceDescriptor[]>;
  
  /**
   * 获取默认 Workspace
   */
  getDefaultWorkspace(): Promise<WorkspaceDescriptor | null>;
}

// ============================================================================
// Workspace Switcher 接口
// ============================================================================

/**
 * Workspace Switcher
 */
export interface WorkspaceSwitcher {
  /**
   * 切换 Workspace
   */
  switchWorkspace(
    sessionId: string,
    workspaceId: string
  ): Promise<WorkspaceSwitchResult>;
}
