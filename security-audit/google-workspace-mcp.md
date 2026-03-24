SKILL VETTING REPORT
═══════════════════════════════════════
Skill: google-workspace-mcp
Source: ClawHub
Author: dru-ca
Version: 1.0.0
───────────────────────────────────────
METRICS:
• Downloads/Stars: Not available
• Last Updated: 2026-03-13T03:07:18.132Z
• Files Reviewed: 1 (SKILL.md)
───────────────────────────────────────
RED FLAGS:
- 使用第三方MCP服务器包 (@presto-ai/google-workspace-mcp)
- 需要全局npm安装
- 需要mcporter工具

PERMISSIONS NEEDED:
• Files: 读取/写入 ~/.config/google-workspace-mcp/ 存储OAuth令牌
• Network: 访问Google Workspace API (Gmail, Calendar, Drive, Docs, Sheets)
• Commands: npm, npx, mcporter (MCP协议客户端)
• Environment: 需要运行 @presto-ai/google-workspace-mcp 包
───────────────────────────────────────
RISK LEVEL: 🟡 MEDIUM

VERDICT: ✅ 可以安装（需用户确认信任presto-ai包）

NOTES:
- 安全扫描标记为SUSPICIOUS（可能由于广泛的Google Workspace访问权限）
- 使用第三方MCP服务器包 (@presto-ai/google-workspace-mcp) 处理OAuth流程
- 需要从npm registry安装包
- 提供完整的Google Workspace访问：Gmail, Calendar, Drive, Docs, Sheets, Chat, People API
- OAuth凭证存储在本地 ~/.config/google-workspace-mcp/
- 无需Google Cloud Console设置，简化了配置但意味着MCP包管理OAuth流程
- 首次使用会打开浏览器进行Google OAuth认证
- 包含49个可用工具，功能非常全面
- 如果信任presto-ai包，这是一个方便的Google Workspace集成方案
═══════════════════════════════════════
