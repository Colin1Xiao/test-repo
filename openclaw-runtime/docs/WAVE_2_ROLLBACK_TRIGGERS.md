# Wave 2 Rollback Triggers

**阶段**: Phase 3B-4: Wave 2 Readiness Review  
**日期**: 2026-04-05  
**状态**: ✅ **READY**

---

## 一、回滚策略

**原则**: 快速止损 > 根因分析

**目标**: 在数据损坏或服务不可用扩大前，快速回退到安全状态

---

## 二、P0 回滚触发条件

### 2.1 数据一致性断裂

**触发条件**:
- Incident/Timeline/Audit 三者状态不一致
- 同一 correlation_id 无法串起完整动作链
- 状态迁移无对应 timeline/audit 记录

**检测方法**:
```bash
# 检查 incident 与 timeline 一致性
curl -s http://localhost:3000/alerting/incidents/<id> | jq .
curl -s "http://localhost:3000/alerting/timeline?incident_id=<id>" | jq .
# 对比 timestamp 和状态
```

**回滚动作**:
1. 停止服务
2. 备份当前数据
3. 恢复到最近快照
4. 重启服务
5. 验证一致性

### 2.2 文件写入损坏

**触发条件**:
- JSONL 文件解析失败 (>0 行)
- 快照文件校验失败
- 文件大小异常（0 字节或异常增长）

**检测方法**:
```bash
# 检查 JSONL 有效性
tail -100 ~/.openclaw/workspace/openclaw-runtime/data/incidents/incidents.jsonl | while read line; do echo "$line" | jq . > /dev/null || echo "CORRUPT: $line"; done

# 检查文件大小
ls -lh ~/.openclaw/workspace/openclaw-runtime/data/*/incidents.jsonl
```

**回滚动作**:
1. 停止服务
2. 备份损坏文件
3. 从备份恢复
4. 重启服务
5. 验证恢复成功

### 2.3 锁未释放

**触发条件**:
- 锁文件残留 (>10 分钟)
- 锁获取失败率 >50%
- 服务阻塞 (>5 分钟无响应)

**检测方法**:
```bash
# 检查锁残留
ls -la ~/.openclaw/workspace/openclaw-runtime/data/locks/

# 检查锁年龄
find ~/.openclaw/workspace/openclaw-runtime/data/locks/ -name "*.lock" -mmin +10
```

**回滚动作**:
1. 停止服务
2. 清理锁文件
3. 重启服务
4. 验证锁行为正常

### 2.4 Webhook 重复副作用

**触发条件**:
- 重复投递导致重复 incident 创建 (>10 次)
- Dedupe 抑制失效
- 同一 event_id 产生多个 incident

**检测方法**:
```bash
# 检查重复 incident
curl -s "http://localhost:3000/alerting/incidents?correlation_id=<id>" | jq '.incidents | length'
# 应返回 1
```

**回滚动作**:
1. 暂停 webhook ingest
2. 清理重复数据
3. 修复 dedupe 逻辑
4. 恢复服务
5. 验证 dedupe 生效

### 2.5 Recovery/Replay 未解释异常

**触发条件**:
- Recovery scan 失败 (>5 次)
- Replay dry-run 失败 (>5 次)
- 未解释异常日志 (>10 条)

**检测方法**:
```bash
# 检查异常日志
grep -i "error\|exception\|fail" /tmp/server.log | tail -20
```

**回滚动作**:
1. 停止 recovery/replay 入口
2. 分析异常原因
3. 修复或回退代码
4. 恢复服务
5. 验证功能正常

### 2.6 P0 告警连续触发

**触发条件**:
- 同一 P0 告警触发 >3 次/10 分钟
- 不同 P0 告警同时触发 (>2 个)
- 告警风暴 (>10 次/5 分钟)

**检测方法**:
- 告警系统自动检测

**回滚动作**:
1. 根据告警类型执行对应回滚
2. 通知负责人
3. 记录详细日志

