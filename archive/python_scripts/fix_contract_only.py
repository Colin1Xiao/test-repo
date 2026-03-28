#!/usr/bin/env python3
# 修复：只使用合约数据，不使用现货数据

import os
import re

script_path = '/Users/colin/.openclaw/workspace/auto_monitor_v2.py'

with open(script_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 添加代理环境变量
if "os.environ['https_proxy']" not in content:
    # 在文件开头添加
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if line.startswith('import ') or line.startswith('from '):
            continue
        elif line.strip() == '' or line.startswith('#'):
            continue
        else:
            # 在第一个非 import 行之前插入
            lines.insert(i, "# 设置代理环境变量")
            lines.insert(i+1, "import os")
            lines.insert(i+2, "os.environ['https_proxy'] = 'http://127.0.0.1:7890'")
            lines.insert(i+3, "os.environ['http_proxy'] = 'http://127.0.0.1:7890'")
            lines.insert(i+4, "")
            break
    
    content = '\n'.join(lines)

# 2. 替换所有 spot 为 swap
content = content.replace("'defaultType': 'spot'", "'defaultType': 'swap'")
content = content.replace('"defaultType": "spot"', '"defaultType": "swap"')
content = content.replace("instType=SPOT", "instType=SWAP")
content = content.replace("instType='SPOT'", "instType='SWAP'")

# 3. 确保所有 ccxt.okx 调用都使用 swap
content = re.sub(
    r"ccxt\.okx\(\{[^}]*\}\)",
    lambda m: m.group(0).replace("})", ", 'options': {'defaultType': 'swap'}}") if "'options'" not in m.group(0) else m.group(0),
    content
)

# 写回文件
with open(script_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ 已修改为只使用合约数据")
print("\n🔄 重启监控系统...")

os.system('pkill -f auto_monitor_v2')
os.system('sleep 2')
os.system('cd /Users/colin/.openclaw/workspace && export https_proxy=http://127.0.0.1:7890 && nohup python3 auto_monitor_v2.py > monitor_live.log 2>&1 &')
print("✅ 监控系统已重启")
print("\n⏱️  等待 15 秒...")
os.system('sleep 15')
print("\n📊 最新日志:")
os.system('tail -30 /Users/colin/.openclaw/workspace/monitor_live.log | grep -E "(成功 | 失败 | 获取|BTC|ETH|SWAP)" | tail -15')
