/**
 * Memory Types - 记忆类型定义
 * 
 * 长期记忆的可见、可编辑、可审计结构。
 * MEMORY.md 只做索引，不塞长正文。
 * 每条记忆独立成文件，frontmatter + markdown 正文。
 */

/** 记忆范围 */
export type MemoryScope = 'user' | 'project' | 'ops' | 'session' | 'preferences';

/** 记忆条目 */
export type MemoryEntry = {
  /** 记忆 ID */
  id: string;
  /** 记忆范围 */
  scope: MemoryScope;
  /** 标题 */
  title: string;
  /** 摘要（用于索引） */
  summary: string;
  /** 标签 */
  tags: string[];
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 文件路径（相对于 memory 目录） */
  path: string;
  /** 来源（可选，如 task ID 或 session ID） */
  source?: string;
};

/** 记忆文件结构 */
export type MemoryFile = {
  /** 前置元数据 */
  frontmatter: MemoryEntry;
  /** 正文内容 */
  content: string;
  /** 完整文件路径 */
  fullPath: string;
};

/** 记忆索引结构（MEMORY.md） */
export type MemoryIndex = {
  /** 索引版本 */
  version: string;
  /** 最后更新时间 */
  updatedAt: string;
  /** 记忆条目列表（仅索引，不含正文） */
  entries: MemoryEntry[];
};

/** 记忆配置 */
export type MemDirConfig = {
  /** 根目录（默认项目根目录/.openclaw） */
  rootDir?: string;
  /** 自动创建目录 */
  autoCreate?: boolean;
  /** 索引最大条目数（防止上下文爆炸） */
  maxIndexSize?: number;
  /** 自动写入高价值内容 */
  autoWrite?: boolean;
};

/** 记忆检索结果 */
export type MemorySearchResult = MemoryEntry & {
  /** 匹配分数 */
  score: number;
  /** 匹配原因 */
  matchReason: string[];
  /** 正文内容（可选） */
  content?: string;
};

/** 自动写入的记忆类型 */
export type AutoMemoryType =
  | 'project_structure'      // 项目结构与模块职责
  | 'common_commands'        // 常用命令与启动方式
  | 'user_preferences'       // 用户明确要求记住的偏好
  | 'risk_operations'        // 常见风险操作禁忌
  | 'phase_plan'             // 当前阶段计划与中断点
  | 'fix_experience';        // 最近一次修复/踩坑经验
