# `using-superpowers` 技能审查报告

## 项目概况
- **项目名称**: Superpowers
- **仓库地址**: https://github.com/obra/superpowers
- **所有者**: obra (Jesse Vincent)
- **许可证**: MIT License
- **版本**: 5.0.6
- **下载时间**: 2026-03-27 08:41

## 安全审查结果

### ✅ 安全优势
1. **开源透明**: 完整源代码在 GitHub 公开
2. **MIT 许可证**: 商业友好，允许自由使用和修改
3. **无外部依赖**: 项目主要包含 Markdown 技能文件和 JavaScript 插件
4. **活跃社区**: 有 71个 issues 和 105个 PRs，显示活跃维护
5. **明确的所有者**: Jesse Vincent，有赞助链接

### ✅ 文件结构审查
项目主要包含：
- `skills/` - 14个技能文件夹，每个包含 SKILL.md
- `.opencode/` - OpenCode 插件实现
- `.codex/` - Codex 集成文件
- `.claude-plugin/` - Claude Code 插件配置
- `.cursor-plugin/` - Cursor 集成
- `docs/` - 文档
- `tests/` - 测试文件

### ✅ 代码审查
- 主插件文件 `superpowers.js` 主要是系统提示注入
- 无恶意代码（如文件删除、网络请求、权限提升）
- 仅包含技能加载和提示注入功能

### ⚠️ 潜在注意点
1. **技能强制执行**: `using-superpowers` 技能要求强制使用技能，可能限制 AI 灵活性
2. **系统提示修改**: 会修改 AI 的系统提示，可能影响其他指令优先级
3. **技能覆盖**: 技能会覆盖默认系统行为，但用户指令优先级最高

### 📊 风险评估
- **安全风险**: 低
- **功能风险**: 中（可能改变 AI 工作流程）
- **兼容性风险**: 低（支持多个平台）

## `using-superpowers` 技能详情
**位置**: `skills/using-superpowers/SKILL.md`
**核心规则**:
1. 任何任务开始前必须检查适用技能（即使只有 1% 可能性）
2. 用户指令优先级最高 > 技能 > 默认系统提示
3. 技能检查在澄清问题之前进行
4. 使用 Skill 工具加载技能，不直接读取文件

## 建议使用方式
1. **测试环境先试用**: 在非关键项目测试技能影响
2. **了解工作流变化**: 技能会强制特定开发流程
3. **保留用户控制**: 用户指令始终优先级最高
4. **评估生产力**: 评估是否提高 vs 限制 AI 灵活性

## 结论
`using-superpowers` 技能和 Superpowers 项目整体：
- ✅ **安全可下载**
- ✅ **代码透明**
- ✅ **许可证友好**
- ⚠️ **会改变 AI 工作流程**

建议下载并使用，但注意其工作流影响，确保用户控制权。

---

**下载命令已完成**: `git clone https://github.com/obra/superpowers.git`
**位置**: `/Users/colin/.openclaw/workspace/superpowers/`

需要进一步配置才能在不同 AI 平台使用该技能。