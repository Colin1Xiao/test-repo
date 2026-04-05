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
import type { McpCapabilityType } from './types';
/**
 * 构建 Tool 名称
 */
export declare function buildToolName(server: string, tool: string): string;
/**
 * 构建 Resource 名称
 */
export declare function buildResourceName(server: string, resourceType: string): string;
/**
 * 构建 Prompt 名称
 */
export declare function buildPromptName(server: string, promptName: string): string;
/**
 * 解析限定名称
 */
export declare function parseQualifiedName(qualifiedName: string): {
    type: McpCapabilityType;
    server: string;
    name: string;
} | null;
/**
 * 验证限定名称
 */
export declare function validateQualifiedName(qualifiedName: string): boolean;
/**
 * 获取名称类型
 */
export declare function getCapabilityType(qualifiedName: string): McpCapabilityType | null;
/**
 * 获取 Server 名称
 */
export declare function extractServerName(qualifiedName: string): string | null;
/**
 * 获取名称部分（不含 server 前缀）
 */
export declare function extractNamePart(qualifiedName: string): string | null;
/**
 * 规范化 Server 名称
 */
export declare function normalizeServerName(server: string): string;
/**
 * 规范化名称部分
 */
export declare function normalizeNamePart(name: string): string;
/**
 * 验证名称部分
 */
export declare function validateNamePart(name: string, context: string): void;
/**
 * 检查名称冲突
 */
export declare function checkNameConflict(existingNames: string[], newName: string, context: string): void;
/**
 * 快速构建限定名称
 */
export declare function buildQualifiedName(server: string, type: McpCapabilityType, name: string): string;
/**
 * 获取所有支持的 Server 名称（硬编码第一批）
 */
export declare function getSupportedServers(): string[];
