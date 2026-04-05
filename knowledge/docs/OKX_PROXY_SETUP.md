# OKX 代理配置指南

**最后更新:** 2026-04-03  
**问题:** DNS 污染导致 OKX API 无法直连  
**解决方案:** 通过 ClashX 代理访问 OKX API

---

## 📋 问题背景

**症状:**
```bash
curl https://www.okx.com/api/v5/public/time
# 错误：DNS 污染 (169.254.0.2)
# 错误：Connection reset by peer
```

**根本原因:**
- 本地 DNS 污染 www.okx.com → 169.254.0.2 (无效地址)
- 直连请求被阻断

**解决方案:**
- 使用 ClashX 代理 (127.0.0.1:7890)
- 所有 OKX API 请求走代理

---

## 🔧 配置方法

### 方法 1: Shell 脚本 (推荐)

**加载配置:**
```bash
source ~/.openclaw/workspace/scripts/okx-proxy-config.sh

# 测试连接
test_okx_connection
```

**在交易脚本中使用:**
```bash
#!/bin/bash
source ~/.openclaw/workspace/scripts/okx-proxy-config.sh

# 现在所有 curl 命令都会使用代理
curl "$OKX_API_BASE/api/v5/public/time"
```

---

### 方法 2: Python 模块 (推荐)

**导入配置:**
```python
from okx_proxy_config import OKXProxyConfig, get_session_with_proxy

# 方法 1: 获取配置
config = OKXProxyConfig()
print(f"代理：{config.proxy_url}")

# 方法 2: 获取带代理的 Session
session = get_session_with_proxy()
response = session.get("https://www.okx.com/api/v5/public/time")

# 方法 3: 测试连接
if config.test_connection():
    print("OKX 连接正常")
```

**在交易系统中的应用:**
```python
# trading_system/core/okx_client.py
from okx_proxy_config import get_session_with_proxy

class OKXClient:
    def __init__(self):
        self.session = get_session_with_proxy()
        self.base_url = "https://www.okx.com"
    
    def get_server_time(self):
        response = self.session.get(f"{self.base_url}/api/v5/public/time")
        return response.json()
    
    def get_balance(self):
        response = self.session.get(f"{self.base_url}/api/v5/account/balance")
        return response.json()
```

---

### 方法 3: 环境变量

**在 ~/.zshrc 中添加:**
```bash
# OKX 代理配置
export OKX_PROXY_HTTP="http://127.0.0.1:7890"
export OKX_PROXY_HTTPS="http://127.0.0.1:7890"
export OKX_USE_PROXY="true"

# 自动加载
source ~/.openclaw/workspace/scripts/okx-proxy-config.sh
```

**使配置生效:**
```bash
source ~/.zshrc
```

---

## 🧪 测试验证

### Shell 测试

```bash
# 加载配置
source ~/.openclaw/workspace/scripts/okx-proxy-config.sh

# 测试连接
test_okx_connection

# 预期输出:
# ✅ OKX 连接成功 - 服务器时间：1712164800000
```

### Python 测试

```bash
python3 ~/.openclaw/workspace/scripts/okx_proxy_config.py
```

**预期输出:**
```
============================================================
OKX 代理配置诊断
============================================================

代理配置：True
代理地址：http://127.0.0.1:7890
API 端点：https://www.okx.com
备用端点：https://okx.com

============================================================
连接测试
============================================================
✅ OKX 连接成功 - 服务器时间：1712164800000
✅ OKX 备用端点连接成功 - 服务器时间：1712164800000

============================================================
诊断结果
============================================================
proxy_configured: True
proxy_url: http://127.0.0.1:7890
api_base: https://www.okx.com
api_backup: https://okx.com
main_endpoint: ✅ 正常
backup_endpoint: ✅ 正常
```

---

## 🔍 故障排查

### 问题 1: 代理未运行

**症状:**
```
❌ OKX 连接失败：Connection refused
```

**解决:**
```bash
# 检查 ClashX 是否运行
ps aux | grep ClashX

# 启动 ClashX
open -a ClashX
```

### 问题 2: 代理端口错误

**症状:**
```
❌ OKX 连接失败：Proxy connection failed
```

**解决:**
```bash
# 检查 ClashX 端口
curl -I http://127.0.0.1:7890

# 修改配置 (如果端口不同)
export OKX_PROXY_HTTP="http://127.0.0.1:7891"
```

### 问题 3: DNS 仍被污染

**症状:**
```
❌ OKX 连接失败：DNS resolution failed
```

**解决:**
```bash
# 修改 DNS 为公共 DNS
sudo networksetup -setdnsservers Wi-Fi 8.8.8.8 8.8.4.4

# 刷新 DNS 缓存
dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

---

## 📁 文件位置

| 文件 | 路径 | 用途 |
|------|------|------|
| Shell 配置 | `scripts/okx-proxy-config.sh` | Bash/Zsh 环境 |
| Python 模块 | `scripts/okx_proxy_config.py` | Python 项目 |
| 本文档 | `docs/OKX_PROXY_SETUP.md` | 使用指南 |

---

## ✅ 最佳实践

### 1. 始终使用代理

```python
# ✅ 正确
session = get_session_with_proxy()

# ❌ 错误 (直连会被 DNS 污染)
session = requests.Session()
```

### 2. 配置备用端点

```python
# 主端点失败时自动切换备用
config = OKXProxyConfig()
if not config.test_connection(verbose=False):
    config.api_base = config.api_backup
```

### 3. 添加超时和重试

```python
from okx_proxy_config import OKXProxyConfig

config = OKXProxyConfig(
    connect_timeout=5,
    read_timeout=10,
    max_retries=3,
    retry_delay=1
)
```

### 4. 在 CI/CD 中配置

```yaml
# .github/workflows/test.yml
env:
  OKX_PROXY_HTTP: "http://127.0.0.1:7890"
  OKX_PROXY_HTTPS: "http://127.0.0.1:7890"
  OKX_USE_PROXY: "true"
```

---

## 📊 配置检查清单

在新环境中部署交易系统时，检查以下项目：

- [ ] ClashX 已安装并运行
- [ ] 代理端口正确 (默认 7890)
- [ ] 环境变量已配置
- [ ] Python 模块已导入
- [ ] 连接测试通过
- [ ] 备用端点测试通过
- [ ] 超时配置合理
- [ ] 重试机制已启用

---

## 🔗 相关资源

- [OKX API 文档](https://www.okx.com/docs-v5/en/)
- [ClashX 配置指南](https://github.com/yichengchen/clashX)
- [Python requests 代理](https://docs.python-requests.org/en/master/user/advanced/#proxies)

---

_配置完成后，所有 OKX API 请求将自动使用代理，不再受 DNS 污染影响。_
