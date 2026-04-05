/**
 * Model Invoker - 模型调用抽象层
 *
 * 职责：
 * 1. 接收标准化 subagent 请求
 * 2. 调用底层模型/provider
 * 3. 返回统一响应格式
 * 4. 屏蔽不同 provider 的字段差异
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
/**
 * 模型调用请求
 */
export interface ModelInvokeRequest {
    role: string;
    subagentTaskId: string;
    teamId: string;
    systemPrompt: string;
    userPrompt: string;
    tools?: string[];
    budget: {
        maxTokens?: number;
        timeoutMs: number;
        maxTurns: number;
    };
    metadata?: Record<string, unknown>;
}
/**
 * 模型调用响应
 */
export interface ModelInvokeResponse {
    content: string;
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
    };
    finishReason: 'stop' | 'length' | 'timeout' | 'error' | 'tool_call';
    raw?: unknown;
    error?: {
        type: string;
        message: string;
        retryable: boolean;
    };
}
/**
 * 模型提供者接口
 */
export interface IModelProvider {
    /**
     * 调用模型
     */
    invoke(request: ModelInvokeRequest): Promise<ModelInvokeResponse>;
    /**
     * 获取提供者名称
     */
    getName(): string;
    /**
     * 检查是否可用
     */
    isAvailable(): boolean;
}
/**
 * 模型调用器接口
 */
export interface IModelInvoker {
    /**
     * 调用模型
     */
    invoke(request: ModelInvokeRequest): Promise<ModelInvokeResponse>;
    /**
     * 注册提供者
     */
    registerProvider(provider: IModelProvider, priority?: number): void;
    /**
     * 选择提供者
     */
    selectProvider(role?: string): IModelProvider | null;
}
/**
 * 可重试错误类型
 */
export declare const RETRYABLE_ERRORS: string[];
/**
 * 判断错误是否可重试
 */
export declare function isRetryableError(error: any): boolean;
/**
 * OpenClaw 默认模型提供者
 *
 * 使用 OpenClaw 配置的默认模型（bailian/kimi-k2.5 等）
 */
export declare class OpenClawModelProvider implements IModelProvider {
    private modelName;
    constructor(modelName?: string);
    getName(): string;
    isAvailable(): boolean;
    invoke(request: ModelInvokeRequest): Promise<ModelInvokeResponse>;
    /**
     * 调用模型（简化实现）
     *
     * 实际应该对接 OpenClaw 的模型调用接口
     */
    private invokeModel;
}
/**
 * 模型调用器实现
 */
export declare class ModelInvoker implements IModelInvoker {
    private providers;
    private defaultProvider?;
    constructor(defaultModelName?: string);
    /**
     * 注册提供者
     */
    registerProvider(provider: IModelProvider, priority?: number): void;
    /**
     * 选择提供者
     */
    selectProvider(role?: string): IModelProvider | null;
    /**
     * 调用模型
     */
    invoke(request: ModelInvokeRequest): Promise<ModelInvokeResponse>;
}
/**
 * 创建模型调用器
 */
export declare function createModelInvoker(defaultModelName?: string): IModelInvoker;
/**
 * 快速调用模型
 */
export declare function invokeModel(systemPrompt: string, userPrompt: string, options?: {
    role?: string;
    maxTokens?: number;
    timeoutMs?: number;
}): Promise<ModelInvokeResponse>;
