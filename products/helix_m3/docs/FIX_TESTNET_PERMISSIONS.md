# 🔧 OKX Testnet 权限修复指南

**日期:** 2026-04-01  
**问题:** Testnet 下单失败 - "All operations failed (code=1)"  

---

## 📋 问题诊断

### 当前状态
- ✅ OKX Testnet 连接：成功
- ✅ 余额查询：成功 (USDT: 4,957)
- ✅ 行情查询：成功 (ETH: 2,100 USDT)
- ❌ 下单交易：失败 (All operations failed)
- ❌ 持仓查询：401 Unauthorized
- ❌ 委托查询：401 Unauthorized

### 根本原因
当前 Testnet API Key **缺少交易权限**或**权限未正确配置**。

---

## 🔧 修复方案

### 方案 A: 重新配置 Testnet API Key (推荐)

#### 步骤 1: 登录 OKX Testnet
```
网址：https://www.okx.com/testnet
使用现有 OKX 账号登录
```

#### 步骤 2: 创建新的 API Key
1. 进入 **API 管理** 页面
2. 点击 **创建 API Key**
3. 填写以下信息：
   - **备注:** `Helix-Trading-Testnet`
   - **权限:** 勾选 **"读取"** + **"交易"** ✅
   - **IP 白名单:** 暂时留空 (或填写当前 IP)

#### 步骤 3: 记录 API 凭证
```
API Key: (复制保存)
Secret Key: (复制保存)
Passphrase: (自定义密码，记住)
```

#### 步骤 4: 更新配置文件
编辑 `tests/config/okx_testnet.json`:
```json
{
  "api_key": "新的 API Key",
  "secret_key": "新的 Secret Key",
  "passphrase": "你的 Passphrase",
  "environment": "testnet"
}
```

#### 步骤 5: 验证权限
```bash
cd /Users/colin/.openclaw/workspace/helix_crypto_trading_platform
./scripts/check_testnet_permissions.py
```

---

### 方案 B: 检查现有 API Key 权限

#### 步骤 1: 登录 OKX Testnet
```
https://www.okx.com/testnet
```

#### 步骤 2: 找到现有 API Key
1. 进入 **API 管理**
2. 找到 Key: `2b3952f8-6538-48a4-a65a-4e219b61d6f5`
3. 点击 **编辑**

#### 步骤 3: 勾选交易权限
- ✅ **读取** (必须)
- ✅ **交易** (必须)
- ❌ **提现** (不要勾选 - 安全)

#### 步骤 4: 保存并验证
保存后等待 1 分钟，然后运行验证脚本。

---

### 方案 C: 跳过 Testnet 直接 Live

如果 Testnet 持续有问题，可以直接进行 M2 Live 验证：

```bash
# 使用实盘配置
export OKX_ENV=live
./run_m2_test.sh
```

**注意:** 实盘使用真实资金，请确保：
- 小额测试 (0.01 ETH)
- 严格止损 (0.5%)
- 全程监控

---

## ✅ 验证标准

修复后应满足以下条件：

| 检查项 | 预期结果 |
|--------|---------|
| 连接 Testnet | ✅ 成功 |
| 获取余额 | ✅ USDT > 0 |
| 获取行情 | ✅ ETH 价格正常 |
| 市价单测试 | ✅ 成功并返回 order_id |
| 限价单测试 | ✅ 成功并返回 order_id |
| 获取挂单 | ✅ 成功 (可能为空) |
| 获取持仓 | ✅ 成功 (可能为空) |
| 撤单 | ✅ 成功 |

---

## 🐛 常见问题

### Q1: "All operations failed (code=1)"
**原因:** API Key 缺少交易权限  
**解决:** 重新创建 API Key 并勾选"交易"权限

### Q2: "401 Unauthorized"
**原因:** API Key 无效或签名错误  
**解决:** 检查 API Key/Secret/Passphrase 是否正确

### Q3: "SSL 连接错误"
**原因:** 网络连接问题  
**解决:** 
1. 检查网络连接
2. 尝试关闭代理
3. 稍后重试

### Q4: "Insufficient balance"
**原因:** Testnet 余额不足  
**解决:** 在 Testnet 页面申请模拟资金

---

## 📞 获取帮助

如果以上方案都无法解决问题：

1. **检查 OKX Testnet 状态**
   - 访问 https://www.okx.com/testnet
   - 确认服务正常

2. **联系 OKX 支持**
   - 邮件：support@okx.com
   - 说明 Testnet API 权限问题

3. **查看系统日志**
   ```bash
   cat ~/.openclaw/workspace/helix_crypto_trading_platform/logs/testnet.log
   ```

---

## 📝 修复记录

| 日期 | 操作 | 结果 |
|------|------|------|
| 2026-04-01 | 诊断权限问题 | 确认缺少交易权限 |
| 2026-04-01 | 创建修复指南 | 完成 |
| TBD | 执行修复 | 待执行 |

---

**最后更新:** 2026-04-01 15:38 GMT+8
