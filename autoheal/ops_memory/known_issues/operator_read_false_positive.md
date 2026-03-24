# operator.read 权限误报

**时间**: 2026-03-17
**类型**: known_issues

---

## 现象
doctor 检查时报告 `operator.read` 权限问题

## 原因
某些情况下，权限检查可能产生误报，实际不影响功能

## 解决方案
如果确认功能正常，可以忽略此警告

## 验证方法
```bash
openclaw doctor --verbose
```

如果其他检查都通过，此警告可安全忽略

---

**标签**: permissions, false-positive, doctor
