import subprocess
import os

# 直接修改文件中的 instType
script_path = '/Users/colin/.openclaw/workspace/auto_monitor_v2.py'

# 读取文件
with open(script_path, 'r') as f:
    lines = f.readlines()

# 修改每一行
new_lines = []
for line in lines:
    # 替换 SPOT 为 SWAP
    if 'instType=SPOT' in line or 'instType="SPOT"' in line or "instType='SPOT'" in line:
        line = line.replace('instType=SPOT', 'instType=SWAP')
        line = line.replace('instType="SPOT"', 'instType="SWAP"')
        line = line.replace("instType='SPOT'", "instType='SWAP'")
        print(f"修改行：{line.strip()}")
    new_lines.append(line)

# 写回文件
with open(script_path, 'w') as f:
    f.writelines(new_lines)

print("✅ 已替换所有 SPOT 为 SWAP")

# 重启
print("\n🔄 重启监控系统...")
os.system('pkill -f auto_monitor_v2')
os.system('sleep 2')
os.system('cd /Users/colin/.openclaw/workspace && python3 auto_monitor_v2.py > monitor_live.log 2>&1 &')
print("✅ 已重启")

