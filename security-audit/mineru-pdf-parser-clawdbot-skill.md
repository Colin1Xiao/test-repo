SKILL VETTING REPORT
═══════════════════════════════════════
Skill: mineru-pdf-parser-clawdbot-skill
Source: ClawHub
Author: kesslerio
Version: 1.0.0
───────────────────────────────────────
METRICS:
• Downloads/Stars: Not available
• Last Updated: 2026-03-13T03:04:17.774Z
• Files Reviewed: 2 (SKILL.md, scripts/mineru_parse.sh)
───────────────────────────────────────
RED FLAGS:
- 需要预先安装MinerU CLI（未包含在技能中）
- 系统上未检测到MinerU安装

PERMISSIONS NEEDED:
• Files: 读取本地PDF文件，写入输出到./mineru-output/目录
• Network: 无（所有处理都在本地CPU上进行）
• Commands: Bash脚本包装器，需要本地MinerU安装
• Environment: 需要MINERU_CMD环境变量或系统PATH中有mineru命令
───────────────────────────────────────
RISK LEVEL: 🟡 MEDIUM

VERDICT: ⚠️ 需要安装MinerU后才能使用

NOTES:
- 安全扫描标记为SUSPICIOUS，可能是由于shell脚本执行
- 所有PDF解析都在本地CPU上进行，没有外部API调用，数据不会离开机器
- 支持表格和图片提取，输出Markdown和JSON格式
- 需要预先安装MinerU PDF解析软件（不包含在技能中）
- 4.1KB的shell脚本结构清晰，无可疑模式
- 比pdf-ocr技能（硬编码百度API密钥）安全得多
- 脚本检查MinerU CLI是否存在，如果不存在会报错并退出
- 支持多种配置选项：格式、表格、图片、线程数、语言、后端、方法、设备
- 需要先安装MinerU才能使用此技能
═══════════════════════════════════════
