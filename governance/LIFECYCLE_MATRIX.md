# 生命周期矩阵

## 工作区生命周期表

| 区域 | 生命周期 | 动作 | 负责人 |
|------|---------|------|--------|
| `products/helix_m3` | Active | 持续开发 | 主开发者 |
| `products/trading_v5_3_ref` | Frozen | 只读参考 | 无 |
| `products/trading_v5_4_rc` | Validate | 验证后合并或清退 | 验证者 |
| `products/legacy/*` | Archived | 永久归档 | 无 |
| `platform/autoheal` | Active-Core | 平台能力持续维护 | 平台维护者 |
| `platform/ocnmps` | Active-Core | 平台能力持续维护 | 平台维护者 |
| `platform/superpowers` | Active-Core | 平台能力持续维护 | 平台维护者 |
| `platform/skills` | Active-Core | 技能系统维护 | 平台维护者 |
| `runtime/config` | Active | 配置管理 | 系统 |
| `runtime/memory` | Active | 记忆管理 | 系统 |
| `runtime/logs` | Rolling | 定期轮转（30天） | 系统 |
| `runtime/health` | Active | 健康检查 | 系统 |
| `knowledge/docs` | Active | 文档维护 | 文档维护者 |
| `knowledge/reports` | Rolling | 定期归档（90天） | 系统 |
| `knowledge/research` | Active | 研究资料管理 | 研究者 |
| `knowledge/archive` | Cold | 仅保留，不活跃使用 | 归档管理员 |
| `quarantine/*` | Forbidden | 永久隔离 | 安全管理员 |

## 状态转换规则

```
Active → Frozen: 版本冻结，设为只读
Active → Validate: 发布候选，进入验证
Validate → Active: 验证通过，合并回主线
Validate → Archived: 验证失败，归档清退
Frozen → Archived: 不再参考，彻底归档
Any → Forbidden: 安全风险，永久隔离
```

## 清理时间表

| 区域 | 保留期 | 清理动作 |
|------|--------|---------|
| `runtime/logs` | 30天 | 自动删除旧日志 |
| `knowledge/reports` | 90天 | 自动归档到 `archive/` |
| `browser/cache` | 7天 | 自动清理过期缓存 |
| `agents/temp` | 1天 | 自动清理临时文件 |
| `sessions/` | 30天 | 自动归档旧会话 |
| `tasks/` | 7天 | 自动清理已完成任务 |
