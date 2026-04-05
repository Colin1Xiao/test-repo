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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0aHViX3dlYmhvb2tfdmVyaWZpZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvY29ubmVjdG9ycy9naXRodWIvc2hhcmVkL2dpdGh1Yl93ZWJob29rX3ZlcmlmaWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7OztHQU9HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF3Rkgsa0VBRUM7QUF4RkQsK0NBQWlDO0FBV2pDLCtFQUErRTtBQUMvRSxtQkFBbUI7QUFDbkIsK0VBQStFO0FBRS9FLE1BQWEscUJBQXFCO0lBR2hDLFlBQVksTUFBbUM7UUFDN0MsSUFBSSxDQUFDLE1BQU0sR0FBRztZQUNaLE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTTtTQUN0QixDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0gsTUFBTSxDQUFDLE9BQWUsRUFBRSxTQUFpQjtRQUN2QyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDZixPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7UUFFRCxzQkFBc0I7UUFDdEIsTUFBTSxLQUFLLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNuQyxJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUNoRCxPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7UUFFRCxNQUFNLGlCQUFpQixHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNuQyxNQUFNLGlCQUFpQixHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUV6RCxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsaUJBQWlCLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztJQUNoRSxDQUFDO0lBRUQ7O09BRUc7SUFDSyxnQkFBZ0IsQ0FBQyxPQUFlO1FBQ3RDLE9BQU8sTUFBTTthQUNWLFVBQVUsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7YUFDeEMsTUFBTSxDQUFDLE9BQU8sQ0FBQzthQUNmLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNuQixDQUFDO0lBRUQ7O09BRUc7SUFDSyxXQUFXLENBQUMsQ0FBUyxFQUFFLENBQVM7UUFDdEMsSUFBSSxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUMxQixPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7UUFFRCxJQUFJLE1BQU0sR0FBRyxDQUFDLENBQUM7UUFDZixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ2xDLE1BQU0sSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDOUMsQ0FBQztRQUVELE9BQU8sTUFBTSxLQUFLLENBQUMsQ0FBQztJQUN0QixDQUFDO0lBRUQ7O09BRUc7SUFDSCxZQUFZLENBQUksT0FBZTtRQUM3QixJQUFJLENBQUM7WUFDSCxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFNLENBQUM7UUFDbEMsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixNQUFNLElBQUksS0FBSyxDQUFDLDJCQUEyQixHQUFHLENBQUMsS0FBSyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMxRyxDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBakVELHNEQWlFQztBQUVELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FLFNBQWdCLDJCQUEyQixDQUFDLE1BQW1DO0lBQzdFLE9BQU8sSUFBSSxxQkFBcUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUMzQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBHaXRIdWIgV2ViaG9vayBWZXJpZmllclxuICogU2hhcmVkIC0gV2ViaG9vayDnrb7lkI3pqozor4EgKDJCLTEgLyAyQi0yIOWFseeUqClcbiAqIFxuICog6IGM6LSj77yaXG4gKiAtIOmqjOivgSBXZWJob29rIOetvuWQjVxuICogLSDop6PmnpAgV2ViaG9vayBQYXlsb2FkXG4gKi9cblxuaW1wb3J0ICogYXMgY3J5cHRvIGZyb20gJ2NyeXB0byc7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOmFjee9rlxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgaW50ZXJmYWNlIEdpdEh1YldlYmhvb2tWZXJpZmllckNvbmZpZyB7XG4gIC8qKiBXZWJob29rIFNlY3JldCAqL1xuICBzZWNyZXQ6IHN0cmluZztcbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gV2ViaG9vayBWZXJpZmllclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgR2l0SHViV2ViaG9va1ZlcmlmaWVyIHtcbiAgcHJpdmF0ZSBjb25maWc6IFJlcXVpcmVkPEdpdEh1YldlYmhvb2tWZXJpZmllckNvbmZpZz47XG4gIFxuICBjb25zdHJ1Y3Rvcihjb25maWc6IEdpdEh1YldlYmhvb2tWZXJpZmllckNvbmZpZykge1xuICAgIHRoaXMuY29uZmlnID0ge1xuICAgICAgc2VjcmV0OiBjb25maWcuc2VjcmV0LFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDpqozor4EgV2ViaG9vayDnrb7lkI1cbiAgICovXG4gIHZlcmlmeShwYXlsb2FkOiBzdHJpbmcsIHNpZ25hdHVyZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgaWYgKCFzaWduYXR1cmUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgXG4gICAgLy8g6Kej5p6Q562+5ZCN5qC85byP77yac2hhMjU2PTxoZXg+XG4gICAgY29uc3QgcGFydHMgPSBzaWduYXR1cmUuc3BsaXQoJz0nKTtcbiAgICBpZiAocGFydHMubGVuZ3RoICE9PSAyIHx8IHBhcnRzWzBdICE9PSAnc2hhMjU2Jykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBwcm92aWRlZFNpZ25hdHVyZSA9IHBhcnRzWzFdO1xuICAgIGNvbnN0IGV4cGVjdGVkU2lnbmF0dXJlID0gdGhpcy5jb21wdXRlU2lnbmF0dXJlKHBheWxvYWQpO1xuICAgIFxuICAgIHJldHVybiB0aGlzLnNhZmVDb21wYXJlKHByb3ZpZGVkU2lnbmF0dXJlLCBleHBlY3RlZFNpZ25hdHVyZSk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDorqHnrpfnrb7lkI1cbiAgICovXG4gIHByaXZhdGUgY29tcHV0ZVNpZ25hdHVyZShwYXlsb2FkOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiBjcnlwdG9cbiAgICAgIC5jcmVhdGVIbWFjKCdzaGEyNTYnLCB0aGlzLmNvbmZpZy5zZWNyZXQpXG4gICAgICAudXBkYXRlKHBheWxvYWQpXG4gICAgICAuZGlnZXN0KCdoZXgnKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOWuieWFqOavlOi+g++8iOmYsuatouaXtuW6j+aUu+WHu++8iVxuICAgKi9cbiAgcHJpdmF0ZSBzYWZlQ29tcGFyZShhOiBzdHJpbmcsIGI6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGlmIChhLmxlbmd0aCAhPT0gYi5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgXG4gICAgbGV0IHJlc3VsdCA9IDA7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XG4gICAgICByZXN1bHQgfD0gYS5jaGFyQ29kZUF0KGkpIF4gYi5jaGFyQ29kZUF0KGkpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gcmVzdWx0ID09PSAwO1xuICB9XG4gIFxuICAvKipcbiAgICog6Kej5p6QIFdlYmhvb2sgUGF5bG9hZFxuICAgKi9cbiAgcGFyc2VQYXlsb2FkPFQ+KHJhd0JvZHk6IHN0cmluZyk6IFQge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gSlNPTi5wYXJzZShyYXdCb2R5KSBhcyBUO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgd2ViaG9vayBwYXlsb2FkOiAnICsgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSkpO1xuICAgIH1cbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDlt6XljoLlh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUdpdEh1YldlYmhvb2tWZXJpZmllcihjb25maWc6IEdpdEh1YldlYmhvb2tWZXJpZmllckNvbmZpZyk6IEdpdEh1YldlYmhvb2tWZXJpZmllciB7XG4gIHJldHVybiBuZXcgR2l0SHViV2ViaG9va1ZlcmlmaWVyKGNvbmZpZyk7XG59XG4iXX0=