---

## 三、P1 降级触发条件

### 3.1 单一组件异常

**触发条件**:
- Audit 写入失败（不影响主流程）
- Timeline 写入延迟（不影响查询）
- 非关键功能异常

**降级动作**:
1. 记录异常
2. 继续运行
3. 计划修复

### 3.2 观测指标缺失

**触发条件**:
- 自动化观测脚本失败
- 日志采集延迟
- 报告生成失败

**降级动作**:
1. 切换到手动观测
2. 修复自动化脚本
3. 恢复自动观测

---

## 四、回滚执行流程

### 4.1 立即回滚（P0）

```
检测到 P0 触发条件
    ↓
确认回滚决策（自动或人工）
    ↓
停止服务
    ↓
备份当前状态
    ↓
执行回滚操作
    ↓
重启服务
    ↓
验证回滚成功
    ↓
记录回滚详情
    ↓
通知相关人员
```

### 4.2 降级执行（P1）

```
检测到 P1 触发条件
    ↓
记录异常
    ↓
执行降级操作
    ↓
继续运行
    ↓
计划修复
    ↓
修复后验证
```

---

## 五、回滚脚本

### 5.1 紧急停止

```bash
#!/bin/bash
# scripts/wave2-emergency-stop.sh

pkill -f "node dist/server.js"
echo "Service stopped at $(date)"
```

### 5.2 数据备份

```bash
#!/bin/bash
# scripts/wave2-backup.sh

BACKUP_DIR=~/.openclaw/workspace/backups/wave2-$(date +%Y%m%d-%H%M%S)
mkdir -p $BACKUP_DIR

cp -r ~/.openclaw/workspace/openclaw-runtime/data/ $BACKUP_DIR/
echo "Backup created at $BACKUP_DIR"
```

### 5.3 快照恢复

```bash
#!/bin/bash
# scripts/wave2-restore-snapshot.sh

# 恢复 incident 快照
cp ~/.openclaw/workspace/backups/latest/incidents_snapshot.json \
   ~/.openclaw/workspace/openclaw-runtime/data/incidents/

# 恢复 timeline
cp ~/.openclaw/workspace/backups/latest/timeline.jsonl \
   ~/.openclaw/workspace/openclaw-runtime/data/timeline/

# 恢复 audit
cp ~/.openclaw/workspace/backups/latest/audit.jsonl \
   ~/.openclaw/workspace/openclaw-runtime/data/audit/

echo "Snapshot restored"
```

### 5.4 锁清理

```bash
#!/bin/bash
# scripts/wave2-cleanup-locks.sh

rm -f ~/.openclaw/workspace/openclaw-runtime/data/locks/*.lock
echo "Locks cleaned at $(date)"
```

---

## 六、回滚验证

### 6.1 基础验证

- [ ] 服务启动成功
- [ ] /health 响应正常
- [ ] 数据恢复成功
- [ ] 锁行为正常

### 6.2 功能验证

- [ ] Incident 创建/查询正常
- [ ] Timeline 查询正常
- [ ] Audit 查询正常
- [ ] Webhook ingest 正常
- [ ] Replay/Recovery 正常

### 6.3 一致性验证

- [ ] Incident/Timeline 一致
- [ ] 状态迁移可追踪
- [ ] 无数据丢失

---

## 七、沟通计划

### 7.1 回滚通知

**渠道**: Telegram

**内容**:
```
【Wave 2 回滚通知】

时间：YYYY-MM-DD HH:MM
原因：[P0 触发条件]
影响：[影响范围]
动作：[已执行回滚]
状态：[回滚成功/进行中]
下一步：[根因分析/修复计划]
```

### 7.2 回滚后报告

**时间**: 回滚后 24 小时内

**内容**:
- 回滚原因
- 回滚过程
- 影响评估
- 根因分析
- 修复计划
- 预防措施

---

_文档制定时间：2026-04-05 05:15_
