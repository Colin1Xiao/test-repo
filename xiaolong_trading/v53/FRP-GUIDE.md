# 🌐 frp 公网访问指南

使用 frp 将小龙 Control Tower 暴露到公网。

---

## 架构

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   公网用户   │ ──────> │  frps 服务器 │ ──────> │  frpc 客户端 │
│  (浏览器)    │         │ (你的服务器) │         │  (本机 Mac)  │
└─────────────┘         └─────────────┘         └──────┬──────┘
                                                       │
                                                ┌──────┴──────┐
                                                │ Control Tower│
                                                │   :8767     │
                                                └─────────────┘
```

---

## 前提条件

1. **一台有公网 IP 的服务器**（VPS/云服务器）
2. **域名**（可选，但推荐）
3. **frp 程序**（服务器端 + 客户端）

---

## 服务器端配置（frps）

### 1. 下载 frp

```bash
# SSH 登录你的服务器
ssh user@your-server-ip

# 下载 frp
cd /opt
wget https://github.com/fatedier/frp/releases/download/v0.52.3/frp_0.52.3_linux_amd64.tar.gz
tar -xzf frp_0.52.3_linux_amd64.tar.gz
cd frp_0.52.3_linux_amd64
```

### 2. 配置 frps.ini

```bash
cat > frps.ini << 'EOF'
[common]
bind_port = 7000
token = YOUR_SECURE_TOKEN_HERE

dashboard_port = 7500
dashboard_user = admin
dashboard_pwd = YOUR_PASSWORD

log_file = ./frps.log
log_level = info
EOF
```

### 3. 启动 frps

```bash
# 前台运行
./frps -c frps.ini

# 或后台运行
nohup ./frps -c frps.ini > frps.log 2>&1 &
```

### 4. 防火墙开放端口

```bash
# 开放 7000（frp）和 7500（仪表盘）端口
sudo ufw allow 7000/tcp
sudo ufw allow 7500/tcp
# 或 iptables
sudo iptables -I INPUT -p tcp --dport 7000 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 7500 -j ACCEPT
```

---

## 客户端配置（frpc）

### 1. 编辑配置文件

```bash
cd /Users/colin/.openclaw/workspace/xiaolong_trading/v53

# 编辑 frpc.ini
vim frpc.ini
```

修改以下字段：
- `server_addr`: 你的服务器 IP 或域名
- `token`: 与服务器端相同的 token
- `custom_domains`: 你的域名（如 control.example.com）

### 2. 下载 frp（Mac）

```bash
# 如果还没有 frp
cd ~
wget https://github.com/fatedier/frp/releases/download/v0.52.3/frp_0.52.3_darwin_amd64.tar.gz
tar -xzf frp_0.52.3_darwin_amd64.tar.gz
mkdir -p ~/frp
mv frp_0.52.3_darwin_amd64/frpc ~/frp/
```

### 3. 启动 frp 隧道

```bash
./start-frp.sh
```

或手动：

```bash
~/frp/frpc -c ./frpc.ini
```

---

## DNS 配置（可选）

如果你有域名，添加 A 记录：

```
Type: A
Name: control-tower
Value: YOUR_SERVER_IP
TTL: 300
```

然后访问：`http://control-tower.your-domain.com`

---

## 启动顺序

```bash
# 1. 服务器端（VPS）
ssh user@your-server-ip
./frps -c frps.ini

# 2. 客户端（Mac）
./start-frp.sh

# 3. 访问
open http://control-tower.your-domain.com
```

---

## 常见问题

### Q: 连接失败
```
[common]
# 检查 server_addr 和 token 是否匹配
# 检查服务器防火墙是否开放 7000 端口
```

### Q: 域名无法访问
```
# 确保 DNS 记录已生效
dig control-tower.your-domain.com

# 检查服务器是否开放 80/443 端口
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Q: 使用 HTTPS
```
# 方法 1: 服务器端配置 nginx + SSL
# 方法 2: 使用 frp 的 https2http 插件（见 frpc.ini 注释）
```

---

## 安全建议

1. **使用强 token**：随机生成，至少 16 位
2. **限制 IP**：服务器防火墙只允许特定 IP 连接
3. **使用 HTTPS**：配置 SSL 证书
4. **定期更新**：保持 frp 版本最新

---

## 文件说明

| 文件 | 说明 |
|------|------|
| `frpc.ini` | 客户端配置 |
| `frps.ini.example` | 服务器端配置示例 |
| `start-frp.sh` | 一键启动脚本 |
| `FRP-GUIDE.md` | 本指南 |

---

## 替代方案

如果不想用 frp，还有其他选择：

- **ngrok**: `./start-public.sh ngrok`
- **Cloudflare Tunnel**: `./start-public.sh cloudflare`
- **SSH 隧道**: `ssh -R 8767:localhost:8767 user@server`

---

**当前状态**: 等待配置服务器信息
