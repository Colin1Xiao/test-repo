/**
 * Skill Capability View - Skill 能力视图
 *
 * 职责：
 * 1. 把已加载 skill 的 capability 汇总成统一视图
 * 2. 给 planner / repo_reader / code_reviewer / release_agent 等角色返回不同粒度的摘要
 * 3. 将 skill 提供的 tools / MCP dependencies / code_intel capabilities / verification abilities 做统一归纳
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { SkillRuntimeView, SkillCapabilityType, AgentCapabilitySummary } from './types';
/**
 * 能力视图配置
 */
export interface CapabilityViewConfig {
    /** 是否包含工具详情 */
    includeToolDetails?: boolean;
    /** 是否包含 MCP 依赖 */
    includeMcpDependencies?: boolean;
}
export declare class SkillCapabilityView {
    private config;
    constructor(config?: CapabilityViewConfig);
    /**
     * 构建能力视图
     */
    buildCapabilityView(loadedSkills: SkillRuntimeView[]): {
        capabilityTypes: SkillCapabilityType[];
        providedTools: string[];
        requiredMcpServers: string[];
        codeIntelHooks: string[];
        verificationHooks: string[];
        automationHooks: string[];
    };
    /**
     * 构建 Agent 能力摘要
     */
    buildAgentCapabilitySummary(agentRole: string, loadedSkills: SkillRuntimeView[]): AgentCapabilitySummary;
    /**
     * 按能力类型查找 Skills
     */
    findSkillsByCapability(loadedSkills: SkillRuntimeView[], capabilityType: SkillCapabilityType): SkillRuntimeView[];
    /**
     * 按工具名称查找 Skills
     */
    findSkillsByTool(loadedSkills: SkillRuntimeView[], toolName: string): SkillRuntimeView[];
    /**
     * 查找需要特定 MCP Server 的 Skills
     */
    findSkillsRequiringMcpServer(loadedSkills: SkillRuntimeView[], serverName: string): SkillRuntimeView[];
    /**
     * 获取能力描述
     */
    getCapabilityDescription(capabilityType: SkillCapabilityType): string;
    /**
     * 查找缺失的能力
     */
    private findMissingCapabilities;
    /**
     * 获取角色期望的能力
     */
    private getExpectedCapabilitiesForRole;
}
/**
 * 创建能力视图
 */
export declare function createSkillCapabilityView(config?: CapabilityViewConfig): SkillCapabilityView;
/**
 * 快速构建能力视图
 */
export declare function buildSkillCapabilityView(loadedSkills: SkillRuntimeView[], config?: CapabilityViewConfig): ReturnType<SkillCapabilityView['buildCapabilityView']>;
/**
 * 快速构建 Agent 能力摘要
 */
export declare function buildAgentCapabilitySummary(agentRole: string, loadedSkills: SkillRuntimeView[], config?: CapabilityViewConfig): AgentCapabilitySummary;
