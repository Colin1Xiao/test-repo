# OCNMPS V3 P0 补丁 24 小时观察清单

**文档状态**: Active  
**创建时间**: 2026-04-04 18:45 (Asia/Shanghai)  
**观察窗口**: 2026-04-04 18:45 → 2026-04-05 18:45  
**工单状态**: P0 = Resolved, Monitoring

---

## 📊 基线信息

| 项目 | 值 |
|------|-----|
| 补丁应用时间 | 2026-04-04 18:41 |
| Gateway 重启时间 | 2026-04-04 18:41 |
| 最后错误时间 | 2026-04-04 17:59:48 |
| 错误归零时间 | 2026-04-04 18:41 |
| 补丁文件 | `/usr/local/lib/node_modules/openclaw/dist/pi-embedded-BYdcxQ5A.js` |
| 修复函数 | `splitModelRef(ref)` |

---

## 🔍 必看日志关键词

### 错误类 (应为 0)

```bash
# Gateway 错误日志
tail -f ~/.openclaw/logs/gateway.err.log | grep -iE "
  split is not a function|
  resolved\.model\.split|
  model split failed
"
```

**预期**: 0 次

---

### 警告类 (监控频次)

```bash
# splitModelRef 类型守卫日志
tail -f ~/.openclaw/logs/gateway.log | grep -iE "
  splitModelRef|
  Invalid object format|
  Non-string input
"
```

**预期**: 偶发 (< 5 次/24h)，仅在真正异常输入时触发

---

### 成功类 (持续出现)

```bash
# OCNMPS 路由成功
tail -f ~/.openclaw/logs/gateway.log | grep -iE "
  V3 Model override applied|
  before_model_resolve|
  grayHit
"
```

**预期**: 持续出现，无中断

---

## ✅ 检查清单

### 2 小时检查 (18:45 → 20:45)

- [ ] `split is not a function` = 0 次
- [ ] OCNMPS 路由日志持续出现
- [ ] Gateway 运行正常
- [ ] 无新增错误类型

**检查人**: 小龙  
**检查时间**: _______  
**状态**: 🟢 / 🟡 / 🔴

---

### 4 小时检查 (18:45 → 22:45)

- [ ] `split is not a function` = 0 次
- [ ] 警告日志 < 5 次
- [ ] OCNMPS 灰度命中正常
- [ ] 无 fallback 异常

**检查人**: 小龙  
**检查时间**: _______  
**状态**: 🟢 / 🟡 / 🔴

---

### 8 小时检查 (18:45 → 02:45)

- [ ] `split is not a function` = 0 次
- [ ] 警告日志 < 10 次
- [ ] 模型切换功能正常
- [ ] 子代理 spawn 正常

**检查人**: 小龙  
**检查时间**: _______  
**状态**: 🟢 / 🟡 / 🔴

---

### 24 小时检查 (18:45 → 次日 18:45)

- [ ] `split is not a function` = 0 次
- [ ] 警告日志 < 20 次
- [ ] 无复发趋势
- [ ] 可以正式关闭 P0

**检查人**: Colin  
**检查时间**: _______  
**状态**: 🟢 / 🟡 / 🔴

---

## 🚨 复发判定标准

### 立即升级 (P0 重新打开)

满足任一条件：

1. **同类错误复发** ≥ 1 次
2. **新错误类型** 与模型解析相关
3. **OCNMPS 路由中断** 持续 > 5 分钟
4. **Gateway 崩溃** 与补丁相关

---

### 需要关注 (P1 提前执行)

满足任一条件：

1. **警告日志** 频次 > 10 次/小时
2. **fallback 触发** 频次 > 5 次/小时
3. **灰度命中率** 异常波动 (> 50% 变化)
4. **用户报告** 模型切换异常

---

## 📋 快速检查命令

```bash
# 1. 错误统计
echo "=== 错误统计 ==="
grep -c "split is not a function" ~/.openclaw/logs/gateway.err.log 2>/dev/null || echo "0"

# 2. 警告统计
echo "=== 警告统计 ==="
grep -c "Invalid object format\|Non-string input" ~/.openclaw/logs/gateway.log 2>/dev/null || echo "0"

# 3. 路由成功统计
echo "=== 路由成功 ==="
grep -c "V3 Model override applied" ~/.openclaw/logs/gateway.log 2>/dev/null || echo "0"

# 4. Gateway 状态
echo "=== Gateway 状态 ==="
openclaw status | grep -E "Gateway|running"

# 5. 补丁验证
echo "=== 补丁验证 ==="
grep -c "P0 补丁" /usr/local/lib/node_modules/openclaw/dist/pi-embedded-BYdcxQ5A.js
```

---

## 📝 观察日志

### 2026-04-04 18:45 (基线)

- 错误统计：0 次
- 警告统计：0 次
- 路由成功：正常
- Gateway 状态：🟢 运行中
- 补丁验证：✅ 已应用

**状态**: 🟢 正常

---

### 2026-04-04 20:45 (2 小时)

- 错误统计：___ 次
- 警告统计：___ 次
- 路由成功：___ 次
- Gateway 状态：🟢 / 🟡 / 🔴

**状态**: 🟢 / 🟡 / 🔴  
**备注**: _______

---

### 2026-04-04 22:45 (4 小时)

- 错误统计：___ 次
- 警告统计：___ 次
- 路由成功：___ 次
- Gateway 状态：🟢 / 🟡 / 🔴

**状态**: 🟢 / 🟡 / 🔴  
**备注**: _______

---

### 2026-04-05 02:45 (8 小时)

- 错误统计：___ 次
- 警告统计：___ 次
- 路由成功：___ 次
- Gateway 状态：🟢 / 🟡 / 🔴

**状态**: 🟢 / 🟡 / 🔴  
**备注**: _______

---

### 2026-04-05 18:45 (24 小时)

- 错误统计：___ 次
- 警告统计：___ 次
- 路由成功：___ 次
- Gateway 状态：🟢 / 🟡 / 🔴

**状态**: 🟢 / 🟡 / 🔴  
**备注**: _______

**P0 正式关闭**: ✅ 是 / ❌ 否

---

## 🔗 相关文档

- **P0 补丁方案**: `OCNMPS_V3_GATEWAY_PATCH_P0.md`
- **完整修复方案**: `OCNMPS_V3_ROUTE_FIX_V1.md`
- **P1 源级修复计划**: `OCNMPS_V3_P1_SOURCE_FIX_PLAN.md` (待创建)

---

**最后更新**: 2026-04-04 18:45  
**下次检查**: 2026-04-04 20:45 (2 小时)  
**负责人**: 小龙 / Colin
