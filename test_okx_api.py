#!/usr/bin/env python3
"""
OKX API Connection Test
OKX API 连接测试脚本

测试内容:
1. API 配置加载
2. 测试网连接
3. 账户查询
4. 权限验证
"""

import sys
import json
from pathlib import Path

# 添加路径
sys.path.insert(0, str(Path(__file__).parent))

print("="*70)
print("🧪 OKX API 连接测试")
print("="*70)

# ========== 测试 1: 加载配置 ==========
print("\n测试 1: 加载 API 配置")
print("-"*70)

config_path = Path.home() / '.openclaw' / 'secrets' / 'okx_api.json'

if not config_path.exists():
    print(f"❌ 配置文件不存在：{config_path}")
    print(f"\n📋 配置步骤:")
    print(f"   1. cd /Users/colin/.openclaw/secrets")
    print(f"   2. cp okx_api.template.json okx_api.json")
    print(f"   3. nano okx_api.json (填入密钥)")
    print(f"   4. chmod 600 okx_api.json")
    sys.exit(1)

# 检查文件权限
import stat
file_stat = config_path.stat()
if file_stat.st_mode & stat.S_IRUSR and file_stat.st_mode & stat.S_IWUSR:
    print(f"✅ 配置文件存在：{config_path}")
    print(f"✅ 文件权限正确")
else:
    print(f"⚠️  文件权限可能不安全，运行：chmod 600 {config_path}")

# 加载配置
try:
    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
    print(f"✅ 配置加载成功")
except Exception as e:
    print(f"❌ 配置加载失败：{e}")
    sys.exit(1)

# 检查配置
okx_config = config.get('okx', {})
if not okx_config.get('enabled', False):
    print(f"⚠️  API 未启用，请在配置文件中设置 enabled: true")

print(f"\n📋 配置信息:")
print(f"   测试网：{'✅ 是' if okx_config.get('testnet', True) else '⚠️  实盘'}")
print(f"   权限：{okx_config.get('permissions', ['read'])}")
print(f"   最大仓位：{okx_config.get('max_position', 0.2)*100:.0f}%")
print(f"   最大杠杆：{okx_config.get('max_leverage', 5)}x")
print(f"   止损：{okx_config.get('stop_loss', 0.02)*100:.1f}%")

# ========== 测试 2: 连接 OKX ==========
print("\n测试 2: 连接 OKX")
print("-"*70)

try:
    import ccxt
    
    # 检查 API 密钥
    api_key = okx_config.get('api_key', '')
    secret = okx_config.get('secret_key', '')
    passphrase = okx_config.get('passphrase', '')
    
    if not api_key or api_key == 'YOUR_API_KEY_HERE':
        print(f"⚠️  API Key 未配置")
        print(f"\n📋 配置步骤:")
        print(f"   1. 登录 OKX → 个人中心 → API 管理")
        print(f"   2. 创建 API（只读权限）")
        print(f"   3. 复制 API Key、Secret、Passphrase")
        print(f"   4. 填入 {config_path}")
    else:
        print(f"✅ API Key 已配置：{api_key[:8]}...{api_key[-4:]}")
        
        # 创建交易所实例
        exchange = ccxt.okx({
            'apiKey': api_key,
            'secret': secret,
            'password': passphrase,
            'enableRateLimit': True,
        })
        
        # 测试网模式
        if okx_config.get('testnet', True):
            exchange.set_sandbox_mode(True)
            print(f"✅ 测试网模式已启用")
        
        # 测试连接
        try:
            print(f"\n📊 测试连接...")
            balance = exchange.fetch_balance()
            
            if 'USDT' in balance['total']:
                usdt_balance = balance['total']['USDT']
                print(f"✅ 连接成功")
                print(f"💰 USDT 余额：{usdt_balance}")
                
                if okx_config.get('testnet', True):
                    print(f"   (测试网虚拟资金)")
                else:
                    print(f"   (⚠️  实盘真实资金)")
            else:
                print(f"✅ 连接成功")
                print(f"💰 账户信息已获取")
                
        except ccxt.AuthenticationError as e:
            print(f"❌ 认证失败：API 密钥可能错误")
            print(f"   请检查 OKX API 配置")
        except ccxt.NetworkError as e:
            print(f"⚠️  网络错误：{e}")
            print(f"   检查网络连接或代理设置")
        except Exception as e:
            print(f"⚠️  连接异常：{e}")
            
