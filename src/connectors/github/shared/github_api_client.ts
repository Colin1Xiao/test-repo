/**
 * GitHub API Client
 * Shared - GitHub API 客户端 (2B-1 / 2B-2 共用)
 * 
 * 职责：
 * - 统一 GitHub API 调用
 * - Token 管理
 * - 错误处理
 */

// ============================================================================
// 配置
// ============================================================================

export interface GitHubApiClientConfig {
  /** GitHub API Token */
  token: string;
  
  /** API 基础 URL */
  baseUrl?: string;
  
  /** 请求超时（毫秒） */
  timeoutMs?: number;
}

// ============================================================================
// GitHub API Client
// ============================================================================

export class GitHubApiClient {
  private config: Required<GitHubApiClientConfig>;
  
  constructor(config: GitHubApiClientConfig) {
    this.config = {
      token: config.token,
      baseUrl: config.baseUrl ?? 'https://api.github.com',
      timeoutMs: config.timeoutMs ?? 10000,
    };
  }
  
  /**
   * GET 请求
   */
  async get<T>(path: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(`${this.config.baseUrl}${path}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }
    
    return this.request<T>('GET', url.toString());
  }
  
  /**
   * POST 请求
   */
  async post<T>(path: string, data?: any): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    return this.request<T>('POST', url, data);
  }
  
  /**
   * PUT 请求
   */
  async put<T>(path: string, data?: any): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    return this.request<T>('PUT', url, data);
  }
  
  /**
   * PATCH 请求
   */
  async patch<T>(path: string, data?: any): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    return this.request<T>('PATCH', url, data);
  }
  
  /**
   * DELETE 请求
   */
  async delete<T>(path: string): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    return this.request<T>('DELETE', url);
  }
  
  // ============================================================================
  // 内部方法
  // ============================================================================
  
  private async request<T>(method: string, url: string, data?: any): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `token ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`GitHub API Error: ${response.status} ${error}`);
      }
      
      return await response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('GitHub API Request Timeout');
      }
      
      throw error;
    }
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createGitHubApiClient(config: GitHubApiClientConfig): GitHubApiClient {
  return new GitHubApiClient(config);
}
