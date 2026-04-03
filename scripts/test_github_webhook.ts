#!/usr/bin/env ts-node
/**
 * GitHub Webhook 测试工具
 * Phase 2B-1-V - 发送测试 Webhook 到本地服务器
 * 
 * 使用方法：
 *   ts-node scripts/test_github_webhook.ts pr_opened
 *   ts-node scripts/test_github_webhook.ts review_requested
 *   ts-node scripts/test_github_webhook.ts check_failed
 * 
 * 环境变量：
 *   GITHUB_WEBHOOK_URL - 本地 Webhook URL (默认：http://localhost:3000/webhook/github)
 *   GITHUB_WEBHOOK_SECRET - Webhook Secret
 */

import * as crypto from 'crypto';

// ============================================================================
// 测试 Payload
// ============================================================================

const TEST_PAYLOADS: Record<string, any> = {
  pr_opened: {
    action: 'opened',
    number: 1,
    pull_request: {
      number: 1,
      title: 'Test PR for validation',
      state: 'open',
      user: { login: 'test-user' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      body: 'This is a test PR for GitHub Connector validation',
      head: {
        ref: 'feature/test',
        sha: 'abc123',
      },
      base: {
        ref: 'main',
        sha: 'def456',
      },
    },
    repository: {
      owner: { login: 'openclaw' },
      name: 'test-repo',
      full_name: 'openclaw/test-repo',
    },
    sender: {
      login: 'test-user',
    },
  },
  
  review_requested: {
    action: 'review_requested',
    number: 1,
    pull_request: {
      number: 1,
      title: 'Test PR for validation',
      state: 'open',
      user: { login: 'test-user' },
      requested_reviewers: [
        { login: 'colin' },
        { login: 'reviewer' },
      ],
    },
    repository: {
      owner: { login: 'openclaw' },
      name: 'test-repo',
      full_name: 'openclaw/test-repo',
    },
    sender: {
      login: 'test-user',
    },
  },
  
  check_failed: {
    action: 'completed',
    check_suite: {
      id: 12345,
      status: 'completed',
      conclusion: 'failure',
      head_branch: 'main',
      head_sha: 'abc123',
    },
    repository: {
      owner: { login: 'openclaw' },
      name: 'test-repo',
      full_name: 'openclaw/test-repo',
    },
    sender: {
      login: 'github-actions',
    },
  },
};

// ============================================================================
// 辅助函数
// ============================================================================

function generateSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return `sha256=${digest}`;
}

async function sendWebhook(
  url: string,
  payload: any,
  secret: string,
  eventType: string
): Promise<{ status: number; body: string }> {
  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(payloadString, secret);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-GitHub-Event': eventType,
      'X-GitHub-Delivery': `test-${Date.now()}`,
      'X-Hub-Signature-256': signature,
    },
    body: payloadString,
  });
  
  const body = await response.text();
  
  return {
    status: response.status,
    body,
  };
}

// ============================================================================
// 主函数
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const eventType = args[0];
  
  if (!eventType) {
    console.log('用法：ts-node test_github_webhook.ts <event_type>');
    console.log('');
    console.log('支持的 event_type:');
    console.log('  pr_opened       - PR Opened 事件');
    console.log('  review_requested - Review Requested 事件');
    console.log('  check_failed    - Check Failed 事件');
    console.log('  all             - 发送所有测试事件');
    console.log('');
    console.log('环境变量:');
    console.log('  GITHUB_WEBHOOK_URL    - Webhook URL (默认：http://localhost:3000/webhook/github)');
    console.log('  GITHUB_WEBHOOK_SECRET - Webhook Secret (默认：test-secret)');
    process.exit(1);
  }
  
  const webhookUrl = process.env.GITHUB_WEBHOOK_URL ?? 'http://localhost:3000/webhook/github';
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET ?? 'test-secret';
  
  const eventTypes = eventType === 'all' 
    ? Object.keys(TEST_PAYLOADS)
    : [eventType];
  
  console.log('🚀 发送 GitHub 测试 Webhook...\n');
  console.log(`Webhook URL: ${webhookUrl}`);
  console.log(`Webhook Secret: ${webhookSecret ? '***' : '(none)'}`);
  console.log();
  
  for (const type of eventTypes) {
    const payload = TEST_PAYLOADS[type];
    
    if (!payload) {
      console.error(`❌ 未知的事件类型：${type}`);
      continue;
    }
    
    console.log(`📤 发送 ${type}...`);
    
    try {
      const result = await sendWebhook(webhookUrl, payload, webhookSecret, type);
      
      if (result.status >= 200 && result.status < 300) {
        console.log(`   ✅ 成功 (${result.status})`);
      } else {
        console.log(`   ❌ 失败 (${result.status}): ${result.body}`);
      }
    } catch (error) {
      console.log(`   ❌ 错误：${error instanceof Error ? error.message : String(error)}`);
    }
    
    // 间隔 1 秒
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('测试完成');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// 运行
main();
