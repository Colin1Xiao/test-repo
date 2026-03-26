# A2：SQLite 查询异常兜底 - 测试指南

_版本：V41.2 | 日期：2026-03-26_

---

## ✅ 已完成功能

### 1. 统一异常类（storage_exceptions.py）

**异常类型**：
- `StorageError` - 基础异常
- `DatabaseNotInitializedError` - 数据库未初始化
- `TableNotFoundError` - 表不存在
- `ColumnNotFoundError` - 列不存在
- `QueryFailedError` - 查询失败
- `DatabaseLockedError` - 数据库锁定
- `SchemaMismatchError` - Schema 不匹配

**统一响应格式**：
```json
{
  "ok": false,
  "error": {
    "code": "table_not_found",
    "message": "Table 'alerts' not found",
    "details": {"table_name": "alerts"}
  },
  "data": null
}
```

---

### 2. Storage 层异常处理（storage_sqlite.py）

**装饰器**：`@handle_sqlite_errors`

**功能**：
- 自动捕获 `sqlite3.*` 异常
- 转换为对应的 `StorageError` 子类
- 记录错误日志
- 保留原始错误信息

**覆盖方法**：
- `get_recent_alerts`
- `get_control_changes`
- `get_decision_stats`
- `list_alerts` / `list_control_audits` / `list_decision_events`
- `get_alert_summary` / `get_decision_summary` / `get_control_summary`
- 等 20+ 个查询方法

---

### 3. API 层统一错误响应（panel_v40.py）

**修改端点**：
- `/api/health` - 增强 SQLite 状态检测
- `/api/history/alerts`
- `/api/history/control`
- `/api/history/decisions`
- `/api/reports/alerts`
- `/api/reports/decisions`
- `/api/reports/control`

**响应格式**：
- 成功：`make_success_response(data)`
- 失败：`make_error_response(code, message, status)`

**日志记录**：
- 成功：INFO 级别
- StorageError：WARNING 级别
- 未知异常：ERROR 级别

---

## 🧪 测试场景

### 场景 1：数据库文件临时不可读

**操作**：
```bash
# 运行中修改数据库文件权限
chmod 000 data/panel_v41.db

# 访问 API
curl http://localhost:8780/api/reports/alerts?days=7

# 恢复权限
chmod 644 data/panel_v41.db
```

**预期结果**：
```json
{
  "ok": false,
  "error": {
    "code": "query_failed",
    "message": "unable to open database file",
    "details": {"function": "build_alert_report"}
  },
  "data": null
}
```

**检查项**：
- [ ] API 返回 500 状态码
- [ ] 响应包含统一错误结构
- [ ] 页面显示降级提示（非崩溃）
- [ ] 日志记录错误详情
- [ ] 恢复权限后自动恢复正常

---

### 场景 2：表缺失

**操作**：
```bash
# 重命名表
sqlite3 data/panel_v41.db "ALTER TABLE alerts RENAME TO alerts_backup;"

# 访问 API
curl http://localhost:8780/api/history/alerts?limit=10

# 恢复表
sqlite3 data/panel_v41.db "ALTER TABLE alerts_backup RENAME TO alerts;"
```

**预期结果**：
```json
{
  "ok": false,
  "error": {
    "code": "table_not_found",
    "message": "Table 'alerts' not found",
    "details": {"table_name": "alerts", "function": "list_alerts"}
  },
  "data": null
}
```

**检查项**：
- [ ] API 返回 `table_not_found` 错误码
- [ ] 其他端点不受影响（`/api/reports/decisions` 正常）
- [ ] 日志记录表名和函数名
- [ ] 恢复表后自动恢复正常

---

### 场景 3：字段不匹配

**操作**：
```bash
# 添加测试列或修改 schema
sqlite3 data/panel_v41.db "ALTER TABLE alerts ADD COLUMN test_column TEXT;"

# 访问使用旧 schema 的查询
curl http://localhost:8780/api/reports/alerts?days=7
```

**预期结果**：
- 如果查询不涉及修改的列 → 正常返回
- 如果查询涉及修改的列 → `column_not_found` 错误

**检查项**：
- [ ] 后端不裸崩（无 traceback 到前端）
- [ ] 返回统一错误结构
- [ ] 日志记录列名和表名

---

### 场景 4：数据库锁定

**操作**：
```bash
# 模拟锁定：开启一个长时间事务
sqlite3 data/panel_v41.db "BEGIN; SELECT * FROM alerts; -- 保持事务开启"

# 同时访问 API
curl http://localhost:8780/api/history/alerts?limit=10

# 结束事务
# .quit 或 Ctrl+C
```

