# Wave 2-A 24h Restart Validation

**阶段**: Phase 3B-5: Wave 2-A Execution  
**执行时间**: T+24h (2026-04-06 05:18 CST)  
**状态**: 🟡 **SCHEDULED**

---

## 一、重启前记录

### 1.1 文件行数基线

```bash
# 执行时间：重启前
wc -l ~/.openclaw/workspace/openclaw-runtime/data/incidents/incidents.jsonl
wc -l ~/.openclaw/workspace/openclaw-runtime/data/timeline/timeline.jsonl
wc -l ~/.openclaw/workspace/openclaw-runtime/data/audit/audit.jsonl 2>/dev/null || echo "0 (audit not integrated)"
```

**记录**:
| 文件 | 行数 |
|------|------|
| incidents.jsonl | [待填写] |
| timeline.jsonl | [待填写] |
| audit.jsonl | [待填写] |

### 1.2 锁残留检查

```bash
# 执行时间：重启前
ls -la ~/.openclaw/workspace/openclaw-runtime/data/locks/
```

**记录**:
| 指标 | 值 |
|------|------|
| 锁文件数 | [待填写] |
| 陈旧锁 (>10min) | [待填写] |

### 1.3 服务状态

```bash
# 执行时间：重启前
NO_PROXY=127.0.0.1 curl -s http://127.0.0.1:3000/health | jq .
```

**记录**:
```json
[待填写]
```

---

## 二、重启执行

### 2.1 停止服务

```bash
pkill -f "node dist/server.js"
sleep 2
```

### 2.2 启动服务

```bash
cd ~/.openclaw/workspace/openclaw-runtime
HOST=0.0.0.0 /usr/local/bin/node dist/server.js > /tmp/server.log 2>&1 &
sleep 3
```

### 2.3 验证启动

```bash
NO_PROXY=127.0.0.1 curl -s http://127.0.0.1:3000/health | jq .
cat /tmp/server.log | grep -E "(Incident|Timeline|Audit)" | head -10
```

---

## 三、重启后验证

### 3.1 恢复数量验证

```bash
# 查看启动日志
cat /tmp/server.log | grep -E "Loaded.*incidents|Loaded.*events"
```

**预期**:
```
[IncidentFileRepository] Loaded X incidents from snapshot
[IncidentFileRepository] Replayed Y incremental events
[TimelineFileRepository] Loaded Z events from disk
```

**记录**:
| 组件 | 快照加载 | 增量回放 | 总计 |
|------|---------|---------|------|
| Incident | [X] | [Y] | [X+Y] |
| Timeline | [Z] | N/A | [Z] |
| Audit | N/A | N/A | [0] |

### 3.2 查询功能验证

```bash
# 查询 incidents
NO_PROXY=127.0.0.1 curl -s 'http://127.0.0.1:3000/alerting/incidents?limit=3' | jq '.incidents[] | {id, status}'

# 查询 timeline
NO_PROXY=127.0.0.1 curl -s 'http://127.0.0.1:3000/alerting/timeline?limit=3' | jq '.events[] | {type, timestamp}'
```

**记录**:
- [ ] Incidents 查询正常
- [ ] Timeline 查询正常
- [ ] Audit 查询正常 (如已集成)

### 3.3 新写入验证

```bash
# 创建测试 incident
NO_PROXY=127.0.0.1 curl -s -X POST http://127.0.0.1:3000/alerting/ingest \
  -H "Content-Type: application/json" \
  -d '{"alert_name":"RedisDisconnected","severity":"P0","source":"restart-test","correlation_id":"restart-validation"}'

# 验证写入
tail -1 ~/.openclaw/workspace/openclaw-runtime/data/incidents/incidents.jsonl | jq .
```

**记录**:
- [ ] 新 incident 创建成功
- [ ] 文件写入正常

### 3.4 一致性验证

```bash
# 查询 correlation_id 串联
NO_PROXY=127.0.0.1 curl -s 'http://127.0.0.1:3000/alerting/timeline?correlation_id=restart-validation' | jq .
```

**记录**:
- [ ] Correlation ID 可追踪
- [ ] Incident/Timeline 对齐

---

## 四、验证结论

### 4.1 恢复正确性

| 检查项 | 预期 | 实际 | 状态 |
|--------|------|------|------|
| Incident 恢复数 | = 重启前 | [实际] | ✅/❌ |
| Timeline 恢复数 | = 重启前 | [实际] | ✅/❌ |
| 锁残留 | 0 | [实际] | ✅/❌ |
| 服务健康 | OK | [实际] | ✅/❌ |
| 新写入 | 成功 | [实际] | ✅/❌ |
| 一致性 | 对齐 | [实际] | ✅/❌ |

### 4.2 总体结论

**状态**: [通过 / 部分通过 / 失败]

**问题记录**:
- [ ]
- [ ]

**建议行动**:
- [ ]

---

**验证人**: 小龙  
**验证时间**: 2026-04-06 05:18 CST

---

_重启验证完成后，更新 WAVE_2A_24H_STATUS.md_
