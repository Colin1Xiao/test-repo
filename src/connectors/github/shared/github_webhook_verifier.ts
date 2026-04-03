/**
 * GitHub Webhook Verifier
 * Shared - Webhook 签名验证 (2B-1 / 2B-2 共用)
 * 
 * 职责：
 * - 验证 Webhook 签名
 * - 解析 Webhook Payload
 */

import * as crypto from 'crypto';

// ============================================================================
// 配置
// ============================================================================

export interface GitHubWebhookVerifierConfig {
  /** Webhook Secret */
  secret: string;
}

// ============================================================================
// Webhook Verifier
// ============================================================================

export class GitHubWebhookVerifier {
  private config: Required<GitHubWebhookVerifierConfig>;
  
  constructor(config: GitHubWebhookVerifierConfig) {
    this.config = {
      secret: config.secret,
    };
  }
  
  /**
   * 验证 Webhook 签名
   */
  verify(payload: string, signature: string): boolean {
    if (!signature) {
      return false;
    }
    
    // 解析签名格式：sha256=<hex>
    const parts = signature.split('=');
    if (parts.length !== 2 || parts[0] !== 'sha256') {
      return false;
    }
    
    const providedSignature = parts[1];
    const expectedSignature = this.computeSignature(payload);
    
    return this.safeCompare(providedSignature, expectedSignature);
  }
  
  /**
   * 计算签名
   */
  private computeSignature(payload: string): string {
    return crypto
      .createHmac('sha256', this.config.secret)
      .update(payload)
      .digest('hex');
  }
  
  /**
   * 安全比较（防止时序攻击）
   */
  private safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }
  
  /**
   * 解析 Webhook Payload
   */
  parsePayload<T>(rawBody: string): T {
    try {
      return JSON.parse(rawBody) as T;
    } catch (error) {
      throw new Error('Invalid webhook payload: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

export function createGitHubWebhookVerifier(config: GitHubWebhookVerifierConfig): GitHubWebhookVerifier {
  return new GitHubWebhookVerifier(config);
}
