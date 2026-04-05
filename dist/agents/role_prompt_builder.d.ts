/**
 * Role Prompt Builder - 角色提示词构建器
 *
 * 职责：
 * 1. 根据 SubagentRole 构造 system prompt
 * 2. 注入目标、约束、输出格式
 * 3. 注入工具边界与预算提示
 * 4. 注入上游上下文摘要
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { SubagentRole } from './types';
/**
 * 提示词构建输入
 */
export interface PromptBuildInput {
    role: SubagentRole;
    goal: string;
    inputs?: Record<string, unknown>;
    allowedTools: string[];
    forbiddenTools: string[];
    budget: {
        maxTurns: number;
        maxTokens?: number;
        timeoutMs: number;
    };
    parentContext?: {
        summary?: string;
        artifacts?: Array<{
            type: string;
            description: string;
            content?: string;
        }>;
    };
    dependencyResults?: Array<{
        role: string;
        summary: string;
        artifacts?: Array<{
            type: string;
            description: string;
        }>;
    }>;
    outputFormat?: 'json' | 'markdown' | 'text';
}
/**
 * 提示词构建结果
 */
export interface PromptBuildResult {
    systemPrompt: string;
    userPrompt: string;
}
export declare class RolePromptBuilder {
    /**
     * 构建提示词
     */
    build(input: PromptBuildInput): PromptBuildResult;
    /**
     * 构建系统提示词
     */
    private buildSystemPrompt;
    /**
     * 构建用户提示词
     */
    private buildUserPrompt;
    /**
     * 构建工具约束
     */
    private buildToolConstraints;
    /**
     * 构建预算提示
     */
    private buildBudgetHint;
    /**
     * 构建输出格式提示
     */
    private buildOutputFormatHint;
}
/**
 * 创建提示词构建器
 */
export declare function createRolePromptBuilder(): RolePromptBuilder;
/**
 * 快速构建提示词
 */
export declare function buildRolePrompt(input: PromptBuildInput): PromptBuildResult;
/**
 * 获取角色系统提示词
 */
export declare function getRoleSystemPrompt(role: SubagentRole): string;
