# Wave 2-A Quick Rollback Playbook

**阶段**: Phase 3B-5: Wave 2-A Execution  
**版本**: 1.0  
**状态**: ✅ **READY**

---

## 一、5 分钟回滚流程

### T+0~1 分钟：确认回滚

**触发条件** (任一):
- [ ] Incident/Timeline/Audit 一致性断裂
- [ ] 文件写入损坏
- [ ] 锁未释放 (>10 分钟)
- [ ] Webhook 重复副作用 (>100 次)
- [ ] Recovery/Replay 异常 (>5 次)
- [ ] P0 告警连续触发 (>3 次/10 分钟)

**决策**: Colin 或 小龙

**通知**:
```
【Wave 2-A 回滚通知】

时间：YYYY-MM-DD HH:MM
原因：[P0 触发条件]
决策：立即回滚
执行：小龙
```

### T+1~3 分钟：执行回滚

**步骤 1: 停止服务**
```bash
pkill -f "node dist/server.js"
sleep 2
```

**步骤 2: 备份当前数据**
```bash
BACKUP_DIR=~/.openclaw/workspace/backups/wave2a-$(date +%Y%m%d-%H%M%S)
mkdir -p $BACKUP_DIR
cp -r ~/.openclaw/workspace/openclaw-runtime/data/ $BACKUP_DIR/
echo "Backup: $BACKUP_DIR"
```

**步骤 3: 清理锁文件**
```bash
rm -f ~/.openclaw/workspace/openclaw-runtime/data/locks/*.lock
```

**步骤 4: 恢复快照**
```bash
# Incident 快照恢复
cp ~/.openclaw/workspace/openclaw-runtime/data/incidents/incidents_snapshot.json \
   ~/.openclaw/workspace/openclaw-runtime/data/incidents/

# Timeline 恢复
cp ~/.openclaw/workspace/openclaw-runtime/data/timeline/timeline.jsonl \
   ~/.openclaw/workspace/openclaw-runtime/data/timeline/
```

**步骤 5: 重启服务**
```bash
cd ~/.openclaw/workspace/openclaw-runtime
HOST=0.0.0.0 /usr/local/bin/node dist/server.js > /tmp/server.log 2>&1 &
sleep 3
```

### T+3~5 分钟：验证回滚

**检查 1: 服务健康**
```bash
NO_PROXY=127.0.0.1 curl -s http://127.0.0.1:3000/health | jq .
```

**预期**: `{"ok":true,"status":"live",...}`

**检查 2: 数据恢复**
```bash
cat /tmp/server.log | grep -E "Loaded.*incidents|Loaded.*events"
```

**预期**: 恢复数量与备份前一致

**检查 3: 锁行为**
```bash
ls -la ~/.openclaw/workspace/openclaw-runtime/data/locks/
```

**预期**: 无残留锁文件

**检查 4: 新写入测试**
```bash
NO_PROXY=127.0.0.1 curl -s -X POST http://127.0.0.1:3000/alerting/ingest \
  -H "Content-Type: application/json" \
  -d '{"alert_name":"RedisDisconnected","severity":"P0","source":"rollback-test","correlation_id":"rollback-validation"}'
```

**预期**: 返回成功，incident 创建

---

## 二、15 分钟验证流程

### T+5~15 分钟：完整验证

**验证 1: Incident 查询**
```bash
NO_PROXY=127.0.0.1 curl -s 'http://127.0.0.1:3000/alerting/incidents?limit=5' | jq '.incidents[] | {id, status}'
```

**验证 2: Timeline 查询**
```bash
NO_PROXY=127.0.0.1 curl -s 'http://127.0.0.1:3000/alerting/timeline?limit=5' | jq '.events[] | {type, timestamp}'
```

**验证 3: 一致性抽样**
```bash
# 选取一个 incident，验证 timeline 对齐
INCIDENT_ID="incident-xxxxx"
NO_PROXY=127.0.0.1 curl -s http://127.0.0.1:3000/alerting/incidents/$INCIDENT_ID | jq .
NO_PROXY=127.0.0.1 curl -s "http://127.0.0.1:3000/alerting/timeline?incident_id=$INCIDENT_ID" | jq .
```

**验证 4: 功能回归**
```bash
# Replay dry-run
NO_PROXY=127.0.0.1 curl -s -X POST http://127.0.0.1:3000/trading/replay/run \
  -H "Content-Type: application/json" -d '{"dry_run":true}'

# Recovery scan
NO_PROXY=127.0.0.1 curl -s -X POST http://127.0.0.1:3000/trading/recovery/scan \
  -H "Content-Type: application/json" -d '{"dry_run":true}'
```

---

## 三、回滚后报告

### 必须检查的 5 个端点/指标

| # | 端点/指标 | 预期 | 实际 | 状态 |
|---|----------|------|------|------|
| 1 | GET /health | `{"ok":true}` | [ ] | [ ] |
| 2 | GET /config | 正常响应 | [ ] | [ ] |
| 3 | Incident 恢复数 | = 备份前 | [ ] | [ ] |
| 4 | Timeline 恢复数 | = 备份前 | [ ] | [ ] |
| 5 | 新写入测试 | 成功 | [ ] | [ ] |

### 回滚报告模板

```
【Wave 2-A 回滚报告】

回滚时间：YYYY-MM-DD HH:MM
触发原因：[P0 条件]
回滚执行：小龙
验证结果：[通过/失败]

关键指标:
- Incident 恢复：[X] 个
- Timeline 恢复：[Y] 个
- 锁残留：[Z] 个
- 新写入：[成功/失败]

下一步:
1. [根因分析]
2. [修复计划]
3. [重新进入 Wave 2-A 条件]
```

---

## 四、联系人

| 角色 | 负责人 | 联系方式 |
|------|--------|---------|
| 决策者 | Colin | Telegram |
| 执行者 | 小龙 | 自动 |
| 观察者 | 小龙 | Telegram |

---

**文档版本**: 1.0  
**最后更新**: 2026-04-05 05:25 CST
