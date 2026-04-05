"use strict";
/**
 * GitHub Webhook Verifier
 * Shared - Webhook 签名验证 (2B-1 / 2B-2 共用)
 *
 * 职责：
 * - 验证 Webhook 签名
 * - 解析 Webhook Payload
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubWebhookVerifier = void 0;
exports.createGitHubWebhookVerifier = createGitHubWebhookVerifier;
const crypto = __importStar(require("crypto"));
// ============================================================================
// Webhook Verifier
// ============================================================================
class GitHubWebhookVerifier {
    constructor(config) {
        this.config = {
            secret: config.secret,
        };
    }
    /**
     * 验证 Webhook 签名
     */
    verify(payload, signature) {
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
    computeSignature(payload) {
        return crypto
            .createHmac('sha256', this.config.secret)
            .update(payload)
            .digest('hex');
    }
    /**
     * 安全比较（防止时序攻击）
     */
    safeCompare(a, b) {
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
    parsePayload(rawBody) {
        try {
            return JSON.parse(rawBody);
        }
        catch (error) {
            throw new Error('Invalid webhook payload: ' + (error instanceof Error ? error.message : String(error)));
        }
    }
}
exports.GitHubWebhookVerifier = GitHubWebhookVerifier;
// ============================================================================
// 工厂函数
// ============================================================================
function createGitHubWebhookVerifier(config) {
    return new GitHubWebhookVerifier(config);
}
