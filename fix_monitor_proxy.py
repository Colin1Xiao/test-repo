#!/usr/bin/env python3
# 修复监控系统的代理配置

import os

# 读取 auto_monitor_v2.py
script_path = '/Users/colin/.openclaw/workspace/auto_monitor_v2.py'

with open(script_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 在文件开头添加代理设置
proxy_setup = '''# 设置代理环境变量
import os
os.environ['https_proxy'] = 'http://127.0.0.1:7890'
os.environ['http_proxy'] = 'http://127.0.0.1:7890'

'''

# 在 import 之后添加
if "os.environ['https_proxy']" not in content:
    # 找到第一个 import 块结束的位置
    lines = content.split('\n')
    insert_pos = 0
    for i, line in enumerate(lines):
        if line.startswith('import ') or line.startswith('from '):
            insert_pos = i + 1
        elif insert_pos > 0 and not line.strip():
            break
    
    # 插入代理设置
    lines.insert(insert_pos, proxy_setup)
    
    # 写回文件
    with open(script_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    
    print("✅ 代理配置已添加到 auto_monitor_v2.py")
else:
    print("✅ 代理配置已存在")

print("\n🔄 重启监控系统...")
os.system('pkill -f auto_monitor_v2')
os.system('sleep 2')
os.system('cd /Users/colin/.openclaw/workspace && nohup python3 auto_monitor_v2.py > monitor_live.log 2>&1 &')
print("✅ 监控系统已重启")
print("\n📊 10 秒后查看日志...")
os.system('sleep 10')
os.system('tail -20 /Users/colin/.openclaw/workspace/monitor_live.log')
