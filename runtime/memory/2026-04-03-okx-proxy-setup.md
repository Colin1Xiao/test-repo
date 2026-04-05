# OKX 代理配置指南 - 交易系统开发标准

**创建日期:** 2026-04-03  
**问题:** DNS 污染导致 OKX API 无法直连  
**解决方案:** 通过 ClashX 代理访问 OKX API  
**状态:** ✅ 已验证可用

---

## 📋 问题背景

**症状:**
```bash
curl https://www.okx.com/api/v5/public/time
# ❌ DNS 污染 (169.254.0.2)
# ❌ Connection reset by peer
```

**根本原因:**
- 本地 DNS 污染 www.okx.com → 169.254.0.2 (无效地址)
- 直连请求被阻断

**解决方案:**
- 使用 ClashX 代理 (127.0.0.1:7890)
- 所有 OKX API 请求走代理

---

## 🔧 配置文件位置

| 文件 | 路径 | 用途 |
|------|------|------|
| Shell 配置 | `~/.openclaw/workspace/scripts/okx-proxy-config.sh` | Bash/Zsh 环境 |
| Python 模块 | `~/.openclaw/workspace/scripts/okx_proxy_config.py` | Python 项目 |
| 使用文档 | `~/.openclaw/workspace/docs/OKX_PROXY_SETUP.md` | 完整指南 |
| 测试脚本 | `~/.openclaw/workspace/scripts/test-okx-connection.sh` | 快速测试 |

---

## 🎯 新建交易系统项目使用指南

### 1. 复制配置文件

```bash
# 创建项目目录
mkdir -p my_trading_system/{config,lib,scripts}

# 复制配置文件
cp ~/.openclaw/workspace/scripts/okx-proxy-config.sh ./config/
cp ~/.openclaw/workspace/scripts/okx_proxy_config.py ./lib/
cp ~/.openclaw/workspace/scripts/test-okx-connection.sh ./scripts/
```

### 2. 在项目中集成

#### Python 项目:

```python
# 入口文件 (main.py 或 __init__.py)
from lib.okx_proxy_config import get_session_with_proxy, apply_proxy_to_urllib

# 方法 1: 应用全局代理 (推荐)
apply_proxy_to_urllib()

# 方法 2: 获取 Session
session = get_session_with_proxy()

# 在 OKX 客户端中使用
class OKXClient:
    def __init__(self):
        self.session = get_session_with_proxy()
        self.base_url = os.getenv("OKX_API_BASE", "https://www.okx.com")
    
    def get_server_time(self):
        response = self.session.get(f"{self.base_url}/api/v5/public/time")
        return response.json()
```

#### Bash 脚本:

```bash
#!/bin/bash
# 在脚本开头加载配置
source ./config/okx-proxy-config.sh

# 现在所有 curl 命令都会使用代理
curl "$OKX_API_BASE/api/v5/public/time"
```

### 3. 测试连接

```bash
# 运行测试脚本
./scripts/test-okx-connection.sh

# 预期输出:
# ============================================================
# OKX 连接测试
# ============================================================
# ✅ OKX 连接成功 - 服务器时间：1712164800000
# ✅ OKX 备用端点连接成功 - 服务器时间：1712164800000
# ✅ OKX 网络可用，可以执行 V5.4 实盘验证
```

### 4. 验证通过后才开始开发

**检查清单:**
- [ ] 主端点连接测试通过
- [ ] 备用端点连接测试通过
- [ ] Python 模块可正常导入
- [ ] Shell 配置可正常加载
- [ ] 所有测试用例通过

---

## 📦 环境变量配置

### 在 ~/.zshrc 中添加 (可选):

```bash
# OKX 代理配置 (全局)
export OKX_PROXY_HTTP="http://127.0.0.1:7890"
export OKX_PROXY_HTTPS="http://127.0.0.1:7890"
export OKX_PROXY_SOCKS5="socks5://127.0.0.1:7891"
export OKX_API_BASE="https://www.okx.com"
export OKX_API_BASE_BACKUP="https://okx.com"
export OKX_USE_PROXY="true"

# 自动加载配置
source ~/.openclaw/workspace/scripts/okx-proxy-config.sh
```

### 在项目 .env 文件中:

```bash
# .env.example
OKX_PROXY_HTTP=http://127.0.0.1:7890
OKX_PROXY_HTTPS=http://127.0.0.1:7890
OKX_API_BASE=https://www.okx.com
OKX_USE_PROXY=true
```

---

## 🧪 测试验证

### Shell 测试:

```bash
# 加载配置
source ./config/okx-proxy-config.sh

# 测试连接
test_okx_connection

# 预期输出:
# ✅ OKX 连接成功 - 服务器时间：1712164800000
```

### Python 测试:

