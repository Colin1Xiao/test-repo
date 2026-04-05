#!/usr/bin/env python3
"""
OKX 网络连通性检测 - 代理版本
使用系统代理检测 OKX API 可用性
"""

import urllib.request
import json
import sys
from datetime import datetime

# 代理配置 (ClashX 默认)
PROXIES = {
    'http': 'http://127.0.0.1:7890',
    'https': 'http://127.0.0.1:7890',
}

# OKX API 端点
OKX_ENDPOINTS = [
    'https://www.okx.com/api/v5/public/time',
    'https://okx.com/api/v5/public/time',
]

def test_okx_connection(url, use_proxy=True):
    """测试 OKX 连接"""
    try:
        if use_proxy:
            proxy = urllib.request.ProxyHandler(PROXIES)
            opener = urllib.request.build_opener(proxy)
            urllib.request.install_opener(opener)
            proxy_status = "✅ 代理"
        else:
            proxy_status = "❌ 直连"
        
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        
        response = urllib.request.urlopen(req, timeout=5)
        data = json.loads(response.read().decode())
        
        if data.get('code') == '0':
            ts = data.get('data', [{}])[0].get('ts', '未知')
            return {
                'status': '✅ 成功',
                'url': url,
                'proxy': proxy_status,
                'time': ts,
                'error': None
            }
        else:
            return {
                'status': '⚠️ 异常',
                'url': url,
                'proxy': proxy_status,
                'time': None,
                'error': f"API 返回错误码：{data.get('code')}"
            }
            
    except Exception as e:
        return {
            'status': '❌ 失败',
            'url': url,
            'proxy': proxy_status,
            'time': None,
            'error': str(e)
        }

def main():
    print("=" * 60)
    print("OKX 网络连通性检测 - 代理版本")
    print(f"检测时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    results = []
    
    # 测试各端点 (使用代理)
    print("\n【使用代理测试】")
    for endpoint in OKX_ENDPOINTS:
        result = test_okx_connection(endpoint, use_proxy=True)
        results.append(result)
        print(f"\n{result['status']} {result['proxy']}")
        print(f"  URL: {result['url']}")
        if result['time']:
            print(f"  服务器时间：{result['time']}")
        if result['error']:
            print(f"  错误：{result['error']}")
    
    # 判断总体状态
    print("\n" + "=" * 60)
    success_count = sum(1 for r in results if r['status'] == '✅ 成功')
    
    if success_count > 0:
        print(f"✅ OKX 网络已恢复！({success_count}/{len(results)} 端点可用)")
        print("\n建议操作:")
        print("1. 可以执行 V5.4 实盘验证")
        print("2. 运行 3 笔 Safety Test")
        print("3. 更新 PRODUCTION_READINESS_CHECKLIST.md")
        sys.exit(0)
    else:
        print(f"❌ OKX 网络仍异常 (0/{len(results)} 端点可用)")
        print("\n建议操作:")
        print("1. 检查 ClashX 是否运行")
        print("2. 切换代理节点 (建议：香港/日本/新加坡)")
        print("3. 等待 30 分钟后自动重测")
        sys.exit(1)

if __name__ == '__main__':
    main()
