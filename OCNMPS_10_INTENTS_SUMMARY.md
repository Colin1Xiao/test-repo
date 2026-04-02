# OCNMPS 10 意图配置汇总

**更新日期**: 2026-04-03  
**版本**: V3 (10 意图完整版)

---

## 意图列表（10 个）

| 意图 | 用途 | 模型 | 触发关键词 |
|------|------|------|-----------|
| **MAIN** | 通用任务 | qwen3.5-plus | 默认 |
| **FAST** | 快速问题 | qwen3-max-2026-01-23 | weather, time, quick |
| **CODE** | 代码编写 | qwen3-coder-next | write code, create function, 代码 |
| **CODE_PLUS** | 复杂代码 | qwen3-coder-plus | optimize, refactor, 重构 |
| **PATCH** | 代码修复 | grok-code-fast-1 | fix, bug, error, 修复 |
| **DEBUG** | 调试问题 | grok-4-1-fast-reasoning | debug, trace, 调试 |
| **REVIEW** | 代码审查 | grok-4-1-fast-reasoning | review, audit, 代码审查 |
| **TEST** | 测试相关 | qwen3-max-2026-01-23 | test, unit test, 测试 |
| **REASON** | 推理/解释 | grok-4-1-fast-reasoning | why, explain, 为什么 |
| **LONG** | 长文本 | qwen3.5-plus | in detail, comprehensive, 详细 |
| **CN** | 中文问题 | MiniMax-M2.5 | 中文字符 |

---

## 意图识别逻辑

### 优先级顺序
1. CODE (代码编写)
2. CODE_PLUS (复杂代码)
3. PATCH (代码修复)
4. DEBUG (调试)
5. REVIEW (审查)
6. TEST (测试)
7. REASON (推理)
8. LONG (长文本)
9. CN (中文)
10. FAST (快速问题)
11. MAIN (默认)

### 识别规则
```javascript
// 代码编写
if (text.includes('write code') || text.includes('create function')) return 'CODE';

// 代码优化
if (text.includes('optimize') || text.includes('refactor')) return 'CODE_PLUS';

// 代码修复
if (text.includes('fix') || text.includes('bug') || text.includes('error')) return 'PATCH';

// 调试
if (text.includes('debug') || text.includes('trace')) return 'DEBUG';

// 审查
if (text.includes('review') || text.includes('audit')) return 'REVIEW';

// 测试
if (text.includes('test') || text.includes('unit test')) return 'TEST';

// 推理
if (text.includes('why') || text.includes('explain')) return 'REASON';

// 长文本
if (text.length > 500 || text.includes('in detail')) return 'LONG';

// 中文
if (/[\u4e00-\u9fff]/.test(text)) return 'CN';

// 快速问题
if (text.length < 20 || text.includes('weather')) return 'FAST';

// 默认
return 'MAIN';
```

---

## 配置位置

| 文件 | 用途 |
|------|------|
| `plugins/ocnmps-router/ocnmps_core.js` | 核心路由逻辑 |
| `plugins/ocnmps-router/plugin.js` | 插件配置加载 |
| `plugins/ocnmps-router/ocnmps_plugin_config.json` | 外部配置（可选） |

---

## 灰度配置

| 配置项 | 值 |
|--------|-----|
| 灰度比例 | 5% |
| 启用意图 | 全部 10 个 |
| 回退策略 | 启用 (fallbackToDefault: true) |

---

## 验证方法

### 测试命令
```bash
# 验证意图识别
node -e "
const c = require('./ocnmps_core.js');
const r = c.createOCNMPSRouterV3();
console.log('支持意图:', Object.keys(r.modelMapping));
"
```

### 预期输出
```
支持意图: MAIN, FAST, CODE, CODE_PLUS, PATCH, REASON, REVIEW, LONG, CN, TEST, DEBUG
```

---

## 历史数据对比

| 版本 | 意图数 | 状态 |
|------|--------|------|
| V2 (原始) | 10 | ✅ 生产运行 |
| V3 (初始) | 7 | ❌ 配置缺失 |
| V3 (修复后) | 11 | ✅ 已修复 |

---

**下次审查**: 2026-04-10
