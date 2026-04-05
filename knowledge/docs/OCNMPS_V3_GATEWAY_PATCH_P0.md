# OCNMPS V3 Gateway P0 补丁方案

**文档状态**: Ready for Review  
**创建时间**: 2026-04-04 18:45 (Asia/Shanghai)  
**优先级**: P0 - 立即执行  
**影响范围**: Gateway 内置子系统

---

## 🔍 根因确认

### 错误来源

**文件**: `/usr/local/lib/node_modules/openclaw/dist/pi-embedded-BYdcxQ5A.js`  
**函数**: `splitModelRef(ref)`  
**位置**: 第 22323-22341 行

### 问题代码

```javascript
function splitModelRef(ref) {
	if (!ref) return {
		provider: void 0,
		model: void 0
	};
	const trimmed = ref.trim();  // ❌ 如果 ref 是对象，这里会报错
	if (!trimmed) return {
		provider: void 0,
		model: void 0
	};
	const [provider, model] = trimmed.split("/", 2);  // ❌ 如果 ref.trim() 返回对象，split 失败
	// ...
}
```

### 调用链

```
before_model_resolve hook (OCNMPS 插件)
  → returns { providerOverride, modelOverride }
  → resolveHookModelSelection()
  → provider = modelResolveOverride.providerOverride
  → modelId = modelResolveOverride.modelOverride
  → spawnSubagentDirect()
    → modelOverride = params.model  // 可能是对象
    → resolveSubagentSpawnModelSelection()
      → returns { provider, model }  // 对象格式！
    → persistInitialChildSessionRuntimeModel()
      → splitModelRef(params.resolvedModel)  // ❌ 传入对象，报错
```

### 数据类型不匹配

**期望**: `splitModelRef(ref: string)`  
**实际**: `ref` 可能是 `{ provider: string, model: string }`

**来源**: `resolveSubagentConfiguredModelSelection()` 返回对象格式：

```javascript
// model-selection-8a6zD_aX.js 第 312 行
function resolveSubagentConfiguredModelSelection(params) {
  // ...
  return {
    provider: params.defaultProvider,
    model: params.defaultModel
  };
}
```

---

## 🛠️ P0 补丁方案

### 修复目标

1. **类型守卫** — 在 `splitModelRef` 入口处检查类型
2. **对象兼容** — 支持 `{ provider, model }` 格式输入
3. **结构化日志** — 记录非法输入以便追踪
4. **安全 fallback** — 非法时返回默认值，不抛异常

### 补丁代码

**文件**: `/usr/local/lib/node_modules/openclaw/dist/pi-embedded-BYdcxQ5A.js`  
**位置**: 第 22323-22341 行

**原代码**:
```javascript
function splitModelRef(ref) {
	if (!ref) return {
		provider: void 0,
		model: void 0
	};
	const trimmed = ref.trim();
	if (!trimmed) return {
		provider: void 0,
		model: void 0
	};
	const [provider, model] = trimmed.split("/", 2);
	if (model) return {
		provider,
		model
	};
	return {
		provider: void 0,
		model: trimmed
	};
}
```

**修复后**:
```javascript
function splitModelRef(ref) {
	// P0 补丁：类型守卫 + 对象兼容
	if (!ref) return {
		provider: void 0,
		model: void 0
	};
	
	// 支持对象格式：{ provider, model }
	if (typeof ref === 'object' && ref !== null) {
		if (ref.provider && ref.model) {
			return {
				provider: ref.provider,
				model: ref.model
			};
		}
		// 对象但缺少必需字段，记录日志并 fallback
		console.warn('[splitModelRef] Invalid object format', {
			ref,
			type: typeof ref,
			keys: Object.keys(ref)
		});
		return {
			provider: void 0,
			model: void 0
		};
	}
	
	// 字符串处理
	if (typeof ref !== 'string') {
		console.warn('[splitModelRef] Non-string input', {
			ref,
			type: typeof ref
		});
		return {
			provider: void 0,
			model: void 0
		};
	}
	
	const trimmed = ref.trim();
	if (!trimmed) return {
		provider: void 0,
		model: void 0
	};
	const [provider, model] = trimmed.split("/", 2);
	if (model) return {
		provider,
		model
	};
	return {
		provider: void 0,
		model: trimmed
	};
}
```

---

## ✅ 验收标准

### 立即验证（补丁后 1 小时内）

- [ ] 同类错误不再出现（检查 `gateway.err.log`）
- [ ] 新日志出现：`[splitModelRef] Invalid object format` 或 `[splitModelRef] Non-string input`
- [ ] 子代理 spawn 功能正常（测试 `sessions_spawn`）

### 短期验证（24 小时）

- [ ] 最近 50 次请求中 `split is not a function` 错误归零
- [ ] 无 `silent bad routing`（模型切换正常）
- [ ] OCNMPS 灰度命中率统计正常

### 回归测试

- [ ] 字符串格式 `"provider/model"` → 正常解析
- [ ] 对象格式 `{ provider, model }` → 正常解析
- [ ] null/undefined → 返回 `{ provider: undefined, model: undefined }`
- [ ] 空字符串 → 返回 `{ provider: undefined, model: undefined }`

---

## 📋 执行步骤

### Step 1: 备份原文件

