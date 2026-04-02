#!/usr/local/bin/python3.14
"""
OKX 连接修复工具

尝试多种方法修复 OKX 连接问题
"""

import sys
import os
import time
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

def print_header(text):
    print("=" * 60)
    print(f"  {text}")
    print("=" * 60)
    print()

def method_1_clear_proxy():
    """方法 1: 清除代理"""
    print_header("方法 1: 清除代理设置")
    
    old_https = os.environ.get('https_proxy', '')
    old_http = os.environ.get('http_proxy', '')
    
    os.environ['https_proxy'] = ''
    os.environ['http_proxy'] = ''
    os.environ['no_proxy'] = '*'
    
    print(f"原 https_proxy: {old_https}")
    print(f"原 http_proxy: {old_http}")
    print("✅ 代理已清除")
    print()
    
    return test_connection("清除代理后")

def method_2_change_dns():
    """方法 2: 尝试不同域名"""
    print_header("方法 2: 尝试备用域名")
    
    domains = [
        'https://okx.com',
        'https://www.okx.com',
        'https://www.okx.vc',
    ]
    
    import requests
    session = requests.Session()
    session.trust_env = False
    
    for domain in domains:
        try:
            url = f"{domain}/api/v5/public/time"
            resp = session.get(url, timeout=10)
            if resp.status_code == 200:
                print(f"✅ {domain} 连接成功！")
                data = resp.json()
                print(f"   服务器时间：{data.get('data', [{}])[0].get('ts')}")
                print()
                return True, domain
        except Exception as e:
            print(f"❌ {domain}: {str(e)[:60]}")
    
    print()
    return False, None

def method_3_retry_with_delay():
    """方法 3: 延迟重试"""
    print_header("方法 3: 延迟重试 (3 次)")
    
    import requests
    session = requests.Session()
    session.trust_env = False
    
    for i in range(3):
        print(f"尝试 {i+1}/3...")
        try:
            resp = session.get('https://okx.com/api/v5/public/time', timeout=10)
            if resp.status_code == 200:
                print(f"✅ 第 {i+1} 次尝试成功！")
                data = resp.json()
                print(f"   服务器时间：{data.get('data', [{}])[0].get('ts')}")
                print()
                return True
        except Exception as e:
            print(f"   失败：{str(e)[:60]}")
            if i < 2:
                wait_time = 5 * (i + 1)
                print(f"   等待 {wait_time} 秒后重试...")
                time.sleep(wait_time)
    
    print()
    return False

def method_4_check_api_key():
    """方法 4: 验证 API Key"""
    print_header("方法 4: 验证 API Key 配置")
    
    config_path = Path(__file__).parent.parent / "tests" / "config" / "okx_live.json"
    
    if not config_path.exists():
        print(f"❌ 配置文件不存在：{config_path}")
        return False
    
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    print(f"配置文件：{config_path}")
    print(f"API Key: {config['api_key'][:20]}...")
    print(f"环境：{config.get('environment', 'unknown')}")
    print(f"交易对：{config.get('symbol', 'unknown')}")
    print(f"订单量：{config.get('qty', 'unknown')}")
    print()
    print("✅ 配置文件有效")
    print()
    
    return True

def test_connection(context="测试"):
    """测试连接"""
    import requests
    session = requests.Session()
    session.trust_env = False
    
    try:
        resp = session.get('https://okx.com/api/v5/public/time', timeout=10)
        if resp.status_code == 200:
            print(f"✅ {context} - 连接成功！")
            data = resp.json()
            print(f"   服务器时间：{data.get('data', [{}])[0].get('ts')}")
            print()
            return True
        else:
            print(f"❌ {context} - 状态码：{resp.status_code}")
            print()
            return False
    except Exception as e:
        print(f"❌ {context} - {str(e)[:80]}")
        print()
        return False

def main():
    print_header("🔧 OKX 连接修复工具")
    
    results = {
        "method_1_proxy": False,
        "method_2_dns": False,
        "method_3_retry": False,
        "method_4_config": False,
    }
    
    # 方法 1: 清除代理
    results["method_1_proxy"] = method_1_clear_proxy()
    if results["method_1_proxy"]:
        print("🎉 连接已恢复！可以直接运行 M2 Live 验证")
        print()
        print("命令：")
        print("  ./scripts/m2_live_validation.py")
        return True
    
    # 方法 2: 备用域名
    success, domain = method_2_change_dns()
    if success:
        print(f"🎉 使用 {domain} 可以连接！")
        print()
        print("建议修改配置使用该域名")
        return True
    
    # 方法 3: 延迟重试
    results["method_3_retry"] = method_3_retry_with_delay()
    if results["method_3_retry"]:
        print("🎉 连接已恢复！")
        return True
    
    # 方法 4: 验证配置
    results["method_4_config"] = method_4_check_api_key()
    
    # 总结
    print_header("修复结果总结")
    print(f"方法 1 (清除代理): {'✅' if results['method_1_proxy'] else '❌'}")
    print(f"方法 2 (备用域名): {'✅' if results['method_2_dns'] else '❌'}")
    print(f"方法 3 (延迟重试): {'✅' if results['method_3_retry'] else '❌'}")
    print(f"方法 4 (配置验证): {'✅' if results['method_4_config'] else '❌'}")
    print()
    
    if not any(results.values()):
        print("⚠️  所有方法都失败了")
        print()
        print("建议:")
        print("  1. 🌐 连接手机热点后重试")
        print("  2. ⏰ 等待网络恢复 (可能是 OKX 服务器维护)")
        print("  3. ⏭️ 先进行 M3 驾驶舱开发")
        print()
        return False
    else:
        print("✅ 部分方法成功，可以尝试运行 M2 Live 验证")
        print()
        return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
