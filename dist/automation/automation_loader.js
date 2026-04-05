"use strict";
/**
 * Automation Loader - 自动化配置加载器
 *
 * 职责：
 * 1. 读取 hooks.yaml / automation.yaml
 * 2. 解析 YAML
 * 3. 调 schema 校验
 * 4. 转成 runtime rule 对象
 * 5. 支持默认规则 + workspace 规则合并
 * 6. 支持热加载
 *
 * @version v0.1.0
 * @date 2026-04-03
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
exports.AutomationLoader = void 0;
exports.createAutomationLoader = createAutomationLoader;
exports.loadAutomationRules = loadAutomationRules;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const automation_schema_1 = require("./automation_schema");
// ============================================================================
// YAML 解析（简化实现）
// ============================================================================
/**
 * 解析 YAML 字符串
 * 简化实现：实际应该使用 js-yaml 库
 */
function parseYaml(content) {
    // 简化实现：这里只做基本的 JSON 兼容解析
    // 实际应该使用 js-yaml 库
    try {
        // 尝试作为 JSON 解析（YAML 是 JSON 的超集）
        return JSON.parse(content);
    }
    catch {
        // 简化 YAML 解析：仅支持非常基础的格式
        const result = {};
        const lines = content.split('\n');
        let currentKey = '';
        let currentArray = [];
        for (const line of lines) {
            const trimmed = line.trim();
            // 跳过空行和注释
            if (!trimmed || trimmed.startsWith('#')) {
                continue;
            }
            // 检测数组项
            if (trimmed.startsWith('- ')) {
                const value = trimmed.slice(2).trim();
                currentArray.push(parseYamlValue(value));
            }
            else if (trimmed.includes(':')) {
                // 保存之前的数组
                if (currentArray.length > 0 && currentKey) {
                    result[currentKey] = currentArray;
                    currentArray = [];
                }
                // 解析键值对
                const [key, value] = trimmed.split(':').map(s => s.trim());
                currentKey = key;
                if (value) {
                    result[key] = parseYamlValue(value);
                }
            }
        }
        // 保存最后的数组
        if (currentArray.length > 0 && currentKey) {
            result[currentKey] = currentArray;
        }
        return result;
    }
}
/**
 * 解析 YAML 值
 */
