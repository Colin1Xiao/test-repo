"use strict";
/**
 * Result Normalizer - 结果标准化器
 *
 * 职责：
 * 1. 去除无效包装
 * 2. 提取结构化 summary
 * 3. 提取 findings / blockers / confidence
 * 4. 转为 SubagentResult
 *
 * @version v0.1.0
 * @date 2026-04-03
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultNormalizer = void 0;
exports.createResultNormalizer = createResultNormalizer;
exports.normalizeResult = normalizeResult;
// ============================================================================
// 结果标准化器
// ============================================================================
class ResultNormalizer {
    /**
     * 标准化结果
     */
    normalize(input) {
        // 处理错误情况
        if (input.error) {
            return this.createErrorResult(input);
        }
        // 解析内容
        const parsed = this.parseContent(input.rawContent, input.role);
        // 构建标准化结果
        return {
            subagentTaskId: input.subagentTaskId,
            parentTaskId: input.parentTaskId,
            teamId: input.teamId,
            agent: input.role,
            // 解析结果
            summary: parsed.summary,
            confidence: parsed.confidence,
            artifacts: parsed.artifacts,
            patches: parsed.patches,
            findings: parsed.findings,
            blockers: parsed.blockers,
            recommendations: parsed.recommendations,
            nextSteps: parsed.nextSteps,
            // 使用情况
            turnsUsed: input.turnsUsed,
            tokensUsed: input.usage?.totalTokens,
            durationMs: input.latencyMs,
        };
    }
    /**
     * 创建错误结果
     */
    createErrorResult(input) {
        return {
            subagentTaskId: input.subagentTaskId,
            parentTaskId: input.parentTaskId,
            teamId: input.teamId,
            agent: input.role,
            summary: `任务失败：${input.error?.message || '未知错误'}`,
            confidence: 0,
            turnsUsed: input.turnsUsed,
            tokensUsed: input.usage?.totalTokens || 0,
            durationMs: input.latencyMs,
            error: input.error,
        };
    }
    /**
     * 解析内容
     */
    parseContent(content, role) {
        // 清理内容（去除 markdown 代码块包装等）
        const cleaned = this.cleanContent(content);
        // 根据角色提取结构化信息
        switch (role) {
            case 'planner':
                return this.parsePlannerResult(cleaned);
            case 'repo_reader':
                return this.parseRepoReaderResult(cleaned);
            case 'code_fixer':
                return this.parseCodeFixerResult(cleaned);
            case 'code_reviewer':
                return this.parseCodeReviewerResult(cleaned);
            case 'verify_agent':
                return this.parseVerifyAgentResult(cleaned);
            case 'release_agent':
                return this.parseReleaseAgentResult(cleaned);
            default:
                return this.parseGenericResult(cleaned);
        }
    }
    /**
     * 清理内容
     */
    cleanContent(content) {
        // 去除 markdown 代码块包装
        let cleaned = content.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '');
        // 去除多余空白
        cleaned = cleaned.trim();
        // 去除常见无效前缀
        const prefixes = [
            '好的，',
            '好的，我',
            '让我',
            '我来',
            '以下是',
            '这是',
        ];
        for (const prefix of prefixes) {
            if (cleaned.startsWith(prefix)) {
                cleaned = cleaned.slice(prefix.length);
            }
        }
        return cleaned.trim();
    }
    /**
     * 解析 planner 结果
     */
    parsePlannerResult(content) {
        const result = {
            summary: this.extractSection(content, '任务分析') ||
                this.extractSection(content, '分析') ||
                content.slice(0, 200),
        };
        // 尝试提取置信度
        result.confidence = this.extractConfidence(content);
        // 尝试提取建议
        result.recommendations = this.extractList(content, '建议');
        result.nextSteps = this.extractList(content, '执行顺序') ||
            this.extractList(content, '下一步');
        // 尝试提取风险评估
        const risks = this.extractList(content, '风险');
        if (risks && risks.length > 0) {
            result.blockers = risks;
        }
        // 创建计划文档 artifact
        result.artifacts = [
            {
                type: 'text',
                content: content,
                description: '任务执行计划',
            },
        ];
        return result;
    }
    /**
     * 解析 repo_reader 结果
     */
    parseRepoReaderResult(content) {
        const result = {
            summary: this.extractSection(content, '项目概览') ||
                this.extractSection(content, '概览') ||
                content.slice(0, 200),
        };
        result.confidence = this.extractConfidence(content);
        // 创建项目结构 artifact
        result.artifacts = [
            {
                type: 'text',
                content: content,
                description: '项目结构分析',
            },
        ];
        return result;
    }
    /**
     * 解析 code_fixer 结果
     */
    parseCodeFixerResult(content) {
        const result = {
            summary: this.extractSection(content, '修改摘要') ||
                this.extractSection(content, '摘要') ||
                content.slice(0, 200),
        };
        result.confidence = this.extractConfidence(content);
        // 尝试提取补丁
        const patches = this.extractPatches(content);
        if (patches.length > 0) {
            result.patches = patches;
        }
        // 尝试提取测试建议
        result.recommendations = this.extractList(content, '测试建议');
        // 尝试提取注意事项
        const notes = this.extractList(content, '注意事项');
        if (notes && notes.length > 0) {
            result.blockers = notes.filter(n => n.includes('风险') || n.includes('必须'));
        }
        return result;
    }
    /**
     * 解析 code_reviewer 结果
     */
    parseCodeReviewerResult(content) {
        const result = {
            summary: this.extractSection(content, '审查摘要') ||
                this.extractSection(content, '摘要') ||
                content.slice(0, 200),
        };
        result.confidence = this.extractConfidence(content);
        // 提取发现的问题
        result.findings = this.extractFindings(content);
        // 提取风险评估
        const riskLevel = this.extractRiskLevel(content);
        if (riskLevel) {
            result.blockers = riskLevel === 'high' || riskLevel === 'critical'
                ? ['高风险问题需要修复']
                : undefined;
        }
        // 提取建议
        result.recommendations = this.extractList(content, '建议');
        return result;
    }
    /**
     * 解析 verify_agent 结果
     */
    parseVerifyAgentResult(content) {
        const result = {
            summary: this.extractSection(content, '验证结论') ||
                this.extractSection(content, '结论') ||
                content.slice(0, 200),
        };
        result.confidence = this.extractConfidence(content);
        // 提取阻塞问题
        result.blockers = this.extractList(content, '阻塞问题') ||
            this.extractList(content, '失败');
        // 提取建议
        result.recommendations = this.extractList(content, '建议');
        return result;
    }
    /**
     * 解析 release_agent 结果
     */
    parseReleaseAgentResult(content) {
        const result = {
            summary: this.extractSection(content, '发布摘要') ||
                this.extractSection(content, '摘要') ||
                content.slice(0, 200),
        };
        result.confidence = this.extractConfidence(content);
        // 创建发布说明 artifact
        result.artifacts = [
            {
                type: 'text',
                content: content,
                description: '发布报告',
            },
        ];
        // 提取后续跟进
        result.nextSteps = this.extractList(content, '后续跟进');
        return result;
    }
    /**
     * 解析通用结果
     */
    parseGenericResult(content) {
        return {
            summary: content.slice(0, 500),
            confidence: this.extractConfidence(content),
        };
    }
    // ============================================================================
    // 提取工具方法
    // ============================================================================
    /**
     * 提取章节内容
     */
    extractSection(content, sectionName) {
        const patterns = [
            new RegExp(`##\\s*${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`, 'i'),
            new RegExp(`###\\s*${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n###|\\n##|$)`, 'i'),
            new RegExp(`\\*\\*${sectionName}\\*\\*[:\\s]*([\\s\\S]*?)(?=\\n\\*\\*|$)`, 'i'),
        ];
        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        return '';
    }
    /**
     * 提取列表
     */
    extractList(content, sectionName) {
        let text = content;
        // 如果有章节名，先提取章节
        if (sectionName) {
            const section = this.extractSection(content, sectionName);
            if (section)
                text = section;
        }
        // 提取列表项
        const listPatterns = [
            /^[\s]*[-*•]\s*(.+)$/gm,
            /^[\s]*\d+\.\s*(.+)$/gm,
            /^[\s]*[▪▸▹]\s*(.+)$/gm,
        ];
        const items = [];
        for (const pattern of listPatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                items.push(match[1].trim());
            }
        }
        return items.length > 0 ? items : undefined;
    }
    /**
     * 提取置信度
     */
    extractConfidence(content) {
        // 尝试提取百分比
        const percentageMatch = content.match(/置信度[:：]?\s*(\d+)%/i);
        if (percentageMatch) {
            return parseInt(percentageMatch[1]) / 100;
        }
        // 尝试提取小数
        const decimalMatch = content.match(/置信度[:：]?\s*(0\.\d+)/i);
        if (decimalMatch) {
            return parseFloat(decimalMatch[1]);
        }
        // 尝试提取信心级别
        if (content.includes('高信心') || content.includes('高置信度')) {
            return 0.9;
        }
        if (content.includes('中信心') || content.includes('中等置信度')) {
            return 0.7;
        }
        if (content.includes('低信心') || content.includes('低置信度')) {
            return 0.5;
        }
        // 默认
        return undefined;
    }
    /**
     * 提取补丁
     */
    extractPatches(content) {
        const patches = [];
        // 提取 diff 块
        const diffPattern = /```diff\n([\s\S]*?)```/g;
        let match;
        while ((match = diffPattern.exec(content)) !== null) {
            const diff = match[1];
            // 提取文件名
            const fileMatch = diff.match(/--- a\/(.+)$/m);
            const fileId = fileMatch ? fileMatch[1] : 'unknown';
            // 计算行数
            const linesAdded = (diff.match(/^\+[^+]/gm) || []).length;
            const linesDeleted = (diff.match(/^-[^-]/gm) || []).length;
            patches.push({
                fileId,
                diff,
                hunks: 1,
                linesAdded,
                linesDeleted,
            });
        }
        return patches;
    }
    /**
     * 提取发现的问题
     */
    extractFindings(content) {
        const findings = [];
        // 提取问题章节
        const sections = ['Critical', 'High', 'Medium', 'Low', '问题', '发现'];
        for (const section of sections) {
            const items = this.extractList(content, section);
            if (items) {
                const severity = section.toLowerCase();
                for (const item of items) {
                    findings.push({
                        type: 'issue',
                        severity: this.mapSeverity(section),
                        description: item,
                    });
                }
            }
        }
        return findings.length > 0 ? findings : undefined;
    }
    /**
     * 映射严重程度
     */
    mapSeverity(level) {
        const lower = level.toLowerCase();
        if (lower.includes('critical') || lower === 'critical')
            return 'critical';
        if (lower.includes('high') || lower === 'high')
            return 'high';
        if (lower.includes('medium') || lower === 'medium')
            return 'medium';
        if (lower.includes('low') || lower === 'low')
            return 'low';
        return 'medium';
    }
    /**
     * 提取风险等级
     */
    extractRiskLevel(content) {
        const patterns = [
            { pattern: /风险等级[:：]?\s*Critical/i, level: 'critical' },
            { pattern: /风险等级[:：]?\s*High/i, level: 'high' },
            { pattern: /风险等级[:：]?\s*Medium/i, level: 'medium' },
            { pattern: /风险等级[:：]?\s*Low/i, level: 'low' },
        ];
        for (const { pattern, level } of patterns) {
            if (pattern.test(content)) {
                return level;
            }
        }
        return null;
    }
}
exports.ResultNormalizer = ResultNormalizer;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建结果标准化器
 */
