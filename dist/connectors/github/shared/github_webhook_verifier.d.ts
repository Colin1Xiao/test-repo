/**
 * GitHub Webhook Verifier
 * Shared - Webhook 签名验证 (2B-1 / 2B-2 共用)
 *
 * 职责：
 * - 验证 Webhook 签名
 * - 解析 Webhook Payload
 */
export interface GitHubWebhookVerifierConfig {
    /** Webhook Secret */
    secret: string;
}
export declare class GitHubWebhookVerifier {
    private config;
    constructor(config: GitHubWebhookVerifierConfig);
    /**
     * 验证 Webhook 签名
     */
    verify(payload: string, signature: string): boolean;
    /**
     * 计算签名
     */
    private computeSignature;
    /**
     * 安全比较（防止时序攻击）
     */
    private safeCompare;
    /**
     * 解析 Webhook Payload
     */
    parsePayload<T>(rawBody: string): T;
}
export declare function createGitHubWebhookVerifier(config: GitHubWebhookVerifierConfig): GitHubWebhookVerifier;
