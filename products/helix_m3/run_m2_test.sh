#!/bin/bash
# 使用 Python 3.14 运行 M2 验证
export PYTHONPATH=/Users/colin/.openclaw/workspace/helix_crypto_trading_platform:$PYTHONPATH
/usr/local/bin/python3.14 tests/m2/test_single_order.py "$@"
