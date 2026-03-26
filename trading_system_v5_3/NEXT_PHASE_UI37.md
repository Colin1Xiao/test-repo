# 下一阶段任务卡 - UI-3.7

**创建时间**: 2026-03-27 04:32  
**优先级**: P0  
**预计周期**: 2-3 天

---

## 🎯 阶段目标

**三页 stale / delayed 状态统一 + Flask 模板化 / 组件化**

---

## 📋 任务分解

### 任务 1: 三页 stale / delayed 状态统一（P0）

**目标**: 用户感知一致性

**范围**:
- `panel.html` (主页)
- `history_analysis.html` (历史页)
- `reports_page.html` (报表页)

**交付物**:
1. **统一 stale 阈值**
   - 30s: 数据新鲜 ✅
   - 60s: 数据延迟 ⚠️
   - 5min: 数据陈旧 🔴

2. **统一 delayed 提示文案**
   ```
   ⚠️ 数据延迟 (最后更新：XX 分钟前)
   🔴 数据陈旧 (最后更新：XX 小时前)
   ```

3. **统一视觉标识**
   - 颜色：绿色/黄色/红色
   - 图标：● / ⚠️ / 🔴
   - 位置：header 右上角

4. **自动刷新机制**
   - stale > 60s → 自动刷新
   - 用户手动刷新 → 重置计时

**验收标准**:
- [ ] 三页 header 显示统一 freshness badge
- [ ] stale 阈值一致（30s/60s/5min）
- [ ] delayed 文案一致
- [ ] 自动刷新功能正常
- [ ] 手动刷新重置计时

**预计工时**: 1 天

---

### 任务 2: Flask 模板化 / 组件化（P1）

**目标**: 工程收敛 + 维护效率

**范围**:
- 提取公共模板（header / footer / nav）
- 组件化状态卡片
- 统一 CSS 变量

**交付物**:
1. **模板结构**
   ```
   templates/
   ├── base.html          # 基础模板
   ├── components/
   │   ├── header.html    # 顶栏（含 freshness badge）
   │   ├── nav.html       # 导航栏
   │   ├── stat-card.html # 统计卡片
   │   └── badge.html     # 状态徽章
   └── pages/
       ├── panel.html
       ├── history.html
       └── reports.html
   ```

2. **CSS 变量统一**
   ```css
   :root {
     --badge-success: #22c55e;
     --badge-warning: #f59e0b;
     --badge-danger: #ef4444;
     --stale-threshold-fresh: 30;
     --stale-threshold-delayed: 60;
     --stale-threshold-stale: 300;
   }
   ```

3. **组件复用**
   - SignalCard
   - StatCard
   - FreshnessBadge
   - RangeButtons

**验收标准**:
- [ ] 三页共用 base.html
- [ ] header/nav 组件化
- [ ] CSS 变量统一
- [ ] 代码重复率 < 20%
- [ ] 页面功能无回归

**预计工时**: 1-2 天

---

## 🔄 执行顺序

```
Day 1: 任务 1 (stale/delayed 统一)
  - 设计 freshness badge 组件
  - 实现 stale 检测逻辑
  - 三页应用

Day 2-3: 任务 2 (Flask 模板化)
  - 提取 base.html
  - 组件化 header/nav
  - 统一 CSS 变量
  - 重构三页
```

---

## 📊 验收清单

### UI-3.7 完成标准

| 检查项 | 主页 | 历史页 | 报表页 |
|--------|------|--------|--------|
| Freshness Badge | ✅ | ✅ | ✅ |
| Stale 阈值统一 | ✅ | ✅ | ✅ |
| Delayed 文案统一 | ✅ | ✅ | ✅ |
| 自动刷新 | ✅ | ✅ | ✅ |
| 模板复用 | ✅ | ✅ | ✅ |
| CSS 变量统一 | ✅ | ✅ | ✅ |

---

## 🎬 启动条件

- [x] UI-3.6 历史页完成并提交
- [ ] 用户确认进入下一阶段
- [ ] 备份当前稳定版本

---

## 📝 备注

**UI-3.6 完成记录**:
- 历史页 range 交互闭环 ✅
- URL 参数持久化 ✅
- days 查询一致 ✅
- Empty 状态场景化 ✅
- 真实数据联调 ✅

**提交哈希**: `c423b17`

---

_准备就绪，等待启动指令。_
