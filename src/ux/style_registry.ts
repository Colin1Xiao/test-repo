/**
 * Style Registry - 风格管理层
 * 
 * 职责：
 * 1. 注册风格
 * 2. 查询风格
 * 3. 启用/禁用风格
 * 4. 获取默认风格
 * 5. 支持后续 workspace/custom styles
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type {
  OutputStyleDescriptor,
  OutputStyleId,
  StyleRegistrationResult,
  StyleRegistrySnapshot,
} from './types';
import { BUILTIN_STYLES, BUILTIN_STYLE_MAP, normalizeStyle, validateStyle } from './output_style';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 风格注册表配置
 */
export interface StyleRegistryConfig {
  /** 默认风格 ID */
  defaultStyleId?: OutputStyleId;
  
  /** 是否允许覆盖内置风格 */
  allowBuiltinOverride?: boolean;
  
  /** 是否启用自动保存 */
  enableAutoSave?: boolean;
  
  /** 保存路径 */
  savePath?: string;
}

// ============================================================================
// 风格注册表
// ============================================================================

export class StyleRegistry {
  private config: Required<StyleRegistryConfig>;
  
  // 风格存储：id → descriptor
  private styles: Map<OutputStyleId, OutputStyleDescriptor> = new Map();
  
  // 默认风格 ID
  private defaultStyleId: OutputStyleId = 'minimal';
  
  constructor(config: StyleRegistryConfig = {}) {
    this.config = {
      defaultStyleId: config.defaultStyleId ?? 'minimal',
      allowBuiltinOverride: config.allowBuiltinOverride ?? false,
      enableAutoSave: config.enableAutoSave ?? false,
      savePath: config.savePath ?? './styles.json',
    };
    
    // 注册内置风格
    this.registerBuiltinStyles();
    
    // 加载持久化风格
    if (this.config.enableAutoSave) {
      this.loadPersistedStyles();
    }
  }
  
  /**
   * 注册风格
   */
  registerStyle(descriptor: Partial<OutputStyleDescriptor>): StyleRegistrationResult {
    // 校验
    const validation = validateStyle(descriptor);
    
    if (!validation.valid) {
      return {
        success: false,
        styleId: descriptor.id || 'unknown',
        error: validation.errors.join('; '),
        warnings: validation.warnings,
      };
    }
    
    const styleId = descriptor.id as OutputStyleId;
    
    // 检查是否是内置风格
    const isBuiltin = BUILTIN_STYLE_MAP.hasOwnProperty(styleId);
    
    if (isBuiltin && !this.config.allowBuiltinOverride) {
      return {
        success: false,
        styleId,
        error: `Cannot override builtin style: ${styleId}`,
      };
    }
    
    // 规范化风格
    const normalizedStyle = normalizeStyle(descriptor);
    
    // 注册
    this.styles.set(styleId, normalizedStyle);
    
    // 自动保存
    if (this.config.enableAutoSave) {
      this.savePersistedStyles();
    }
    
    return {
      success: true,
      styleId,
      warnings: validation.warnings,
    };
  }
  
  /**
   * 注销风格
   */
  unregisterStyle(styleId: OutputStyleId): boolean {
    // 不允许注销内置风格
    if (BUILTIN_STYLE_MAP.hasOwnProperty(styleId)) {
      return false;
    }
    
    const deleted = this.styles.delete(styleId);
    
    // 自动保存
    if (deleted && this.config.enableAutoSave) {
      this.savePersistedStyles();
    }
    
    return deleted;
  }
  
  /**
   * 获取风格
   */
  getStyle(styleId: OutputStyleId): OutputStyleDescriptor | null {
    const style = this.styles.get(styleId);
    
    if (style) {
      return { ...style };
    }
    
    // 回退到内置风格
    const builtin = BUILTIN_STYLE_MAP[styleId];
    if (builtin) {
      return { ...builtin };
    }
    
    return null;
  }
  
  /**
   * 列出风格
   */
  listStyles(options?: {
    enabledOnly?: boolean;
    builtinOnly?: boolean;
    customOnly?: boolean;
  }): OutputStyleDescriptor[] {
    const styles: OutputStyleDescriptor[] = [];
    
    for (const style of this.styles.values()) {
      if (options?.enabledOnly && !style.enabled) {
        continue;
      }
      
      if (options?.builtinOnly && !style.isBuiltin) {
        continue;
      }
      
      if (options?.customOnly && style.isBuiltin) {
        continue;
      }
      
      styles.push({ ...style });
    }
    
    return styles;
  }
  
