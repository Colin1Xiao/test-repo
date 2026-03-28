# 📛 命名规范 (Naming Conventions)

_最后更新：2026-03-29_  
_目的：统一工作区命名，避免搜索困难、文档错链、脚本误匹配_

---

## 🎯 核心原则

**人读和机器读分离**：
- **目录/文件名**：只用下划线风格（机器友好）
- **文档展示名**：只用点号风格（人类友好）

---

## 📂 一、目录与文件命名

### 规则：只用下划线，不用点号

| ✅ 正确 | ❌ 错误 | 说明 |
|--------|--------|------|
| `trading_system_v5_3/` | `trading_system_v5.3/` | 目录名 |
| `V5_4_ARCHITECTURE.md` | `V5.4_ARCHITECTURE.md` | 文件名 |
| `v5_4_test_report.md` | `v5.4_test_report.md` | 文件名 |
| `production_readiness_checklist.md` | `production.readiness.checklist.md` | 文件名 |
| `state_store.json` | `state.store.json` | 数据文件 |
| `live_state.json` | `live.state.json` | 数据文件 |

### 版本号命名

**目录/文件名中的版本号**：
- 格式：`v{主版本}_{次版本}`
- 示例：`v5_4`, `v3_6`, `v2_5`

**例外**：日期格式保持点号
- `2026-03-29.md` ✅
- `daily_report_20260329.md` ✅

---

## 📖 二、文档展示名

### 规则：文档标题、表格、口头交流用点号

| ✅ 正确 | 说明 |
|--------|------|
| **V5.4** 架构文档 | 文档标题 |
| 发布说明 **V5.4.1** | 发布版本 |
| Phase **2.5** 验证 | 阶段版本 |
| UI-**3.9** PWA 支持 | 子系统版本 |

### 示例对比

```markdown
# ❌ 错误（文件名风格用于标题）
# V5_4 架构文档

# ✅ 正确（点号风格用于标题）
# V5.4 架构文档
```

```markdown
# ❌ 错误（混用）
| 版本 | 状态 |
|------|------|
| V5_4 | ✅ 生产就绪 |

# ✅ 正确（统一）
| 版本 | 状态 |
|------|------|
| V5.4 | ✅ 生产就绪 |
```

---

## 🔧 三、代码与脚本

### 变量与函数名

**Python 变量/函数**：下划线风格
```python
# ✅ 正确
v5_4_architecture = load_doc()
get_production_readiness()
state_store = load_state()

# ❌ 错误
v5.4.architecture = load_doc()  # 语法错误
getProductionReadiness()  # 风格不一致
```

**常量**：全大写下划线
```python
# ✅ 正确
V5_4_VERSION = "5.4.0"
MAX_POSITION_V5_4 = 0.13

# ❌ 错误
V5.4.VERSION = "5.4.0"  # 语法错误
```

### 类名

**PascalCase**，版本号用下划线分隔
```python
# ✅ 正确
class V5_4_Architecture:
    pass

class StateStore:
    pass

# ❌ 错误
class V5.4.Architecture:  # 语法错误
    pass
```

### 日志与输出

**显示给用户时用点号**
```python
# ✅ 正确
logger.info(f"V5.4 实盘验证完成")
print(f"当前版本：V5.4.0-verified")

# ❌ 错误（除非是文件路径）
logger.info(f"V5_4 实盘验证完成")
```

---

## 📁 四、路径引用

### 脚本中的路径

**使用下划线风格的目录名**
```python
# ✅ 正确
TRADING_SYSTEM_DIR = "~/.openclaw/workspace/trading_system_v5_3"
V5_4_DOCS = "~/.openclaw/workspace/trading_system_v5_4"

# ❌ 错误
TRADING_SYSTEM_DIR = "~/.openclaw/workspace/trading_system_v5.3"
```

### 文档中的路径引用

**代码块内用下划线，正文用点号**
```markdown
# ✅ 正确
运行目录：`trading_system_v5_3/`（下划线）
当前版本：V5.4（点号）

# ❌ 错误
运行目录：`trading_system_v5.3/`
当前版本：V5_4
```

---

## 🗂️ 五、现有文件整理清单

### 需要重命名的文件（优先级：中）

| 当前文件名 | 建议新文件名 | 原因 |
|-----------|-------------|------|
| `V5.4_ARCHITECTURE.md` | `V5_4_ARCHITECTURE.md` | 统一文件名风格 |
| `V5.4_TEST_REPORT.md` | `V5_4_TEST_REPORT.md` | 统一文件名风格 |
| `V5.4.1_BACKLOG.md` | `V5_4_1_BACKLOG.md` | 统一文件名风格 |

**注意**：重命名前需检查所有引用，更新后再重命名。

### 已符合规范的文件

| 文件 | 状态 |
|------|------|
| `trading_system_v5_3/` | ✅ 目录名正确 |
| `trading_system_v5_4/` | ✅ 目录名正确 |
| `V5_4_ARCHITECTURE.md` | ✅ 已修正 |
| `V5_4_TEST_REPORT.md` | ✅ 已修正 |
| `state_store.json` | ✅ 正确 |
| `live_state.json` | ✅ 正确 |

---

## 📊 六、版本展示对照表

| 场景 | 使用风格 | 示例 |
|------|---------|------|
| 目录名 | 下划线 | `trading_system_v5_3/` |
| 文件名 | 下划线 | `V5_4_ARCHITECTURE.md` |
| 文档标题 | 点号 | `# V5.4 架构文档` |
| 表格内容 | 点号 | `\| V5.4 \| ✅ 生产就绪 \|` |
| 代码变量 | 下划线 | `v5_4_version` |
| 日志输出 | 点号 | `"V5.4 验证完成"` |
| 口头交流 | 点号 | "V5.4 版本" |
| Git 标签 | 点号 | `v5.4.0-verified` |
| Git 提交信息 | 混合 | `feat(V5.4): 实盘验证完成` |

---

## ✅ 检查清单

### 新增文件时
- [ ] 目录名：只用下划线
- [ ] 文件名：只用下划线
- [ ] 文档标题：用点号
- [ ] 代码变量：用下划线
- [ ] 日志输出：用点号

### 审查现有文件时
- [ ] 检查目录名是否符合规范
- [ ] 检查文件名是否符合规范
- [ ] 检查文档内引用是否一致
- [ ] 检查脚本路径引用是否正确

---

## 🚨 常见错误

### 错误 1：混用风格
```markdown
# ❌ 错误
V5_4 版本已在 trading_system_v5.3/ 目录运行

# ✅ 正确
V5.4 版本已在 trading_system_v5_3/ 目录运行
```

### 错误 2：文件名用点号
```bash
# ❌ 错误
ls V5.4_ARCHITECTURE.md

# ✅ 正确
ls V5_4_ARCHITECTURE.md
```

### 错误 3：代码中用点号
```python
# ❌ 错误
v5.4_dir = "trading_system_v5.3"

# ✅ 正确
v5_4_dir = "trading_system_v5_3"
```

---

## 📝 执行策略

### 立即执行（本次整理）
1. ✅ 更新 README.md 使用正确命名
2. ✅ 创建本规范文档
3. ⏳ 检查并更新所有文档中的引用

### 后续执行（不影响运行）
4. 📝 重命名不符合规范的文件名（先更新引用）
5. 📝 归档历史版本文档时统一命名

---

_命名规范是团队协作和自动化的基础。遵守规范，减少混乱。_
