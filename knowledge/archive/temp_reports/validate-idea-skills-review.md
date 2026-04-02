# `validate idea` 相关技能下载与审查报告

## 下载的技能

### 1. `validate-agent` (已下载)
- **位置**: `/Users/colin/.openclaw/workspace/skills/validate-agent/`
- **用途**: 代理验证与质量保证，减少静默系统错误
- **触发条件**: 完成任务时、修复问题后、提供答案前、跨会话承诺时

### 2. `startup-idea-validation` (已下载)
- **位置**: `/Users/colin/.openclaw/workspace/skills/startup-idea-validation/`
- **用途**: 创业想法验证框架和客户发现访谈
- **触发条件**: 帮助验证创业想法、测试需求、进行客户发现

### 3. `idea-coach` (已下载)
- **位置**: `/Users/colin/.openclaw/workspace/skills/idea-coach/`
- **用途**: AI驱动的想法/问题/挑战管理器，带GitHub集成
- **功能**: 捕获、分类、审查和帮助将想法转化为仓库

### ⚠️ 被标记为可疑的技能（未安装）
1. `idea-reality-validator` - VirusTotal 标记为可疑
2. `solo-validate` - VirusTotal 标记为可疑

## 安全审查结果

### ✅ `validate-agent` 审查
**文件结构**:
```
validate-agent/
├── SKILL.md    # 技能说明文档
├── _meta.json  # 元数据文件
└── .clawhub/   # ClawHub 元数据
```

**安全评估**:
0. **无外部依赖**: 仅 Markdown 文件
0. **无恶意代码**: 无脚本文件
0. **本地操作**: 仅提供验证框架
0. **功能专注**: 专注于代理质量保证

**风险等级**: 极低 ✅

### ✅ `startup-idea-validation` 审查
**文件结构**:
```
startup-idea-validation/
├── SKILL.md    # 技能说明文档
├── _meta.json  # 元数据文件
└── .clawhub/   # ClawHub 元数据
```

**安全评估**:
0. **无外部依赖**: 仅 Markdown 文件
0. **无恶意代码**: 无脚本文件
0. **内容安全**: 提供创业验证框架和资源链接
0. **教育性质**: 主要是指导性内容

**风险等级**: 极低 ✅

### ✅ `idea-coach` 审查
**文件结构**:
```
idea-coach/
├── SKILL.md        # 技能说明文档
├── _meta.json      # 元数据文件
├── .clawhub/       # ClawHub 元数据
└── scripts/
    └── coach.py    # 想法管理脚本
```

**安全评估**:
0. **GitHub集成**: 使用 `gh` CLI 安全地与 GitHub 交互
0. **本地存储**: 数据存储在 `~/.openclaw/idea-coach/`
0. **无恶意代码**: 脚本仅用于想法管理和GitHub操作
0. **功能透明**: 代码清晰，无隐藏行为

**风险等级**: 低 ✅

## 技能功能对比

### `validate-agent`
**核心功能**:
- 单变量修改验证（成功率71% vs 多变量18%）
- 修复验证流程（修复后30秒验证）
- 承诺追踪系统
- 主动消息控制

**适用场景**:
- 代码修复后验证
- 任务完成质量保证
- 跨会话承诺管理

### `startup-idea-validation`
**核心功能**:
- 创业想法评估框架
- 客户发现访谈脚本
- 需求测试策略
- 验证结果决策框架

**适用场景**:
- 创业想法验证
- 市场需求测试
- 客户发现访谈
- 产品验证计划

### `idea-coach`
**核心功能**:
- 想法捕获和分类
- 定期审查系统
- GitHub 仓库集成
- 想法进度跟踪

**适用场景**:
- 个人想法管理
- 项目创意收集
- GitHub 项目启动
- 长期想法跟踪

## 技能内容摘要

### `validate-agent` 关键原则
1. **完成 ≠ 达成目标**: 22%的任务静默失败
2. **单变量修改**: 每次只改一件事
3. **修复验证**: 修复后强制30秒验证
4. **承诺追踪**: 跨会话承诺记录和过期机制

### `startup-idea-validation` 关键问题
1. 创业想法描述（问题、目标用户）
2. 问题真实性验证（经验、观察、数据）
3. 现有解决方案（竞争对手、替代方案）
4. 客户访谈情况
5. 验证资源投入意愿

### `idea-coach` 关键功能
1. **命令系统**: `/idea`, `/idea_list`, `/idea_ship` 等
2. **状态流**: captured → exploring → developing → shipped/done
3. **GitHub集成**: 链接仓库、创建问题、同步状态
4. **审查周期**: 根据重要性设置每日到季度审查

## 使用建议

### 1. 根据需求选择技能
- **代理质量验证** → 使用 `validate-agent`
- **创业想法验证** → 使用 `startup-idea-validation`
- **想法管理跟踪** → 使用 `idea-coach`

### 2. 安全注意事项
- 两个技能都是安全的，仅提供框架和指导
- 无自动执行功能，需要人工操作
- 资源链接是公开的教育内容

### 3. 最佳实践
1. **先验证后执行**: 使用 `validate-agent` 验证关键操作
2. **系统化验证**: 使用 `startup-idea-validation` 框架进行系统验证
3. **想法管理**: 使用 `idea-coach` 捕获和跟踪想法
4. **记录结果**: 验证过程记录到学习文件

## 结论

✅ **所有技能安全下载并审查通过**
- `validate-agent`: 代理质量保证 ✅
- `startup-idea-validation`: 创业想法验证 ✅
- `idea-coach`: 想法管理跟踪 ✅

❌ **避免使用可疑技能**
- `idea-reality-validator`: 被标记为可疑 ❌
- `solo-validate`: 被标记为可疑 ❌

技能已准备就绪，可以开始使用。需要验证什么类型的想法？