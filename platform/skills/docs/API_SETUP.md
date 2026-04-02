# 🔑 API 配置指南

> 详细步骤教你获取和配置交易所 API 密钥

---

## ⚠️ 重要提示

1. **新手务必使用测试网** - 零风险模拟交易
2. **不要泄露 API 密钥** - 任何人索要都是骗子
3. **设置 IP 白名单** - 增加安全性
4. **只给必要权限** - 不要给提现权限

---

## OKX API 配置

### 步骤 1: 访问 OKX 测试网

1. 打开浏览器访问：https://www.okx.com/demo
2. 注册/登录账号
3. 完成实名认证（测试网可能不需要）

![OKX 测试网首页](https://via.placeholder.com/800x400?text=OKX+Demo+Homepage)

### 步骤 2: 进入 API 管理

1. 点击右上角头像
2. 选择 **个人中心**
3. 左侧菜单选择 **API 管理**

![API 管理入口](https://via.placeholder.com/800x400?text=API+Management+Menu)

### 步骤 3: 创建 API 密钥

1. 点击 **创建 API** 按钮
2. 填写 API 名称（如：trading-bot）
3. 选择权限：
   - ✅ **读取** - 必须勾选
   - ✅ **交易** - 必须勾选
   - ❌ **提现** - **绝对不要勾选！**

![创建 API](https://via.placeholder.com/800x400?text=Create+API+Key)

### 步骤 4: 保存密钥

**重要**：密钥只显示一次！

1. 复制并保存以下信息：
   - API Key（公钥）
   - Secret Key（私钥）
   - Passphrase（密码短语）

2. 建议立即保存到密码管理器

![保存密钥](https://via.placeholder.com/800x400?text=Save+API+Credentials)

### 步骤 5: 配置 IP 白名单（推荐）

1. 在 API 设置中找到 **IP 白名单**
2. 添加你的 IP 地址
3. 如果在家，可以设置家庭 IP
4. 如果使用服务器，设置服务器 IP

> 💡 **提示**：如果不确定 IP，可以访问 https://whatismyipaddress.com/

### 步骤 6: 创建配置文件

```bash
# 创建配置目录
mkdir -p ~/.openclaw/workspace/skills/crypto-execute

# 创建配置文件
cat > ~/.openclaw/workspace/skills/crypto-execute/config.json << EOF
{
  "exchange": "okx",
  "apiKey": "你的 API Key",
  "secret": "你的 Secret",
  "password": "你的 Passphrase",
  "testnet": true
}
EOF
```

### 步骤 7: 验证配置

```bash
# 查询余额（测试网）
python3 ~/.openclaw/workspace/skills/crypto-execute/scripts/trade.py --get-balance
```

**预期输出**：
```json
{
  "balances": {
    "USDT": 10000,
    "BTC": 0,
    "ETH": 0
  }
}
```

---

## OKX 实盘配置

> ⚠️ **警告**：实盘交易有风险，请确保已完成测试网练习！

### 步骤 1: 访问 OKX 官网

1. 访问：https://www.okx.com/
2. 登录你的账号

### 步骤 2: 创建实盘 API

流程与测试网相同，但注意：

1. **务必设置 IP 白名单**
2. **务必不要勾选提现权限**
3. **建议设置 API 提币白名单**

### 步骤 3: 修改配置文件

```json
{
  "exchange": "okx",
  "apiKey": "你的实盘 API Key",
  "secret": "你的实盘 Secret",
  "password": "你的实盘 Passphrase",
  "testnet": false
}
```

**关键变化**：`"testnet": false`

---

## 币安 (Binance) API 配置

### 步骤 1: 访问币安

1. 访问：https://www.binance.com/
2. 登录账号

### 步骤 2: 进入 API 管理

1. 点击右上角头像
2. 选择 **API Management**

### 步骤 3: 创建 API

1. 点击 **Create API**
2. 输入 API 名称
3. 完成安全验证

### 步骤 4: 设置权限

1. **Enable Reading** - ✅ 必须
2. **Enable Futures** - ✅ 必须（合约交易）
3. **Enable Withdrawals** - ❌ 绝对不要

### 步骤 5: 配置 IP 白名单

1. 点击 **Restrict access to trusted IPs only**
2. 添加你的 IP 地址
3. 保存

### 步骤 6: 保存密钥

- API Key
- Secret Key

> 💡 币安不需要 Passphrase

### 步骤 7: 创建配置文件

```json
{
  "exchange": "binance",
  "apiKey": "你的币安 API Key",
  "secret": "你的币安 Secret",
  "testnet": true
}
```

### 币安测试网

币安测试网：https://testnet.binancefuture.com/

需要单独注册测试网账号并创建测试网 API。

---

## 其他交易所

### Bybit

```json
{
  "exchange": "bybit",
  "apiKey": "你的 Bybit API Key",
  "secret": "你的 Bybit Secret",
  "testnet": true
}
```

Bybit 测试网：https://testnet.bybit.com/

### Gate.io

```json
{
  "exchange": "gateio",
  "apiKey": "你的 Gate.io API Key",
  "secret": "你的 Gate.io Secret",
  "testnet": false
}
```

Gate.io 测试网功能有限，建议直接用 OKX 或币安测试网。

---

## 安全最佳实践

### ✅ 应该做的

1. **使用测试网练习** - 至少 2 周
2. **设置 IP 白名单** - 防止密钥泄露
3. **只给必要权限** - 读取 + 交易
4. **定期更换密钥** - 每 3 个月
5. **使用密码管理器** - 安全存储密钥
6. **启用 2FA** - 账号双重验证
7. **监控 API 活动** - 定期检查日志

### ❌ 不应该做的

1. **不要给提现权限** - 绝对不要！
2. **不要公开密钥** - 包括截图
3. **不要分享给他人** - 包括"客服"
4. **不要保存在代码中** - 使用配置文件
5. **不要使用公共电脑** - 可能记录密钥

---

## 配置文件详解

### 完整配置示例

```json
{
  "exchange": "okx",
  "apiKey": "abc123def456...",
  "secret": "xyz789uvw012...",
  "password": "MyPassphrase123",
  "testnet": true,
  "options": {
    "timeout": 30000,
    "recvWindow": 5000
  }
}
```

### 参数说明

| 参数 | 必填 | 说明 |
|------|------|------|
| `exchange` | ✅ | 交易所名称 (okx/binance/bybit/gateio) |
| `apiKey` | ✅ | API 公钥 |
| `secret` | ✅ | API 私钥 |
| `password` | ⚠️ | OKX 需要，币安不需要 |
| `testnet` | ✅ | 测试网模式 (true/false) |
| `options.timeout` | ❌ | 请求超时（毫秒） |
| `options.recvWindow` | ❌ | 接收窗口（币安用） |

---

## 常见问题

### Q: 配置文件权限设置？

**A**: 建议设置仅自己可读：

```bash
chmod 600 ~/.openclaw/workspace/skills/crypto-execute/config.json
```

### Q: 可以在多个设备使用吗？

**A**: 可以，但需要：
1. 在每个设备配置相同的 API
2. 设置所有设备的 IP 白名单
3. 注意并发请求限制

### Q: API 密钥失效了怎么办？

**A**: 
1. 登录交易所
2. 删除旧 API
3. 创建新 API
4. 更新配置文件

### Q: 测试网资金用完了怎么办？

**A**: 
- OKX 测试网：每天可以领取一次测试资金
- 币安测试网：可以重置测试账户

### Q: 实盘和测试网的配置区别？

**A**: 只需要修改 `testnet` 字段：

```json
// 测试网
{
  "testnet": true
}

// 实盘
{
  "testnet": false
}
```

---

## 测试清单

配置完成后，按顺序测试：

```bash
# 1. 测试连接
python3 scripts/trade.py --get-balance

# 2. 查询当前价格
python3 scripts/fetch_ohlcv.py --symbol BTC/USDT --timeframe 5m --limit 1

# 3. 测试下单（干跑模式）
python3 scripts/trade.py --symbol BTC/USDT --side buy --size 100 --dry-run

# 4. 测试真实下单（仅测试网！）
python3 scripts/trade.py --symbol BTC/USDT --side buy --size 100 --leverage 10
```

---

## 故障排除

### 问题 1: 认证失败

```
Error: Invalid API key
```

**解决**：
1. 检查配置文件格式
2. 确认 API 密钥没有复制错误
3. 确认 API 状态正常（未删除/禁用）

### 问题 2: 权限不足

```
Error: Insufficient permissions
```

**解决**：
1. 登录交易所检查 API 权限
2. 确认勾选了"读取"和"交易"
3. 重新创建 API

### 问题 3: IP 限制

```
Error: IP address not whitelisted
```

**解决**：
1. 登录交易所 API 管理
2. 添加当前 IP 到白名单
3. 或者关闭 IP 白名单（不推荐）

### 问题 4: 测试网不可用

```
Error: Testnet not available
```

**解决**：
1. 确认 `"testnet": true`
2. 检查测试网是否维护
3. 尝试切换到实盘（仅经验者）

---

## 相关文档

- [快速入门](QUICKSTART.md) - 基础配置
- [风险管理](RISK_GUIDE.md) - 安全交易
- [FAQ](FAQ.md) - 常见问题
- [策略配置](STRATEGIES.md) - 策略选择

---

> 🐉 **龙叔提醒**：API 密钥是你的"银行卡密码"，务必妥善保管！
