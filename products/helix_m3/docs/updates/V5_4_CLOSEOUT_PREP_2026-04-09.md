# V5.4 RC 正式关闭预备文档

**预备日期**: 2026-04-02  
**执行日期**: 2026-04-09  
**归档日期**: 2026-04-16

---

## 4/9 当天要执行的替换

### 1. VERSION_MATRIX.md

**查找:**
```md
| trading_v5_4_rc | **Closeout in progress** | 已合并到 helix_m3; pending formal closure on 2026-04-09 |
```

**替换为:**
```md
| trading_v5_4_rc | **Closed** | Merged into helix_m3 on 2026-04-02; formally closed on 2026-04-09 |
```

---

### 2. GOVERNANCE_STATUS.md

**在文件末尾追加:**
```md
* V5.4 RC formally closed on 2026-04-09
```

---

### 3. V5_4_RC_DECISION.md

**在结论部分补充:**
```md
## Final Decision
Option A adopted: selected V5.4 RC fixes were merged into `helix_m3` on 2026-04-02.

## Closeout Status
Formally closed on 2026-04-09.

## Final Directory Action
Freeze or archive `trading_v5_4_rc` on 2026-04-16.
```

---

### 4. trading_v5_4_rc/README_STATUS.md

**查找:**
```md
## Current Phase
Closeout in progress.
```

**替换为:**
```md
## Current Phase
Closed.

## Closeout Date
2026-04-09
```

---

## 4/16 当天要执行的归档命令

```bash
# 移动目录到 legacy
mv ~/.openclaw/workspace/products/trading_v5_4_rc \
    ~/.openclaw/workspace/products/legacy/trading_v5_4_rc

# 设置为只读
chmod -R a-w ~/.openclaw/workspace/products/legacy/trading_v5_4_rc

# 验证
ls -la ~/.openclaw/workspace/products/legacy/
```

---

## 验证清单

### 4/9 当天检查
- [ ] VERSION_MATRIX.md 已更新
- [ ] GOVERNANCE_STATUS.md 已追加
- [ ] V5_4_RC_DECISION.md 已补充
- [ ] README_STATUS.md 已改为 "Closed"

### 4/16 当天检查
- [ ] 目录已移动到 legacy/
- [ ] 权限已设为只读
- [ ] 最终验证通过

---

**预备人**: OpenClaw Agent  
**预备时间**: 2026-04-02 05:36 GMT+8
