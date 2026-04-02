# Gateway 重启标准流程

**时间**: 2026-03-17
**类型**: repairs

---

## 场景
Gateway 无响应或状态异常

## 步骤

1. 检查状态
```bash
openclaw gateway status
```

2. 尝试优雅重启
```bash
openclaw gateway restart
```

3. 等待 3-5 秒后验证
```bash
sleep 5 && openclaw gateway status
```

4. 如果失败，强制重启
```bash
openclaw gateway stop
sleep 2
openclaw gateway start
```

5. 最终检查
```bash
openclaw health check
```

## 成功率
通常 95%+ 的 Gateway 问题可通过重启解决

---

**标签**: gateway, restart, troubleshooting
