#!/usr/bin/env python3
"""
小龙监控系统包装器
确保代理配置正确
"""

import os
import sys

# 必须在导入其他模块之前设置
os.environ['https_proxy'] = 'http://127.0.0.1:7890'
os.environ['http_proxy'] = 'http://127.0.0.1:7890'

# 清除 no_proxy
if 'no_proxy' in os.environ:
    del os.environ['no_proxy']
if 'NO_PROXY' in os.environ:
    del os.environ['NO_PROXY']

# 打印配置
print("🚀 小龙监控系统启动")
print(f"  HTTPS_PROXY: {os.environ.get('https_proxy')}")
print(f"  HTTP_PROXY: {os.environ.get('http_proxy')}")
print(f"  NO_PROXY: {os.environ.get('no_proxy', '(未设置)')}")
print()

# 导入并运行主程序
if __name__ == "__main__":
    import auto_monitor_v2
    auto_monitor_v2.main()
