# OKX API 配置说明

## 📍 配置文件位置

### 原始配置 (secrets)
| 文件 | 路径 | 用途 |
|------|------|------|
| 实盘 | `~/.openclaw/secrets/okx_api.json` | 实盘交易配置 |
| 测试网 | `~/.openclaw/secrets/okx_testnet.json` | 测试网交易配置 |

### M2 验证配置 (workspace)
| 文件 | 路径 | 用途 |
|------|------|------|
| 实盘 | `tests/config/okx_live.json` | M2 实盘验证 |
| 测试网 | `tests/config/okx_testnet.json` | M2 测试网验证 |

---

## 🔑 API Key 信息

### 实盘 API (Live)
```json
{
  "api_key": "8705ea66-bb2a-4eb3-b58a-768346d83657",
  "secret_key": "8D2DF7BEA6EA559FE5BD1F36E11C44B1",
  "passphrase": "Xzl405026.",
  "environment": "live",
  "base_url": "https://www.okx.com"
}
```

**权限:**
- ✅ Read
- ✅ Trade
- ❌ Withdraw (禁用)

**风险配置:**
- 杠杆：100x
- 最大仓位：0.13 ETH
- 止损：0.5%
- 止盈：0.2%

---

### 测试网 API (Testnet)
```json
{
  "api_key": "2b3952f8-6538-48a4-a65a-4e219b61d6f5",
  "secret_key": "279DFFAE2F9F695C07A0D484FD414620",
  "passphrase": "Xzl405026.",
  "environment": "testnet",
  "base_url": "https://www.okx.com"
}
```

**权限:**
- ✅ Read
- ✅ Trade

**风险配置:**
- 杠杆：100x
- 最大仓位：0.3 ETH
- 止损：0.5%
- 止盈：0.2%

---

## 🔒 安全设置

### 文件权限
```bash
# secrets 目录文件权限应为 600
chmod 600 ~/.openclaw/secrets/okx_*.json
```

### API Key 限制
- IP 白名单：未设置（建议添加服务器 IP）
- 提现权限：**已禁用**
- 子账户：未启用

---

## 🚀 使用方式

### M2 测试网验证
```bash
cd /Users/colin/.openclaw/workspace/helix_crypto_trading_platform
./run_m2_test.sh
```

### M2 实盘验证
```bash
# 修改测试脚本使用实盘配置
export OKX_CONFIG=tests/config/okx_live.json
./run_m2_test.sh
```

---

## ⚠️ 风险提示

### 实盘模式
- 🔴 **真金白银** - 请使用小额测试
- 🔴 **100x 杠杆** - 爆仓风险极高
- 🔴 **严格止损** - 必须设置止损保护

### 测试网模式
- 🟢 **模拟资金** - 安全测试
- 🟢 **真实 API** - 验证代码逻辑
- 🟢 **推荐先用** - 验证后再切实盘

---

## 📋 配置同步

当需要更新 API Key 时：

1. 修改 `~/.openclaw/secrets/` 下的原始配置
2. 同步复制到 `tests/config/` 目录
3. 验证配置正确性
4. 运行测试验证

```bash
# 同步配置
cp ~/.openclaw/secrets/okx_testnet.json tests/config/okx_testnet.json
cp ~/.openclaw/secrets/okx_api.json tests/config/okx_live.json
```

---

_最后更新：2026-04-01_
