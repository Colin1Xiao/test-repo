# 保留/清理白名单

## 目录治理策略

| 区域 | 策略 | 说明 |
|------|------|------|
| `products/helix_m3/` | 允许增长 | 唯一主开发线，持续迭代 |
| `products/trading_v5_3_ref/` | 禁止增长 | 参考基线，已只读保护 |
| `products/trading_v5_4_rc/` | 受控增长 | 验证期，通过即合并或清退 |
| `products/legacy/*` | 禁止增长 | 历史归档，永久冻结 |
| `platform/*` | 受控增长 | 平台能力，按需维护 |
| `runtime/*` | 滚动保留 | 活数据，定期轮转 |
| `knowledge/docs/` | 允许增长 | 规范文档 |
| `knowledge/reports/` | 滚动保留 | 日报周报，保留90天 |
| `knowledge/research/` | 允许增长 | 研究资料 |
| `knowledge/archive/` | 禁止增长 | 冷数据，仅查阅 |
| `quarantine/*` | 永久隔离 | 高风险技能，禁止恢复 |

## 缓存清理白名单

### 必须清理（每次部署后）
- `__pycache__/`
- `.pytest_cache/`
- `*.pyc`
- `node_modules/.cache/`

### 定期清理（每周）
- `runtime/logs/*.log`
- `browser/cache/`
- `agents/temp/`

### 禁止清理
- `memory/vectors/` - 向量索引
- `runtime/config/` - 配置数据
- `runtime/memory/` - 记忆文件

## 大文件审计清单

| 路径 | 当前大小 | 阈值 | 动作 |
|------|---------|------|------|
| `memory/` | 314M | 500M | 监控，超阈值审查重复索引 |
| `products/helix_m3/.venv/` | ~200M | 300M | 监控，考虑共享虚拟环境 |
| `node_modules/` | 73M | 100M | 监控，定期 `npm prune` |
| `browser/` | 56M | 100M | 监控，设置 retention |
| `agents/` | 54M | 100M | 监控，定期清理 |