except ImportError as e:
    print(f"❌ 缺少依赖：{e}")
    print(f"   运行：pip3 install ccxt")

# ========== 测试 3: 权限验证 ==========
print("\n测试 3: 权限验证")
print("-"*70)

permissions = okx_config.get('permissions', ['read'])

if 'read' in permissions:
    print(f"✅ 读取权限：已配置")
else:
    print(f"⚠️  读取权限：未配置")

if 'trade' in permissions:
    print(f"⚠️  交易权限：已配置（⚠️  有真实交易风险）")
    if not okx_config.get('testnet', True):
        print(f"   ⚠️  实盘交易 - 请谨慎！")
else:
    print(f"✅ 交易权限：未配置（安全）")

if 'withdraw' in permissions:
    print(f"🚨 提现权限：已配置（🚨 极度危险）")
    print(f"   ⚠️  强烈建议关闭此权限！")
else:
    print(f"✅ 提现权限：未配置（安全）")

# ========== 测试 4: 安全检查 ==========
print("\n测试 4: 安全检查")
print("-"*70)

security_checks = []

# 检查测试网
if okx_config.get('testnet', True):
    security_checks.append(("测试网模式", True, "无真实风险"))
else:
    security_checks.append(("测试网模式", False, "⚠️  实盘风险"))

# 检查提现权限
if 'withdraw' not in permissions:
    security_checks.append(("提现权限关闭", True, "安全"))
else:
    security_checks.append(("提现权限关闭", False, "🚨 危险"))

# 检查仓位限制
max_pos = okx_config.get('max_position', 0.2)
if max_pos <= 0.3:
    security_checks.append(("仓位限制", True, f"{max_pos*100:.0f}%"))
else:
    security_checks.append(("仓位限制", False, f"⚠️  {max_pos*100:.0f}% 过高"))

# 检查杠杆限制
max_lev = okx_config.get('max_leverage', 5)
if max_lev <= 10:
    security_checks.append(("杠杆限制", True, f"{max_lev}x"))
else:
    security_checks.append(("杠杆限制", False, f"⚠️  {max_lev}x 过高"))

# 检查止损
stop_loss = okx_config.get('stop_loss', 0.02)
if stop_loss <= 0.03:
    security_checks.append(("止损保护", True, f"{stop_loss*100:.1f}%"))
else:
    security_checks.append(("止损保护", False, f"⚠️  {stop_loss*100:.1f}% 过大"))

# 显示检查结果
passed = 0
for check_name, passed_check, detail in security_checks:
    if passed_check:
        print(f"✅ {check_name}: {detail}")
        passed += 1
    else:
        print(f"⚠️  {check_name}: {detail}")

security_score = passed / len(security_checks) * 100
print(f"\n安全评分：{passed}/{len(security_checks)} ({security_score:.0f}%)")

# ========== 测试总结 ==========
print("\n" + "="*70)
print("📊 测试总结")
print("="*70)

if security_score >= 80:
    print("✅ 配置安全，可以使用")
elif security_score >= 60:
    print("⚠️  配置基本安全，建议改进")
else:
    print("🚨 配置存在安全风险，请改进")

print("\n💡 建议:")
if okx_config.get('testnet', True):
    print("   ✅ 已使用测试网 - 无真实风险")
else:
    print("   ⚠️  建议先使用测试网验证")

if 'trade' not in permissions:
    print("   ✅ 只读模式 - 安全")
else:
    print("   ⚠️  交易模式 - 请谨慎")

if 'withdraw' not in permissions:
    print("   ✅ 提现权限已关闭 - 安全")
else:
    print("   🚨 请立即关闭提现权限！")

print("\n📋 下一步:")
print("   1. 启动监控：python3 auto_monitor_v2.py")
print("   2. 查看信号：监控告警")
print("   3. 手动交易：根据信号执行")

print("\n" + "="*70)
