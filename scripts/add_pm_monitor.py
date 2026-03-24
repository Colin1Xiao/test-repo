#!/usr/bin/env python3
"""为小龙交易面板添加增强监控模块"""

import re

# 读取文件
with open('/Users/colin/.openclaw/workspace/trading_system_v5_3/panel_v40_full.py', 'r') as f:
    content = f.read()

# 检查是否已添加
if 'pm-monitor' in content:
    print("✅ 增强监控模块已存在")
    exit(0)

print("正在添加增强监控模块...")

# 在 </style> 前添加新样式
new_styles = '''
        /* 增强系统监控模块 */
        .pm-monitor {
            margin: 16px 0;
            padding: 16px;
            background: linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 16px;
        }
        .pm-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }
        .pm-title {
            font-weight: 600;
            font-size: 16px;
            color: #fff;
        }
        .pm-status-badge {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 12px;
            background: rgba(0, 217, 165, 0.1);
            border: 1px solid rgba(0, 217, 165, 0.3);
            border-radius: 20px;
            font-size: 12px;
            color: var(--success);
        }
        .pm-pulse {
            width: 8px;
            height: 8px;
            background: var(--success);
            border-radius: 50%;
            animation: pm-pulse 2s infinite;
        }
        @keyframes pm-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.2); }
        }
        .pm-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 12px;
        }
        .pm-card {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px;
            padding: 16px;
            transition: all 0.3s ease;
        }
        .pm-card:hover {
            transform: translateY(-2px);
            border-color: rgba(255,255,255,0.15);
            background: rgba(255,255,255,0.05);
        }
        .pm-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        .pm-card-title {
            font-size: 11px;
            color: rgba(255,255,255,0.5);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .pm-badge {
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 500;
        }
        .pm-badge-success { background: rgba(0, 217, 165, 0.15); color: var(--success); }
        .pm-badge-warning { background: rgba(255, 179, 71, 0.15); color: var(--warning); }
        .pm-badge-info { background: rgba(108, 92, 231, 0.15); color: var(--info); }
        .pm-stat-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .pm-stat-row:last-child { border-bottom: none; }
        .pm-stat-label { color: rgba(255,255,255,0.4); font-size: 13px; }
        .pm-stat-value { font-weight: 500; font-size: 13px; color: #fff; }
        .pm-progress {
            height: 4px;
            background: rgba(255,255,255,0.1);
            border-radius: 2px;
            overflow: hidden;
            margin-top: 8px;
        }
        .pm-progress-fill {
            height: 100%;
            border-radius: 2px;
            background: linear-gradient(90deg, var(--secondary), var(--success));
            background-size: 200% 100%;
            animation: pm-shimmer 2s infinite;
        }
        @keyframes pm-shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }
        .pm-quality-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
        }
        .pm-quality-item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            padding: 6px;
            background: rgba(255,255,255,0.03);
            border-radius: 6px;
        }
        .pm-check { color: var(--success); }
'''

# 在 </style> 前插入样式
content = content.replace('    </style>', new_styles + '    </style>')

print("✅ 样式已添加")

# 保存
with open('/Users/colin/.openclaw/workspace/trading_system_v5_3/panel_v40_full.py', 'w') as f:
    f.write(content)

print("✅ 文件已保存")
print("请重启交易面板服务查看效果")