function parseYamlValue(value) {
    // 移除引号
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
    }
    // 布尔值
    if (value === 'true')
        return true;
    if (value === 'false')
        return false;
    // 数字
    const num = Number(value);
    if (!isNaN(num))
        return num;
    // 数组（内联格式）
    if (value.startsWith('[') && value.endsWith(']')) {
        return value.slice(1, -1).split(',').map(s => s.trim());
    }
    return value;
}
// ============================================================================
// 自动化加载器
// ============================================================================
class AutomationLoader {
    constructor(config = {}) {
        this.watchTimers = new Map();
        this.config = {
            defaultRulesPath: config.defaultRulesPath ?? './rules/default-hooks.yaml',
            workspaceRulesPath: config.workspaceRulesPath ?? './hooks.yaml',
            enableHotReload: config.enableHotReload ?? false,
            hotReloadIntervalMs: config.hotReloadIntervalMs ?? 5000,
            strictMode: config.strictMode ?? false,
        };
    }
    /**
     * 加载自动化文件
     */
    async loadAutomationFile(filePath, sourceType = 'workspace') {
        const source = {
            type: sourceType,
            path: filePath,
            loadedAt: Date.now(),
            errors: [],
            warnings: [],
        };
        try {
            // 读取文件
            const content = await fs.readFile(filePath, 'utf-8');
            // 解析 YAML
            let doc;
            try {
                doc = parseYaml(content);
            }
            catch (error) {
                return {
                    success: false,
                    loadedRules: 0,
                    failedRules: 0,
                    source,
                    errors: [{
                            type: 'parse',
                            path: filePath,
                            message: `Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`,
                        }],
                    warnings: [],
                };
            }
            // Schema 校验
            const validationResult = (0, automation_schema_1.validateAutomationDocument)(doc);
            if (!validationResult.valid) {
                return {
                    success: false,
                    loadedRules: 0,
                    failedRules: validationResult.errors.length,
                    source: {
                        ...source,
                        errors: validationResult.errors,
                    },
                    errors: validationResult.errors,
                    warnings: validationResult.warnings,
                };
            }
            // 规范化
            const normalized = validationResult.normalized;
            // 应用默认配置
            const rules = normalized.rules.map(rule => ({
                ...rule,
                enabled: rule.enabled ?? normalized.defaults?.enabled ?? true,
                cooldownMs: rule.cooldownMs ?? normalized.defaults?.cooldownMs ?? 60000,
                maxTriggerCount: rule.maxTriggerCount ?? normalized.defaults?.maxTriggerCount,
            }));
            return {
                success: true,
                loadedRules: rules.length,
                failedRules: 0,
                source: {
                    ...source,
                    warnings: validationResult.warnings,
                },
                errors: [],
                warnings: validationResult.warnings,
            };
        }
        catch (error) {
            return {
                success: false,
                loadedRules: 0,
                failedRules: 0,
                source: {
                    ...source,
                    errors: [{
                            type: 'load',
                            path: filePath,
                            message: `Failed to load file: ${error instanceof Error ? error.message : String(error)}`,
                        }],
                },
                errors: [{
                        type: 'load',
                        path: filePath,
                        message: `Failed to load file: ${error instanceof Error ? error.message : String(error)}`,
                    }],
                warnings: [],
            };
        }
    }
    /**
     * 加载工作区自动化
     */
    async loadWorkspaceAutomation(workspaceRoot) {
        const workspaceRulesPath = path.join(workspaceRoot, this.config.workspaceRulesPath);
        return await this.loadAutomationFile(workspaceRulesPath, 'workspace');
    }
    /**
     * 重新加载自动化
     */
    async reloadAutomation(workspaceRoot) {
        const result = await this.loadWorkspaceAutomation(workspaceRoot);
        if (!result.success) {
            return {
                success: false,
                rules: [],
                source: result.source,
                errors: result.errors,
            };
        }
        // 重新加载时，需要获取实际规则
        // 简化实现：这里假设规则已经加载
        return {
            success: true,
            rules: [],
            source: result.source,
            errors: [],
        };
    }
    /**
     * 监视自动化文件变化
     */
    watchAutomationFiles(workspaceRoot, onChange) {
        if (!this.config.enableHotReload) {
            return;
        }
        const workspaceRulesPath = path.join(workspaceRoot, this.config.workspaceRulesPath);
        // 清除旧的监视
        if (this.watchTimers.has(workspaceRulesPath)) {
            clearInterval(this.watchTimers.get(workspaceRulesPath));
        }
        // 设置新的监视
        const timer = setInterval(async () => {
            try {
                const stats = await fs.stat(workspaceRulesPath);
                // 简化实现：实际应该检查文件修改时间
                onChange();
            }
            catch {
                // 文件不存在，忽略
            }
        }, this.config.hotReloadIntervalMs);
        this.watchTimers.set(workspaceRulesPath, timer);
    }
    /**
     * 停止监视
     */
    stopWatching() {
        for (const timer of this.watchTimers.values()) {
            clearInterval(timer);
        }
        this.watchTimers.clear();
    }
    /**
     * 构建规则集
     */
    buildRuleSet(defaults, workspaceRules, overrideMode = 'override') {
        const rules = [];
        const workspaceRuleIds = new Set(workspaceRules.map(r => r.id));
        // 处理默认规则
        for (const defaultRule of defaults) {
            // 检查 workspace 是否有同 ID 规则
            const workspaceRule = workspaceRules.find(r => r.id === defaultRule.id);
            if (workspaceRule) {
                if (overrideMode === 'disable' && !workspaceRule.enabled) {
                    // 显式禁用
                    continue;
                }
                else if (overrideMode === 'override') {
                    // 覆盖
                    rules.push({ ...defaultRule, ...workspaceRule });
                    continue;
                }
            }
            // 添加默认规则
            rules.push(defaultRule);
        }
        // 处理 workspace 新增规则（append 模式）
        if (overrideMode === 'append' || overrideMode === 'override') {
            for (const workspaceRule of workspaceRules) {
                if (!workspaceRuleIds.has(workspaceRule.id)) {
                    rules.push(workspaceRule);
                }
            }
        }
        return {
            rules,
            source: {
                type: 'workspace',
                loadedAt: Date.now(),
            },
            loadedAt: Date.now(),
        };
    }
}
exports.AutomationLoader = AutomationLoader;
// ============================================================================
// 便捷函数
// ============================================================================
/**
 * 创建自动化加载器
 */
function createAutomationLoader(config) {
    return new AutomationLoader(config);
}
/**
 * 快速加载规则
 */
