/**
 * GitHub API Client
 * Shared - GitHub API 客户端 (2B-1 / 2B-2 共用)
 *
 * 职责：
 * - 统一 GitHub API 调用
 * - Token 管理
 * - 错误处理
 */
export interface GitHubApiClientConfig {
    /** GitHub API Token */
    token: string;
    /** API 基础 URL */
    baseUrl?: string;
    /** 请求超时（毫秒） */
    timeoutMs?: number;
}
export declare class GitHubApiClient {
    private config;
    constructor(config: GitHubApiClientConfig);
    /**
     * GET 请求
     */
    get<T>(path: string, params?: Record<string, any>): Promise<T>;
    /**
     * POST 请求
     */
    post<T>(path: string, data?: any): Promise<T>;
    /**
     * PUT 请求
     */
    put<T>(path: string, data?: any): Promise<T>;
    /**
     * PATCH 请求
     */
    patch<T>(path: string, data?: any): Promise<T>;
    /**
     * DELETE 请求
     */
    delete<T>(path: string): Promise<T>;
    private request;
}
export declare function createGitHubApiClient(config: GitHubApiClientConfig): GitHubApiClient;
