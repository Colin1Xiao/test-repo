/**
 * Automation Loader - 自动化配置加载器
 * 
 * 职责：
 * 1. 读取 hooks.yaml / automation.yaml
 * 2. 解析 YAML
 * 3. 调 schema 校验
 * 4. 转成 runtime rule 对象
 * 5. 支持默认规则 + workspace 规则合并
 * 6. 支持热加载
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  AutomationConfigDocument,
  AutomationRule,
  AutomationLoadResult,
  AutomationRuleSource,
  AutomationRuleSet,
  AutomationLoaderConfig,
  AutomationConfigError,
} from './types';
import { validateAutomationDocument, normalizeAutomationDocument } from './automation_schema';

// ============================================================================
// YAML 解析（简化实现）
// ============================================================================

/**
 * 解析 YAML 字符串
 * 简化实现：实际应该使用 js-yaml 库
 */
function parseYaml(content: string): any {
  // 简化实现：这里只做基本的 JSON 兼容解析
  // 实际应该使用 js-yaml 库
  
  try {
    // 尝试作为 JSON 解析（YAML 是 JSON 的超集）
    return JSON.parse(content);
  } catch {
    // 简化 YAML 解析：仅支持非常基础的格式
    const result: any = {};
    const lines = content.split('\n');
    let currentKey = '';
    let currentArray: any[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // 跳过空行和注释
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      
      // 检测数组项
      if (trimmed.startsWith('- ')) {
        const value = trimmed.slice(2).trim();
        currentArray.push(parseYamlValue(value));
      } else if (trimmed.includes(':')) {
        // 保存之前的数组
        if (currentArray.length > 0 && currentKey) {
          result[currentKey] = currentArray;
          currentArray = [];
        }
        
        // 解析键值对
        const [key, value] = trimmed.split(':').map(s => s.trim());
        currentKey = key;
        
        if (value) {
          result[key] = parseYamlValue(value);
        }
      }
    }
    
    // 保存最后的数组
    if (currentArray.length > 0 && currentKey) {
      result[currentKey] = currentArray;
    }
    
    return result;
  }
}

/**
 * 解析 YAML 值
 */
function parseYamlValue(value: string): any {
  // 移除引号
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  
  // 布尔值
  if (value === 'true') return true;
  if (value === 'false') return false;
  
  // 数字
  const num = Number(value);
  if (!isNaN(num)) return num;
  
  // 数组（内联格式）
  if (value.startsWith('[') && value.endsWith(']')) {
    return value.slice(1, -1).split(',').map(s => s.trim());
  }
  
  return value;
}

// ============================================================================
// 自动化加载器
// ============================================================================

export class AutomationLoader {
  private config: Required<AutomationLoaderConfig>;
  private watchTimers: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(config: AutomationLoaderConfig = {}) {
    this.config = {
      defaultRulesPath: config.defaultRulesPath ?? './rules/default-hooks.yaml',
      workspaceRulesPath: config.workspaceRulesPath ?? './hooks.yaml',
      enableHotReload: config.enableHotReload ?? false,
      hotReloadIntervalMs: config.hotReloadIntervalMs ?? 5000,
      strictMode: config.strictMode ?? false,
    };
  }
  
  /**
   * 加载自动化文件
   */
  async loadAutomationFile(
    filePath: string,
    sourceType: 'builtin' | 'workspace' | 'remote' = 'workspace'
  ): Promise<AutomationLoadResult> {
    const source: AutomationRuleSource = {
      type: sourceType,
      path: filePath,
      loadedAt: Date.now(),
      errors: [],
      warnings: [],
    };
    
    try {
      // 读取文件
      const content = await fs.readFile(filePath, 'utf-8');
      
      // 解析 YAML
      let doc: AutomationConfigDocument;
      try {
        doc = parseYaml(content);
      } catch (error) {
        return {
          success: false,
          loadedRules: 0,
          failedRules: 0,
          source,
          errors: [{
            type: 'parse',
            path: filePath,
            message: `Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`,
          }],
          warnings: [],
        };
      }
      
      // Schema 校验
      const validationResult = validateAutomationDocument(doc);
      
      if (!validationResult.valid) {
        return {
          success: false,
          loadedRules: 0,
          failedRules: validationResult.errors.length,
          source: {
            ...source,
            errors: validationResult.errors,
          },
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        };
      }
      
      // 规范化
      const normalized = validationResult.normalized!;
      
      // 应用默认配置
      const rules = normalized.rules.map(rule => ({
        ...rule,
        enabled: rule.enabled ?? normalized.defaults?.enabled ?? true,
        cooldownMs: rule.cooldownMs ?? normalized.defaults?.cooldownMs ?? 60000,
        maxTriggerCount: rule.maxTriggerCount ?? normalized.defaults?.maxTriggerCount,
      }));
      
      return {
        success: true,
        loadedRules: rules.length,
        failedRules: 0,
        source: {
          ...source,
          warnings: validationResult.warnings,
        },
        errors: [],
        warnings: validationResult.warnings,
      };
      
    } catch (error) {
      return {
        success: false,
        loadedRules: 0,
        failedRules: 0,
        source: {
          ...source,
          errors: [{
            type: 'load',
            path: filePath,
            message: `Failed to load file: ${error instanceof Error ? error.message : String(error)}`,
          }],
        },
        errors: [{
          type: 'load',
          path: filePath,
          message: `Failed to load file: ${error instanceof Error ? error.message : String(error)}`,
        }],
        warnings: [],
      };
    }
  }
  