async function loadAutomationRules(filePath, sourceType) {
    const loader = new AutomationLoader();
    const result = await loader.loadAutomationFile(filePath, sourceType);
    if (!result.success) {
        return [];
    }
    // 简化实现：实际应该从结果中提取规则
    return [];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0b21hdGlvbl9sb2FkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvYXV0b21hdGlvbi9hdXRvbWF0aW9uX2xvYWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7R0FhRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBaVhILHdEQUVDO0FBS0Qsa0RBYUM7QUFuWUQsZ0RBQWtDO0FBQ2xDLDJDQUE2QjtBQVU3QiwyREFBOEY7QUFFOUYsK0VBQStFO0FBQy9FLGdCQUFnQjtBQUNoQiwrRUFBK0U7QUFFL0U7OztHQUdHO0FBQ0gsU0FBUyxTQUFTLENBQUMsT0FBZTtJQUNoQyx5QkFBeUI7SUFDekIsbUJBQW1CO0lBRW5CLElBQUksQ0FBQztRQUNILGdDQUFnQztRQUNoQyxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDN0IsQ0FBQztJQUFDLE1BQU0sQ0FBQztRQUNQLHdCQUF3QjtRQUN4QixNQUFNLE1BQU0sR0FBUSxFQUFFLENBQUM7UUFDdkIsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNsQyxJQUFJLFVBQVUsR0FBRyxFQUFFLENBQUM7UUFDcEIsSUFBSSxZQUFZLEdBQVUsRUFBRSxDQUFDO1FBRTdCLEtBQUssTUFBTSxJQUFJLElBQUksS0FBSyxFQUFFLENBQUM7WUFDekIsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1lBRTVCLFVBQVU7WUFDVixJQUFJLENBQUMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDeEMsU0FBUztZQUNYLENBQUM7WUFFRCxRQUFRO1lBQ1IsSUFBSSxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JBQzdCLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxL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Q3BCLE9BQU8sRUFBRSxDQUFDO0lBQ1osQ0FBQztJQUVELG9CQUFvQjtJQUNwQixPQUFPLEVBQUUsQ0FBQztBQUNaLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEF1dG9tYXRpb24gTG9hZGVyIC0g6Ieq5Yqo5YyW6YWN572u5Yqg6L295ZmoXG4gKiBcbiAqIOiBjOi0o++8mlxuICogMS4g6K+75Y+WIGhvb2tzLnlhbWwgLyBhdXRvbWF0aW9uLnlhbWxcbiAqIDIuIOino+aekCBZQU1MXG4gKiAzLiDosIMgc2NoZW1hIOagoemqjFxuICogNC4g6L2s5oiQIHJ1bnRpbWUgcnVsZSDlr7nosaFcbiAqIDUuIOaUr+aMgem7mOiupOinhOWImSArIHdvcmtzcGFjZSDop4TliJnlkIjlubZcbiAqIDYuIOaUr+aMgeeDreWKoOi9vVxuICogXG4gKiBAdmVyc2lvbiB2MC4xLjBcbiAqIEBkYXRlIDIwMjYtMDQtMDNcbiAqL1xuXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcy9wcm9taXNlcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHR5cGUge1xuICBBdXRvbWF0aW9uQ29uZmlnRG9jdW1lbnQsXG4gIEF1dG9tYXRpb25SdWxlLFxuICBBdXRvbWF0aW9uTG9hZFJlc3VsdCxcbiAgQXV0b21hdGlvblJ1bGVTb3VyY2UsXG4gIEF1dG9tYXRpb25SdWxlU2V0LFxuICBBdXRvbWF0aW9uTG9hZGVyQ29uZmlnLFxuICBBdXRvbWF0aW9uQ29uZmlnRXJyb3IsXG59IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgdmFsaWRhdGVBdXRvbWF0aW9uRG9jdW1lbnQsIG5vcm1hbGl6ZUF1dG9tYXRpb25Eb2N1bWVudCB9IGZyb20gJy4vYXV0b21hdGlvbl9zY2hlbWEnO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBZQU1MIOino+aekO+8iOeugOWMluWunueOsO+8iVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4vKipcbiAqIOino+aekCBZQU1MIOWtl+espuS4slxuICog566A5YyW5a6e546w77ya5a6e6ZmF5bqU6K+l5L2/55SoIGpzLXlhbWwg5bqTXG4gKi9cbmZ1bmN0aW9uIHBhcnNlWWFtbChjb250ZW50OiBzdHJpbmcpOiBhbnkge1xuICAvLyDnroDljJblrp7njrDvvJrov5nph4zlj6rlgZrln7rmnKznmoQgSlNPTiDlhbzlrrnop6PmnpBcbiAgLy8g5a6e6ZmF5bqU6K+l5L2/55SoIGpzLXlhbWwg5bqTXG4gIFxuICB0cnkge1xuICAgIC8vIOWwneivleS9nOS4uiBKU09OIOino+aekO+8iFlBTUwg5pivIEpTT04g55qE6LaF6ZuG77yJXG4gICAgcmV0dXJuIEpTT04ucGFyc2UoY29udGVudCk7XG4gIH0gY2F0Y2gge1xuICAgIC8vIOeugOWMliBZQU1MIOino+aekO+8muS7heaUr+aMgemdnuW4uOWfuuehgOeahOagvOW8j1xuICAgIGNvbnN0IHJlc3VsdDogYW55ID0ge307XG4gICAgY29uc3QgbGluZXMgPSBjb250ZW50LnNwbGl0KCdcXG4nKTtcbiAgICBsZXQgY3VycmVudEtleSA9ICcnO1xuICAgIGxldCBjdXJyZW50QXJyYXk6IGFueVtdID0gW107XG4gICAgXG4gICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICBjb25zdCB0cmltbWVkID0gbGluZS50cmltKCk7XG4gICAgICBcbiAgICAgIC8vIOi3s+i/h+epuuihjOWSjOazqOmHilxuICAgICAgaWYgKCF0cmltbWVkIHx8IHRyaW1tZWQuc3RhcnRzV2l0aCgnIycpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyDmo4DmtYvmlbDnu4TpoblcbiAgICAgIGlmICh0cmltbWVkLnN0YXJ0c1dpdGgoJy0gJykpIHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSB0cmltbWVkLnNsaWNlKDIpLnRyaW0oKTtcbiAgICAgICAgY3VycmVudEFycmF5LnB1c2gocGFyc2VZYW1sVmFsdWUodmFsdWUpKTtcbiAgICAgIH0gZWxzZSBpZiAodHJpbW1lZC5pbmNsdWRlcygnOicpKSB7XG4gICAgICAgIC8vIOS/neWtmOS5i+WJjeeahOaVsOe7hFxuICAgICAgICBpZiAoY3VycmVudEFycmF5Lmxlbmd0aCA+IDAgJiYgY3VycmVudEtleSkge1xuICAgICAgICAgIHJlc3VsdFtjdXJyZW50S2V5XSA9IGN1cnJlbnRBcnJheTtcbiAgICAgICAgICBjdXJyZW50QXJyYXkgPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8g6Kej5p6Q6ZSu5YC85a+5XG4gICAgICAgIGNvbnN0IFtrZXksIHZhbHVlXSA9IHRyaW1tZWQuc3BsaXQoJzonKS5tYXAocyA9PiBzLnRyaW0oKSk7XG4gICAgICAgIGN1cnJlbnRLZXkgPSBrZXk7XG4gICAgICAgIFxuICAgICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgICByZXN1bHRba2V5XSA9IHBhcnNlWWFtbFZhbHVlKHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyDkv53lrZjmnIDlkI7nmoTmlbDnu4RcbiAgICBpZiAoY3VycmVudEFycmF5Lmxlbmd0aCA+IDAgJiYgY3VycmVudEtleSkge1xuICAgICAgcmVzdWx0W2N1cnJlbnRLZXldID0gY3VycmVudEFycmF5O1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG59XG5cbi8qKlxuICog6Kej5p6QIFlBTUwg5YC8XG4gKi9cbmZ1bmN0aW9uIHBhcnNlWWFtbFZhbHVlKHZhbHVlOiBzdHJpbmcpOiBhbnkge1xuICAvLyDnp7vpmaTlvJXlj7dcbiAgaWYgKCh2YWx1ZS5zdGFydHNXaXRoKCdcIicpICYmIHZhbHVlLmVuZHNXaXRoKCdcIicpKSB8fFxuICAgICAgKHZhbHVlLnN0YXJ0c1dpdGgoXCInXCIpICYmIHZhbHVlLmVuZHNXaXRoKFwiJ1wiKSkpIHtcbiAgICByZXR1cm4gdmFsdWUuc2xpY2UoMSwgLTEpO1xuICB9XG4gIFxuICAvLyDluIPlsJTlgLxcbiAgaWYgKHZhbHVlID09PSAndHJ1ZScpIHJldHVybiB0cnVlO1xuICBpZiAodmFsdWUgPT09ICdmYWxzZScpIHJldHVybiBmYWxzZTtcbiAgXG4gIC8vIOaVsOWtl1xuICBjb25zdCBudW0gPSBOdW1iZXIodmFsdWUpO1xuICBpZiAoIWlzTmFOKG51bSkpIHJldHVybiBudW07XG4gIFxuICAvLyDmlbDnu4TvvIjlhoXogZTmoLzlvI/vvIlcbiAgaWYgKHZhbHVlLnN0YXJ0c1dpdGgoJ1snKSAmJiB2YWx1ZS5lbmRzV2l0aCgnXScpKSB7XG4gICAgcmV0dXJuIHZhbHVlLnNsaWNlKDEsIC0xKS5zcGxpdCgnLCcpLm1hcChzID0+IHMudHJpbSgpKTtcbiAgfVxuICBcbiAgcmV0dXJuIHZhbHVlO1xufVxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyDoh6rliqjljJbliqDovb3lmahcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuZXhwb3J0IGNsYXNzIEF1dG9tYXRpb25Mb2FkZXIge1xuICBwcml2YXRlIGNvbmZpZzogUmVxdWlyZWQ8QXV0b21hdGlvbkxvYWRlckNvbmZpZz47XG4gIHByaXZhdGUgd2F0Y2hUaW1lcnM6IE1hcDxzdHJpbmcsIE5vZGVKUy5UaW1lb3V0PiA9IG5ldyBNYXAoKTtcbiAgXG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogQXV0b21hdGlvbkxvYWRlckNvbmZpZyA9IHt9KSB7XG4gICAgdGhpcy5jb25maWcgPSB7XG4gICAgICBkZWZhdWx0UnVsZXNQYXRoOiBjb25maWcuZGVmYXVsdFJ1bGVzUGF0aCA/PyAnLi9ydWxlcy9kZWZhdWx0LWhvb2tzLnlhbWwnLFxuICAgICAgd29ya3NwYWNlUnVsZXNQYXRoOiBjb25maWcud29ya3NwYWNlUnVsZXNQYXRoID8/ICcuL2hvb2tzLnlhbWwnLFxuICAgICAgZW5hYmxlSG90UmVsb2FkOiBjb25maWcuZW5hYmxlSG90UmVsb2FkID8/IGZhbHNlLFxuICAgICAgaG90UmVsb2FkSW50ZXJ2YWxNczogY29uZmlnLmhvdFJlbG9hZEludGVydmFsTXMgPz8gNTAwMCxcbiAgICAgIHN0cmljdE1vZGU6IGNvbmZpZy5zdHJpY3RNb2RlID8/IGZhbHNlLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDliqDovb3oh6rliqjljJbmlofku7ZcbiAgICovXG4gIGFzeW5jIGxvYWRBdXRvbWF0aW9uRmlsZShcbiAgICBmaWxlUGF0aDogc3RyaW5nLFxuICAgIHNvdXJjZVR5cGU6ICdidWlsdGluJyB8ICd3b3Jrc3BhY2UnIHwgJ3JlbW90ZScgPSAnd29ya3NwYWNlJ1xuICApOiBQcm9taXNlPEF1dG9tYXRpb25Mb2FkUmVzdWx0PiB7XG4gICAgY29uc3Qgc291cmNlOiBBdXRvbWF0aW9uUnVsZVNvdXJjZSA9IHtcbiAgICAgIHR5cGU6IHNvdXJjZVR5cGUsXG4gICAgICBwYXRoOiBmaWxlUGF0aCxcbiAgICAgIGxvYWRlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgZXJyb3JzOiBbXSxcbiAgICAgIHdhcm5pbmdzOiBbXSxcbiAgICB9O1xuICAgIFxuICAgIHRyeSB7XG4gICAgICAvLyDor7vlj5bmlofku7ZcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBmcy5yZWFkRmlsZShmaWxlUGF0aCwgJ3V0Zi04Jyk7XG4gICAgICBcbiAgICAgIC8vIOino+aekCBZQU1MXG4gICAgICBsZXQgZG9jOiBBdXRvbWF0aW9uQ29uZmlnRG9jdW1lbnQ7XG4gICAgICB0cnkge1xuICAgICAgICBkb2MgPSBwYXJzZVlhbWwoY29udGVudCk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgIGxvYWRlZFJ1bGVzOiAwLFxuICAgICAgICAgIGZhaWxlZFJ1bGVzOiAwLFxuICAgICAgICAgIHNvdXJjZSxcbiAgICAgICAgICBlcnJvcnM6IFt7XG4gICAgICAgICAgICB0eXBlOiAncGFyc2UnLFxuICAgICAgICAgICAgcGF0aDogZmlsZVBhdGgsXG4gICAgICAgICAgICBtZXNzYWdlOiBgRmFpbGVkIHRvIHBhcnNlIFlBTUw6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWAsXG4gICAgICAgICAgfV0sXG4gICAgICAgICAgd2FybmluZ3M6IFtdLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBTY2hlbWEg5qCh6aqMXG4gICAgICBjb25zdCB2YWxpZGF0aW9uUmVzdWx0ID0gdmFsaWRhdGVBdXRvbWF0aW9uRG9jdW1lbnQoZG9jKTtcbiAgICAgIFxuICAgICAgaWYgKCF2YWxpZGF0aW9uUmVzdWx0LnZhbGlkKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgbG9hZGVkUnVsZXM6IDAsXG4gICAgICAgICAgZmFpbGVkUnVsZXM6IHZhbGlkYXRpb25SZXN1bHQuZXJyb3JzLmxlbmd0aCxcbiAgICAgICAgICBzb3VyY2U6IHtcbiAgICAgICAgICAgIC4uLnNvdXJjZSxcbiAgICAgICAgICAgIGVycm9yczogdmFsaWRhdGlvblJlc3VsdC5lcnJvcnMsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBlcnJvcnM6IHZhbGlkYXRpb25SZXN1bHQuZXJyb3JzLFxuICAgICAgICAgIHdhcm5pbmdzOiB2YWxpZGF0aW9uUmVzdWx0Lndhcm5pbmdzLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyDop4TojIPljJZcbiAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSB2YWxpZGF0aW9uUmVzdWx0Lm5vcm1hbGl6ZWQhO1xuICAgICAgXG4gICAgICAvLyDlupTnlKjpu5jorqTphY3nva5cbiAgICAgIGNvbnN0IHJ1bGVzID0gbm9ybWFsaXplZC5ydWxlcy5tYXAocnVsZSA9PiAoe1xuICAgICAgICAuLi5ydWxlLFxuICAgICAgICBlbmFibGVkOiBydWxlLmVuYWJsZWQgPz8gbm9ybWFsaXplZC5kZWZhdWx0cz8uZW5hYmxlZCA/PyB0cnVlLFxuICAgICAgICBjb29sZG93bk1zOiBydWxlLmNvb2xkb3duTXMgPz8gbm9ybWFsaXplZC5kZWZhdWx0cz8uY29vbGRvd25NcyA/PyA2MDAwMCxcbiAgICAgICAgbWF4VHJpZ2dlckNvdW50OiBydWxlLm1heFRyaWdnZXJDb3VudCA/PyBub3JtYWxpemVkLmRlZmF1bHRzPy5tYXhUcmlnZ2VyQ291bnQsXG4gICAgICB9KSk7XG4gICAgICBcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIGxvYWRlZFJ1bGVzOiBydWxlcy5sZW5ndGgsXG4gICAgICAgIGZhaWxlZFJ1bGVzOiAwLFxuICAgICAgICBzb3VyY2U6IHtcbiAgICAgICAgICAuLi5zb3VyY2UsXG4gICAgICAgICAgd2FybmluZ3M6IHZhbGlkYXRpb25SZXN1bHQud2FybmluZ3MsXG4gICAgICAgIH0sXG4gICAgICAgIGVycm9yczogW10sXG4gICAgICAgIHdhcm5pbmdzOiB2YWxpZGF0aW9uUmVzdWx0Lndhcm5pbmdzLFxuICAgICAgfTtcbiAgICAgIFxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgbG9hZGVkUnVsZXM6IDAsXG4gICAgICAgIGZhaWxlZFJ1bGVzOiAwLFxuICAgICAgICBzb3VyY2U6IHtcbiAgICAgICAgICAuLi5zb3VyY2UsXG4gICAgICAgICAgZXJyb3JzOiBbe1xuICAgICAgICAgICAgdHlwZTogJ2xvYWQnLFxuICAgICAgICAgICAgcGF0aDogZmlsZVBhdGgsXG4gICAgICAgICAgICBtZXNzYWdlOiBgRmFpbGVkIHRvIGxvYWQgZmlsZTogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YCxcbiAgICAgICAgICB9XSxcbiAgICAgICAgfSxcbiAgICAgICAgZXJyb3JzOiBbe1xuICAgICAgICAgIHR5cGU6ICdsb2FkJyxcbiAgICAgICAgICBwYXRoOiBmaWxlUGF0aCxcbiAgICAgICAgICBtZXNzYWdlOiBgRmFpbGVkIHRvIGxvYWQgZmlsZTogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YCxcbiAgICAgICAgfV0sXG4gICAgICAgIHdhcm5pbmdzOiBbXSxcbiAgICAgIH07XG4gICAgfVxuICB9XG4gIFxuICAvKipcbiAgICog5Yqg6L295bel5L2c5Yy66Ieq5Yqo5YyWXG4gICAqL1xuICBhc3luYyBsb2FkV29ya3NwYWNlQXV0b21hdGlvbihcbiAgICB3b3Jrc3BhY2VSb290OiBzdHJpbmdcbiAgKTogUHJvbWlzZTxBdXRvbWF0aW9uTG9hZFJlc3VsdD4ge1xuICAgIGNvbnN0IHdvcmtzcGFjZVJ1bGVzUGF0aCA9IHBhdGguam9pbihcbiAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICB0aGlzLmNvbmZpZy53b3Jrc3BhY2VSdWxlc1BhdGhcbiAgICApO1xuICAgIFxuICAgIHJldHVybiBhd2FpdCB0aGlzLmxvYWRBdXRvbWF0aW9uRmlsZSh3b3Jrc3BhY2VSdWxlc1BhdGgsICd3b3Jrc3BhY2UnKTtcbiAgfVxuICBcbiAgLyoqXG4gICAqIOmHjeaWsOWKoOi9veiHquWKqOWMllxuICAgKi9cbiAgYXN5bmMgcmVsb2FkQXV0b21hdGlvbihcbiAgICB3b3Jrc3BhY2VSb290OiBzdHJpbmdcbiAgKTogUHJvbWlzZTx7XG4gICAgc3VjY2VzczogYm9vbGVhbjtcbiAgICBydWxlczogQXV0b21hdGlvblJ1bGVbXTtcbiAgICBzb3VyY2U6IEF1dG9tYXRpb25SdWxlU291cmNlO1xuICAgIGVycm9yczogQXV0b21hdGlvbkNvbmZpZ0Vycm9yW107XG4gIH0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmxvYWRXb3Jrc3BhY2VBdXRvbWF0aW9uKHdvcmtzcGFjZVJvb3QpO1xuICAgIFxuICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBydWxlczogW10sXG4gICAgICAgIHNvdXJjZTogcmVzdWx0LnNvdXJjZSxcbiAgICAgICAgZXJyb3JzOiByZXN1bHQuZXJyb3JzLFxuICAgICAgfTtcbiAgICB9XG4gICAgXG4gICAgLy8g6YeN5paw5Yqg6L295pe277yM6ZyA6KaB6I635Y+W5a6e6ZmF6KeE5YiZXG4gICAgLy8g566A5YyW5a6e546w77ya6L+Z6YeM5YGH6K6+6KeE5YiZ5bey57uP5Yqg6L29XG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBydWxlczogW10sXG4gICAgICBzb3VyY2U6IHJlc3VsdC5zb3VyY2UsXG4gICAgICBlcnJvcnM6IFtdLFxuICAgIH07XG4gIH1cbiAgXG4gIC8qKlxuICAgKiDnm5Hop4boh6rliqjljJbmlofku7blj5jljJZcbiAgICovXG4gIHdhdGNoQXV0b21hdGlvbkZpbGVzKFxuICAgIHdvcmtzcGFjZVJvb3Q6IHN0cmluZyxcbiAgICBvbkNoYW5nZTogKCkgPT4gdm9pZFxuICApOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuY29uZmlnLmVuYWJsZUhvdFJlbG9hZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCB3b3Jrc3BhY2VSdWxlc1BhdGggPSBwYXRoLmpvaW4oXG4gICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgdGhpcy5jb25maWcud29ya3NwYWNlUnVsZXNQYXRoXG4gICAgKTtcbiAgICBcbiAgICAvLyDmuIXpmaTml6fnmoTnm5Hop4ZcbiAgICBpZiAodGhpcy53YXRjaFRpbWVycy5oYXMod29ya3NwYWNlUnVsZXNQYXRoKSkge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLndhdGNoVGltZXJzLmdldCh3b3Jrc3BhY2VSdWxlc1BhdGgpISk7XG4gICAgfVxuICAgIFxuICAgIC8vIOiuvue9ruaWsOeahOebkeinhlxuICAgIGNvbnN0IHRpbWVyID0gc2V0SW50ZXJ2YWwoYXN5bmMgKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBmcy5zdGF0KHdvcmtzcGFjZVJ1bGVzUGF0aCk7XG4gICAgICAgIC8vIOeugOWMluWunueOsO+8muWunumZheW6lOivpeajgOafpeaWh+S7tuS/ruaUueaXtumXtFxuICAgICAgICBvbkNoYW5nZSgpO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8vIOaWh+S7tuS4jeWtmOWcqO+8jOW/veeVpVxuICAgICAgfVxuICAgIH0sIHRoaXMuY29uZmlnLmhvdFJlbG9hZEludGVydmFsTXMpO1xuICAgIFxuICAgIHRoaXMud2F0Y2hUaW1lcnMuc2V0KHdvcmtzcGFjZVJ1bGVzUGF0aCwgdGltZXIpO1xuICB9XG4gIFxuICAvKipcbiAgICog5YGc5q2i55uR6KeGXG4gICAqL1xuICBzdG9wV2F0Y2hpbmcoKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCB0aW1lciBvZiB0aGlzLndhdGNoVGltZXJzLnZhbHVlcygpKSB7XG4gICAgICBjbGVhckludGVydmFsKHRpbWVyKTtcbiAgICB9XG4gICAgdGhpcy53YXRjaFRpbWVycy5jbGVhcigpO1xuICB9XG4gIFxuICAvKipcbiAgICog5p6E5bu66KeE5YiZ6ZuGXG4gICAqL1xuICBidWlsZFJ1bGVTZXQoXG4gICAgZGVmYXVsdHM6IEF1dG9tYXRpb25SdWxlW10sXG4gICAgd29ya3NwYWNlUnVsZXM6IEF1dG9tYXRpb25SdWxlW10sXG4gICAgb3ZlcnJpZGVNb2RlOiAnYXBwZW5kJyB8ICdvdmVycmlkZScgfCAnZGlzYWJsZScgPSAnb3ZlcnJpZGUnXG4gICk6IEF1dG9tYXRpb25SdWxlU2V0IHtcbiAgICBjb25zdCBydWxlczogQXV0b21hdGlvblJ1bGVbXSA9IFtdO1xuICAgIGNvbnN0IHdvcmtzcGFjZVJ1bGVJZHMgPSBuZXcgU2V0KHdvcmtzcGFjZVJ1bGVzLm1hcChyID0+IHIuaWQpKTtcbiAgICBcbiAgICAvLyDlpITnkIbpu5jorqTop4TliJlcbiAgICBmb3IgKGNvbnN0IGRlZmF1bHRSdWxlIG9mIGRlZmF1bHRzKSB7XG4gICAgICAvLyDmo4Dmn6Ugd29ya3NwYWNlIOaYr+WQpuacieWQjCBJRCDop4TliJlcbiAgICAgIGNvbnN0IHdvcmtzcGFjZVJ1bGUgPSB3b3Jrc3BhY2VSdWxlcy5maW5kKHIgPT4gci5pZCA9PT0gZGVmYXVsdFJ1bGUuaWQpO1xuICAgICAgXG4gICAgICBpZiAod29ya3NwYWNlUnVsZSkge1xuICAgICAgICBpZiAob3ZlcnJpZGVNb2RlID09PSAnZGlzYWJsZScgJiYgIXdvcmtzcGFjZVJ1bGUuZW5hYmxlZCkge1xuICAgICAgICAgIC8vIOaYvuW8j+emgeeUqFxuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9IGVsc2UgaWYgKG92ZXJyaWRlTW9kZSA9PT0gJ292ZXJyaWRlJykge1xuICAgICAgICAgIC8vIOimhuebllxuICAgICAgICAgIHJ1bGVzLnB1c2goeyAuLi5kZWZhdWx0UnVsZSwgLi4ud29ya3NwYWNlUnVsZSB9KTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICAvLyDmt7vliqDpu5jorqTop4TliJlcbiAgICAgIHJ1bGVzLnB1c2goZGVmYXVsdFJ1bGUpO1xuICAgIH1cbiAgICBcbiAgICAvLyDlpITnkIYgd29ya3NwYWNlIOaWsOWinuinhOWIme+8iGFwcGVuZCDmqKHlvI/vvIlcbiAgICBpZiAob3ZlcnJpZGVNb2RlID09PSAnYXBwZW5kJyB8fCBvdmVycmlkZU1vZGUgPT09ICdvdmVycmlkZScpIHtcbiAgICAgIGZvciAoY29uc3Qgd29ya3NwYWNlUnVsZSBvZiB3b3Jrc3BhY2VSdWxlcykge1xuICAgICAgICBpZiAoIXdvcmtzcGFjZVJ1bGVJZHMuaGFzKHdvcmtzcGFjZVJ1bGUuaWQpKSB7XG4gICAgICAgICAgcnVsZXMucHVzaCh3b3Jrc3BhY2VSdWxlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgcnVsZXMsXG4gICAgICBzb3VyY2U6IHtcbiAgICAgICAgdHlwZTogJ3dvcmtzcGFjZScsXG4gICAgICAgIGxvYWRlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgfSxcbiAgICAgIGxvYWRlZEF0OiBEYXRlLm5vdygpLFxuICAgIH07XG4gIH1cbn1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8g5L6/5o235Ye95pWwXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbi8qKlxuICog5Yib5bu66Ieq5Yqo5YyW5Yqg6L295ZmoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBdXRvbWF0aW9uTG9hZGVyKGNvbmZpZz86IEF1dG9tYXRpb25Mb2FkZXJDb25maWcpOiBBdXRvbWF0aW9uTG9hZGVyIHtcbiAgcmV0dXJuIG5ldyBBdXRvbWF0aW9uTG9hZGVyKGNvbmZpZyk7XG59XG5cbi8qKlxuICog5b+r6YCf5Yqg6L296KeE5YiZXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2FkQXV0b21hdGlvblJ1bGVzKFxuICBmaWxlUGF0aDogc3RyaW5nLFxuICBzb3VyY2VUeXBlPzogJ2J1aWx0aW4nIHwgJ3dvcmtzcGFjZScgfCAncmVtb3RlJ1xuKTogUHJvbWlzZTxBdXRvbWF0aW9uUnVsZVtdPiB7XG4gIGNvbnN0IGxvYWRlciA9IG5ldyBBdXRvbWF0aW9uTG9hZGVyKCk7XG4gIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGxvYWRlci5sb2FkQXV0b21hdGlvbkZpbGUoZmlsZVBhdGgsIHNvdXJjZVR5cGUpO1xuICBcbiAgaWYgKCFyZXN1bHQuc3VjY2Vzcykge1xuICAgIHJldHVybiBbXTtcbiAgfVxuICBcbiAgLy8g566A5YyW5a6e546w77ya5a6e6ZmF5bqU6K+l5LuO57uT5p6c5Lit5o+Q5Y+W6KeE5YiZXG4gIHJldHVybiBbXTtcbn1cbiJdfQ==