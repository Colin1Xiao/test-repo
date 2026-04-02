# OCNMPS Bridge v2 灰度观察基线

**观察启动时间:** 2026-04-02 06:10 (Asia/Shanghai)  
**灰度比例:** 5%  
**配置版本:** ocnmps_plugin_config.json (2026-04-02 更新)

---

## 📊 当前路由配置

| 意图 | 主模型 | Provider |
|------|--------|----------|
| MAIN | qwen3.5-plus | bailian |
| FAST | glm-4.7 | bailian |
| CODE | qwen3-coder-next | bailian |
| CODE-PLUS | qwen3-coder-plus | bailian |
| PATCH | grok-code-fast-1 | xai |
| REASON | grok-4-1-fast | xai |
| REVIEW | grok-4-1-fast | xai |
| LONG | kimi-k2.5 | bailian |
| CN | MiniMax-M2.5 | bailian |
| TEST | glm-4.7 | bailian |
| DEBUG | grok-4-1-fast | xai |

---

## 🎯 验收指标（第一阶段）

| 指标 | 目标值 | 当前值 | 状态 |
|------|--------|--------|------|
| 灰度命中率 | ~5% | 待统计 | ⏳ |
| 意图识别准确率 | >90% | 待统计 | ⏳ |
| Fallback 率 | <10% | 待统计 | ⏳ |
| Provider 错误率 | <1% | 待统计 | ⏳ |

---

## 📝 观察日志位置

**插件日志:** `~/.openclaw/plugins/ocnmps-router/ocnmps_plugin.log`

**关键日志类型:**
- `before_model_resolve triggered` - 路由触发
- `Gray release miss` - 未命中灰度（走默认）
- `Gray release hit` - 命中灰度（走路由）
- `Intent detected` - 意图识别
- `Fallback triggered` - 回退触发
- `Provider error` - Provider 错误

---

## 🔍 统计命令

```bash
# 查看最新日志
tail -50 ~/.openclaw/plugins/ocnmps-router/ocnmps_plugin.log

# 统计灰度命中
grep "Gray release" ~/.openclaw/plugins/ocnmps-router/ocnmps_plugin.log | sort | uniq -c

# 统计意图分布
grep "Intent detected" ~/.openclaw/plugins/ocnmps-router/ocnmps_plugin.log | sort | uniq -c

# 统计错误
grep "error\|Error\|ERROR" ~/.openclaw/plugins/ocnmps-router/ocnmps_plugin.log | tail -20
```

---

## 📈 第一阶段观察计划

**观察周期:** 30-60 分钟  
**检查频率:** 每 15 分钟一次

**检查点:**
- [ ] T+15min: 初步流量统计
- [ ] T+30min: 灰度命中率验证
- [ ] T+45min: 意图分布分析
- [ ] T+60min: 错误/回退统计 + 阶段判断

**阶段判断标准:**
- ✅ **通过:** 灰度命中率 3-7%，无严重错误 → 进入 15% 灰度
- ⚠️ **有条件通过:** 命中率偏差>20% 或 少量错误 → 微调后继续 5%
- 🔴 **阻断:** Provider 错误率>5% 或 意图识别严重偏差 → 回退配置

---

## 📋 待办事项

### P0（立即）
- [x] 设置定时统计任务
- [x] 记录 T+0 基线

### P1（30 分钟内）
- [ ] 完成首次流量统计
- [ ] 验证灰度命中率

### P2（60 分钟内）
- [ ] 输出第一阶段报告
- [ ] 判断是否进入 15% 灰度

---

**最后更新:** 2026-04-02 06:10