  /**
   * 设置默认风格
   */
  setDefaultStyle(styleId: OutputStyleId): boolean {
    const style = this.getStyle(styleId);
    
    if (!style) {
      return false;
    }
    
    this.defaultStyleId = styleId;
    
    return true;
  }
  
  /**
   * 获取默认风格
   */
  getDefaultStyle(): OutputStyleDescriptor {
    const style = this.getStyle(this.defaultStyleId);
    
    if (style) {
      return style;
    }
    
    // 回退到 minimal
    return { ...BUILTIN_STYLE_MAP.minimal };
  }
  
  /**
   * 获取默认风格 ID
   */
  getDefaultStyleId(): OutputStyleId {
    return this.defaultStyleId;
  }
  
  /**
   * 启用风格
   */
  enableStyle(styleId: OutputStyleId): boolean {
    const style = this.styles.get(styleId);
    
    if (!style) {
      return false;
    }
    
    style.enabled = true;
    this.styles.set(styleId, style);
    
    return true;
  }
  
  /**
   * 禁用风格
   */
  disableStyle(styleId: OutputStyleId): boolean {
    const style = this.styles.get(styleId);
    
    if (!style) {
      return false;
    }
    
    // 不允许禁用默认风格
    if (styleId === this.defaultStyleId) {
      return false;
    }
    
    style.enabled = false;
    this.styles.set(styleId, style);
    
    return true;
  }
  
  /**
   * 构建注册表快照
   */
  buildSnapshot(): StyleRegistrySnapshot {
    const styles = this.listStyles();
    const enabledStyles = styles.filter(s => s.enabled);
    
    return {
      snapshotId: `snapshot_${Date.now()}`,
      createdAt: Date.now(),
      totalStyles: styles.length,
      enabledStyles: enabledStyles.length,
      defaultStyleId: this.defaultStyleId,
      styles,
    };
  }
  
  /**
   * 清空自定义风格
   */
  clearCustomStyles(): void {
    for (const styleId of this.styles.keys()) {
      if (!BUILTIN_STYLE_MAP.hasOwnProperty(styleId)) {
        this.styles.delete(styleId);
      }
    }
    
    if (this.config.enableAutoSave) {
      this.savePersistedStyles();
    }
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  /**
   * 注册内置风格
   */
  private registerBuiltinStyles(): void {
    for (const style of BUILTIN_STYLES) {
      this.styles.set(style.id, { ...style });
    }
  }
  
  /**
   * 加载持久化风格
   */
  private loadPersistedStyles(): void {
    // 简化实现：实际应该从文件加载
    try {
      // const fs = require('fs');
      // const data = fs.readFileSync(this.config.savePath, 'utf-8');
      // const styles = JSON.parse(data);
      // for (const style of styles) {
      //   if (!BUILTIN_STYLE_MAP.hasOwnProperty(style.id)) {
      //     this.styles.set(style.id, style);
      //   }
      // }
    } catch (error) {
      // 文件不存在或解析失败，忽略
    }
  }
  
  /**
   * 保存持久化风格
   */
  private savePersistedStyles(): void {
    // 简化实现：实际应该保存到文件
    try {
      // const fs = require('fs');
      // const customStyles = this.listStyles({ customOnly: true });
      // const data = JSON.stringify(customStyles, null, 2);
      // fs.writeFileSync(this.config.savePath, data);
    } catch (error) {
      // 保存失败，忽略
    }
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建风格注册表
 */
export function createStyleRegistry(config?: StyleRegistryConfig): StyleRegistry {
  return new StyleRegistry(config);
}

/**
 * 快速注册风格
 */
export function registerStyle(
  registry: StyleRegistry,
  descriptor: Partial<OutputStyleDescriptor>
): StyleRegistrationResult {
  return registry.registerStyle(descriptor);
}

/**
 * 快速查询风格
 */
export function getStyle(
  registry: StyleRegistry,
  styleId: OutputStyleId
): OutputStyleDescriptor | null {
  return registry.getStyle(styleId);
}