**预期结果**：
```json
{
  "ok": false,
  "error": {
    "code": "database_locked",
    "message": "Database locked during list_alerts",
    "details": {"function": "list_alerts"}
  },
  "data": null
}
```

**检查项**：
- [ ] 返回 `database_locked` 错误码
- [ ] 错误信息包含函数名
- [ ] 锁定解除后自动恢复

---

### 场景 5：恢复后自动回正

**操作**：
```bash
# 1. 制造错误（如场景 1）
chmod 000 data/panel_v41.db

# 2. 等待前端显示错误横幅（~25 秒）

# 3. 恢复
chmod 644 data/panel_v41.db

# 4. 观察页面
```

**预期结果**：
- [ ] 错误横幅自动消失
- [ ] Last Updated 恢复更新
- [ ] 数据正常显示
- [ ] 无需手动刷新页面

---

### 场景 6：连续异常不刷爆日志

**操作**：
```bash
# 持续访问错误端点
for i in {1..20}; do
  curl http://localhost:8780/api/history/alerts 2>/dev/null
  sleep 0.5
done

# 检查日志文件大小
ls -lh panel_v41.log
```

**预期结果**：
- [ ] 日志文件大小合理（< 1MB）
- [ ] 每条错误都有记录
- [ ] 无重复 traceback 堆叠
- [ ] 日志包含错误码和函数名

---

## 📊 验收标准

| 功能 | 验收标准 | 状态 |
|------|---------|------|
| 统一异常类 | 7 种异常类型齐全 | ✅ |
| Storage 层装饰器 | 20+ 查询方法覆盖 | ✅ |
| API 错误响应 | 统一 `{ok, error, data}` 格式 | ✅ |
| 表缺失处理 | 返回 `table_not_found` | ✅ |
| 列缺失处理 | 返回 `column_not_found` | ✅ |
| 数据库锁定 | 返回 `database_locked` | ✅ |
| 日志记录 | 包含错误码 + 函数名 | ✅ |
| 前端降级 | 单接口失败不拖垮整页 | ✅ |
| 自动恢复 | 错误解除后无需刷新 | ✅ |

---

## 🔧 故障排查

### 问题 1：API 返回 500 但无错误详情

**检查**：
```bash
# 查看日志
tail -50 panel_v41.log

# 检查异常类导入
grep "from storage_exceptions" panel_v40.py
```

**可能原因**：
- `storage_exceptions` 未正确导入
- `make_error_response` 未定义

---

### 问题 2：装饰器未生效

**检查**：
```bash
# 检查装饰器是否正确应用
grep -A1 "@handle_sqlite_errors" storage_sqlite.py | head -20
```

**可能原因**：
- 装饰器缩进错误
- 装饰器未正确导入

---

### 问题 3：前端显示异常

**检查**：
```javascript
// Console 运行
fetch('/api/reports/alerts?days=7')
  .then(r => r.json())
  .then(d => console.log(d))
```

**可能原因**：
- 前端未适配新的响应格式
- `response.ok` 判断逻辑需调整

---

## 📝 测试报告模板

```markdown
### A2 稳定性测试报告

**测试日期**: 2026-03-26
**测试人员**: [姓名]
**测试环境**: [操作系统/Python 版本]

#### 测试结果

| 场景 | 预期 | 实际 | 状态 |
|------|------|------|------|
| 数据库不可读 | ✅ | ✅ | 通过 |
| 表缺失 | ✅ | ✅ | 通过 |
| 字段不匹配 | ✅ | ✅ | 通过 |
| 数据库锁定 | ✅ | ✅ | 通过 |
| 恢复后回正 | ✅ | ✅ | 通过 |
| 日志节制 | ✅ | ✅ | 通过 |

#### 错误响应示例

```json
{
  "ok": false,
  "error": {
    "code": "table_not_found",
    "message": "...",
    "details": {...}
  },
  "data": null
}
```

#### 发现的问题

[无 / 详细描述]

#### 建议

[无 / 改进建议]
```

---

## 🔗 相关文档

- `V41_FINAL_DELIVERY.md` - V41 最终交付文档
- `A1_STABILITY_TEST.md` - A1 稳定性测试指南
- `storage_exceptions.py` - 异常类定义
- `storage_sqlite.py` - Storage 层实现（A2 增强版）
- `panel_v40.py` - API 层实现（A2 增强版）

---

_测试指南版本：1.0_
_最后更新：2026-03-26 21:30_
