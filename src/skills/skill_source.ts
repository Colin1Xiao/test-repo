/**
 * Skill Source - Skill 来源管理
 * 
 * 职责：
 * 1. 统一表达 builtin / workspace / external source
 * 2. 解析 source metadata
 * 3. 区分"可直接用"和"需下载/导入"的来源
 * 4. 为 installer 提供标准 source descriptor
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type { SkillSourceDescriptor, SkillSourceType } from './types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 来源解析结果
 */
export interface SourceResolveResult {
  /** 是否成功 */
  success: boolean;
  
  /** 来源描述符（如果解析成功） */
  source?: SkillSourceDescriptor;
  
  /** 错误信息（如果解析失败） */
  error?: string;
}

// ============================================================================
// 来源解析
// ============================================================================

/**
 * 解析来源
 */
export function resolveSource(input: string): SourceResolveResult {
  try {
    // 检查是否是 builtin
    if (isBuiltinSourcePath(input)) {
      return {
        success: true,
        source: {
          type: 'builtin',
          location: input,
          origin: input,
          fetchedAt: Date.now(),
        },
      };
    }
    
    // 检查是否是 workspace
    if (isWorkspaceSourcePath(input)) {
      return {
        success: true,
        source: {
          type: 'workspace',
          location: input,
          origin: input,
          fetchedAt: Date.now(),
        },
      };
    }
    
    // 检查是否是外部来源
    if (isExternalSourcePath(input)) {
      return {
        success: true,
        source: {
          type: 'external',
          location: input,
          origin: input,
          fetchedAt: Date.now(),
        },
      };
    }
    
    // 默认视为 workspace
    return {
      success: true,
      source: {
        type: 'workspace',
        location: input,
        origin: input,
        fetchedAt: Date.now(),
      },
    };
    
  } catch (error) {
    return {
      success: false,
      error: `Failed to resolve source: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 规范化来源
 */
export function normalizeSource(source: SkillSourceDescriptor): SkillSourceDescriptor {
  return {
    ...source,
    type: source.type || 'workspace',
    location: source.location?.trim() || '',
    fetchedAt: source.fetchedAt || Date.now(),
  };
}

/**
 * 检查是否是 builtin 来源
 */
export function isBuiltinSource(source: SkillSourceDescriptor): boolean {
  return source.type === 'builtin' || isBuiltinSourcePath(source.location);
}

/**
 * 检查是否是 workspace 来源
 */
export function isWorkspaceSource(source: SkillSourceDescriptor): boolean {
  return source.type === 'workspace' || isWorkspaceSourcePath(source.location);
}

/**
 * 检查是否是 external 来源
 */
export function isExternalSource(source: SkillSourceDescriptor): boolean {
  return source.type === 'external' || isExternalSourcePath(source.location);
}

// ============================================================================
// 路径检查
// ============================================================================

/**
 * 检查是否是 builtin 来源路径
 */
export function isBuiltinSourcePath(path: string): boolean {
  // builtin 路径通常以 ./builtin/ 或 builtin: 开头
  return path.startsWith('./builtin/') || 
         path.startsWith('builtin:') ||
         path.startsWith('@openclaw/');
}

/**
 * 检查是否是 workspace 来源路径
 */
export function isWorkspaceSourcePath(path: string): boolean {
  // workspace 路径通常是相对路径或绝对路径
  return path.startsWith('./skills/') ||
         path.startsWith('./workspace/skills/') ||
         path.startsWith('/') ||
         path.startsWith('../');
}

/**
 * 检查是否是 external 来源路径
 */
export function isExternalSourcePath(path: string): boolean {
  // external 来源通常是 URL 或 npm 包名
  return path.startsWith('http://') ||
         path.startsWith('https://') ||
         path.startsWith('npm:') ||
         path.startsWith('github:') ||
         path.startsWith('git@') ||
         path.includes('@') && !path.startsWith('./'); // npm 包名如 @org/package
}

// ============================================================================
// 来源元数据
// ============================================================================

/**
 * 获取来源类型
 */
export function getSourceType(path: string): SkillSourceType {
  if (isBuiltinSourcePath(path)) {
    return 'builtin';
  }
  
  if (isExternalSourcePath(path)) {
    return 'external';
  }
  
  return 'workspace';
}

/**
 * 检查来源是否可用
 */
export async function isSourceAvailable(source: SkillSourceDescriptor): Promise<boolean> {
  try {
    // builtin 来源默认可用
    if (source.type === 'builtin') {
      return true;
    }
    
    // workspace 来源检查文件是否存在
    if (source.type === 'workspace') {
      // 简化实现：实际应该检查文件系统
      return true;
    }
    
    // external 来源检查 URL 是否可访问
    if (source.type === 'external') {
      // 简化实现：实际应该发起 HTTP 请求
      return true;
    }
    
    return false;
    
  } catch (error) {
    return false;
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建 builtin 来源
 */
export function createBuiltinSource(skillName: string): SkillSourceDescriptor {
  return {
    type: 'builtin',
    location: `./builtin/${skillName}`,
    origin: `builtin:${skillName}`,
    fetchedAt: Date.now(),
  };
}

/**
 * 创建 workspace 来源
 */
export function createWorkspaceSource(skillName: string, basePath: string = './skills'): SkillSourceDescriptor {
  return {
    type: 'workspace',
    location: `${basePath}/${skillName}`,
    origin: `${basePath}/${skillName}`,
    fetchedAt: Date.now(),
  };
}

/**
 * 创建 external 来源
 */
export function createExternalSource(location: string): SkillSourceDescriptor {
  return {
    type: 'external',
    location,
    origin: location,
    fetchedAt: Date.now(),
  };
}
