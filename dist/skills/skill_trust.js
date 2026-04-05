"use strict";
/**
 * Skill Trust - Skill 信任评估
 *
 * 职责：
 * 1. 定义 trust level 语义
 * 2. 计算 package 的 trust posture
 * 3. 区分 source trust 与 package trust
 * 4. 输出统一 trust decision 基础对象
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillTrustEvaluator = void 0;
exports.createSkillTrustEvaluator = createSkillTrustEvaluator;
exports.evaluateSkillTrust = evaluateSkillTrust;
exports.isSkillTrusted = isSkillTrusted;
exports.doesSkillRequireApproval = doesSkillRequireApproval;
// ============================================================================
// 信任评估
// ============================================================================
/**
 * 信任评估器
 */
class SkillTrustEvaluator {
    /**
     * 评估信任级别
     */
    evaluateTrust(pkg, sourceType) {
        const source = sourceType || pkg.source;
        const manifestTrustLevel = pkg.manifest.trustLevel;
        // 确定信任级别
        const trustLevel = this.determineTrustLevel(pkg, source);
        // 收集信任信号
        const trustSignals = this.collectTrustSignals(pkg, source);
        // 生成警告
        const warnings = this.generateWarnings(pkg, trustLevel);
        // 判断是否可信
        const isTrusted = this.isTrustedLevel(trustLevel);
        // 判断是否需要审批
        const requiresApproval = this.requiresApproval(trustLevel, source);
        return {
            trustLevel,
            sourceType: source,
            isTrusted,
            requiresApproval,
            trustSignals,
            warnings,
        };
    }
    /**
     * 确定信任级别
     */
    determineTrustLevel(pkg, source) {
        // 如果 manifest 明确声明了 trustLevel，优先使用
        if (pkg.manifest.trustLevel) {
            return pkg.manifest.trustLevel;
        }
        // 根据来源推断
        switch (source) {
            case 'builtin':
                return 'builtin';
            case 'workspace':
                return 'workspace';
            case 'external':
                // 外部来源默认 untrusted，需要验证
                return 'untrusted';
            default:
                return 'workspace';
        }
    }
    /**
     * 收集信任信号
     */
    collectTrustSignals(pkg, source) {
        const signals = [];
        // builtin 信号
        if (source === 'builtin') {
            signals.push({
                type: 'builtin',
                value: 'System built-in skill',
                confidence: 1.0,
            });
        }
        // workspace 本地信号
        if (source === 'workspace') {
            signals.push({
                type: 'workspace_local',
                value: 'Local workspace skill',
                confidence: 0.8,
            });
        }
        // 校验和信号（如果有）
        if (pkg.metadata?.checksum) {
            signals.push({
                type: 'checksum_valid',
                value: pkg.metadata.checksum,
                confidence: 0.9,
            });
        }
        // 发布者信号（如果有）
        if (pkg.manifest.author) {
            signals.push({
                type: 'verified_publisher',
                value: pkg.manifest.author,
                confidence: 0.7,
            });
        }
        return signals;
    }
    /**
     * 生成警告
     */
    generateWarnings(pkg, trustLevel) {
        const warnings = [];
        // untrusted 警告
        if (trustLevel === 'untrusted') {
            warnings.push('This skill is from an untrusted source and requires verification');
        }
        // external 警告
        if (pkg.source === 'external' && trustLevel !== 'verified') {
            warnings.push('External skills should be reviewed before enabling');
        }
        // 无作者信息警告
        if (!pkg.manifest.author) {
            warnings.push('No author information provided');
        }
        // 无许可证警告
        if (!pkg.manifest.license) {
            warnings.push('No license information provided');
        }
        return warnings;
    }
    /**
     * 检查是否是可信级别
     */
    isTrustedLevel(trustLevel) {
        return ['builtin', 'verified', 'workspace'].includes(trustLevel);
    }
    /**
     * 检查是否需要审批
     */
    requiresApproval(trustLevel, source) {
        // builtin 不需要审批
        if (trustLevel === 'builtin') {
            return false;
        }
        // untrusted 需要审批
        if (trustLevel === 'untrusted') {
            return true;
        }
        // external 来源需要审批
        if (source === 'external') {
            return true;
        }
        // verified 和 workspace 不需要审批
        return false;
    }
    /**
     * 检查 skill 是否可信
     */
    isTrusted(pkg) {
        const summary = this.evaluateTrust(pkg);
        return summary.isTrusted;
    }
    /**
     * 获取信任摘要
     */
    getTrustSummary(pkg) {
        return this.evaluateTrust(pkg);
    }
}
exports.SkillTrustEvaluator = SkillTrustEvaluator;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建信任评估器
 */
