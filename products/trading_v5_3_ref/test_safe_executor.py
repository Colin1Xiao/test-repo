#!/usr/bin/env python3
"""测试 SafeExecutionV54 是否正确加载"""

import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent
sys.path.insert(0, str(BASE_DIR / 'core'))

print("Testing SafeExecutionV54 import...")

from core.safe_execution import SafeExecutionV54, TradeResult

print(f"SafeExecutionV54 loaded from: {SafeExecutionV54.__module__}")
print(f"Has try_execute: {hasattr(SafeExecutionV54, 'try_execute')}")
print(f"Has execute_entry: {hasattr(SafeExecutionV54, 'execute_entry')}")
print(f"Has execute_exit: {hasattr(SafeExecutionV54, 'execute_exit')}")
print(f"Has close_position: {hasattr(SafeExecutionV54, 'close_position')}")

# 列出所有公共方法
methods = [m for m in dir(SafeExecutionV54) if not m.startswith('_')]
print(f"\nAll public methods: {methods}")
