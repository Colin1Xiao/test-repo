#!/usr/bin/env python3
"""修复 multi_exchange_adapter.py 中的代理配置"""

import re

with open('multi_exchange_adapter.py', 'r') as f:
    content = f.read()

# 查找所有 ccxt.okx 实例化
lines = content.split('\n')
new_lines = []
in_exchange_block = False
brace_count = 0

for i, line in enumerate(lines):
    if 'exchange = ccxt.okx({' in line:
        in_exchange_block = True
        brace_count = 1
        new_lines.append(line)
        # 在下一行添加 proxies
        new_lines.append("                'proxies': GLOBAL_PROXIES,")
        continue
    
    if in_exchange_block:
        brace_count += line.count('{') - line.count('}')
        if brace_count <= 0:
            in_exchange_block = False
    
    new_lines.append(line)

# 写回文件
with open('multi_exchange_adapter.py', 'w') as f:
    f.write('\n'.join(new_lines))

print('✅ 代理配置修复完成')
