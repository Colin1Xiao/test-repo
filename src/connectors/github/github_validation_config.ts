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

// ============================================================================
// 验证配置
// ============================================================================

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

// ============================================================================
// 默认配置（从环境变量读取）
// ============================================================================

export function getGitHubValidationConfig(): GitHubValidationConfig {
  return {
    owner: process.env.GITHUB_TEST_OWNER ?? 'openclaw',
    repo: process.env.GITHUB_TEST_REPO ?? 'test-repo',
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET ?? 'test-secret',
    apiToken: process.env.GITHUB_TOKEN ?? '',
    testReviewers: (process.env.GITHUB_TEST_REVIEWERS ?? 'colin,tester').split(','),
    mode: (process.env.GITHUB_VALIDATION_MODE as any) ?? 'dry-run',
    webhookUrl: process.env.GITHUB_WEBHOOK_URL,
    createTestPR: process.env.GITHUB_CREATE_TEST_PR === 'true',
    autoCleanup: process.env.GITHUB_AUTO_CLEANUP === 'true',
  };
}

// ============================================================================
// 测试用例配置
// ============================================================================

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
export const GITHUB_TEST_CASES: GitHubTestCase[] = [
  {
    id: 'pr_opened_001',
    name: 'PR Opened - 基本测试',
    type: 'pr_opened',
    expected: {
      taskCreated: true,
      inboxItemCreated: true,
    },
    payload: {
      action: 'opened',
      number: 1,
      title: 'Test PR for validation',
      user: { login: 'test-user' },
    },
  },
  {
    id: 'review_requested_001',
    name: 'Review Requested - 基本测试',
    type: 'review_requested',
    expected: {
      approvalCreated: true,
      inboxItemCreated: true,
    },
    payload: {
      action: 'review_requested',
      number: 1,
      title: 'Test PR for validation',
      user: { login: 'test-user' },
      requested_reviewers: [{ login: 'colin' }],
    },
  },
  {
    id: 'check_failed_001',
    name: 'Check Failed - 基本测试',
    type: 'check_failed',
    expected: {
      incidentCreated: true,
      inboxItemCreated: true,
    },
    payload: {
      action: 'completed',
      check_suite: {
        id: 12345,
        status: 'completed',
        conclusion: 'failure',
        head_branch: 'main',
      },
    },
  },
  {
    id: 'approve_001',
    name: 'Approve Action - 回写测试',
    type: 'approve',
    expected: {
      githubWriteback: true,
    },
  },
  {
    id: 'reject_001',
    name: 'Reject Action - 回写测试',
    type: 'reject',
    expected: {
      githubWriteback: true,
    },
  },
];

// ============================================================================
// 验证报告
// ============================================================================

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

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 生成测试 Webhook Payload
 */
export function generateTestWebhookPayload(
  testCase: GitHubTestCase,
  config: GitHubValidationConfig
): any {
  const basePayload = {
    repository: {
      owner: { login: config.owner },
      name: config.repo,
      full_name: `${config.owner}/${config.repo}`,
    },
    sender: {
      login: 'test-user',
    },
    ...testCase.payload,
  };
  
  if (testCase.type === 'pr_opened' || testCase.type === 'review_requested') {
    return {
      ...basePayload,
      pull_request: {
        number: testCase.payload?.number ?? 1,
        title: testCase.payload?.title ?? 'Test PR',
        state: 'open',
        user: testCase.payload?.user ?? { login: 'test-user' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        requested_reviewers: testCase.payload?.requested_reviewers ?? [],
      },
    };
  }
  
  if (testCase.type === 'check_failed') {
    return {
      ...basePayload,
      check_suite: testCase.payload?.check_suite,
    };
  }
  
  return basePayload;
}

/**
 * 验证配置是否完整
 */
export function validateConfig(config: GitHubValidationConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 必需配置
  if (!config.owner) errors.push('Missing owner');
  if (!config.repo) errors.push('Missing repo');
  if (!config.webhookSecret) errors.push('Missing webhookSecret');
  
  // Live 模式需要 API Token
  if (config.mode === 'live' && !config.apiToken) {
    errors.push('Live mode requires apiToken');
  }
  
  // Dry-run 模式警告
  if (config.mode === 'dry-run') {
    warnings.push('Running in dry-run mode, no real GitHub API calls');
  }
  
  // Webhook URL 警告
  if (!config.webhookUrl && config.mode === 'live') {
    warnings.push('No webhookUrl configured, GitHub webhook may not reach local server');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
