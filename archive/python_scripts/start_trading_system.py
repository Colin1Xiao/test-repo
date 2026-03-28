#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V5.4 薄启动器 - 重定向到真实主入口
"""

import subprocess
import sys
import os
from datetime import datetime

def main():
    print("="*70)
    print("🚀 启动小龙智能交易系统 V5.4")
    print("="*70)
    
    # 配置
    WORKSPACE = "/Users/colin/.openclaw/workspace"
    APP_DIR = os.path.join(WORKSPACE, "trading_system_v5_3")
    MAIN_ENTRY = os.path.join(APP_DIR, "run_v52_live.py")
    LOG_DIR = os.path.join(APP_DIR, "logs")
    
    # 创建日志目录
    os.makedirs(LOG_DIR, exist_ok=True)
    
    # 检查主入口是否存在
    if not os.path.exists(MAIN_ENTRY):
        print(f"❌ 错误: 主入口文件不存在: {MAIN_ENTRY}")
        sys.exit(1)
    
    # 生成日志文件名
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    log_file_path = os.path.join(LOG_DIR, f"engine_boot_{timestamp}.log")
    
    print(f"📋 主入口: {MAIN_ENTRY}")
    print(f"📊 日志文件: {log_file_path}")
    print()
    
    try:
        # 启动主进程（后台运行，执行模式）
        with open(log_file_path, "a", encoding="utf-8") as log_file:
            proc = subprocess.Popen(
                [sys.executable, "run_v52_live.py", "--execute"],
                cwd=APP_DIR,
                stdout=log_file,
                stderr=subprocess.STDOUT,
                env={**os.environ}  # 继承当前环境变量
            )
        
        print(f"✅ 交易引擎已启动!")
        print(f"   PID: {proc.pid}")
        print(f"   日志: tail -f {log_file_path}")
        print()
        print("="*70)
        print("🎉 小龙智能交易系统 V5.4 运行中！")
        print("="*70)
        
    except Exception as e:
        print(f"❌ 启动失败: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()