  /**
   * 加载工作区自动化
   */
  async loadWorkspaceAutomation(
    workspaceRoot: string
  ): Promise<AutomationLoadResult> {
    const workspaceRulesPath = path.join(
      workspaceRoot,
      this.config.workspaceRulesPath
    );
    
    return await this.loadAutomationFile(workspaceRulesPath, 'workspace');
  }
  
  /**
   * 重新加载自动化
   */
  async reloadAutomation(
    workspaceRoot: string
  ): Promise<{
    success: boolean;
    rules: AutomationRule[];
    source: AutomationRuleSource;
    errors: AutomationConfigError[];
  }> {
    const result = await this.loadWorkspaceAutomation(workspaceRoot);
    
    if (!result.success) {
      return {
        success: false,
        rules: [],
        source: result.source,
        errors: result.errors,
      };
    }
    
    // 重新加载时，需要获取实际规则
    // 简化实现：这里假设规则已经加载
    return {
      success: true,
      rules: [],
      source: result.source,
      errors: [],
    };
  }
  
  /**
   * 监视自动化文件变化
   */
  watchAutomationFiles(
    workspaceRoot: string,
    onChange: () => void
  ): void {
    if (!this.config.enableHotReload) {
      return;
    }
    
    const workspaceRulesPath = path.join(
      workspaceRoot,
      this.config.workspaceRulesPath
    );
    
    // 清除旧的监视
    if (this.watchTimers.has(workspaceRulesPath)) {
      clearInterval(this.watchTimers.get(workspaceRulesPath)!);
    }
    
    // 设置新的监视
    const timer = setInterval(async () => {
      try {
        const stats = await fs.stat(workspaceRulesPath);
        // 简化实现：实际应该检查文件修改时间
        onChange();
      } catch {
        // 文件不存在，忽略
      }
    }, this.config.hotReloadIntervalMs);
    
    this.watchTimers.set(workspaceRulesPath, timer);
  }
  
  /**
   * 停止监视
   */
  stopWatching(): void {
    for (const timer of this.watchTimers.values()) {
      clearInterval(timer);
    }
    this.watchTimers.clear();
  }
  
  /**
   * 构建规则集
   */
  buildRuleSet(
    defaults: AutomationRule[],
    workspaceRules: AutomationRule[],
    overrideMode: 'append' | 'override' | 'disable' = 'override'
  ): AutomationRuleSet {
    const rules: AutomationRule[] = [];
    const workspaceRuleIds = new Set(workspaceRules.map(r => r.id));
    
    // 处理默认规则
    for (const defaultRule of defaults) {
      // 检查 workspace 是否有同 ID 规则
      const workspaceRule = workspaceRules.find(r => r.id === defaultRule.id);
      
      if (workspaceRule) {
        if (overrideMode === 'disable' && !workspaceRule.enabled) {
          // 显式禁用
          continue;
        } else if (overrideMode === 'override') {
          // 覆盖
          rules.push({ ...defaultRule, ...workspaceRule });
          continue;
        }
      }
      
      // 添加默认规则
      rules.push(defaultRule);
    }
    
    // 处理 workspace 新增规则（append 模式）
    if (overrideMode === 'append' || overrideMode === 'override') {
      for (const workspaceRule of workspaceRules) {
        if (!workspaceRuleIds.has(workspaceRule.id)) {
          rules.push(workspaceRule);
        }
      }
    }
    
    return {
      rules,
      source: {
        type: 'workspace',
        loadedAt: Date.now(),
      },
      loadedAt: Date.now(),
    };
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建自动化加载器
 */
export function createAutomationLoader(config?: AutomationLoaderConfig): AutomationLoader {
  return new AutomationLoader(config);
}

/**
 * 快速加载规则
 */
export async function loadAutomationRules(
  filePath: string,
  sourceType?: 'builtin' | 'workspace' | 'remote'
): Promise<AutomationRule[]> {
  const loader = new AutomationLoader();
  const result = await loader.loadAutomationFile(filePath, sourceType);
  
  if (!result.success) {
    return [];
  }
  
  // 简化实现：实际应该从结果中提取规则
  return [];
}
