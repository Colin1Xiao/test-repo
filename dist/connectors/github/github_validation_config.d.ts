/**
 * GitHub Validation Config
 * Phase 2B-1-V - GitHub 端到端验证配置
 *
 * 职责：
 * - 定义测试仓库配置
 * - 定义 Webhook 配置
 * - 定义测试用户/Reviewer
 * - 支持 dry-run / live 模式
 */
export interface GitHubValidationConfig {
    /** 测试仓库 Owner */
    owner: string;
    /** 测试仓库名称 */
    repo: string;
    /** Webhook Secret */
    webhookSecret: string;
    /** GitHub Token (用于 API 调用) */
    apiToken: string;
    /** 测试 Reviewer 列表 */
    testReviewers: string[];
    /** 运行模式 */
    mode: 'dry-run' | 'live';
    /** Webhook URL (本地测试用 ngrok 等) */
    webhookUrl?: string;
    /** 创建测试 PR */
    createTestPR?: boolean;
    /** 自动清理测试 PR */
    autoCleanup?: boolean;
}
export declare function getGitHubValidationConfig(): GitHubValidationConfig;
export interface GitHubTestCase {
    /** 测试用例 ID */
    id: string;
    /** 测试用例名称 */
    name: string;
    /** 测试类型 */
    type: 'pr_opened' | 'review_requested' | 'check_failed' | 'approve' | 'reject';
    /** 预期结果 */
    expected: {
        taskCreated?: boolean;
        approvalCreated?: boolean;
        incidentCreated?: boolean;
        inboxItemCreated?: boolean;
        githubWriteback?: boolean;
    };
    /** 测试数据 */
    payload?: any;
}
/**
 * 预定义测试用例
 */
export declare const GITHUB_TEST_CASES: GitHubTestCase[];
export interface ValidationReport {
    /** 验证时间 */
    timestamp: number;
    /** 测试用例结果 */
    testResults: Array<{
        testCaseId: string;
        passed: boolean;
        message?: string;
        duration?: number;
    }>;
    /** 总体状态 */
    overall: 'passed' | 'failed' | 'partial';
    /** 详细信息 */
    details?: Record<string, any>;
}
/**
 * 生成测试 Webhook Payload
 */
export declare function generateTestWebhookPayload(testCase: GitHubTestCase, config: GitHubValidationConfig): any;
/**
 * 验证配置是否完整
 */
export declare function validateConfig(config: GitHubValidationConfig): {
    valid: boolean;
    errors: string[];
    warnings: string[];
};
