/**
 * MCP Naming - MCP 命名规范
 * 
 * 职责：
 * 1. 统一命名规范生成
 * 2. 名称校验
 * 3. Server 名规范化
 * 4. 重名冲突检测
 * 
 * @version v0.1.0
 * @date 2026-04-03
 */

import type { McpServerId, McpCapabilityType } from './types';

// ============================================================================
// 命名常量
// ============================================================================

/**
 * 命名分隔符
 */
const SEPARATOR = '__';
const RESOURCE_PREFIX = 'resource';
const PROMPT_PREFIX = 'prompt';

/**
 * 命名格式
 */
const TOOL_PATTERN = /^mcp__([a-zA-Z0-9_-]+)__([a-zA-Z0-9_-]+)$/;
const RESOURCE_PATTERN = /^mcp__([a-zA-Z0-9_-]+)__resource__([a-zA-Z0-9_-]+)$/;
const PROMPT_PATTERN = /^mcp__([a-zA-Z0-9_-]+)__prompt__([a-zA-Z0-9_-]+)$/;

// ============================================================================
// 命名构建器
// ============================================================================

/**
 * 构建 Tool 名称
 */
export function buildToolName(server: string, tool: string): string {
  const normalizedServer = normalizeServerName(server);
  const normalizedTool = normalizeNamePart(tool);
  
  validateNamePart(normalizedServer, 'server');
  validateNamePart(normalizedTool, 'tool');
  
  return `mcp${SEPARATOR}${normalizedServer}${SEPARATOR}${normalizedTool}`;
}

/**
 * 构建 Resource 名称
 */
export function buildResourceName(server: string, resourceType: string): string {
  const normalizedServer = normalizeServerName(server);
  const normalizedResource = normalizeNamePart(resourceType);
  
  validateNamePart(normalizedServer, 'server');
  validateNamePart(normalizedResource, 'resource');
  
  return `mcp${SEPARATOR}${normalizedServer}${SEPARATOR}${RESOURCE_PREFIX}${SEPARATOR}${normalizedResource}`;
}

/**
 * 构建 Prompt 名称
 */
export function buildPromptName(server: string, promptName: string): string {
  const normalizedServer = normalizeServerName(server);
  const normalizedPrompt = normalizeNamePart(promptName);
  
  validateNamePart(normalizedServer, 'server');
  validateNamePart(normalizedPrompt, 'prompt');
  
  return `mcp${SEPARATOR}${normalizedServer}${SEPARATOR}${PROMPT_PREFIX}${SEPARATOR}${normalizedPrompt}`;
}

// ============================================================================
// 名称解析
// ============================================================================

/**
 * 解析限定名称
 */
export function parseQualifiedName(
  qualifiedName: string
): {
  type: McpCapabilityType;
  server: string;
  name: string;
} | null {
  // 尝试匹配 Tool
  const toolMatch = qualifiedName.match(TOOL_PATTERN);
  if (toolMatch) {
    return {
      type: 'tool',
      server: toolMatch[1],
      name: toolMatch[2],
    };
  }
  
  // 尝试匹配 Resource
  const resourceMatch = qualifiedName.match(RESOURCE_PATTERN);
  if (resourceMatch) {
    return {
      type: 'resource',
      server: resourceMatch[1],
      name: resourceMatch[2],
    };
  }
  
  // 尝试匹配 Prompt
  const promptMatch = qualifiedName.match(PROMPT_PATTERN);
  if (promptMatch) {
    return {
      type: 'prompt',
      server: promptMatch[1],
      name: promptMatch[2],
    };
  }
  
  return null;
}

/**
 * 验证限定名称
 */
export function validateQualifiedName(qualifiedName: string): boolean {
  return parseQualifiedName(qualifiedName) !== null;
}

/**
 * 获取名称类型
 */
export function getCapabilityType(qualifiedName: string): McpCapabilityType | null {
  const parsed = parseQualifiedName(qualifiedName);
  return parsed?.type ?? null;
}

/**
 * 获取 Server 名称
 */
export function extractServerName(qualifiedName: string): string | null {
  const parsed = parseQualifiedName(qualifiedName);
  return parsed?.server ?? null;
}

/**
 * 获取名称部分（不含 server 前缀）
 */
export function extractNamePart(qualifiedName: string): string | null {
  const parsed = parseQualifiedName(qualifiedName);
  return parsed?.name ?? null;
}

// ============================================================================
// 名称规范化
// ============================================================================

/**
 * 规范化 Server 名称
 */
export function normalizeServerName(server: string): string {
  // 转小写
  let normalized = server.toLowerCase();
  
  // 替换空格为下划线
  normalized = normalized.replace(/\s+/g, '_');
  
  // 移除非法字符（只保留字母数字下划线连字符）
  normalized = normalized.replace(/[^a-z0-9_-]/g, '');
  
  // 移除首尾的下划线/连字符
  normalized = normalized.replace(/^[_-]+|[_-]+$/g, '');
  
  // 检查是否为空
  if (!normalized) {
    throw new Error('Server name cannot be empty after normalization');
  }
  
  return normalized;
}

/**
 * 规范化名称部分
 */
export function normalizeNamePart(name: string): string {
  // 转小写
  let normalized = name.toLowerCase();
  
  // 替换空格为下划线
  normalized = normalized.replace(/\s+/g, '_');
  
  // 移除非法字符
  normalized = normalized.replace(/[^a-z0-9_-]/g, '');
  
  // 移除首尾的下划线/连字符
  normalized = normalized.replace(/^[_-]+|[_-]+$/g, '');
  
  // 检查是否为空
  if (!normalized) {
    throw new Error('Name part cannot be empty after normalization');
  }
  
  return normalized;
}

// ============================================================================
// 名称校验
// ============================================================================

/**
 * 验证名称部分
 */
export function validateNamePart(name: string, context: string): void {
  if (!name) {
    throw new Error(`${context} name cannot be empty`);
  }
  
  if (!/^[a-z0-9_-]+$/.test(name)) {
    throw new Error(
      `${context} name contains invalid characters: ${name}. ` +
      'Only lowercase letters, numbers, underscores, and hyphens are allowed.'
    );
  }
  
  if (name.length > 64) {
    throw new Error(`${context} name is too long: ${name.length} characters (max 64)`);
  }
}

/**
 * 检查名称冲突
 */
export function checkNameConflict(
  existingNames: string[],
  newName: string,
  context: string
): void {
  if (existingNames.includes(newName)) {
    throw new Error(
      `${context} name conflict: ${newName} already exists. ` +
      'Please use a different name.'
    );
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 快速构建限定名称
 */
export function buildQualifiedName(
  server: string,
  type: McpCapabilityType,
  name: string
): string {
  switch (type) {
    case 'tool':
      return buildToolName(server, name);
    case 'resource':
      return buildResourceName(server, name);
    case 'prompt':
      return buildPromptName(server, name);
    default:
      throw new Error(`Unknown capability type: ${type}`);
  }
}

/**
 * 获取所有支持的 Server 名称（硬编码第一批）
 */
export function getSupportedServers(): string[] {
  return ['github', 'browser', 'slack', 'telegram', 'gdrive', 'cicd'];
}
