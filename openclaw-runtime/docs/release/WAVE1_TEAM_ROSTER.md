# Wave 1 灰度发布人员清单

_Phase 3A-5: 首轮灰度发布团队与职责。_

---

## 基本信息

| 项目 | 值 |
|------|-----|
| 发布版本 | v3.0.0-rc1 |
| 灰度时间 | 2026-04-05 10:00-14:00 (Asia/Shanghai) |
| 灰度范围 | <5% 流量 (<10 req/s, <1000 req/day) |
| 观察窗口 | 4 小时 |

---

## 开放入口

| 入口 | 状态 | 范围 |
|------|------|------|
| `POST /trading/approvals/:id/resolve` | ✅ 开放 | 白名单 only |
| `POST /trading/incidents/:id/acknowledge` | ✅ 开放 | 白名单 only |
| `POST /trading/webhooks/okx/ingest` | ✅ 开放 | testnet only |
| `POST /trading/replay/run` | ❌ 关闭 | 仅内部测试 |
| `POST /trading/recovery/scan` | ❌ 关闭 | 仅 staging |

---

## 白名单 Operator

| 姓名/代号 | 角色 | 入口权限 | 联系方式 | 备注 |
|-----------|------|---------|---------|------|
| Colin | Approval/Incident | approvals, incidents | - | 发布/技术/运维负责人 |
| Operator-02 | Incident | incidents | - | 事件处理专员 |
| Operator-03 | Webhook Observer | webhook (read) | - | 监控 webhook 流入 |
| 小龙 | 系统代理 | 全部 | 内部 | 自动化监控 + On-call |

**总计**: 4 名白名单用户

---

## 负责人与联系方式

| 角色 | 人员 | 联系方式 | 职责 |
|------|------|---------|------|
| **发布负责人** | Colin | - | 最终决策、Go/No-Go 判断 |
| **技术负责人** | Colin | - | 技术问题判断、升级决策 |
| **运维负责人** | Colin | - | 环境配置、回滚执行 |
| **On-call 1** (10:00-12:00) | 小龙 | 内部 | 首轮值班、告警响应 |
| **On-call 2** (12:00-14:00) | 小龙 | 内部 | 次轮值班、告警响应 |

---

## 执行前确认清单

### T-30min (09:30)

| 检查项 | 负责人 | 状态 |
|--------|--------|------|
| 白名单已生效 | 运维负责人 | ☐ |
| Feature Flags 已核对 | 技术负责人 | ☐ |
| Redis 状态正常 | 运维负责人 | ☐ |
| /metrics 可访问 | 运维负责人 | ☐ |
| 告警通道正常 | 技术负责人 | ☐ |
| Rollback 开关已确认 | 发布负责人 | ☐ |

### T-10min (09:50)

| 检查项 | 负责人 | 状态 |
|--------|--------|------|
| 团队已就位 | 发布负责人 | ☐ |
| On-call 在线 | On-call 1 | ☐ |
| 沟通渠道已建立 | 运维负责人 | ☐ |

### T-0 (10:00)

| 动作 | 负责人 | 状态 |
|------|--------|------|
| 开启灰度 | 运维负责人 | ☐ |
| 发送开始通知 | 发布负责人 | ☐ |

---

## 沟通渠道

| 渠道 | 用途 | 链接/群号 |
|------|------|----------|
| IM 群 | 实时沟通 | - |
| 电话会议 | 紧急决策 | - |
| Grafana Dashboard | 指标监控 | http://grafana/d/runtime |
| Prometheus Alerts | 告警查看 | http://prometheus:9090/alerts |

---

## 升级路径

| 级别 | 条件 | 响应人 | 响应时间 |
|------|------|--------|---------|
| L1 | P1 告警 | On-call | 5 min |
| L2 | P0 告警 | 技术负责人 + 运维负责人 | 5 min |
| L3 | Blocker 触发 | 发布负责人 + 全体 | 立即 |

---

## 通知模板

### Wave 1 开始通知 (IM)

```
【Wave 1 灰度开始】🚀

时间：2026-04-05 10:00-14:00
版本：v3.0.0-rc1
范围：<5% 流量，白名单 operator

开放入口：
✅ /trading/approvals/:id/resolve
✅ /trading/incidents/:id/acknowledge
✅ /trading/webhooks/okx/ingest (testnet)

暂不开放：
❌ /trading/replay/run
❌ /trading/recovery/scan

观察指标：
- endpoint success rate ≥ 99%
- lock acquire failure < 5%
- idempotency hit < 100/min
- audit write failure = 0

Dashboard: http://grafana/d/runtime
On-call: [姓名] [联系方式]

如有异常请立即联系。
```

### Wave 1 完成通知 (IM)

```
【Wave 1 灰度完成】✅

时间：2026-04-05 10:00-14:00
总请求量：XXX
错误数：XXX
错误率：X.XX%
P0 告警：X 次
Blocker: 无/有 [详情]

决策：☐ 进入 Wave 2 / ☐ 需要修复 / ☐ 回滚

详细报告：[链接]
```

---

## 待确认项

| 项目 | 状态 | 负责人 | 截止时间 |
|------|------|--------|---------|
| 白名单 operator 最终名单 | ✅ **已确认** | Colin | 2026-04-04 20:05 |
| 发布负责人指派 | ✅ **已确认** | Colin | 2026-04-04 20:05 |
| 技术负责人指派 | ✅ **已确认** | Colin | 2026-04-04 20:05 |
| 运维负责人指派 | ✅ **已确认** | Colin | 2026-04-04 20:05 |
| On-call 排班 | ✅ **已确认** | 小龙 | 2026-04-04 20:05 |

---

_最后更新：2026-04-04 23:15_
_版本：1.0_
_状态：**Confirmed**_