```python
from lib.okx_proxy_config import OKXProxyConfig, get_session_with_proxy

# 测试 1: 获取配置
config = OKXProxyConfig()
print(f"代理：{config.proxy_url}")

# 测试 2: 测试连接
if config.test_connection():
    print("✅ OKX 连接正常")

# 测试 3: 获取 Session
session = get_session_with_proxy()
response = session.get("https://www.okx.com/api/v5/public/time")
print(response.json())
```

---

## 🔍 故障排查

### 问题 1: 代理未运行

**症状:** `Connection refused`

**解决:**
```bash
# 检查 ClashX 是否运行
ps aux | grep ClashX

# 启动 ClashX
open -a ClashX
```

### 问题 2: 代理端口错误

**症状:** `Proxy connection failed`

**解决:**
```bash
# 检查 ClashX 端口
curl -I http://127.0.0.1:7890

# 修改配置
export OKX_PROXY_HTTP="http://127.0.0.1:7891"
```

### 问题 3: DNS 仍被污染

**症状:** `DNS resolution failed`

**解决:**
```bash
# 修改 DNS 为公共 DNS
sudo networksetup -setdnsservers Wi-Fi 8.8.8.8 8.8.4.4

# 刷新 DNS 缓存
dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

---

## ✅ 配置检查清单

在新项目中部署时，检查以下项目:

- [ ] ClashX 已安装并运行
- [ ] 配置文件已复制到项目
- [ ] 代理端口正确 (默认 7890)
- [ ] Python 模块可导入
- [ ] Shell 配置可加载
- [ ] 主端点连接测试通过
- [ ] 备用端点连接测试通过
- [ ] 超时配置合理 (connect=5s, read=10s)
- [ ] 重试机制已启用 (max_retries=3)

---

## 📊 配置效果对比

### 配置前:

```bash
curl https://www.okx.com/api/v5/public/time
# ❌ DNS 污染 (169.254.0.2)
# ❌ Connection reset
# ❌ 无法获取服务器时间
```

### 配置后:

```bash
source ./config/okx-proxy-config.sh
curl "$OKX_API_BASE/api/v5/public/time"
# ✅ 连接成功
# ✅ 服务器时间：1712164800000
# ✅ 可以正常交易
```

---

## 🎯 最佳实践

### 1. 始终使用代理

```python
# ✅ 正确
session = get_session_with_proxy()

# ❌ 错误 (直连会被 DNS 污染)
session = requests.Session()
```

### 2. 配置备用端点

```python
config = OKXProxyConfig()
if not config.test_connection(verbose=False):
    config.api_base = config.api_backup  # 切换到备用端点
```

### 3. 添加超时和重试

```python
config = OKXProxyConfig(
    connect_timeout=5,      # 连接超时 5 秒
    read_timeout=10,        # 读取超时 10 秒
    max_retries=3,          # 最多重试 3 次
    retry_delay=1,          # 重试间隔 1 秒
)
```

### 4. 在 CI/CD 中配置

```yaml
# .github/workflows/test.yml
env:
  OKX_PROXY_HTTP: "http://127.0.0.1:7890"
  OKX_PROXY_HTTPS: "http://127.0.0.1:7890"
  OKX_USE_PROXY: "true"

steps:
  - name: Test OKX Connection
    run: ./scripts/test-okx-connection.sh
```

### 5. 在项目启动时自动测试

```python
# 项目启动时
from lib.okx_proxy_config import OKXProxyConfig

config = OKXProxyConfig()
if not config.test_connection():
    raise RuntimeError("OKX 连接失败，请检查代理配置")
```

---

## 📁 文件结构示例

```
my_trading_system/
├── config/
│   └── okx-proxy-config.sh      # Shell 配置
├── lib/
│   └── okx_proxy_config.py      # Python 模块
├── scripts/
│   └── test-okx-connection.sh   # 测试脚本
├── .env                         # 环境变量
├── .env.example                 # 环境变量示例
└── README.md                    # 项目文档 (引用本指南)
```

---

## 🔗 相关资源

- [OKX API 文档](https://www.okx.com/docs-v5/en/)
- [ClashX 配置指南](https://github.com/yichengchen/clashX)
- [Python requests 代理](https://docs.python-requests.org/en/master/user/advanced/#proxies)
- [小龙全系统报告](~/.openclaw/workspace/memory/2026-04-03-okx-proxy-setup.md)

---

## 📝 更新记录

| 日期 | 更新内容 | 作者 |
|------|---------|------|
| 2026-04-03 | 初始版本 - 创建配置文件和文档 | 小龙 |
| 2026-04-03 | 录入记忆系统 - 供未来项目使用 | 小龙 |

---

**重要提示:**
- 此配置已验证可用，未来项目可直接复制使用
- 如 ClashX 端口变更，请更新配置文件中的端口号
- 定期测试连接，确保代理正常工作
- 在生产环境中，建议使用专用的代理服务器

---

_配置完成后，所有 OKX API 请求将自动使用代理，不再受 DNS 污染影响。_
