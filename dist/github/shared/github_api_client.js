"use strict";
/**
 * GitHub API Client
 * Shared - GitHub API 客户端 (2B-1 / 2B-2 共用)
 *
 * 职责：
 * - 统一 GitHub API 调用
 * - Token 管理
 * - 错误处理
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubApiClient = void 0;
exports.createGitHubApiClient = createGitHubApiClient;
// ============================================================================
// GitHub API Client
// ============================================================================
class GitHubApiClient {
    constructor(config) {
        this.config = {
            token: config.token,
            baseUrl: config.baseUrl ?? 'https://api.github.com',
            timeoutMs: config.timeoutMs ?? 10000,
        };
    }
    /**
     * GET 请求
     */
    async get(path, params) {
        const url = new URL(`${this.config.baseUrl}${path}`);
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                url.searchParams.append(key, String(value));
            });
        }
        return this.request('GET', url.toString());
    }
    /**
     * POST 请求
     */
    async post(path, data) {
        const url = `${this.config.baseUrl}${path}`;
        return this.request('POST', url, data);
    }
    /**
     * PUT 请求
     */
    async put(path, data) {
        const url = `${this.config.baseUrl}${path}`;
        return this.request('PUT', url, data);
    }
    /**
     * PATCH 请求
     */
    async patch(path, data) {
        const url = `${this.config.baseUrl}${path}`;
        return this.request('PATCH', url, data);
    }
    /**
     * DELETE 请求
     */
    async delete(path) {
        const url = `${this.config.baseUrl}${path}`;
        return this.request('DELETE', url);
    }
    // ============================================================================
    // 内部方法
    // ============================================================================
    async request(method, url, data) {
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
            return await response.json();
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('GitHub API Request Timeout');
            }
            throw error;
        }
    }
}
exports.GitHubApiClient = GitHubApiClient;
// ============================================================================
// 工厂函数
// ============================================================================
function createGitHubApiClient(config) {
    return new GitHubApiClient(config);
}
