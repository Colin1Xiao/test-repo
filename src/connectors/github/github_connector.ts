/**
 * GitHub Connector
 * Phase 2B-1 - GitHub / PR Connector MVP
 * 
 * 职责：
 * - 接收 GitHub Webhook 事件
 * - 轮询 GitHub API 获取 PR 状态
 * - 统一事件输入格式
 */

import type {
  GitHubEvent,
  GitHubPREvent,
  GitHubCheckEvent,
  GitHubWebhookPayload,
} from './github_types';

// ============================================================================
// 配置
// ============================================================================

export interface GitHubConnectorConfig {
  /** GitHub API Token */
  apiToken?: string;
  
  /** Webhook Secret */
  webhookSecret?: string;
  
  /** 轮询间隔（毫秒） */
  pollingIntervalMs?: number;
  
  /** 启用轮询 */
  enablePolling?: boolean;
  
  /** 仓库列表 */
  repositories?: string[];
}

// ============================================================================
// GitHub Connector 接口
// ============================================================================

export interface GitHubConnector {
  /**
   * 处理 Webhook 事件
   */
  handleWebhook(payload: GitHubWebhookPayload, signature?: string): Promise<GitHubEvent[]>;
  
  /**
   * 轮询 PR 状态
   */
  pollPRs(): Promise<GitHubEvent[]>;
  
  /**
   * 轮询 Check 状态
   */
  pollChecks(): Promise<GitHubEvent[]>;
  
  /**
   * 获取 PR 详情
   */
  getPRDetails(owner: string, repo: string, prNumber: number): Promise<any>;
  
  /**
   * 提交 PR Review
   */
  submitReview(owner: string, repo: string, prNumber: number, review: {
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
    body?: string;
    commitId?: string;
  }): Promise<void>;
  
  /**
   * 合并 PR
   */
  mergePR(owner: string, repo: string, prNumber: number, options?: {
    mergeMethod?: 'merge' | 'squash' | 'rebase';
    commitTitle?: string;
    commitMessage?: string;
  }): Promise<void>;
  
  /**
   * 获取 PR Checks 状态
   */
  getPRChecks(owner: string, repo: string, prNumber: number): Promise<any>;
}

// ============================================================================
// 内存实现（MVP 版本）
// ============================================================================

export class InMemoryGitHubConnector implements GitHubConnector {
  private config: Required<GitHubConnectorConfig>;
  private eventListeners: Array<(event: GitHubEvent) => void> = [];
  
  constructor(config: GitHubConnectorConfig = {}) {
    this.config = {
      apiToken: config.apiToken ?? process.env.GITHUB_TOKEN ?? '',
      webhookSecret: config.webhookSecret ?? process.env.GITHUB_WEBHOOK_SECRET ?? '',
      pollingIntervalMs: config.pollingIntervalMs ?? 60000, // 1 分钟
      enablePolling: config.enablePolling ?? false,
      repositories: config.repositories ?? [],
    };
    
    // 启动轮询（如果启用）
    if (this.config.enablePolling) {
      this.startPolling();
    }
  }
  
  async handleWebhook(payload: GitHubWebhookPayload, signature?: string): Promise<GitHubEvent[]> {
    // 验证签名（如果配置了 secret）
    if (this.config.webhookSecret && signature) {
      const valid = this.verifySignature(payload, signature);
      if (!valid) {
        throw new Error('Invalid webhook signature');
      }
    }
    
    const events: GitHubEvent[] = [];
    
    // 处理 PR 事件
    if (payload.action && ['opened', 'reopened', 'synchronize', 'review_requested'].includes(payload.action)) {
      const prEvent: GitHubPREvent = {
        type: 'pr',
        action: payload.action as any,
        repository: {
          owner: payload.repository?.owner?.login ?? '',
          name: payload.repository?.name ?? '',
        },
        pullRequest: {
          number: payload.pull_request?.number ?? 0,
          title: payload.pull_request?.title ?? '',
          state: payload.pull_request?.state ?? 'open',
          user: payload.pull_request?.user?.login ?? '',
          createdAt: payload.pull_request?.created_at ?? new Date().toISOString(),
          updatedAt: payload.pull_request?.updated_at ?? new Date().toISOString(),
        },
        sender: {
          login: payload.sender?.login ?? '',
        },
        timestamp: Date.now(),
      };
      
      events.push(prEvent);
      this.emitEvent(prEvent);
    }
    
    // 处理 Check 事件
    if (payload.check_suite || payload.check_run) {
      const checkEvent: GitHubCheckEvent = {
        type: 'check',
        action: payload.action ?? 'created',
        repository: {
          owner: payload.repository?.owner?.login ?? '',
          name: payload.repository?.name ?? '',
        },
        checkSuite: {
          id: payload.check_suite?.id ?? 0,
          status: payload.check_suite?.status ?? 'queued',
          conclusion: payload.check_suite?.conclusion,
          headBranch: payload.check_suite?.head_branch ?? '',
        },
        timestamp: Date.now(),
      };
      
      events.push(checkEvent);
      this.emitEvent(checkEvent);
    }
    
    return events;
  }
  
  async pollPRs(): Promise<GitHubEvent[]> {
    // MVP 版本：返回空数组
    // 实际实现需要调用 GitHub API
    return [];
  }
  
  async pollChecks(): Promise<GitHubEvent[]> {
    // MVP 版本：返回空数组
    return [];
  }
  
  async getPRDetails(owner: string, repo: string, prNumber: number): Promise<any> {
    // MVP 版本：返回模拟数据
    return {
      number: prNumber,
      title: `PR #${prNumber}`,
      state: 'open',
      user: 'mock-user',
    };
  }
  
  async submitReview(owner: string, repo: string, prNumber: number, review: {
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
    body?: string;
    commitId?: string;
  }): Promise<void> {
    // MVP 版本：记录日志
    console.log(`[GitHub] Submit review for ${owner}/${repo}#${prNumber}: ${review.event}`);
  }
  
  async mergePR(owner: string, repo: string, prNumber: number, options?: any): Promise<void> {
    // MVP 版本：记录日志
    console.log(`[GitHub] Merge PR ${owner}/${repo}#${prNumber}`);
  }
  
  async getPRChecks(owner: string, repo: string, prNumber: number): Promise<any> {
    // MVP 版本：返回模拟数据
    return {
      total_count: 0,
      check_runs: [],
    };
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  private verifySignature(payload: any, signature: string): boolean {
    // MVP 版本：简单验证
    // 实际实现需要计算 HMAC-SHA256
    return true;
  }
  
  private emitEvent(event: GitHubEvent): void {
    for (const listener of this.eventListeners) {
      listener(event);
    }
  }
  
  private startPolling(): void {
    setInterval(() => {
      this.pollPRs().catch(console.error);
      this.pollChecks().catch(console.error);
    }, this.config.pollingIntervalMs);
  }
  
  // ============================================================================
  // 事件订阅
  // ============================================================================
  
  onEvent(listener: (event: GitHubEvent) => void): void {
    this.eventListeners.push(listener);
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createGitHubConnector(config?: GitHubConnectorConfig): GitHubConnector {
  return new InMemoryGitHubConnector(config);
}
