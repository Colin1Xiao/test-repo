#!/usr/bin/env python3
import json
import subprocess
import sys

result = subprocess.run(
    ['curl', '-s', "https://www.okx.com/api/v5/public/instruments?instType=SWAP&uly=ETH-USDT"],
    capture_output=True, text=True
)

data = json.loads(result.stdout)
if data.get('code') == '0':
    for inst in data.get('data', []):
        if inst.get('instId') == 'ETH-USDT-SWAP':
            print('=== ETH-USDT-SWAP 特性 ===')
            print(f"合约面值 (ctVal): {inst.get('ctVal')} {inst.get('ctValCcy')}")
            print(f"最小下单量 (minSz): {inst.get('minSz')}")
            print(f"下单步长 (lotSz): {inst.get('lotSz')}")
            print(f"杠杆: {inst.get('lever')}")
            print(f"状态: {inst.get('state')}")
            
            min_sz = float(inst.get('minSz', 0))
            print(f'\n=== 最小交易计算 ===')
            print(f'最小张数: {min_sz}')
            
            current_price = 2160
            print(f'在 ${current_price} 价格下:')
            min_notional = min_sz * 10 * current_price
            min_margin = min_notional / 100
            print(f'  最小名义价值 = {min_sz} × 10 × {current_price} = ${min_notional:.2f}')
            print(f'  最小保证金 (100x) = ${min_margin:.2f}')
            break
else:
    print(data)
