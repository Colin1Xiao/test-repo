/**
 * Skill Runtime Adapter - Skill 运行时适配器
 *
 * 职责：
 * 1. 把 registry + installer + trust/policy 的结果，转成 runtime 可加载对象
 * 2. 决定哪些 skill 在当前 ExecutionContext / AgentContext 下应被加载
 * 3. 为 agent 构造最小 skill context
 * 4. 把 skill capability 接到 Tool Runtime / MCP / Code Intelligence
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
import type { AgentSkillSpec, AgentSkillContext, SkillRuntimeView } from './types';
import { SkillRegistry } from './skill_registry';
import { AgentSkillCompatChecker } from './agent_skill_compat';
/**
 * 运行时适配器配置
 */
export interface RuntimeAdapterConfig {
    /** 运行时版本 */
    runtimeVersion?: string;
    /** 可用的 Agent 列表 */
    availableAgents?: string[];
}
/**
 * 技能运行时状态
 */
export interface SkillRuntimeState {
    /** 已加载的 skills */
    loadedSkills: SkillRuntimeView[];
    /** 被阻塞的 skills */
    blockedSkills: string[];
    /** 等待审批的 skills */
    pendingSkills: string[];
    /** 缺失的 required skills */
    missingRequiredSkills: string[];
    /** 不可用的 optional skills */
    optionalUnavailableSkills: string[];
}
export declare class SkillRuntimeAdapter {
    private config;
    private registry;
    private compatChecker;
    constructor(registry: SkillRegistry, compatChecker: AgentSkillCompatChecker, config?: RuntimeAdapterConfig);
    /**
     * 准备 Skill 运行时
     */
    prepareSkillRuntime(agentSpec: AgentSkillSpec): Promise<SkillRuntimeState>;
    /**
     * 为 Agent 加载 Skills
     */
    loadSkillsForAgent(agentSpec: AgentSkillSpec): Promise<AgentSkillContext>;
    /**
     * 构建 Skill Context
     */
    buildSkillContext(agentRole: string, task: any, loadedSkills: SkillRuntimeView[]): Record<string, unknown>;
    /**
     * 解析被阻塞的 Skills
     */
    resolveBlockedSkills(agentSpec: AgentSkillSpec): Promise<{
        blocked: string[];
        reasons: Record<string, string>;
    }>;
    /**
     * 构建运行时视图
     */
    private buildRuntimeView;
    /**
     * 构建能力摘要
     */
    private buildCapabilitySummary;
}
/**
 * 创建运行时适配器
 */
export declare function createSkillRuntimeAdapter(registry: SkillRegistry, compatChecker: AgentSkillCompatChecker, config?: RuntimeAdapterConfig): SkillRuntimeAdapter;
