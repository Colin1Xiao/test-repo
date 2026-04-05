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

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 模型调用请求
 */
export interface ModelInvokeRequest {
  // 身份
  role: string;
  subagentTaskId: string;
  teamId: string;
  
  // 提示词
  systemPrompt: string;
  userPrompt: string;
  
  // 约束
  tools?: string[];
  budget: {
    maxTokens?: number;
    timeoutMs: number;
    maxTurns: number;
  };
  
  // 元数据
  metadata?: Record<string, unknown>;
}

/**
 * 模型调用响应
 */
export interface ModelInvokeResponse {
  // 内容
  content: string;
  
  // 使用情况
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  
  // 完成原因
  finishReason: 'stop' | 'length' | 'timeout' | 'error' | 'tool_call';
  
  // 原始响应（用于调试）
  raw?: unknown;
  
  // 错误信息
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

// ============================================================================
// 错误分类
// ============================================================================

/**
 * 可重试错误类型
 */
export const RETRYABLE_ERRORS = [
  'rate_limit',
  'timeout',
  'connection_error',
  'server_error',
  'transient_error',
];

/**
 * 判断错误是否可重试
 */
export function isRetryableError(error: any): boolean {
  if (!error) return false;
  
  const message = (error.message || '').toLowerCase();
  const type = (error.type || '').toLowerCase();
  
  return RETRYABLE_ERRORS.some(pattern => 
    message.includes(pattern) || type.includes(pattern)
  );
}

// ============================================================================
// 默认提供者实现（OpenClaw 环境）
// ============================================================================

/**
 * OpenClaw 默认模型提供者
 * 
 * 使用 OpenClaw 配置的默认模型（bailian/kimi-k2.5 等）
 */
export class OpenClawModelProvider implements IModelProvider {
  private modelName: string;
  
  constructor(modelName: string = 'bailian/kimi-k2.5') {
    this.modelName = modelName;
  }
  
  getName(): string {
    return `OpenClaw:${this.modelName}`;
  }
  
  isAvailable(): boolean {
    // 简单检查：模型名称非空
    return !!this.modelName;
  }
  
  async invoke(request: ModelInvokeRequest): Promise<ModelInvokeResponse> {
    try {
      // 构造消息
      const messages = [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ];
      
      // 调用 OpenClaw 默认模型（通过 sessions_spawn 或直接调用）
      // 注意：这里是简化实现，实际应该调用 OpenClaw 的模型接口
      const response = await this.invokeModel(messages, request.budget);
      
      return {
        content: response.content,
        usage: response.usage,
        finishReason: response.finishReason,
        raw: response.raw,
      };
      
    } catch (error) {
      return {
        content: '',
        finishReason: 'error',
        error: {
          type: error instanceof Error ? error.name : 'UnknownError',
          message: error instanceof Error ? error.message : String(error),
          retryable: isRetryableError(error),
        },
      };
    }
  }
  
  /**
   * 调用模型（简化实现）
   * 
   * 实际应该对接 OpenClaw 的模型调用接口
   */
  private async invokeModel(
    messages: Array<{ role: string; content: string }>,
    budget: { maxTokens?: number; timeoutMs: number; maxTurns: number }
  ): Promise<{
    content: string;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
    finishReason: 'stop' | 'length' | 'timeout' | 'error' | 'tool_call';
    raw?: unknown;
  }> {
    // TODO: 实际对接 OpenClaw 模型调用接口
    // 当前使用 mock 实现用于测试
    
    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      content: `[Mock Response] ${messages[1]?.content || ''}`,
      usage: {
        inputTokens: Math.floor(Math.random() * 100) + 50,
        outputTokens: Math.floor(Math.random() * 200) + 100,
        totalTokens: Math.floor(Math.random() * 300) + 150,
      },
      finishReason: 'stop',
    };
  }
}

// ============================================================================
// 模型调用器实现
// ============================================================================

/**
 * 模型调用器实现
 */
export class ModelInvoker implements IModelInvoker {
  private providers: Map<string, { provider: IModelProvider; priority: number }> = new Map();
  private defaultProvider?: IModelProvider;
  
  constructor(defaultModelName?: string) {
    // 注册默认提供者
    if (defaultModelName) {
      this.defaultProvider = new OpenClawModelProvider(defaultModelName);
      this.registerProvider(this.defaultProvider, 0);
    }
  }
  
  /**
   * 注册提供者
   */
  registerProvider(provider: IModelProvider, priority: number = 0): void {
    const name = provider.getName();
    this.providers.set(name, { provider, priority });
  }
  
  /**
   * 选择提供者
   */
  selectProvider(role?: string): IModelProvider | null {
    // 简单策略：返回最高优先级的可用提供者
    let best: { provider: IModelProvider; priority: number } | null = null;
    
    for (const { provider, priority } of this.providers.values()) {
      if (!provider.isAvailable()) continue;
      
      if (!best || priority > best.priority) {
        best = { provider, priority };
      }
    }
    
    return best?.provider || this.defaultProvider || null;
  }
  
  /**
   * 调用模型
   */
  async invoke(request: ModelInvokeRequest): Promise<ModelInvokeResponse> {
    const provider = this.selectProvider(request.role);
    
    if (!provider) {
      return {
        content: '',
        finishReason: 'error',
        error: {
          type: 'NoProvider',
          message: 'No available model provider',
          retryable: false,
        },
      };
    }
    
    return await provider.invoke(request);
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建模型调用器
 */
export function createModelInvoker(defaultModelName?: string): IModelInvoker {
  return new ModelInvoker(defaultModelName);
}

/**
 * 快速调用模型
 */
export async function invokeModel(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    role?: string;
    maxTokens?: number;
    timeoutMs?: number;
  }
): Promise<ModelInvokeResponse> {
  const invoker = createModelInvoker();
  
  return await invoker.invoke({
    role: options?.role || 'assistant',
    subagentTaskId: 'quick_invoke',
    teamId: 'quick_invoke',
    systemPrompt,
    userPrompt,
    budget: {
      maxTokens: options?.maxTokens,
      timeoutMs: options?.timeoutMs || 60000,
      maxTurns: 1,
    },
  });
}
