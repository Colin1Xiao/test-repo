# 快照摘要

**快照 ID**: snapshot_20260317_070941
**创建时间**: Tue Mar 17 07:10:14 CST 2026
**触发原因**: critical_Gateway 进程未运行

## 文件列表

| 文件 | 说明 |
|------|------|
| system_status.txt | 系统状态快照 |
| doctor.txt | Doctor 检查输出 |
| health.txt | Health Check 输出 |
| config_summary.txt | 配置摘要 |
| health_data.json | 最近健康数据 |
| recent_logs.txt | 最近日志 |
| sessions.txt | 活跃会话 |
| models.txt | 模型状态 |

## 快速诊断

```
/Users/colin/.openclaw/workspace/autoheal/snapshots/snapshot_20260317_070941/recent_logs.txt:[2026-03-17 06:34:55] Critical: 1, Warning: 0, Info: 0
/Users/colin/.openclaw/workspace/autoheal/snapshots/snapshot_20260317_070941/recent_logs.txt:[2026-03-17 06:38:16] Critical: 1, Warning: 0, Info: 0
/Users/colin/.openclaw/workspace/autoheal/snapshots/snapshot_20260317_070941/system_status.txt:  WARN Reverse proxy headers are not trusted
```

---
*由 Auto-Heal 自动生成*
