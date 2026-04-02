# Version Matrix

| 项目 | 角色 | 状态 | 说明 |
|------|------|------|------|
| helix_m3 | 主开发线 | Active | 当前唯一主开发，FastAPI 架构 |
| trading_v5_3_ref | 参考基线 | Frozen | 稳定版，只读参考 |
| trading_v5_4_rc | 候选发布 | Validate | 安全修复验证中 |
| xiaolong_crypto_trading_system | 历史归档 | Archived | 早期遗留版本 |

## 状态说明

- **Active**: 活跃开发，可提交变更
- **Frozen**: 冻结，只读参考，禁止修改
- **Validate**: 验证中，通过后可合并或删除
- **Archived**: 已归档，仅历史查阅

## 迁移记录

- 2026-04-02: 完成五层结构重组
- 旧路径保留软链接兼容