function createResultNormalizer() {
    return new ResultNormalizer();
}
/**
 * 快速标准化结果
 */
function normalizeResult(input) {
    const normalizer = new ResultNormalizer();
    return normalizer.normalize(input);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzdWx0X25vcm1hbGl6ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvYWdlbnRzL3Jlc3VsdF9ub3JtYWxpemVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7R0FXRzs7O0FBeWhCSCx3REFFQztBQUtELDBDQUdDO0FBMWVELCtFQUErRTtBQUMvRSxTQUFTO0FBQ1QsK0VBQStFO0FBRS9FLE1BQWEsZ0JBQWdCO0lBQzNCOztPQUVHO0lBQ0gsU0FBUyxDQUFDLEtBQXlCO1FBQ2pDLFNBQVM7UUFDVCxJQUFJLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNoQixPQUFPLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN2QyxDQUFDO1FBRUQsT0FBTztRQUNQLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFL0QsVUFBVTtRQUNWLE9BQU87WUFDTCxjQUFjLEVBQUUsS0FBSyxDQUFDLGNBQWM7WUFDcEMsWUFBWSxFQUFFLEtBQUssQ0FBQyxZQUFZO1lBQ2hDLE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBTTtZQUNwQixLQUFLLEVBQUUsS0FBSyxDQUFDLElBQUk7WUFFakIsT0FBTztZQUNQLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTztZQUN2QixVQUFVLEVBQUUsTUFBTSxDQUFDLFVBQVU7WUFDN0IsU0FBUyxFQUFFLE1BQU0sQ0FBQyxTQUFTO1lBQzNCLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTztZQUN2QixRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVE7WUFDekIsUUFBUSxFQUFFLE1BQU0sQ0FBQyxRQUFRO1lBQ3pCLGVBQWUsRUFBRSxNQUFNLENBQUMsZUFBZTtZQUN2QyxTQUFTLEVBQUUsTUFBTSxDQUFDLFNBQVM7WUFFM0IsT0FBTztZQUNQLFNBQVMsRUFBRSxLQUFL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c0I7SUFDcEMsT0FBTyxJQUFJLGdCQUFnQixFQUFFLENBQUM7QUFDaEMsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0IsZUFBZSxDQUFDLEtBQXlCO0lBQ3ZELE1BQU0sVUFBVSxHQUFHLElBQUksZ0JBQWdCLEVBQUUsQ0FBQztJQUMxQyxPQUFPLFVBQVUsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDckMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUmVzdWx0IE5vcm1hbGl6ZXIgLSDnu5PmnpzmoIflh4bljJblmahcbiAqIFxuICog6IGM6LSj77yaXG4gKiAxLiDljrvpmaTml6DmlYjljIXoo4VcbiAqIDIuIOaPkOWPlue7k+aehOWMliBzdW1tYXJ5XG4gKiAzLiDmj5Dlj5YgZmluZGluZ3MgLyBibG9ja2VycyAvIGNvbmZpZGVuY2VcbiAqIDQuIOi9rOS4uiBTdWJhZ2VudFJlc3VsdFxuICogXG4gKiBAdmVyc2lvbiB2MC4xLjBcbiAqIEBkYXRlIDIwMjYtMDQtMDNcbiAqL1xuXG5pbXBvcnQgdHlwZSB7IFN1YmFnZW50UmVzdWx0LCBTdWJhZ2VudFJvbGUsIEFydGlmYWN0UmVmLCBGaW5kaW5nLCBQYXRjaFJlZiB9IGZyb20gJy4vdHlwZXMnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDnsbvlnovlrprkuYlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDmoIflh4bljJbovpPlhaVcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBOb3JtYWxpemF0aW9uSW5wdXQge1xuICAvLyDouqvku71cbiAgc3ViYWdlbnRUYXNrSWQ6IHN0cmluZztcbiAgcGFyZW50VGFza0lkOiBzdHJpbmc7XG4gIHRlYW1JZDogc3RyaW5nO1xuICByb2xlOiBTdWJhZ2VudFJvbGU7XG4gIFxuICAvLyDljp/lp4vlhoXlrrlcbiAgcmF3Q29udGVudDogc3RyaW5nO1xuICBcbiAgLy8g5L2/55So5oOF5Ya1XG4gIHVzYWdlPzoge1xuICAgIGlucHV0VG9rZW5zPzogbnVtYmVyO1xuICAgIG91dHB1dFRva2Vucz86IG51bWJlcjtcbiAgICB0b3RhbFRva2Vucz86IG51bWJlcjtcbiAgfTtcbiAgXG4gIC8vIOaAp+iDvVxuICBsYXRlbmN5TXM6IG51bWJlcjtcbiAgdHVybnNVc2VkOiBudW1iZXI7XG4gIFxuICAvLyDlrozmiJDljp/lm6BcbiAgZmluaXNoUmVhc29uOiAnc3RvcCcgfCAnbGVuZ3RoJyB8ICd0aW1lb3V0JyB8ICdlcnJvcicgfCAndG9vbF9jYWxsJztcbiAgXG4gIC8vIOmUmeivr1xuICBlcnJvcj86IHtcbiAgICB0eXBlOiBzdHJpbmc7XG4gICAgbWVzc2FnZTogc3RyaW5nO1xuICAgIHJlY292ZXJhYmxlOiBib29sZWFuO1xuICB9O1xufVxuXG4vKipcbiAqIOino+aekOWQjueahOS4remXtOe7k+aenFxuICovXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlZFJlc3VsdCB7XG4gIHN1bW1hcnk6IHN0cmluZztcbiAgY29uZmlkZW5jZT86IG51bWJlcjtcbiAgYXJ0aWZhY3RzPzogQXJ0aWZhY3RSZWZbXTtcbiAgcGF0Y2hlcz86IFBhdGNoUmVmW107XG4gIGZpbmRpbmdzPzogRmluZGluZ1tdO1xuICBibG9ja2Vycz86IHN0cmluZ1tdO1xuICByZWNvbW1lbmRhdGlvbnM/OiBzdHJpbmdbXTtcbiAgbmV4dFN0ZXBzPzogc3RyaW5nW107XG59XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIOe7k+aenOagh+WHhuWMluWZqFxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgY2xhc3MgUmVzdWx0Tm9ybWFsaXplciB7XG4gIC8qKlxuICAgKiDmoIflh4bljJbnu5PmnpxcbiAgICovXG4gIG5vcm1hbGl6ZShpbnB1dDogTm9ybWFsaXphdGlvbklucHV0KTogU3ViYWdlbnRSZXN1bHQge1xuICAgIC8vIOWkhOeQhumUmeivr+aDheWGtVxuICAgIGlmIChpbnB1dC5lcnJvcikge1xuICAgICAgcmV0dXJuIHRoaXMuY3JlYXRlRXJyb3JSZXN1bHQoaW5wdXQpO1xuICAgIH1cbiAgICBcbiAgICAvLyDop6PmnpDlhoXlrrlcbiAgICBjb25zdCBwYXJzZWQgPSB0aGlzLnBhcnNlQ29udGVudChpbnB1dC5yYXdDb250ZW50LCBpbnB1dC5yb2xlKTtcbiAgICBcbiAgICAvLyDmnoTlu7rmoIflh4bljJbnu5PmnpxcbiAgICByZXR1cm4ge1xuICAgICAgc3ViYWdlbnRUYXNrSWQ6IGlucHV0LnN1YmFnZW50VGFza0lkLFxuICAgICAgcGFyZW50VGFza0lkOiBpbnB1dC5wYXJlbnRUYXNrSWQsXG4gICAgICB0ZWFtSWQ6IGlucHV0LnRlYW1JZCxcbiAgICAgIGFnZW50OiBpbnB1dC5yb2xlLFxuICAgICAgXG4gICAgICAvLyDop6PmnpDnu5PmnpxcbiAgICAgIHN1bW1hcnk6IHBhcnNlZC5zdW1tYXJ5LFxuICAgICAgY29uZmlkZW5jZTogcGFyc2VkLmNvbmZpZGVuY2UsXG4gICAgICBhcnRpZmFjdHM6IHBhcnNlZC5hcnRpZmFjdHMsXG4gICAgICBwYXRjaGVzOiBwYXJzZWQucGF0Y2hlcyxcbiAgICAgIGZpbmRpbmdzOiBwYXJzZWQuZmluZGluZ3MsXG4gICAgICBibG9ja2VyczogcGFyc2VkLmJsb2NrZXJzLFxuICAgICAgcmVjb21tZW5kYXRpb25zOiBwYXJzZWQucmVjb21tZW5kYXRpb25zLFxuICAgICAgbmV4dFN0ZXBzOiBwYXJzZWQubmV4dFN0ZXBzLFxuICAgICAgXG4gICAgICAvLyDkvb/nlKjmg4XlhrVcbiAgICAgIHR1cm5zVXNlZDogaW5wdXQudHVybnNVc2VkLFxuICAgICAgdG9rZW5zVXNlZDogaW5wdXQudXNhZ2U/LnRvdGFsVG9rZW5zLFxuICAgICAgZHVyYXRpb25NczogaW5wdXQubGF0ZW5jeU1zLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDliJvlu7rplJnor6/nu5PmnpxcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlRXJyb3JSZXN1bHQoaW5wdXQ6IE5vcm1hbGl6YXRpb25JbnB1dCk6IFN1YmFnZW50UmVzdWx0IHtcbiAgICByZXR1cm4ge1xuICAgICAgc3ViYWdlbnRUYXNrSWQ6IGlucHV0LnN1YmFnZW50VGFza0lkLFxuICAgICAgcGFyZW50VGFza0lkOiBpbnB1dC5wYXJlbnRUYXNrSWQsXG4gICAgICB0ZWFtSWQ6IGlucHV0LnRlYW1JZCxcbiAgICAgIGFnZW50OiBpbnB1dC5yb2xlLFxuICAgICAgc3VtbWFyeTogYOS7u+WKoeWksei0pe+8miR7aW5wdXQuZXJyb3I/Lm1lc3NhZ2UgfHwgJ+acquefpemUmeivryd9YCxcbiAgICAgIGNvbmZpZGVuY2U6IDAsXG4gICAgICB0dXJuc1VzZWQ6IGlucHV0LnR1cm5zVXNlZCxcbiAgICAgIHRva2Vuc1VzZWQ6IGlucHV0LnVzYWdlPy50b3RhbFRva2VucyB8fCAwLFxuICAgICAgZHVyYXRpb25NczogaW5wdXQubGF0ZW5jeU1zLFxuICAgICAgZXJyb3I6IGlucHV0LmVycm9yLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDop6PmnpDlhoXlrrlcbiAgICovXG4gIHByaXZhdGUgcGFyc2VDb250ZW50KGNvbnRlbnQ6IHN0cmluZywgcm9sZTogU3ViYWdlbnRSb2xlKTogUGFyc2VkUmVzdWx0IHtcbiAgICAvLyDmuIXnkIblhoXlrrnvvIjljrvpmaQgbWFya2Rvd24g5Luj56CB5Z2X5YyF6KOF562J77yJXG4gICAgY29uc3QgY2xlYW5lZCA9IHRoaXMuY2xlYW5Db250ZW50KGNvbnRlbnQpO1xuICAgIFxuICAgIC8vIOagueaNruinkuiJsuaPkOWPlue7k+aehOWMluS/oeaBr1xuICAgIHN3aXRjaCAocm9sZSkge1xuICAgICAgY2FzZSAncGxhbm5lcic6XG4gICAgICAgIHJldHVybiB0aGlzLnBhcnNlUGxhbm5lclJlc3VsdChjbGVhbmVkKTtcbiAgICAgIGNhc2UgJ3JlcG9fcmVhZGVyJzpcbiAgICAgICAgcmV0dXJuIHRoaXMucGFyc2VSZXBvUmVhZGVyUmVzdWx0KGNsZWFuZWQpO1xuICAgICAgY2FzZSAnY29kZV9maXhlcic6XG4gICAgICAgIHJldHVybiB0aGlzLnBhcnNlQ29kZUZpeGVyUmVzdWx0KGNsZWFuZWQpO1xuICAgICAgY2FzZSAnY29kZV9yZXZpZXdlcic6XG4gICAgICAgIHJldHVybiB0aGlzLnBhcnNlQ29kZVJldmlld2VyUmVzdWx0KGNsZWFuZWQpO1xuICAgICAgY2FzZSAndmVyaWZ5X2FnZW50JzpcbiAgICAgICAgcmV0dXJuIHRoaXMucGFyc2VWZXJpZnlBZ2VudFJlc3VsdChjbGVhbmVkKTtcbiAgICAgIGNhc2UgJ3JlbGVhc2VfYWdlbnQnOlxuICAgICAgICByZXR1cm4gdGhpcy5wYXJzZVJlbGVhc2VBZ2VudFJlc3VsdChjbGVhbmVkKTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiB0aGlzLnBhcnNlR2VuZXJpY1Jlc3VsdChjbGVhbmVkKTtcbiAgICB9XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmuIXnkIblhoXlrrlcbiAgICovXG4gIHByaXZhdGUgY2xlYW5Db250ZW50KGNvbnRlbnQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgLy8g5Y676ZmkIG1hcmtkb3duIOS7o+eggeWdl+WMheijhVxuICAgIGxldCBjbGVhbmVkID0gY29udGVudC5yZXBsYWNlKC9eYGBgW1xcd10qXFxuPy9nbSwgJycpLnJlcGxhY2UoL2BgYCQvZ20sICcnKTtcbiAgICBcbiAgICAvLyDljrvpmaTlpJrkvZnnqbrnmb1cbiAgICBjbGVhbmVkID0gY2xlYW5lZC50cmltKCk7XG4gICAgXG4gICAgLy8g5Y676Zmk5bi46KeB5peg5pWI5YmN57yAXG4gICAgY29uc3QgcHJlZml4ZXMgPSBbXG4gICAgICAn5aW955qE77yMJyxcbiAgICAgICflpb3nmoTvvIzmiJEnLFxuICAgICAgJ+iuqeaIkScsXG4gICAgICAn5oiR5p2lJyxcbiAgICAgICfku6XkuIvmmK8nLFxuICAgICAgJ+i/meaYrycsXG4gICAgXTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHByZWZpeCBvZiBwcmVmaXhlcykge1xuICAgICAgaWYgKGNsZWFuZWQuc3RhcnRzV2l0aChwcmVmaXgpKSB7XG4gICAgICAgIGNsZWFuZWQgPSBjbGVhbmVkLnNsaWNlKHByZWZpeC5sZW5ndGgpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gY2xlYW5lZC50cmltKCk7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDop6PmnpAgcGxhbm5lciDnu5PmnpxcbiAgICovXG4gIHByaXZhdGUgcGFyc2VQbGFubmVyUmVzdWx0KGNvbnRlbnQ6IHN0cmluZyk6IFBhcnNlZFJlc3VsdCB7XG4gICAgY29uc3QgcmVzdWx0OiBQYXJzZWRSZXN1bHQgPSB7XG4gICAgICBzdW1tYXJ5OiB0aGlzLmV4dHJhY3RTZWN0aW9uKGNvbnRlbnQsICfku7vliqHliIbmnpAnKSB8fCBcbiAgICAgICAgICAgICAgIHRoaXMuZXh0cmFjdFNlY3Rpb24oY29udGVudCwgJ+WIhuaekCcpIHx8XG4gICAgICAgICAgICAgICBjb250ZW50LnNsaWNlKDAsIDIwMCksXG4gICAgfTtcbiAgICBcbiAgICAvLyDlsJ3or5Xmj5Dlj5bnva7kv6HluqZcbiAgICByZXN1bHQuY29uZmlkZW5jZSA9IHRoaXMuZXh0cmFjdENvbmZpZGVuY2UoY29udGVudCk7XG4gICAgXG4gICAgLy8g5bCd6K+V5o+Q5Y+W5bu66K6uXG4gICAgcmVzdWx0LnJlY29tbWVuZGF0aW9ucyA9IHRoaXMuZXh0cmFjdExpc3QoY29udGVudCwgJ+W7uuiuricpO1xuICAgIHJlc3VsdC5uZXh0U3RlcHMgPSB0aGlzLmV4dHJhY3RMaXN0KGNvbnRlbnQsICfmiafooYzpobrluo8nKSB8fCBcbiAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5leHRyYWN0TGlzdChjb250ZW50LCAn5LiL5LiA5q2lJyk7XG4gICAgXG4gICAgLy8g5bCd6K+V5o+Q5Y+W6aOO6Zmp6K+E5LywXG4gICAgY29uc3Qgcmlza3MgPSB0aGlzLmV4dHJhY3RMaXN0KGNvbnRlbnQsICfpo47pmaknKTtcbiAgICBpZiAocmlza3MgJiYgcmlza3MubGVuZ3RoID4gMCkge1xuICAgICAgcmVzdWx0LmJsb2NrZXJzID0gcmlza3M7XG4gICAgfVxuICAgIFxuICAgIC8vIOWIm+W7uuiuoeWIkuaWh+ahoyBhcnRpZmFjdFxuICAgIHJlc3VsdC5hcnRpZmFjdHMgPSBbXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICd0ZXh0JyxcbiAgICAgICAgY29udGVudDogY29udGVudCxcbiAgICAgICAgZGVzY3JpcHRpb246ICfku7vliqHmiafooYzorqHliJInLFxuICAgICAgfSxcbiAgICBdO1xuICAgIFxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDop6PmnpAgcmVwb19yZWFkZXIg57uT5p6cXG4gICAqL1xuICBwcml2YXRlIHBhcnNlUmVwb1JlYWRlclJlc3VsdChjb250ZW50OiBzdHJpbmcpOiBQYXJzZWRSZXN1bHQge1xuICAgIGNvbnN0IHJlc3VsdDogUGFyc2VkUmVzdWx0ID0ge1xuICAgICAgc3VtbWFyeTogdGhpcy5leHRyYWN0U2VjdGlvbihjb250ZW50LCAn6aG555uu5qaC6KeIJykgfHwgXG4gICAgICAgICAgICAgICB0aGlzLmV4dHJhY3RTZWN0aW9uKGNvbnRlbnQsICfmpoLop4gnKSB8fFxuICAgICAgICAgICAgICAgY29udGVudC5zbGljZSgwLCAyMDApLFxuICAgIH07XG4gICAgXG4gICAgcmVzdWx0LmNvbmZpZGVuY2UgPSB0aGlzLmV4dHJhY3RDb25maWRlbmNlKGNvbnRlbnQpO1xuICAgIFxuICAgIC8vIOWIm+W7uumhueebrue7k+aehCBhcnRpZmFjdFxuICAgIHJlc3VsdC5hcnRpZmFjdHMgPSBbXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICd0ZXh0JyxcbiAgICAgICAgY29udGVudDogY29udGVudCxcbiAgICAgICAgZGVzY3JpcHRpb246ICfpobnnm67nu5PmnoTliIbmnpAnLFxuICAgICAgfSxcbiAgICBdO1xuICAgIFxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDop6PmnpAgY29kZV9maXhlciDnu5PmnpxcbiAgICovXG4gIHByaXZhdGUgcGFyc2VDb2RlRml4ZXJSZXN1bHQoY29udGVudDogc3RyaW5nKTogUGFyc2VkUmVzdWx0IHtcbiAgICBjb25zdCByZXN1bHQ6IFBhcnNlZFJlc3VsdCA9IHtcbiAgICAgIHN1bW1hcnk6IHRoaXMuZXh0cmFjdFNlY3Rpb24oY29udGVudCwgJ+S/ruaUueaRmOimgScpIHx8IFxuICAgICAgICAgICAgICAgdGhpcy5leHRyYWN0U2VjdGlvbihjb250ZW50LCAn5pGY6KaBJykgfHxcbiAgICAgICAgICAgICAgIGNvbnRlbnQuc2xpY2UoMCwgMjAwKSxcbiAgICB9O1xuICAgIFxuICAgIHJlc3VsdC5jb25maWRlbmNlID0gdGhpcy5leHRyYWN0Q29uZmlkZW5jZShjb250ZW50KTtcbiAgICBcbiAgICAvLyDlsJ3or5Xmj5Dlj5booaXkuIFcbiAgICBjb25zdCBwYXRjaGVzID0gdGhpcy5leHRyYWN0UGF0Y2hlcyhjb250ZW50KTtcbiAgICBpZiAocGF0Y2hlcy5sZW5ndGggPiAwKSB7XG4gICAgICByZXN1bHQucGF0Y2hlcyA9IHBhdGNoZXM7XG4gICAgfVxuICAgIFxuICAgIC8vIOWwneivleaPkOWPlua1i+ivleW7uuiurlxuICAgIHJlc3VsdC5yZWNvbW1lbmRhdGlvbnMgPSB0aGlzLmV4dHJhY3RMaXN0KGNvbnRlbnQsICfmtYvor5Xlu7rorq4nKTtcbiAgICBcbiAgICAvLyDlsJ3or5Xmj5Dlj5bms6jmhI/kuovpoblcbiAgICBjb25zdCBub3RlcyA9IHRoaXMuZXh0cmFjdExpc3QoY29udGVudCwgJ+azqOaEj+S6i+mhuScpO1xuICAgIGlmIChub3RlcyAmJiBub3Rlcy5sZW5ndGggPiAwKSB7XG4gICAgICByZXN1bHQuYmxvY2tlcnMgPSBub3Rlcy5maWx0ZXIobiA9PiBuLmluY2x1ZGVzKCfpo47pmaknKSB8fCBuLmluY2x1ZGVzKCflv4XpobsnKSk7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDop6PmnpAgY29kZV9yZXZpZXdlciDnu5PmnpxcbiAgICovXG4gIHByaXZhdGUgcGFyc2VDb2RlUmV2aWV3ZXJSZXN1bHQoY29udGVudDogc3RyaW5nKTogUGFyc2VkUmVzdWx0IHtcbiAgICBjb25zdCByZXN1bHQ6IFBhcnNlZFJlc3VsdCA9IHtcbiAgICAgIHN1bW1hcnk6IHRoaXMuZXh0cmFjdFNlY3Rpb24oY29udGVudCwgJ+WuoeafpeaRmOimgScpIHx8IFxuICAgICAgICAgICAgICAgdGhpcy5leHRyYWN0U2VjdGlvbihjb250ZW50LCAn5pGY6KaBJykgfHxcbiAgICAgICAgICAgICAgIGNvbnRlbnQuc2xpY2UoMCwgMjAwKSxcbiAgICB9O1xuICAgIFxuICAgIHJlc3VsdC5jb25maWRlbmNlID0gdGhpcy5leHRyYWN0Q29uZmlkZW5jZShjb250ZW50KTtcbiAgICBcbiAgICAvLyDmj5Dlj5blj5HnjrDnmoTpl67pophcbiAgICByZXN1bHQuZmluZGluZ3MgPSB0aGlzLmV4dHJhY3RGaW5kaW5ncyhjb250ZW50KTtcbiAgICBcbiAgICAvLyDmj5Dlj5bpo47pmanor4TkvLBcbiAgICBjb25zdCByaXNrTGV2ZWwgPSB0aGlzLmV4dHJhY3RSaXNrTGV2ZWwoY29udGVudCk7XG4gICAgaWYgKHJpc2tMZXZlbCkge1xuICAgICAgcmVzdWx0LmJsb2NrZXJzID0gcmlza0xldmVsID09PSAnaGlnaCcgfHwgcmlza0xldmVsID09PSAnY3JpdGljYWwnIFxuICAgICAgICA/IFsn6auY6aOO6Zmp6Zeu6aKY6ZyA6KaB5L+u5aSNJ10gXG4gICAgICAgIDogdW5kZWZpbmVkO1xuICAgIH1cbiAgICBcbiAgICAvLyDmj5Dlj5blu7rorq5cbiAgICByZXN1bHQucmVjb21tZW5kYXRpb25zID0gdGhpcy5leHRyYWN0TGlzdChjb250ZW50LCAn5bu66K6uJyk7XG4gICAgXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOino+aekCB2ZXJpZnlfYWdlbnQg57uT5p6cXG4gICAqL1xuICBwcml2YXRlIHBhcnNlVmVyaWZ5QWdlbnRSZXN1bHQoY29udGVudDogc3RyaW5nKTogUGFyc2VkUmVzdWx0IHtcbiAgICBjb25zdCByZXN1bHQ6IFBhcnNlZFJlc3VsdCA9IHtcbiAgICAgIHN1bW1hcnk6IHRoaXMuZXh0cmFjdFNlY3Rpb24oY29udGVudCwgJ+mqjOivgee7k+iuuicpIHx8IFxuICAgICAgICAgICAgICAgdGhpcy5leHRyYWN0U2VjdGlvbihjb250ZW50LCAn57uT6K66JykgfHxcbiAgICAgICAgICAgICAgIGNvbnRlbnQuc2xpY2UoMCwgMjAwKSxcbiAgICB9O1xuICAgIFxuICAgIHJlc3VsdC5jb25maWRlbmNlID0gdGhpcy5leHRyYWN0Q29uZmlkZW5jZShjb250ZW50KTtcbiAgICBcbiAgICAvLyDmj5Dlj5bpmLvloZ7pl67pophcbiAgICByZXN1bHQuYmxvY2tlcnMgPSB0aGlzLmV4dHJhY3RMaXN0KGNvbnRlbnQsICfpmLvloZ7pl67popgnKSB8fCBcbiAgICAgICAgICAgICAgICAgICAgICB0aGlzLmV4dHJhY3RMaXN0KGNvbnRlbnQsICflpLHotKUnKTtcbiAgICBcbiAgICAvLyDmj5Dlj5blu7rorq5cbiAgICByZXN1bHQucmVjb21tZW5kYXRpb25zID0gdGhpcy5leHRyYWN0TGlzdChjb250ZW50LCAn5bu66K6uJyk7XG4gICAgXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOino+aekCByZWxlYXNlX2FnZW50IOe7k+aenFxuICAgKi9cbiAgcHJpdmF0ZSBwYXJzZVJlbGVhc2VBZ2VudFJlc3VsdChjb250ZW50OiBzdHJpbmcpOiBQYXJzZWRSZXN1bHQge1xuICAgIGNvbnN0IHJlc3VsdDogUGFyc2VkUmVzdWx0ID0ge1xuICAgICAgc3VtbWFyeTogdGhpcy5leHRyYWN0U2VjdGlvbihjb250ZW50LCAn5Y+R5biD5pGY6KaBJykgfHwgXG4gICAgICAgICAgICAgICB0aGlzLmV4dHJhY3RTZWN0aW9uKGNvbnRlbnQsICfmkZjopoEnKSB8fFxuICAgICAgICAgICAgICAgY29udGVudC5zbGljZSgwLCAyMDApLFxuICAgIH07XG4gICAgXG4gICAgcmVzdWx0LmNvbmZpZGVuY2UgPSB0aGlzLmV4dHJhY3RDb25maWRlbmNlKGNvbnRlbnQpO1xuICAgIFxuICAgIC8vIOWIm+W7uuWPkeW4g+ivtOaYjiBhcnRpZmFjdFxuICAgIHJlc3VsdC5hcnRpZmFjdHMgPSBbXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICd0ZXh0JyxcbiAgICAgICAgY29udGVudDogY29udGVudCxcbiAgICAgICAgZGVzY3JpcHRpb246ICflj5HluIPmiqXlkYonLFxuICAgICAgfSxcbiAgICBdO1xuICAgIFxuICAgIC8vIOaPkOWPluWQjue7rei3n+i/m1xuICAgIHJlc3VsdC5uZXh0U3RlcHMgPSB0aGlzLmV4dHJhY3RMaXN0KGNvbnRlbnQsICflkI7nu63ot5/ov5snKTtcbiAgICBcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIFxuICAvKipcbiAgICog6Kej5p6Q6YCa55So57uT5p6cXG4gICAqL1xuICBwcml2YXRlIHBhcnNlR2VuZXJpY1Jlc3VsdChjb250ZW50OiBzdHJpbmcpOiBQYXJzZWRSZXN1bHQge1xuICAgIHJldHVybiB7XG4gICAgICBzdW1tYXJ5OiBjb250ZW50LnNsaWNlKDAsIDUwMCksXG4gICAgICBjb25maWRlbmNlOiB0aGlzLmV4dHJhY3RDb25maWRlbmNlKGNvbnRlbnQpLFxuICAgIH07XG4gIH1cbiAgXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8g5o+Q5Y+W5bel5YW35pa55rOVXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgXG4gIC8qKlxuICAgKiDmj5Dlj5bnq6DoioLlhoXlrrlcbiAgICovXG4gIHByaXZhdGUgZXh0cmFjdFNlY3Rpb24oY29udGVudDogc3RyaW5nLCBzZWN0aW9uTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBwYXR0ZXJucyA9IFtcbiAgICAgIG5ldyBSZWdFeHAoYCMjXFxcXHMqJHtzZWN0aW9uTmFtZX1cXFxccypcXFxcbihbXFxcXHNcXFxcU10qPykoPz1cXFxcbiMjfCQpYCwgJ2knKSxcbiAgICAgIG5ldyBSZWdFeHAoYCMjI1xcXFxzKiR7c2VjdGlvbk5hbWV9XFxcXHMqXFxcXG4oW1xcXFxzXFxcXFNdKj8pKD89XFxcXG4jIyN8XFxcXG4jI3wkKWAsICdpJyksXG4gICAgICBuZXcgUmVnRXhwKGBcXFxcKlxcXFwqJHtzZWN0aW9uTmFtZX1cXFxcKlxcXFwqWzpcXFxcc10qKFtcXFxcc1xcXFxTXSo/KSg/PVxcXFxuXFxcXCpcXFxcKnwkKWAsICdpJyksXG4gICAgXTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBhdHRlcm4gb2YgcGF0dGVybnMpIHtcbiAgICAgIGNvbnN0IG1hdGNoID0gY29udGVudC5tYXRjaChwYXR0ZXJuKTtcbiAgICAgIGlmIChtYXRjaCAmJiBtYXRjaFsxXSkge1xuICAgICAgICByZXR1cm4gbWF0Y2hbMV0udHJpbSgpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gJyc7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmj5Dlj5bliJfooahcbiAgICovXG4gIHByaXZhdGUgZXh0cmFjdExpc3QoY29udGVudDogc3RyaW5nLCBzZWN0aW9uTmFtZT86IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgICBsZXQgdGV4dCA9IGNvbnRlbnQ7XG4gICAgXG4gICAgLy8g5aaC5p6c5pyJ56ug6IqC5ZCN77yM5YWI5o+Q5Y+W56ug6IqCXG4gICAgaWYgKHNlY3Rpb25OYW1lKSB7XG4gICAgICBjb25zdCBzZWN0aW9uID0gdGhpcy5leHRyYWN0U2VjdGlvbihjb250ZW50LCBzZWN0aW9uTmFtZSk7XG4gICAgICBpZiAoc2VjdGlvbikgdGV4dCA9IHNlY3Rpb247XG4gICAgfVxuICAgIFxuICAgIC8vIOaPkOWPluWIl+ihqOmhuVxuICAgIGNvbnN0IGxpc3RQYXR0ZXJucyA9IFtcbiAgICAgIC9eW1xcc10qWy0q4oCiXVxccyooLispJC9nbSxcbiAgICAgIC9eW1xcc10qXFxkK1xcLlxccyooLispJC9nbSxcbiAgICAgIC9eW1xcc10qW+KWquKWuOKWuV1cXHMqKC4rKSQvZ20sXG4gICAgXTtcbiAgICBcbiAgICBjb25zdCBpdGVtczogc3RyaW5nW10gPSBbXTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHBhdHRlcm4gb2YgbGlzdFBhdHRlcm5zKSB7XG4gICAgICBsZXQgbWF0Y2g7XG4gICAgICB3aGlsZSAoKG1hdGNoID0gcGF0dGVybi5leGVjKHRleHQpKSAhPT0gbnVsbCkge1xuICAgICAgICBpdGVtcy5wdXNoKG1hdGNoWzFdLnRyaW0oKSk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBpdGVtcy5sZW5ndGggPiAwID8gaXRlbXMgOiB1bmRlZmluZWQgYXMgYW55O1xuICB9XG4gIFxuICAvKipcbiAgICog5o+Q5Y+W572u5L+h5bqmXG4gICAqL1xuICBwcml2YXRlIGV4dHJhY3RDb25maWRlbmNlKGNvbnRlbnQ6IHN0cmluZyk6IG51bWJlciB8IHVuZGVmaW5lZCB7XG4gICAgLy8g5bCd6K+V5o+Q5Y+W55m+5YiG5q+UXG4gICAgY29uc3QgcGVyY2VudGFnZU1hdGNoID0gY29udGVudC5tYXRjaCgv572u5L+h5bqmWzrvvJpdP1xccyooXFxkKyklL2kpO1xuICAgIGlmIChwZXJjZW50YWdlTWF0Y2gpIHtcbiAgICAgIHJldHVybiBwYXJzZUludChwZXJjZW50YWdlTWF0Y2hbMV0pIC8gMTAwO1xuICAgIH1cbiAgICBcbiAgICAvLyDlsJ3or5Xmj5Dlj5blsI/mlbBcbiAgICBjb25zdCBkZWNpbWFsTWF0Y2ggPSBjb250ZW50Lm1hdGNoKC/nva7kv6HluqZbOu+8ml0/XFxzKigwXFwuXFxkKykvaSk7XG4gICAgaWYgKGRlY2ltYWxNYXRjaCkge1xuICAgICAgcmV0dXJuIHBhcnNlRmxvYXQoZGVjaW1hbE1hdGNoWzFdKTtcbiAgICB9XG4gICAgXG4gICAgLy8g5bCd6K+V5o+Q5Y+W5L+h5b+D57qn5YirXG4gICAgaWYgKGNvbnRlbnQuaW5jbHVkZXMoJ+mrmOS/oeW/gycpIHx8IGNvbnRlbnQuaW5jbHVkZXMoJ+mrmOe9ruS/oeW6picpKSB7XG4gICAgICByZXR1cm4gMC45O1xuICAgIH1cbiAgICBpZiAoY29udGVudC5pbmNsdWRlcygn5Lit5L+h5b+DJykgfHwgY29udGVudC5pbmNsdWRlcygn5Lit562J572u5L+h5bqmJykpIHtcbiAgICAgIHJldHVybiAwLjc7XG4gICAgfVxuICAgIGlmIChjb250ZW50LmluY2x1ZGVzKCfkvY7kv6Hlv4MnKSB8fCBjb250ZW50LmluY2x1ZGVzKCfkvY7nva7kv6HluqYnKSkge1xuICAgICAgcmV0dXJuIDAuNTtcbiAgICB9XG4gICAgXG4gICAgLy8g6buY6K6kXG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOaPkOWPluihpeS4gVxuICAgKi9cbiAgcHJpdmF0ZSBleHRyYWN0UGF0Y2hlcyhjb250ZW50OiBzdHJpbmcpOiBQYXRjaFJlZltdIHtcbiAgICBjb25zdCBwYXRjaGVzOiBQYXRjaFJlZltdID0gW107XG4gICAgXG4gICAgLy8g5o+Q5Y+WIGRpZmYg5Z2XXG4gICAgY29uc3QgZGlmZlBhdHRlcm4gPSAvYGBgZGlmZlxcbihbXFxzXFxTXSo/KWBgYC9nO1xuICAgIGxldCBtYXRjaDtcbiAgICBcbiAgICB3aGlsZSAoKG1hdGNoID0gZGlmZlBhdHRlcm4uZXhlYyhjb250ZW50KSkgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IGRpZmYgPSBtYXRjaFsxXTtcbiAgICAgIFxuICAgICAgLy8g5o+Q5Y+W5paH5Lu25ZCNXG4gICAgICBjb25zdCBmaWxlTWF0Y2ggPSBkaWZmLm1hdGNoKC8tLS0gYVxcLyguKykkL20pO1xuICAgICAgY29uc3QgZmlsZUlkID0gZmlsZU1hdGNoID8gZmlsZU1hdGNoWzFdIDogJ3Vua25vd24nO1xuICAgICAgXG4gICAgICAvLyDorqHnrpfooYzmlbBcbiAgICAgIGNvbnN0IGxpbmVzQWRkZWQgPSAoZGlmZi5tYXRjaCgvXlxcK1teK10vZ20pIHx8IFtdKS5sZW5ndGg7XG4gICAgICBjb25zdCBsaW5lc0RlbGV0ZWQgPSAoZGlmZi5tYXRjaCgvXi1bXi1dL2dtKSB8fCBbXSkubGVuZ3RoO1xuICAgICAgXG4gICAgICBwYXRjaGVzLnB1c2goe1xuICAgICAgICBmaWxlSWQsXG4gICAgICAgIGRpZmYsXG4gICAgICAgIGh1bmtzOiAxLFxuICAgICAgICBsaW5lc0FkZGVkLFxuICAgICAgICBsaW5lc0RlbGV0ZWQsXG4gICAgICB9KTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHBhdGNoZXM7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmj5Dlj5blj5HnjrDnmoTpl67pophcbiAgICovXG4gIHByaXZhdGUgZXh0cmFjdEZpbmRpbmdzKGNvbnRlbnQ6IHN0cmluZyk6IEZpbmRpbmdbXSB7XG4gICAgY29uc3QgZmluZGluZ3M6IEZpbmRpbmdbXSA9IFtdO1xuICAgIFxuICAgIC8vIOaPkOWPlumXrumimOeroOiKglxuICAgIGNvbnN0IHNlY3Rpb25zID0gWydDcml0aWNhbCcsICdIaWdoJywgJ01lZGl1bScsICdMb3cnLCAn6Zeu6aKYJywgJ+WPkeeOsCddO1xuICAgIFxuICAgIGZvciAoY29uc3Qgc2VjdGlvbiBvZiBzZWN0aW9ucykge1xuICAgICAgY29uc3QgaXRlbXMgPSB0aGlzLmV4dHJhY3RMaXN0KGNvbnRlbnQsIHNlY3Rpb24pO1xuICAgICAgaWYgKGl0ZW1zKSB7XG4gICAgICAgIGNvbnN0IHNldmVyaXR5ID0gc2VjdGlvbi50b0xvd2VyQ2FzZSgpIGFzIEZpbmRpbmdbJ3NldmVyaXR5J107XG4gICAgICAgIFxuICAgICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcbiAgICAgICAgICBmaW5kaW5ncy5wdXNoKHtcbiAgICAgICAgICAgIHR5cGU6ICdpc3N1ZScsXG4gICAgICAgICAgICBzZXZlcml0eTogdGhpcy5tYXBTZXZlcml0eShzZWN0aW9uKSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBpdGVtLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBmaW5kaW5ncy5sZW5ndGggPiAwID8gZmluZGluZ3MgOiB1bmRlZmluZWQgYXMgYW55O1xuICB9XG4gIFxuICAvKipcbiAgICog5pig5bCE5Lil6YeN56iL5bqmXG4gICAqL1xuICBwcml2YXRlIG1hcFNldmVyaXR5KGxldmVsOiBzdHJpbmcpOiBGaW5kaW5nWydzZXZlcml0eSddIHtcbiAgICBjb25zdCBsb3dlciA9IGxldmVsLnRvTG93ZXJDYXNlKCk7XG4gICAgXG4gICAgaWYgKGxvd2VyLmluY2x1ZGVzKCdjcml0aWNhbCcpIHx8IGxvd2VyID09PSAnY3JpdGljYWwnKSByZXR1cm4gJ2NyaXRpY2FsJztcbiAgICBpZiAobG93ZXIuaW5jbHVkZXMoJ2hpZ2gnKSB8fCBsb3dlciA9PT0gJ2hpZ2gnKSByZXR1cm4gJ2hpZ2gnO1xuICAgIGlmIChsb3dlci5pbmNsdWRlcygnbWVkaXVtJykgfHwgbG93ZXIgPT09ICdtZWRpdW0nKSByZXR1cm4gJ21lZGl1bSc7XG4gICAgaWYgKGxvd2VyLmluY2x1ZGVzKCdsb3cnKSB8fCBsb3dlciA9PT0gJ2xvdycpIHJldHVybiAnbG93JztcbiAgICBcbiAgICByZXR1cm4gJ21lZGl1bSc7XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDmj5Dlj5bpo47pmannrYnnuqdcbiAgICovXG4gIHByaXZhdGUgZXh0cmFjdFJpc2tMZXZlbChjb250ZW50OiBzdHJpbmcpOiAnbG93JyB8ICdtZWRpdW0nIHwgJ2hpZ2gnIHwgJ2NyaXRpY2FsJyB8IG51bGwge1xuICAgIGNvbnN0IHBhdHRlcm5zID0gW1xuICAgICAgeyBwYXR0ZXJuOiAv6aOO6Zmp562J57qnWzrvvJpdP1xccypDcml0aWNhbC9pLCBsZXZlbDogJ2NyaXRpY2FsJyB9LFxuICAgICAgeyBwYXR0ZXJuOiAv6aOO6Zmp562J57qnWzrvvJpdP1xccypIaWdoL2ksIGxldmVsOiAnaGlnaCcgfSxcbiAgICAgIHsgcGF0dGVybjogL+mjjumZqeetiee6p1s677yaXT9cXHMqTWVkaXVtL2ksIGxldmVsOiAnbWVkaXVtJyB9LFxuICAgICAgeyBwYXR0ZXJuOiAv6aOO6Zmp562J57qnWzrvvJpdP1xccypMb3cvaSwgbGV2ZWw6ICdsb3cnIH0sXG4gICAgXTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHsgcGF0dGVybiwgbGV2ZWwgfSBvZiBwYXR0ZXJucykge1xuICAgICAgaWYgKHBhdHRlcm4udGVzdChjb250ZW50KSkge1xuICAgICAgICByZXR1cm4gbGV2ZWwgYXMgYW55O1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDkvr/mjbflh73mlbBcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuLyoqXG4gKiDliJvlu7rnu5PmnpzmoIflh4bljJblmahcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVJlc3VsdE5vcm1hbGl6ZXIoKTogUmVzdWx0Tm9ybWFsaXplciB7XG4gIHJldHVybiBuZXcgUmVzdWx0Tm9ybWFsaXplcigpO1xufVxuXG4vKipcbiAqIOW/q+mAn+agh+WHhuWMlue7k+aenFxuICovXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplUmVzdWx0KGlucHV0OiBOb3JtYWxpemF0aW9uSW5wdXQpOiBTdWJhZ2VudFJlc3VsdCB7XG4gIGNvbnN0IG5vcm1hbGl6ZXIgPSBuZXcgUmVzdWx0Tm9ybWFsaXplcigpO1xuICByZXR1cm4gbm9ybWFsaXplci5ub3JtYWxpemUoaW5wdXQpO1xufVxuIl19