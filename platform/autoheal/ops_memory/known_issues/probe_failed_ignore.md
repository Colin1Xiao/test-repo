# probe_failed 可忽略的情况

**时间**: 2026-03-17
**类型**: known_issues

---

## 现象
健康检查显示 `probe_failed`

## 可忽略的场景
1. 网络临时波动
2. Telegram API 限流
3. 代理连接不稳定

## 何时需要关注
- 连续多次失败
- 影响实际功能（消息发不出去）

## 验证
```bash
curl -s https://api.telegram.org
```

---

**标签**: telegram, probe, network
