#!/usr/bin/env python3
import requests
import json

resp = requests.get("http://127.0.0.1:8780/api/health")
d = resp.json()

print("=== Health 端点核心字段验收 ===")
print(f"status: {d.get('status', 'MISSING')}")
print(f"worker_alive: {d.get('worker_alive', 'MISSING')}")
print(f"snapshot_ready: {d.get('snapshot_ready', 'MISSING')}")
print(f"snapshot_age_sec: {d.get('snapshot_age_sec', 'MISSING')}")
print(f"data_valid: {d.get('data_valid', 'MISSING')}")
print(f"equity: {d.get('equity', 'MISSING')}")
print(f"fail_count: {d.get('fail_count', 'MISSING')}")
print(f"last_error: {d.get('last_error', 'MISSING')}")
print(f"last_loop_ts: {d.get('last_loop_ts', 'MISSING')}")
print(f"dependency: {d.get('dependency', 'MISSING')}")

print("\n=== 验收标准 ===")
checks = [
    ("worker_alive", d.get('worker_alive') == True),
    ("snapshot_ready", d.get('snapshot_ready') == True),
    ("snapshot_age_sec < 10", d.get('snapshot_age_sec', 999) < 10),
    ("dependency 存在", isinstance(d.get('dependency'), dict)),
]

all_pass = True
for name, passed in checks:
    status = "✅" if passed else "❌"
    print(f"{status} {name}")
    if not passed:
        all_pass = False

print(f"\n总体：{'✅ 通过' if all_pass else '⚠️ 部分通过'}")
