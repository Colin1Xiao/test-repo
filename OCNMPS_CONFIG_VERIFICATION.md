# OCNMPS 配置验证清单

**更新日期**: 2026-04-03  
**验证频率**: 每次配置变更后

---

## 一、配置文件位置

| 文件 | 路径 | 用途 |
|------|------|------|
| Core | `plugins/ocnmps-router/ocnmps_core.js` | 路由核心逻辑 |
| Plugin | `plugins/ocnmps-router/plugin.js` | 插件入口 |
| 配置 | `plugins/ocnmps-router/ocnmps_plugin_config.json` | 外部配置（可选） |
| Gateway | `~/.openclaw/config.json` | Gateway 主配置 |
| 用户配置 | `~/.openclaw/openclaw.json` | 用户偏好 |

---

## 二、配置同步检查（每次变更后必做）

### 步骤 1: 验证意图数量
```bash
node -e "const c = require('./ocnmps_core.js'); const r = c.createOCNMPSRouterV3(); console.log('意图数:', Object.keys(r.modelMapping).length);"
```
**预期**: 11 个意图

### 步骤 2: 验证意图列表
```bash
node -e "const c = require('./ocnmps_core.js'); const r = c.createOCNMPSRouterV3(); console.log(Object.keys(r.modelMapping).join(', '));"
```
**预期**: MAIN, FAST, CODE, CODE_PLUS, PATCH, REASON, REVIEW, LONG, CN, TEST, DEBUG

### 步骤 3: 验证 Gateway 配置
```bash
grep ocnmps ~/.openclaw/config.json
```
**预期**: ocnmps-router-v3

### 步骤 4: 重启 Gateway
```bash
openclaw gateway restart
```

### 步骤 5: 查看日志
```bash
tail -5 ~/.openclaw/plugins/ocnmps-router/ocnmps_v3.log
```
**预期**: 显示 11 个 models

---

## 三、配置变更检查清单

### 修改 ocnmps_core.js 后
- [ ] 验证 modelMapping 完整性（11 个意图）
- [ ] 验证 classifyIntent 逻辑（10 意图分类）
- [ ] 运行配置同步检查脚本
- [ ] 重启 Gateway
- [ ] 查看日志确认

### 修改 plugin.js 后
- [ ] 验证 loadConfig() 返回完整配置
- [ ] 验证 modelMapping 与 core 一致
- [ ] 运行配置同步检查脚本
- [ ] 重启 Gateway
- [ ] 查看日志确认

### 修改外部配置后
- [ ] 验证 JSON 格式正确
- [ ] 验证所有意图都有配置
- [ ] 运行配置同步检查脚本
- [ ] 重启 Gateway
- [ ] 查看日志确认

---

## 四、常见问题排查

### 问题 1: 意图数量不对
**检查**:
```bash
grep -A15 "modelMapping" plugins/ocnmps-router/ocnmps_core.js
```
**解决**: 确保 11 个意图都在 modelMapping 中

### 问题 2: Gateway 加载失败
**检查**:
```bash
node -e "require('./plugins/ocnmps-router/plugin.js')"
```
**解决**: 检查语法错误

### 问题 3: 配置不一致
**检查**:
```bash
~/.openclaw/workspace/scripts/sync-ocnmps-config.sh
```
**解决**: 同步三个配置文件

---

## 五、配置备份策略

### 变更前备份
```bash
cp plugins/ocnmps-router/ocnmps_core.js \
   plugins/ocnmps-router/archive/ocnmps_core.js.bak.$(date +%Y%m%d-%H%M%S)
```

### 保留策略
- 保留最近 3 个版本
- 重大变更前手动备份
- 归档到 `plugins/ocnmps-router/archive/`

---

**下次审查**: 2026-04-10