function createSkillTrustEvaluator() {
    return new SkillTrustEvaluator();
}
/**
 * 快速评估信任
 */
function evaluateSkillTrust(pkg) {
    const evaluator = new SkillTrustEvaluator();
    return evaluator.evaluateTrust(pkg);
}
/**
 * 快速检查是否可信
 */
function isSkillTrusted(pkg) {
    const evaluator = new SkillTrustEvaluator();
    return evaluator.isTrusted(pkg);
}
/**
 * 快速检查是否需要审批
 */
function doesSkillRequireApproval(pkg) {
    const evaluator = new SkillTrustEvaluator();
    const summary = evaluator.evaluateTrust(pkg);
    return summary.requiresApproval;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2tpbGxfdHJ1c3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvc2tpbGxzL3NraWxsX3RydXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7R0FXRzs7O0FBd05ILDhEQUVDO0FBS0QsZ0RBS0M7QUFLRCx3Q0FHQztBQUtELDREQUlDO0FBMU9ELCtFQUErRTtBQUMvRSxPQUFPO0FBQ1AsK0VBQStFO0FBRS9FOztHQUVHO0FBQ0gsTUFBYSxtQkFBbUI7SUFDOUI7O09BRUc7SUFDSCxhQUFhLENBQ1gsR0FBMkIsRUFDM0IsVUFBNEI7UUFFNUIsTUFBTSxNQUFNLEdBQUcsVUFBVSxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUM7UUFDeEMsTUFBTSxrQkFBa0IsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQztRQUVuRCxTQUFTO1FBQ1QsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUV6RCxTQUFTO1FBQ1QsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUUzRCxPQUFPO1FBQ1AsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUV4RCxTQUFTO1FBQ1QsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUVsRCxXQUFXO1FBQ1gsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBRW5FLE9BQU87WUFDTCxVQUFVO1lBQ1YsVUFBVSxFQUFFLE1BQU07WUFDbEIsU0FBUztZQUNULGdCQUFnQjtZQUNoQixZQUFZO1lBQ1osUUFBUTtTQUNULENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7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U0FBZ0IsY0FBYyxDQUFDLEdBQTJCO0lBQ3hELE1BQU0sU0FBUyxHQUFHLElBQUksbUJBQW1CLEVBQUUsQ0FBQztJQUM1QyxPQUFPLFNBQVMsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDbEMsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0Isd0JBQXdCLENBQUMsR0FBMkI7SUFDbEUsTUFBTSxTQUFTLEdBQUcsSUFBSSxtQkFBbUIsRUFBRSxDQUFDO0lBQzVDLE1BQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDN0MsT0FBTyxPQUFPLENBQUMsZ0JBQWdCLENBQUM7QUFDbEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogU2tpbGwgVHJ1c3QgLSBTa2lsbCDkv6Hku7vor4TkvLBcbiAqIFxuICog6IGM6LSj77yaXG4gKiAxLiDlrprkuYkgdHJ1c3QgbGV2ZWwg6K+t5LmJXG4gKiAyLiDorqHnrpcgcGFja2FnZSDnmoQgdHJ1c3QgcG9zdHVyZVxuICogMy4g5Yy65YiGIHNvdXJjZSB0cnVzdCDkuI4gcGFja2FnZSB0cnVzdFxuICogNC4g6L6T5Ye657uf5LiAIHRydXN0IGRlY2lzaW9uIOWfuuehgOWvueixoVxuICogXG4gKiBAdmVyc2lvbiB2MC4xLjBcbiAqIEBkYXRlIDIwMjYtMDQtMDNcbiAqL1xuXG5pbXBvcnQgdHlwZSB7XG4gIFNraWxsUGFja2FnZURlc2NyaXB0b3IsXG4gIFNraWxsVHJ1c3RMZXZlbCxcbiAgU2tpbGxTb3VyY2VUeXBlLFxuICBTa2lsbFRydXN0U3VtbWFyeSxcbiAgU2tpbGxUcnVzdFNpZ25hbCxcbn0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBpc0J1aWx0aW5Tb3VyY2UsIGlzV29ya3NwYWNlU291cmNlLCBpc0V4dGVybmFsU291cmNlIH0gZnJvbSAnLi9za2lsbF9zb3VyY2UnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDkv6Hku7vor4TkvLBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDkv6Hku7vor4TkvLDlmahcbiAqL1xuZXhwb3J0IGNsYXNzIFNraWxsVHJ1c3RFdmFsdWF0b3Ige1xuICAvKipcbiAgICog6K+E5Lyw5L+h5Lu757qn5YirXG4gICAqL1xuICBldmFsdWF0ZVRydXN0KFxuICAgIHBrZzogU2tpbGxQYWNrYWdlRGVzY3JpcHRvcixcbiAgICBzb3VyY2VUeXBlPzogU2tpbGxTb3VyY2VUeXBlXG4gICk6IFNraWxsVHJ1c3RTdW1tYXJ5IHtcbiAgICBjb25zdCBzb3VyY2UgPSBzb3VyY2VUeXBlIHx8IHBrZy5zb3VyY2U7XG4gICAgY29uc3QgbWFuaWZlc3RUcnVzdExldmVsID0gcGtnLm1hbmlmZXN0LnRydXN0TGV2ZWw7XG4gICAgXG4gICAgLy8g56Gu5a6a5L+h5Lu757qn5YirXG4gICAgY29uc3QgdHJ1c3RMZXZlbCA9IHRoaXMuZGV0ZXJtaW5lVHJ1c3RMZXZlbChwa2csIHNvdXJjZSk7XG4gICAgXG4gICAgLy8g5pS26ZuG5L+h5Lu75L+h5Y+3XG4gICAgY29uc3QgdHJ1c3RTaWduYWxzID0gdGhpcy5jb2xsZWN0VHJ1c3RTaWduYWxzKHBrZywgc291cmNlKTtcbiAgICBcbiAgICAvLyDnlJ/miJDorablkYpcbiAgICBjb25zdCB3YXJuaW5ncyA9IHRoaXMuZ2VuZXJhdGVXYXJuaW5ncyhwa2csIHRydXN0TGV2ZWwpO1xuICAgIFxuICAgIC8vIOWIpOaWreaYr+WQpuWPr+S/oVxuICAgIGNvbnN0IGlzVHJ1c3RlZCA9IHRoaXMuaXNUcnVzdGVkTGV2ZWwodHJ1c3RMZXZlbCk7XG4gICAgXG4gICAgLy8g5Yik5pat5piv5ZCm6ZyA6KaB5a6h5om5XG4gICAgY29uc3QgcmVxdWlyZXNBcHByb3ZhbCA9IHRoaXMucmVxdWlyZXNBcHByb3ZhbCh0cnVzdExldmVsLCBzb3VyY2UpO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICB0cnVzdExldmVsLFxuICAgICAgc291cmNlVHlwZTogc291cmNlLFxuICAgICAgaXNUcnVzdGVkLFxuICAgICAgcmVxdWlyZXNBcHByb3ZhbCxcbiAgICAgIHRydXN0U2lnbmFscyxcbiAgICAgIHdhcm5pbmdzLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnoa7lrprkv6Hku7vnuqfliKtcbiAgICovXG4gIHByaXZhdGUgZGV0ZXJtaW5lVHJ1c3RMZXZlbChcbiAgICBwa2c6IFNraWxsUGFja2FnZURlc2NyaXB0b3IsXG4gICAgc291cmNlOiBTa2lsbFNvdXJjZVR5cGVcbiAgKTogU2tpbGxUcnVzdExldmVsIHtcbiAgICAvLyDlpoLmnpwgbWFuaWZlc3Qg5piO56Gu5aOw5piO5LqGIHRydXN0TGV2ZWzvvIzkvJjlhYjkvb/nlKhcbiAgICBpZiAocGtnLm1hbmlmZXN0LnRydXN0TGV2ZWwpIHtcbiAgICAgIHJldHVybiBwa2cubWFuaWZlc3QudHJ1c3RMZXZlbDtcbiAgICB9XG4gICAgXG4gICAgLy8g5qC55o2u5p2l5rqQ5o6o5patXG4gICAgc3dpdGNoIChzb3VyY2UpIHtcbiAgICAgIGNhc2UgJ2J1aWx0aW4nOlxuICAgICAgICByZXR1cm4gJ2J1aWx0aW4nO1xuICAgICAgXG4gICAgICBjYXNlICd3b3Jrc3BhY2UnOlxuICAgICAgICByZXR1cm4gJ3dvcmtzcGFjZSc7XG4gICAgICBcbiAgICAgIGNhc2UgJ2V4dGVybmFsJzpcbiAgICAgICAgLy8g5aSW6YOo5p2l5rqQ6buY6K6kIHVudHJ1c3RlZO+8jOmcgOimgemqjOivgVxuICAgICAgICByZXR1cm4gJ3VudHJ1c3RlZCc7XG4gICAgICBcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiAnd29ya3NwYWNlJztcbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmlLbpm4bkv6Hku7vkv6Hlj7dcbiAgICovXG4gIHByaXZhdGUgY29sbGVjdFRydXN0U2lnbmFscyhcbiAgICBwa2c6IFNraWxsUGFja2FnZURlc2NyaXB0b3IsXG4gICAgc291cmNlOiBTa2lsbFNvdXJjZVR5cGVcbiAgKTogU2tpbGxUcnVzdFNpZ25hbFtdIHtcbiAgICBjb25zdCBzaWduYWxzOiBTa2lsbFRydXN0U2lnbmFsW10gPSBbXTtcbiAgICBcbiAgICAvLyBidWlsdGluIOS/oeWPt1xuICAgIGlmIChzb3VyY2UgPT09ICdidWlsdGluJykge1xuICAgICAgc2lnbmFscy5wdXNoKHtcbiAgICAgICAgdHlwZTogJ2J1aWx0aW4nLFxuICAgICAgICB2YWx1ZTogJ1N5c3RlbSBidWlsdC1pbiBza2lsbCcsXG4gICAgICAgIGNvbmZpZGVuY2U6IDEuMCxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyB3b3Jrc3BhY2Ug5pys5Zyw5L+h5Y+3XG4gICAgaWYgKHNvdXJjZSA9PT0gJ3dvcmtzcGFjZScpIHtcbiAgICAgIHNpZ25hbHMucHVzaCh7XG4gICAgICAgIHR5cGU6ICd3b3Jrc3BhY2VfbG9jYWwnLFxuICAgICAgICB2YWx1ZTogJ0xvY2FsIHdvcmtzcGFjZSBza2lsbCcsXG4gICAgICAgIGNvbmZpZGVuY2U6IDAuOCxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyDmoKHpqozlkozkv6Hlj7fvvIjlpoLmnpzmnInvvIlcbiAgICBpZiAocGtnLm1ldGFkYXRhPy5jaGVja3N1bSkge1xuICAgICAgc2lnbmFscy5wdXNoKHtcbiAgICAgICAgdHlwZTogJ2NoZWNrc3VtX3ZhbGlkJyxcbiAgICAgICAgdmFsdWU6IHBrZy5tZXRhZGF0YS5jaGVja3N1bSBhcyBzdHJpbmcsXG4gICAgICAgIGNvbmZpZGVuY2U6IDAuOSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyDlj5HluIPogIXkv6Hlj7fvvIjlpoLmnpzmnInvvIlcbiAgICBpZiAocGtnLm1hbmlmZXN0LmF1dGhvcikge1xuICAgICAgc2lnbmFscy5wdXNoKHtcbiAgICAgICAgdHlwZTogJ3ZlcmlmaWVkX3B1Ymxpc2hlcicsXG4gICAgICAgIHZhbHVlOiBwa2cubWFuaWZlc3QuYXV0aG9yLFxuICAgICAgICBjb25maWRlbmNlOiAwLjcsXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHNpZ25hbHM7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnlJ/miJDorablkYpcbiAgICovXG4gIHByaXZhdGUgZ2VuZXJhdGVXYXJuaW5ncyhcbiAgICBwa2c6IFNraWxsUGFja2FnZURlc2NyaXB0b3IsXG4gICAgdHJ1c3RMZXZlbDogU2tpbGxUcnVzdExldmVsXG4gICk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcbiAgICBcbiAgICAvLyB1bnRydXN0ZWQg6K2m5ZGKXG4gICAgaWYgKHRydXN0TGV2ZWwgPT09ICd1bnRydXN0ZWQnKSB7XG4gICAgICB3YXJuaW5ncy5wdXNoKCdUaGlzIHNraWxsIGlzIGZyb20gYW4gdW50cnVzdGVkIHNvdXJjZSBhbmQgcmVxdWlyZXMgdmVyaWZpY2F0aW9uJyk7XG4gICAgfVxuICAgIFxuICAgIC8vIGV4dGVybmFsIOitpuWRilxuICAgIGlmIChwa2cuc291cmNlID09PSAnZXh0ZXJuYWwnICYmIHRydXN0TGV2ZWwgIT09ICd2ZXJpZmllZCcpIHtcbiAgICAgIHdhcm5pbmdzLnB1c2goJ0V4dGVybmFsIHNraWxscyBzaG91bGQgYmUgcmV2aWV3ZWQgYmVmb3JlIGVuYWJsaW5nJyk7XG4gICAgfVxuICAgIFxuICAgIC8vIOaXoOS9nOiAheS/oeaBr+itpuWRilxuICAgIGlmICghcGtnLm1hbmlmZXN0LmF1dGhvcikge1xuICAgICAgd2FybmluZ3MucHVzaCgnTm8gYXV0aG9yIGluZm9ybWF0aW9uIHByb3ZpZGVkJyk7XG4gICAgfVxuICAgIFxuICAgIC8vIOaXoOiuuOWPr+ivgeitpuWRilxuICAgIGlmICghcGtnLm1hbmlmZXN0LmxpY2Vuc2UpIHtcbiAgICAgIHdhcm5pbmdzLnB1c2goJ05vIGxpY2Vuc2UgaW5mb3JtYXRpb24gcHJvdmlkZWQnKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHdhcm5pbmdzO1xuICB9XG4gIFxuICAvKipcbiAgICog5qOA5p+l5piv5ZCm5piv5Y+v5L+h57qn5YirXG4gICAqL1xuICBpc1RydXN0ZWRMZXZlbCh0cnVzdExldmVsOiBTa2lsbFRydXN0TGV2ZWwpOiBib29sZWFuIHtcbiAgICByZXR1cm4gWydidWlsdGluJywgJ3ZlcmlmaWVkJywgJ3dvcmtzcGFjZSddLmluY2x1ZGVzKHRydXN0TGV2ZWwpO1xuICB9XG4gIFxuICAvKipcbiAgICog5qOA5p+l5piv5ZCm6ZyA6KaB5a6h5om5XG4gICAqL1xuICByZXF1aXJlc0FwcHJvdmFsKHRydXN0TGV2ZWw6IFNraWxsVHJ1c3RMZXZlbCwgc291cmNlOiBTa2lsbFNvdXJjZVR5cGUpOiBib29sZWFuIHtcbiAgICAvLyBidWlsdGluIOS4jemcgOimgeWuoeaJuVxuICAgIGlmICh0cnVzdExldmVsID09PSAnYnVpbHRpbicpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgXG4gICAgLy8gdW50cnVzdGVkIOmcgOimgeWuoeaJuVxuICAgIGlmICh0cnVzdExldmVsID09PSAndW50cnVzdGVkJykge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIFxuICAgIC8vIGV4dGVybmFsIOadpea6kOmcgOimgeWuoeaJuVxuICAgIGlmIChzb3VyY2UgPT09ICdleHRlcm5hbCcpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBcbiAgICAvLyB2ZXJpZmllZCDlkowgd29ya3NwYWNlIOS4jemcgOimgeWuoeaJuVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOajgOafpSBza2lsbCDmmK/lkKblj6/kv6FcbiAgICovXG4gIGlzVHJ1c3RlZChwa2c6IFNraWxsUGFja2FnZURlc2NyaXB0b3IpOiBib29sZWFuIHtcbiAgICBjb25zdCBzdW1tYXJ5ID0gdGhpcy5ldmFsdWF0ZVRydXN0KHBrZyk7XG4gICAgcmV0dXJuIHN1bW1hcnkuaXNUcnVzdGVkO1xuICB9XG4gIFxuICAvKipcbiAgICog6I635Y+W5L+h5Lu75pGY6KaBXG4gICAqL1xuICBnZXRUcnVzdFN1bW1hcnkocGtnOiBTa2lsbFBhY2thZ2VEZXNjcmlwdG9yKTogU2tpbGxUcnVzdFN1bW1hcnkge1xuICAgIHJldHVybiB0aGlzLmV2YWx1YXRlVHJ1c3QocGtnKTtcbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDkvr/mjbflh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDliJvlu7rkv6Hku7vor4TkvLDlmahcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNraWxsVHJ1c3RFdmFsdWF0b3IoKTogU2tpbGxUcnVzdEV2YWx1YXRvciB7XG4gIHJldHVybiBuZXcgU2tpbGxUcnVzdEV2YWx1YXRvcigpO1xufVxuXG4vKipcbiAqIOW/q+mAn+ivhOS8sOS/oeS7u1xuICovXG5leHBvcnQgZnVuY3Rpb24gZXZhbHVhdGVTa2lsbFRydXN0KFxuICBwa2c6IFNraWxsUGFja2FnZURlc2NyaXB0b3Jcbik6IFNraWxsVHJ1c3RTdW1tYXJ5IHtcbiAgY29uc3QgZXZhbHVhdG9yID0gbmV3IFNraWxsVHJ1c3RFdmFsdWF0b3IoKTtcbiAgcmV0dXJuIGV2YWx1YXRvci5ldmFsdWF0ZVRydXN0KHBrZyk7XG59XG5cbi8qKlxuICog5b+r6YCf5qOA5p+l5piv5ZCm5Y+v5L+hXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1NraWxsVHJ1c3RlZChwa2c6IFNraWxsUGFja2FnZURlc2NyaXB0b3IpOiBib29sZWFuIHtcbiAgY29uc3QgZXZhbHVhdG9yID0gbmV3IFNraWxsVHJ1c3RFdmFsdWF0b3IoKTtcbiAgcmV0dXJuIGV2YWx1YXRvci5pc1RydXN0ZWQocGtnKTtcbn1cblxuLyoqXG4gKiDlv6vpgJ/mo4Dmn6XmmK/lkKbpnIDopoHlrqHmiblcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRvZXNTa2lsbFJlcXVpcmVBcHByb3ZhbChwa2c6IFNraWxsUGFja2FnZURlc2NyaXB0b3IpOiBib29sZWFuIHtcbiAgY29uc3QgZXZhbHVhdG9yID0gbmV3IFNraWxsVHJ1c3RFdmFsdWF0b3IoKTtcbiAgY29uc3Qgc3VtbWFyeSA9IGV2YWx1YXRvci5ldmFsdWF0ZVRydXN0KHBrZyk7XG4gIHJldHVybiBzdW1tYXJ5LnJlcXVpcmVzQXBwcm92YWw7XG59XG4iXX0=