```bash
cp /usr/local/lib/node_modules/openclaw/dist/pi-embedded-BYdcxQ5A.js \
   /usr/local/lib/node_modules/openclaw/dist/pi-embedded-BYdcxQ5A.js.bak.$(date +%Y%m%d_%H%M%S)
```

### Step 2: 应用补丁

**方法 A: 手动编辑**
```bash
# 使用编辑器定位到第 22323 行
vim +22323 /usr/local/lib/node_modules/openclaw/dist/pi-embedded-BYdcxQ5A.js
```

**方法 B: sed 替换** (推荐，更精确)
```bash
# 创建补丁脚本
cat > /tmp/fix_splitModelRef.sh << 'EOF'
#!/bin/bash
FILE="/usr/local/lib/node_modules/openclaw/dist/pi-embedded-BYdcxQ5A.js"
BACKUP="${FILE}.bak.$(date +%Y%m%d_%H%M%S)"

# 备份
cp "$FILE" "$BACKUP"
echo "Backup: $BACKUP"

# 使用 Node.js 脚本精确替换
node -e "
const fs = require('fs');
const file = '$FILE';
let content = fs.readFileSync(file, 'utf-8');

const oldFunc = \`function splitModelRef(ref) {
	if (!ref) return {
		provider: void 0,
		model: void 0
	};
	const trimmed = ref.trim();
	if (!trimmed) return {
		provider: void 0,
		model: void 0
	};
	const [provider, model] = trimmed.split(\"/\", 2);
	if (model) return {
		provider,
		model
	};
	return {
		provider: void 0,
		model: trimmed
	};
}\`;

const newFunc = \`function splitModelRef(ref) {
	// P0 补丁：类型守卫 + 对象兼容
	if (!ref) return {
		provider: void 0,
		model: void 0
	};
	
	// 支持对象格式：{ provider, model }
	if (typeof ref === 'object' && ref !== null) {
		if (ref.provider && ref.model) {
			return {
				provider: ref.provider,
				model: ref.model
			};
		}
		// 对象但缺少必需字段，记录日志并 fallback
		console.warn('[splitModelRef] Invalid object format', {
			ref,
			type: typeof ref,
			keys: Object.keys(ref)
		});
		return {
			provider: void 0,
			model: void 0
		};
	}
	
	// 字符串处理
	if (typeof ref !== 'string') {
		console.warn('[splitModelRef] Non-string input', {
			ref,
			type: typeof ref
		});
		return {
			provider: void 0,
			model: void 0
		};
	}
	
	const trimmed = ref.trim();
	if (!trimmed) return {
		provider: void 0,
		model: void 0
	};
	const [provider, model] = trimmed.split(\"/\", 2);
	if (model) return {
		provider,
		model
	};
	return {
		provider: void 0,
		model: trimmed
	};
}\`;

content = content.replace(oldFunc, newFunc);
fs.writeFileSync(file, content);
console.log('Patch applied successfully');
"
EOF

chmod +x /tmp/fix_splitModelRef.sh
/tmp/fix_splitModelRef.sh
```

### Step 3: 重启 Gateway

```bash
openclaw gateway restart
```

### Step 4: 验证

```bash
# 1. 检查 Gateway 状态
openclaw status

# 2. 监控错误日志
tail -f ~/.openclaw/logs/gateway.err.log | grep -i "split"

# 3. 测试子代理 spawn
# 发送消息触发 OCNMPS 路由
```

---

## 🚨 回滚方案

如果补丁导致问题：

```bash
# 1. 停止 Gateway
openclaw gateway stop

# 2. 恢复备份
cp /usr/local/lib/node_modules/openclaw/dist/pi-embedded-BYdcxQ5A.js.bak.* \
   /usr/local/lib/node_modules/openclaw/dist/pi-embedded-BYdcxQ5A.js

# 3. 重启 Gateway
openclaw gateway start
```

---

## 📊 预期效果

### 修复前

```
错误频率：5 次/天
错误类型：TypeError: resolved.model.split is not a function
影响：灰度命中请求报错
```

### 修复后

```
错误频率：0 次/天
新增日志：[splitModelRef] Invalid object format (仅当真正异常时)
影响：无用户可见错误，fallback 到默认模型
```

---

## 🔗 相关文件

- **补丁目标**: `/usr/local/lib/node_modules/openclaw/dist/pi-embedded-BYdcxQ5A.js`
- **OCNMPS 插件**: `~/.openclaw/plugins/ocnmps-router/plugin.js`
- **模型选择**: `/usr/local/lib/node_modules/openclaw/dist/model-selection-8a6zD_aX.js`
- **错误日志**: `~/.openclaw/logs/gateway.err.log`

---

## 📝 后续工作

### P1: 统一模型解析契约

在 P0 补丁稳定后，推动 Gateway 上游修复：

1. 在 `resolveSubagentSpawnModelSelection()` 返回处统一格式
2. 或修改 `splitModelRef()` 为内部函数，不暴露给外部调用
3. 添加 TypeScript 类型检查，编译时捕获类型错误

### P2: 灰度配置核验

修复 Routing Error 后，检查灰度命中率问题：

1. 验证 `grayRatio` 配置单位
2. 检查 Hash Bucket 计算逻辑
3. 确认统计口径

---

**最后更新**: 2026-04-04 18:45  
**审查人**: Colin  
**执行状态**: 待执行
