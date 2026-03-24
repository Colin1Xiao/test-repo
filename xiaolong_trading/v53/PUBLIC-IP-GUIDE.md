# 🌐 宽带公网 IP 访问指南

使用你的宽带公网 IP 直接访问 Control Tower。

---

## 当前网络信息

```
公网 IP: 103.190.179.8
本地 IP: 192.168.1.65
端口: 8767
```

---

## 访问地址

| 类型 | URL |
|------|-----|
| 本地 | http://localhost:8767/control-tower |
| 局域网 | http://192.168.1.65:8767/control-tower |
| 公网 | http://103.190.179.8:8767/control-tower |

---

## 设置步骤

### 1. 路由器端口映射（必须）

登录你的路由器管理页面（通常是 http://192.168.1.1 或 http://192.168.0.1）

找到 **端口转发** / **虚拟服务器** / **NAT 设置**：

```
添加规则:
  外部端口: 8767
  内部 IP: 192.168.1.65
  内部端口: 8767
  协议: TCP
  状态: 启用
```

**常见路由器设置路径：**
- TP-Link: 转发规则 -> 虚拟服务器
- 小米: 高级设置 -> 端口转发
- 华硕: 外部网络 -> 端口转发
- 华为: 更多功能 -> 安全设置 -> NAT

### 2. Mac 防火墙设置

**选项 A: 关闭防火墙（简单但不推荐）**
```
系统设置 -> 网络 -> 防火墙 -> 关闭
```

**选项 B: 允许 Python 传入连接（推荐）**
```
系统设置 -> 隐私与安全性 -> 防火墙 -> 选项
添加 Python 到允许列表
```

### 3. 测试访问

```bash
# 本地测试
curl http://localhost:8767/api/system/status

# 公网测试（用手机流量）
curl http://103.190.179.8:8767/api/system/status
```

---

## DDNS 动态域名（推荐）

由于宽带 IP 是动态的，建议配置 DDNS。

### 方案 A: DuckDNS（免费，最简单）

**1. 注册**
- 访问 https://www.duckdns.org/
- 用 GitHub/Google/Reddit/Twitter 账号登录
- 创建一个子域名（如 xiaolong-control）

**2. 获取 Token**
- 登录后页面会显示 token
- 复制 token（如 a1b2c3d4-e5f6-7890-abcd-ef1234567890）

**3. 配置 DDNS**
```bash
cd v53
cp ddns.conf.example ddns.conf
vim ddns.conf
```

修改：
```
PROVIDER=duckdns
DUCKDNS_DOMAIN=xiaolong-control
DUCKDNS_TOKEN=your-token
```

**4. 启动 DDNS**
```bash
# 测试更新
./ddns.sh update

# 安装定时任务（每5分钟检查）
./ddns.sh install

# 查看状态
./ddns.sh status
```

**5. 访问地址**
```
http://xiaolong-control.duckdns.org:8767/control-tower
```

### 方案 B: 花生壳（国内）

如果你有花生壳账号，可以使用花生壳客户端。

---

## 启动命令

```bash
# 启动 Control Tower
./start-public-ip.sh

# 或
./start_control_tower.sh local

# 启动 DDNS（如果配置了）
./ddns.sh update
```

---

## 故障排查

### 无法从公网访问

**检查清单：**
1. ✅ Control Tower 是否运行？
   ```bash
   curl http://localhost:8767/api/system/status
   ```

2. ✅ 路由器端口映射是否正确？
   - 检查内部 IP 是否为 192.168.1.65
   - 检查端口是否为 8767

3. ✅ Mac 防火墙是否允许？
   - 临时关闭防火墙测试

4. ✅ 运营商是否封锁端口？
   - 尝试更换端口（如 8080, 8888）
   - 有些运营商会封锁 80/443 端口

### IP 变化了

**如果你配置了 DDNS：**
```bash
# 手动更新
./ddns.sh update

# 或等待定时任务自动更新（每5分钟）
```

**如果没有 DDNS：**
- 重新获取公网 IP
- 更新访问地址

---

## 安全建议

1. **不要使用默认端口**：可以改为 8080, 8888 等
2. **设置访问密码**：通过 nginx 反向代理添加 basic auth
3. **限制访问 IP**：路由器防火墙只允许特定 IP
4. **使用 HTTPS**：配置 SSL 证书

---

## 文件说明

| 文件 | 说明 |
|------|------|
| `start-public-ip.sh` | 公网 IP 启动脚本 |
| `ddns.sh` | DDNS 更新脚本 |
| `ddns.conf.example` | DDNS 配置示例 |
| `PUBLIC-IP-GUIDE.md` | 本指南 |

---

## 快速检查

```bash
# 1. 检查 Control Tower
curl http://localhost:8767/api/system/status

# 2. 检查公网 IP
curl https://api.ipify.org

# 3. 检查 DDNS 状态（如果配置了）
./ddns.sh status
```

---

**当前状态**: 等待路由器端口映射配置
