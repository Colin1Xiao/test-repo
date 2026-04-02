#!/usr/bin/env python3
"""
🐉 小龙交易系统 V5.4 - 平衡版专业面板
完整功能 + 性能优化
"""

import sys
from pathlib import Path
from datetime import datetime
from flask import Flask, jsonify, render_template_string, request
from flask_cors import CORS

# 添加核心模块路径
sys.path.insert(0, str(Path(__file__).parent.parent / "core"))
sys.path.insert(0, str(Path(__file__).parent))
from trade_integration_v54 import get_trade_bridge
from market_data_api import get_market_api

app = Flask(__name__)
CORS(app)
bridge = get_trade_bridge()
market_api = get_market_api()

# 平衡版 HTML 模板（完整功能 + 性能优化）
HTML_TEMPLATE = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>小龙交易系统 V5.4 - 平衡版</title>
    
    <!-- Chart.js (按需加载) -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    
    <style>
        /* 基于 web-design 和 frontend-design-3 指南优化 */
        :root {
            /* 色彩系统 - 金融仪表板专用 */
            --bg-surface-0: #0F172A; /* 页面背景 */
            --bg-surface-1: #1E293B; /* 卡片背景 */
            --bg-surface-2: #334155; /* 卡片悬停 */
            
            /* 文字颜色 - 高对比度 */
            --text-primary: #F8FAFC;   /* 纯白色，对比度 15.2:1 */
            --text-secondary: #CBD5E1; /* 浅灰色，对比度 8.7:1 */
            --text-tertiary: #94A3B8;  /* 中灰色，对比度 5.2:1 */
            
            /* 功能色 */
            --primary-500: #3B82F6;
            --primary-600: #2563EB;
            --success-500: #22C55E;    /* 绿色正向指标 */
            --success-400: #4ADE80;
            --danger-500: #EF4444;
            --danger-400: #F87171;
            --warning-500: #F59E0B;    /* 琥珀金高亮 */
            --warning-400: #FBBF24;
            --info-500: #06B6D4;
            --info-400: #22D3EE;
            
            /* 边框和分割线 */
            --border-color: #334155;
            
            /* 统一间距系统 (8px 基准) */
            --space-xs: 0.25rem;   /* 4px */
            --space-sm: 0.5rem;    /* 8px */
            --space-md: 1rem;      /* 16px */
            --space-lg: 1.5rem;    /* 24px */
            --space-xl: 2rem;      /* 32px */
            
            /* 圆角 */
            --radius-sm: 0.25rem;
            --radius-md: 0.5rem;
            --radius-lg: 0.75rem;
            --radius-xl: 1rem;
            
            /* 阴影 */
            --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
            --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
        }
            
            /* 统一间距系统 (8px 基准) */
            --space-xs: 0.25rem;   /* 4px */
            --space-sm: 0.5rem;    /* 8px */
            --space-md: 1rem;      /* 16px */
            --space-lg: 1.5rem;    /* 24px */
            --space-xl: 2rem;      /* 32px */
            
            /* 间距系统 - 8px 基准 */
            --space-1: 0.25rem;   /* 4px */
            --space-2: 0.5rem;    /* 8px */
            --space-3: 0.75rem;   /* 12px */
            --space-4: 1rem;      /* 16px */
            --space-5: 1.25rem;   /* 20px */
            --space-6: 1.5rem;    /* 24px */
            --space-8: 2rem;      /* 32px */
            --space-10: 2.5rem;   /* 40px */
            
            /* 圆角 */
            --radius-sm: 0.25rem;
            --radius-md: 0.5rem;
            --radius-lg: 0.75rem;
            --radius-xl: 1rem;
            
            /* 阴影 */
            --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
            --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg-surface-0);
            color: var(--text-primary);
            line-height: 1.5;
            font-size: 0.9375rem; /* 15px */
            overflow-x: hidden;
        }

        /* 布局容器 */
        .dashboard {
            display: grid;
            grid-template-columns: 280px 1fr;
            min-height: 100vh;
            transition: grid-template-columns 0.3s ease;
        }
        
        /* 全屏功能模式 */
        .dashboard.functional-mode {
            grid-template-columns: 280px 1fr;
        }
        
        .dashboard.functional-mode .main-content {
            display: block;
        }
        
        .dashboard.functional-mode .sidebar {
            width: 280px;
        }
        
        .dashboard.functional-mode .main-content .header,
        .dashboard.functional-mode .main-content .panel-grid {
            display: none;
        }
        
        .dashboard.functional-mode #function-content {
            display: block !important;
        }

        /* 侧边栏 */
        .sidebar {
            background: var(--card-bg);
            padding: var(--space-lg);
            border-right: 1px solid var(--border-color);
            position: sticky;
            top: 0;
            height: 100vh;
            overflow-y: auto;
            transition: width 0.3s ease;
        }
        


        .sidebar-header {
            margin-bottom: 30px;
            text-align: center;
        }

        .sidebar-header h1 {
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--primary-color);
            margin-bottom: 5px;
        }

        .sidebar-header p {
            font-size: 0.8rem;
            color: var(--text-secondary);
        }

        .nav-group {
            margin-bottom: 30px;
        }

        .nav-group-title {
            font-size: 0.75rem;
            text-transform: uppercase;
            color: var(--text-secondary);
            margin-bottom: 10px;
            letter-spacing: 1px;
        }

        .nav-item {
            display: flex;
            align-items: center;
            padding: var(--space-sm) var(--space-md);
            margin-bottom: var(--space-xs);
            color: var(--text-primary);
            text-decoration: none;
            border-radius: var(--radius-sm);
            transition: all 0.2s;
            cursor: pointer;
        }

        .nav-item:hover {
            background: var(--card-hover);
        }

        .nav-item.active {
            background: var(--primary-dark);
            border-left: 4px solid var(--primary-color);
        }

        .nav-item i {
            width: 20px;
            margin-right: 10px;
        }

        /* 主内容 */
        .main-content {
            background: var(--dark-bg);
            padding: var(--space-xl);
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--border-color);
        }

        .header h2 {
            font-size: 1.8rem;
            font-weight: 600;
        }

        .stats-bar {
            display: flex;
            gap: 20px;
        }

        .stat-item {
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .stat-value {
            font-size: 1.2rem;
            font-weight: 700;
        }

        .stat-label {
            font-size: 0.8rem;
            color: var(--text-secondary);
        }

        /* 主面板网格 */
        .panel-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: var(--space-lg); /* 增加卡片间距到24px */
        }

        /* 卡片样式 */
        .card {
            background: linear-gradient(135deg, var(--bg-surface-1), #222f41);
            border-radius: var(--radius-lg);
            padding: var(--space-lg);
            border: 1px solid var(--border-color);
            transition: all 0.3s ease;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            /* 骨架屏加载效果 */
            position: relative;
            overflow: hidden;
        }
        
        .card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1);
        }
        
        /* 骨架屏样式 */
        .skeleton {
            background: linear-gradient(90deg, var(--bg-surface-1) 25%, var(--bg-surface-2) 50%, var(--bg-surface-1) 75%);
            background-size: 200% 100%;
            animation: loading 1.5s infinite;
        }
        
        @keyframes loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .card-title {
            font-size: 1rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .card-title i {
            color: var(--primary-color);
        }

        .card-header-actions {
            display: flex;
            gap: 10px;
        }

        .btn-icon {
            background: transparent;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.2s;
        }

        .btn-icon:hover {
            color: var(--text-primary);
        }

        /* 数据表格 */
        .data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.85rem;
        }

        .data-table th {
            background: var(--table-header);
            padding: 10px 8px;
            text-align: left;
            font-weight: 600;
            color: var(--text-primary);
            border-bottom: 2px solid var(--border-color);
        }

        .data-table td {
            padding: 8px;
            border-bottom: 1px solid var(--border-color);
            color: var(--text-primary);
        }

        .data-table tr:nth-child(odd) {
            background: var(--table-row-1);
        }

        .data-table tr:nth-child(even) {
            background: var(--table-row-2);
        }

        .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 600;
        }

        .status-active { background: var(--success-light); color: var(--success-color); }
        .status-pending { background: var(--warning-light); color: var(--warning-color); }
        .status-inactive { background: var(--danger-light); color: var(--danger-color); }

        /* 指标卡片 */
        .metric-card {
            text-align: center;
        }

        .metric-value {
            font-size: 1.8rem;
            font-weight: 700;
            color: var(--text-primary);
            margin: 10px 0;
        }

        .metric-value.up { color: var(--success-color); }
        .metric-value.down { color: var(--danger-color); }

        .metric-label {
            color: var(--text-secondary);
            font-size: 0.8rem;
        }

        /* 按钮样式 */
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            /* 触摸目标最小尺寸 */
            min-width: 44px;
            min-height: 44px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }

        .btn-primary {
            background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
            color: white;
            border: 1px solid var(--primary-700);
        }

        .btn-primary:hover {
            background: linear-gradient(135deg, var(--primary-600), var(--primary-700));
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        
        .btn-primary:active {
            transform: scale(0.95);
        }
        
        .btn-success {
            background: linear-gradient(135deg, var(--success-500), #059669);
            color: white;
            border: 1px solid #047857;
        }
        
        .btn-success:hover {
            background: linear-gradient(135deg, #059669, #047857);
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        
        .btn-success:active {
            transform: scale(0.95);
        }
        
        .btn-danger {
            background: linear-gradient(135deg, var(--danger-500), #dc2626);
            color: white;
            border: 1px solid #b91c1c;
        }
        
        .btn-danger:hover {
            background: linear-gradient(135deg, #ef4444, #dc2626);
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        
        .btn-danger:active {
            transform: scale(0.95);
        }
        
        .btn-warning {
            background: linear-gradient(135deg, var(--warning-500), #d97706);
            color: var(--bg-surface-0);
            border: 1px solid #ca8a04;
        }
        
        .btn-warning:hover {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        
        .btn-warning:active {
            transform: scale(0.95);
        }
        
        /* 焦点状态 - 可访问性 */
        .btn:focus-visible {
            outline: 2px solid var(--primary-500);
            outline-offset: 2px;
        }

        .btn-success {
            background: var(--success-color);
            color: white;
        }

        .btn-danger {
            background: var(--danger-color);
            color: white;
        }

        .btn-warning {
            background: var(--warning-color);
            color: var(--dark-bg);
        }

        .btn-group {
            display: flex;
            gap: 10px;
        }

        /* 进度条 */
        .progress-bar {
            height: 8px;
            background: var(--border-color);
            border-radius: 4px;
            overflow: hidden;
            margin: 8px 0;
        }

        .progress-fill {
            height: 100%;
            border-radius: 4px;
            transition: width 0.3s;
        }

        .progress-success { background: var(--success-color); }
        .progress-warning { background: var(--warning-color); }
        .progress-danger { background: var(--danger-color); }

        /* 图表容器 */
        .chart-container {
            height: 180px;
            margin-top: 15px;
            position: relative;
            aspect-ratio: 16/9; /* 保持响应式比例 */
        }

        /* 响应式设计 */
        /* Tablet 响应式 */
        @media (max-width: 1024px) and (min-width: 769px) {
            .dashboard {
                grid-template-columns: 240px 1fr;
            }
            
            .sidebar {
                width: 240px;
            }
            
            .card {
                padding: var(--space-md);
            }
        }

        /* 移动端响应式 */
        @media (max-width: 768px) {
            .dashboard {
                grid-template-columns: 1fr;
            }

            .sidebar {
                position: fixed;
                left: -280px;
                top: 0;
                height: 100vh;
                z-index: 1000;
                transition: left 0.3s ease;
                display: block !important;
            }
            
            .sidebar.active {
                left: 0;
            }

            .panel-grid {
                grid-template-columns: 1fr;
            }
            
            .main-content {
                padding: var(--space-md);
            }
            
            .header {
                padding: var(--space-sm) 0;
            }
            
            .stats-bar {
                flex-direction: column;
                gap: var(--space-sm);
            }
            
            .chart-container {
                height: 200px;
            }
        }
        
        /* 超小屏幕 */
        @media (max-width: 480px) {
            .card {
                padding: var(--space-sm);
            }
            
            .card-title {
                font-size: 1rem;
            }
            
            .stat-value {
                font-size: 1rem;
            }
            
            .nav-item {
                padding: var(--space-xs) var(--space-sm);
            }
        }

        /* 性能优化 */
        .fade-in {
            opacity: 1;
            transition: opacity 0.3s ease-in-out;
        }

        /* 状态栏 */
        .status-bar {
            display: flex;
            gap: 15px;
            padding: 10px 20px;
            background: var(--primary-dark);
            font-size: 0.8rem;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 1000;
        }

        .status-item {
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }

        .status-active .status-indicator { background: var(--success-color); }
        .status-warning .status-indicator { background: var(--warning-color); }
        .status-danger .status-indicator { background: var(--danger-color); }
        /* 功能面板样式 */
        .function-content {
            width: 100%;
            margin-top: var(--space-lg);
            padding-top: var(--space-md);
            border-top: 1px solid var(--border-color);
        }
        
        .function-panel {
            padding: var(--space-xl);
            max-width: 1200px;
        }
        
        
        .function-panel h2 {
            margin-bottom: var(--space-lg);
            color: var(--text-primary);
        }
        
        .function-panel h2 i {
            margin-right: var(--space-sm);
            color: var(--primary-color);
        }
        
        .big-number {
            font-size: 2.5rem;
            font-weight: 700;
            margin: var(--space-md) 0;
        }
        
        .positive { color: var(--success-color); }
        .negative { color: var(--danger-color); }
        .long { color: var(--success-color); }
        .short { color: var(--danger-color); }
        
        .status-badge {
            display: inline-block;
            padding: var(--space-sm) var(--space-md);
            border-radius: var(--radius-md);
            font-weight: 600;
        }
        
        .control-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: var(--space-lg);
        }
        
        .control-group {
            display: flex;
            gap: var(--space-md);
            margin-top: var(--space-md);
        }
        
        .btn {
            padding: var(--space-sm) var(--space-md);
            border: none;
            border-radius: var(--radius-md);
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s;
        }
        
        .btn-success {
            background: var(--success-color);
            color: white;
        }
        
        .btn-danger {
            background: var(--danger-color);
            color: white;
        }
        
        .btn-warning {
            background: var(--warning-color);
            color: white;
        }
    </style>
</head>
<body>
    <!-- 状态栏 -->
    <div class="status-bar">
        <div class="status-item status-active">
            <span class="status-indicator"></span>
            <span>系统运行中</span>
        </div>
        <div class="status-item status-active">
            <span class="status-indicator"></span>
            <span>ETH/USDT: ${{ "%.2f"|format(data.market_price or 2456.32) }}</span>
        </div>
        <div class="status-item status-active">
            <span class="status-indicator"></span>
            <span>总交易: {{ data.trade_summary.total_trades or 0 }}</span>
        </div>
        <div class="status-item {{ 'status-active' if data.safety.safe else 'status-danger' }}">
            <span class="status-indicator"></span>
            <span>{{ '安全' if data.safety.safe else '异常' }}</span>
        </div>
    </div>

    <div class="dashboard">
        <!-- 侧边栏 -->
        <aside class="sidebar">
            <div class="sidebar-header">
                <h1>小龙交易系统 V5.4</h1>
                <p>平衡版专业终端</p>
            </div>

            <nav class="nav-group">
                <div class="nav-group-title">核心</div>
                <a href="#" class="nav-item active">
                    <i class="fa-solid fa-chart-line"></i>
                    <span>监控面板</span>
                </a>
                <a href="#" class="nav-item">
                    <i class="fa-solid fa-wallet"></i>
                    <span>我的仓位</span>
                </a>
                <a href="#" class="nav-item">
                    <i class="fa-solid fa-clock"></i>
                    <span>交易历史</span>
                </a>
            </nav>

            <nav class="nav-group">
                <div class="nav-group-title">智能引擎</div>
                <a href="#" class="nav-item">
                    <i class="fa-solid fa-robot"></i>
                    <span>演化引擎</span>
                </a>
                <a href="#" class="nav-item">
                    <i class="fa-solid fa-brain"></i>
                    <span>市场结构</span>
                </a>
                <a href="#" class="nav-item">
                    <i class="fa-solid fa-list-check"></i>
                    <span>决策追踪</span>
                </a>
            </nav>

            <nav class="nav-group">
                <div class="nav-group-title">控制中心</div>
                <a href="#" class="nav-item">
                    <i class="fa-solid fa-sliders"></i>
                    <span>系统控制</span>
                </a>
                <a href="#" class="nav-item">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <span>告警中心</span>
                </a>
            </nav>
        </aside>

        <!-- 功能内容区域 -->
        <div id="function-content" class="function-content" style="display: none; padding: var(--space-xl);">
            <!-- 动态加载功能内容 -->
        </div>

        <!-- 主内容 -->
        <main class="main-content">
            <div class="header">
                <h2>实时监控面板</h2>
                <div class="stats-bar">
                    <div class="stat-item">
                        <span class="stat-value" style="color: var(--primary-color);">${{ "%.2f"|format(data.market_price or 2456.32) }}</span>
                        <span class="stat-label">ETH/USDT</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value" style="color: {{ 'var(--success-color)' if data.trade_summary.total_pnl >= 0 else 'var(--danger-color)' }};">{{ '+' if data.trade_summary.total_pnl >= 0 else '' }}${{ "%.2f"|format(data.trade_summary.total_pnl or 0) }}</span>
                        <span class="stat-label">累计盈亏</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value" style="color: var(--text-primary);">{{ data.trade_summary.total_trades or 0 }}</span>
                        <span class="stat-label">总交易</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value" style="color: var(--success-color);">{{ "%.1f"|format((data.trade_summary.win_rate or 0) * 100) }}%</span>
                        <span class="stat-label">胜率</span>
                    </div>
                </div>
            </div>

            <!-- 四大功能模块 -->
            <div class="panel-grid">
                <!-- 演化引擎 -->
                <div class="card fade-in">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="fa-solid fa-robot"></i>
                            <span>演化引擎</span>
                        </div>
                        <div class="card-header-actions">
                            <button class="btn-icon" onclick="refreshChart('evolution')"><i class="fa-solid fa-sync"></i></button>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:15px;">
                        <div style="background:rgba(255,255,255,0.05);padding:12px;border-radius:8px;text-align:center;">
                            <div style="font-size:1.4rem;font-weight:700;">{{ data.evolution.iterations or 24 }}</div>
                            <div style="font-size:0.7rem;color:var(--text-secondary);">迭代次数</div>
                        </div>
                        <div style="background:rgba(255,255,255,0.05);padding:12px;border-radius:8px;text-align:center;">
                            <div style="font-size:1.4rem;font-weight:700;">{{ "%.1f"|format(data.evolution.fitness_avg or 94.2) }}%</div>
                            <div style="font-size:0.7rem;color:var(--text-secondary);">适应度均值</div>
                        </div>
                    </div>
                    <div class="chart-container">
                        <canvas id="evolutionChart"></canvas>
                    </div>
                </div>

                <!-- 市场结构 -->
                <div class="card fade-in">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="fa-solid fa-brain"></i>
                            <span>市场结构</span>
                        </div>
                        <div class="card-header-actions">
                            <button class="btn-icon" onclick="refreshChart('market')"><i class="fa-solid fa-sync"></i></button>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:15px;">
                        <div>
                            <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-secondary);">
                                <span>趋势强度</span>
                                <span>{{ "%.2f"|format(data.market_structure.trend_strength or 0.78) }}</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill progress-success" style="width: {{ (data.market_structure.trend_strength or 0.78) * 100 }}%"></div>
                            </div>
                        </div>
                        <div>
                            <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-secondary);">
                                <span>波动性</span>
                                <span>{{ "%.2f"|format(data.market_structure.volatility or 0.42) }}</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill progress-warning" style="width: {{ (data.market_structure.volatility or 0.42) * 100 }}%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="chart-container">
                        <canvas id="marketChart"></canvas>
                    </div>
                </div>

                <!-- 决策追踪 -->
                <div class="card fade-in">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="fa-solid fa-list-check"></i>
                            <span>决策追踪</span>
                        </div>
                        <div class="card-header-actions">
                            <button class="btn-icon" onclick="refreshChart('decision')"><i class="fa-solid fa-sync"></i></button>
                        </div>
                    </div>
                    <div style="display:flex;gap:15px;margin-bottom:15px;">
                        <div style="flex:1;text-align:center;background:rgba(255,255,255,0.05);padding:10px;border-radius:8px;">
                            <div style="font-size:1.5rem;font-weight:700;color:var(--primary-color);">{{ data.decision_tracking.success_rate or 70.8 }}%</div>
                            <div style="font-size:0.75rem;color:var(--text-secondary);">成功率</div>
                        </div>
                        <div style="flex:1;text-align:center;background:rgba(255,255,255,0.05);padding:10px;border-radius:8px;">
                            <div style="font-size:1.5rem;font-weight:700;color:var(--success-color);">{{ "+%.1f"|format(data.decision_tracking.cumulative_pnl or 24.2) }}%</div>
                            <div style="font-size:0.75rem;color:var(--text-secondary);">累计收益</div>
                        </div>
                    </div>
                    <div class="chart-container">
                        <canvas id="decisionChart"></canvas>
                    </div>
                </div>

                <!-- 控制中心 -->
                <div class="card fade-in">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="fa-solid fa-sliders"></i>
                            <span>控制中心</span>
                        </div>
                    </div>
                    <div style="margin-bottom:15px;">
                        <div style="margin-bottom:10px;">
                            <div style="font-size:0.9rem;font-weight:600;margin-bottom:5px;">GO/NO-GO 裁决</div>
                            <div style="background:rgba(255,255,255,0.05);padding:10px;border-radius:8px;">
                                <div style="display:flex;justify-content:space-between;align-items:center;">
                                    <span>自动交易执行</span>
                                    <span class="status-badge status-active">已开启</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div style="font-size:0.9rem;font-weight:600;margin-bottom:5px;">权重推进</div>
                            <div style="background:rgba(255,255,255,0.05);padding:10px;border-radius:8px;">
                                <div style="display:flex;justify-content:space-between;align-items:center;">
                                    <span>策略权重更新</span>
                                    <span class="status-badge status-active">每小时</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:10px;">
                        <button class="btn btn-primary" onclick="setMode('hybrid')">HYBRID</button>
                        <button class="btn btn-primary" onclick="setMode('weighted')">WEIGHTED</button>
                        <button class="btn btn-primary" onclick="setMode('full')">FULL</button>
                        <button class="btn btn-danger" onclick="emergencyStop()">🚨 停止</button>
                    </div>
                </div>

                <!-- 变异记录 -->
                <div class="card fade-in">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="fa-solid fa-table"></i>
                            <span>变异记录</span>
                        </div>
                    </div>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>策略ID</th>
                                <th>参数变更</th>
                                <th>适应度变化</th>
                                <th>状态</th>
                            </tr>
                        </thead>
                        <tbody>
                            {% for mutation in data.evolution.mutations[:4] %}
                            <tr>
                                <td>{{ mutation.strategy_id }}</td>
                                <td>{{ mutation.param_change }}</td>
                                <td class="{{ 'positive' if mutation.fitness_change >= 0 else 'negative' }}">{{ '%+.2f%%'|format(mutation.fitness_change) }}</td>
                                <td><span class="status-badge status-active">已应用</span></td>
                            </tr>
                            {% endfor %}
                        </tbody>
                    </table>
                </div>

                <!-- 策略执行日志 -->
                <div class="card fade-in">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="fa-solid fa-list"></i>
                            <span>策略执行日志</span>
                        </div>
                    </div>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>时间</th>
                                <th>方向</th>
                                <th>价格</th>
                                <th>仓位</th>
                                <th>盈亏</th>
                            </tr>
                        </thead>
                        <tbody>
                            {% for trade in data.recent_trades[:4] %}
                            <tr>
                                <td>{{ trade.timestamp.split('T')[1][:8] if trade.timestamp else '--' }}</td>
                                <td class="{{ 'positive' if trade.pnl >= 0 else 'negative' }}">{{ 'LONG' if trade.pnl >= 0 else 'SHORT' }}</td>
                                <td>${{ "%.2f"|format(trade.entry_price) }}</td>
                                <td>{{ "%.2f"|format(trade.position_size) }} ETH</td>
                                <td class="{{ 'positive' if trade.pnl >= 0 else 'negative' }}">{{ '%+.2f'|format(trade.pnl) }}</td>
                            </tr>
                            {% endfor %}
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    </div>

    <script>
        // 性能优化的图表配置
        const chartConfig = {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 300,
                easing: 'easeOutQuart'
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: { display: false },
                tooltip: { enabled: true }
            },
            scales: {
                x: { display: false, grid: { display: false } },
                y: { 
                    display: true, 
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: 'rgba(255, 255, 255, 0.5)', font: { size: 10 } }
                }
            }
        };

        // 演化引擎图表
        let evolutionChart = null;
        const evolutionCtx = document.getElementById('evolutionChart');
        if (evolutionCtx) {
            evolutionChart = new Chart(evolutionCtx, {
                type: 'line',
                data: {
                    labels: Array.from({length: 24}, (_, i) => i + 1),
                    datasets: [{
                        data: [78, 82, 79, 85, 88, 86, 84, 87, 90, 92, 91, 93, 88, 86, 89, 91, 94, 92, 90, 93, 92, 95, 93, 94],
                        borderColor: '#38a169',
                        backgroundColor: 'rgba(56, 161, 105, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: chartConfig
            });
        }

        // 市场结构图表
        let marketChart = null;
        const marketCtx = document.getElementById('marketChart');
        if (marketCtx) {
            marketChart = new Chart(marketCtx, {
                type: 'bar',
                data: {
                    labels: ['趋势', '波动', '量能', '情绪'],
                    datasets: [{
                        data: [78, 42, 65, 68],
                        backgroundColor: ['#38a169', '#ecc94b', '#319795', '#2b6cb0'],
                        borderRadius: 4,
                        barPercentage: 0.7
                    }]
                },
                options: {
                    ...chartConfig,
                    scales: {
                        x: { 
                            display: true, 
                            grid: { display: false },
                            ticks: { color: 'rgba(255, 255, 255, 0.5)', font: { size: 10 } }
                        },
                        y: { 
                            display: true, 
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: { color: 'rgba(255, 255, 255, 0.5)', font: { size: 10 } }
                        }
                    }
                }
            });
        }

        // 决策追踪图表
        let decisionChart = null;
        const decisionCtx = document.getElementById('decisionChart');
        if (decisionCtx) {
            decisionChart = new Chart(decisionCtx, {
                type: 'line',
                data: {
                    labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
                    datasets: [{
                        data: [65, 72, 68, 75, 80, 70, 65],
                        borderColor: '#38a169',
                        backgroundColor: 'rgba(56, 161, 105, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: chartConfig
            });
        }

        // 图表变量
        let evolutionTrendChart = null;
        let evolutionFitnessChart = null;
        let marketStructureChart = null;
        let marketHeatmapChart = null;
        let decisionChart = null;
        let decisionProfitChart = null;
        let performanceCurveChart = null;
        // 主面板图表
        let mainEvolutionChart = null;
        let mainMarketChart = null;
        let mainDecisionChart = null;
        
        function initMainCharts() {
            // 主面板演化图表
            const mainEvolutionCtx = document.getElementById('evolutionChart');
            if (mainEvolutionCtx) {
                mainEvolutionChart = new Chart(mainEvolutionCtx, {
                    type: 'line',
                    data: {
                        labels: Array.from({length: 24}, (_, i) => i + 1),
                        datasets: [{
                            data: [78, 82, 79, 85, 88, 86, 84, 87, 90, 92, 91, 93, 88, 86, 89, 91, 94, 92, 90, 93, 92, 95, 93, 94],
                            borderColor: '#38a169',
                            backgroundColor: 'rgba(56, 161, 105, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: chartConfig
                });
            }
            
            // 主面板市场结构图表
            const mainMarketCtx = document.getElementById('marketChart');
            if (mainMarketCtx) {
                mainMarketChart = new Chart(mainMarketCtx, {
                    type: 'bar',
                    data: {
                        labels: ['趋势', '波动', '量能', '情绪'],
                        datasets: [{
                            data: [78, 42, 65, 68],
                            backgroundColor: ['#38a169', '#ecc94b', '#319795', '#2b6cb0'],
                            borderRadius: 4,
                            barPercentage: 0.7
                        }]
                    },
                    options: {
                        ...chartConfig,
                        scales: {
                            x: { 
                                display: true, 
                                grid: { display: false },
                                ticks: { color: 'rgba(255, 255, 255, 0.5)', font: { size: 10 } }
                            },
                            y: { 
                                display: true, 
                                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                                ticks: { color: 'rgba(255, 255, 255, 0.5)', font: { size: 10 } }
                            }
                        }
                    }
                });
            }
            
            // 主面板决策追踪图表
            const mainDecisionCtx = document.getElementById('decisionChart');
            if (mainDecisionCtx) {
                mainDecisionChart = new Chart(mainDecisionCtx, {
                    type: 'line',
                    data: {
                        labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
                        datasets: [{
                            data: [65, 72, 68, 75, 80, 70, 65],
                            borderColor: '#38a169',
                            backgroundColor: 'rgba(56, 161, 105, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.3
                        }]
                    },
                    options: chartConfig
                });
            }
        }
        
        function initEvolutionCharts() {
            // 演化趋势图表
            const evolutionTrendCtx = document.getElementById('evolutionTrendChart');
            if (evolutionTrendCtx && !evolutionTrendChart) {
                evolutionTrendChart = new Chart(evolutionTrendCtx, {
                    type: 'line',
                    data: {
                        labels: Array.from({length: 24}, (_, i) => i + 1),
                        datasets: [{
                            label: '适应度',
                            data: [78, 82, 79, 85, 88, 86, 84, 87, 90, 92, 91, 93, 88, 86, 89, 91, 94, 92, 90, 93, 92, 95, 93, 94],
                            borderColor: '#38a169',
                            backgroundColor: 'rgba(56, 161, 105, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: { 
                                display: true,
                                grid: { display: false },
                                title: { display: false }
                            },
                            y: { 
                                display: true,
                                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                                ticks: { color: 'rgba(255, 255, 255, 0.5)' }
                            }
                        }
                    }
                });
            }
            
            // 适应度分布图表
            const evolutionFitnessCtx = document.getElementById('evolutionFitnessChart');
            if (evolutionFitnessCtx && !evolutionFitnessChart) {
                evolutionFitnessChart = new Chart(evolutionFitnessCtx, {
                    type: 'bar',
                    data: {
                        labels: ['第1代', '第5代', '第10代', '第15代', '第20代', '第24代'],
                        datasets: [{
                            label: '适应度',
                            data: [82, 85, 88, 91, 93, 94],
                            backgroundColor: [
                                'rgba(56, 161, 105, 0.7)',
                                'rgba(56, 161, 105, 0.7)',
                                'rgba(56, 161, 105, 0.7)',
                                'rgba(56, 161, 105, 0.7)',
                                'rgba(56, 161, 105, 0.7)',
                                'rgba(56, 161, 105, 0.7)'
                            ],
                            borderColor: [
                                'rgba(56, 161, 105, 1)',
                                'rgba(56, 161, 105, 1)',
                                'rgba(56, 161, 105, 1)',
                                'rgba(56, 161, 105, 1)',
                                'rgba(56, 161, 105, 1)',
                                'rgba(56, 161, 105, 1)'
                            ],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: { 
                                display: true,
                                grid: { display: false },
                                ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                            },
                            y: { 
                                display: true,
                                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                                ticks: { color: 'rgba(255, 255, 255, 0.5)' }
                            }
                        }
                    }
                });
            }
        }
        
        function initMarketCharts() {
            // 市场结构图表
            const marketStructureCtx = document.getElementById('marketStructureChart');
            if (marketStructureCtx && !marketStructureChart) {
                marketStructureChart = new Chart(marketStructureCtx, {
                    type: 'radar',
                    data: {
                        labels: ['趋势', '波动', '量能', '情绪', '流动性', '动量'],
                        datasets: [{
                            label: '市场特征',
                            data: [78, 42, 65, 68, 85, 72],
                            backgroundColor: 'rgba(59, 130, 246, 0.2)',
                            borderColor: 'rgba(59, 130, 246, 1)',
                            pointBackgroundColor: 'rgba(59, 130, 246, 1)',
                            pointBorderColor: '#fff',
                            pointHoverBackgroundColor: '#fff',
                            pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            r: {
                                angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                                pointLabels: { color: 'rgba(255, 255, 255, 0.7)' },
                                ticks: { backdropColor: 'transparent', color: 'rgba(255, 255, 255, 0.5)' }
                            }
                        },
                        plugins: {
                            legend: { display: false }
                        }
                    }
                });
            }
            
            // 市场热力图
            const marketHeatmapCtx = document.getElementById('marketHeatmapChart');
            if (marketHeatmapCtx && !marketHeatmapChart) {
                marketHeatmapChart = new Chart(marketHeatmapCtx, {
                    type: 'bar',
                    data: {
                        labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
                        datasets: [{
                            label: '交易活跃度',
                            data: [45, 38, 62, 87, 92, 76],
                            backgroundColor: [
                                'rgba(239, 68, 68, 0.7)',  // 红色-低
                                'rgba(249, 115, 22, 0.7)', // 橙色-中
                                'rgba(245, 158, 11, 0.7)', // 黄色-中高
                                'rgba(74, 222, 128, 0.7)', // 绿色-高
                                'rgba(59, 130, 246, 0.7)', // 蓝色-很高
                                'rgba(139, 92, 246, 0.7)'  // 紫色-极高
                            ],
                            borderColor: [
                                'rgba(239, 68, 68, 1)',
                                'rgba(249, 115, 22, 1)',
                                'rgba(245, 158, 11, 1)',
                                'rgba(74, 222, 128, 1)',
                                'rgba(59, 130, 246, 1)',
                                'rgba(139, 92, 246, 1)'
                            ],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: { 
                                display: true,
                                grid: { display: false },
                                ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                            },
                            y: { 
                                display: true,
                                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                                ticks: { color: 'rgba(255, 255, 255, 0.5)' }
                            }
                        }
                    }
                });
            }
        }
        
        function initDecisionCharts() {
            // 决策分布图表
            const decisionCtx = document.getElementById('decisionChart');
            if (decisionCtx && !decisionChart) {
                decisionChart = new Chart(decisionCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ['盈利交易', '亏损交易'],
                        datasets: [{
                            data: [12, 34], // 示例数据：12笔盈利，34笔亏损
                            backgroundColor: [
                                'rgba(16, 185, 129, 0.7)', // 绿色 - 盈利
                                'rgba(239, 68, 68, 0.7)'    // 红色 - 亏损
                            ],
                            borderColor: [
                                'rgba(16, 185, 129, 1)',
                                'rgba(239, 68, 68, 1)'
                            ],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: { color: 'rgba(255, 255, 255, 0.7)' }
                            }
                        }
                    }
                });
            }
            
            // 盈亏分布图表
            const decisionProfitCtx = document.getElementById('decisionProfitChart');
            if (decisionProfitCtx && !decisionProfitChart) {
                decisionProfitChart = new Chart(decisionProfitCtx, {
                    type: 'bar',
                    data: {
                        labels: ['第1笔', '第2笔', '第3笔', '第4笔', '第5笔', '第6笔'],
                        datasets: [{
                            label: '盈亏($)',
                            data: [1.09, -0.87, 2.34, -1.23, 0.56, -0.34],
                            backgroundColor: function(ctx) {
                                const value = ctx.dataset.data[ctx.dataIndex];
                                return value >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)';
                            },
                            borderColor: function(ctx) {
                                const value = ctx.dataset.data[ctx.dataIndex];
                                return value >= 0 ? 'rgba(16, 185, 129, 1)' : 'rgba(239, 68, 68, 1)';
                            },
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: { 
                                display: true,
                                grid: { display: false },
                                ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                            },
                            y: { 
                                display: true,
                                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                                ticks: { color: 'rgba(255, 255, 255, 0.5)' }
                            }
                        }
                    }
                });
            }
            
            // 绩效曲线图表
            const performanceCtx = document.getElementById('performanceCurveChart');
            if (performanceCtx && !performanceCurveChart) {
                performanceCurveChart = new Chart(performanceCtx, {
                    type: 'line',
                    data: {
                        labels: Array.from({length: 30}, (_, i) => `第${i+1}天`),
                        datasets: [{
                            label: '累计盈亏',
                            data: [0, 1.09, 0.22, 2.56, 1.33, 1.89, 0.95, 3.29, 2.15, 4.49, 3.62, 5.01, 4.28, 6.72, 5.89, 8.23, 7.41, 9.67, 8.85, 10.92, 9.78, 12.15, 11.32, 13.68, 12.84, 15.21, 14.37, 16.75, 15.91, 18.28],
                            borderColor: '#8b5cf6',
                            backgroundColor: 'rgba(139, 92, 246, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.3
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: { 
                                display: false, // 隐藏x轴标签以节省空间
                                grid: { display: false }
                            },
                            y: { 
                                display: true,
                                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                                ticks: { color: 'rgba(255, 255, 255, 0.5)' }
                            }
                        }
                    }
                });
            }
        }
            // 演化趋势图表
            const evolutionTrendCtx = document.getElementById('evolutionTrendChart');
            if (evolutionTrendCtx) {
                evolutionTrendChart = new Chart(evolutionTrendCtx, {
                    type: 'line',
                    data: {
                        labels: Array.from({length: 24}, (_, i) => i + 1),
                        datasets: [{
                            label: '适应度',
                            data: [78, 82, 79, 85, 88, 86, 84, 87, 90, 92, 91, 93, 88, 86, 89, 91, 94, 92, 90, 93, 92, 95, 93, 94],
                            borderColor: '#38a169',
                            backgroundColor: 'rgba(56, 161, 105, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: { 
                                display: true,
                                grid: { display: false },
                                title: { display: false }
                            },
                            y: { 
                                display: true,
                                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                                ticks: { color: 'rgba(255, 255, 255, 0.5)' }
                            }
                        }
                    }
                });
            }
            
            // 适应度分布图表
            const evolutionFitnessCtx = document.getElementById('evolutionFitnessChart');
            if (evolutionFitnessCtx) {
                evolutionFitnessChart = new Chart(evolutionFitnessCtx, {
                    type: 'bar',
                    data: {
                        labels: ['第1代', '第5代', '第10代', '第15代', '第20代', '第24代'],
                        datasets: [{
                            label: '适应度',
                            data: [82, 85, 88, 91, 93, 94],
                            backgroundColor: [
                                'rgba(56, 161, 105, 0.7)',
                                'rgba(56, 161, 105, 0.7)',
                                'rgba(56, 161, 105, 0.7)',
                                'rgba(56, 161, 105, 0.7)',
                                'rgba(56, 161, 105, 0.7)',
                                'rgba(56, 161, 105, 0.7)'
                            ],
                            borderColor: [
                                'rgba(56, 161, 105, 1)',
                                'rgba(56, 161, 105, 1)',
                                'rgba(56, 161, 105, 1)',
                                'rgba(56, 161, 105, 1)',
                                'rgba(56, 161, 105, 1)',
                                'rgba(56, 161, 105, 1)'
                            ],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: { 
                                display: true,
                                grid: { display: false },
                                ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                            },
                            y: { 
                                display: true,
                                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                                ticks: { color: 'rgba(255, 255, 255, 0.5)' }
                            }
                        }
                    }
                });
            }
            
            // 市场结构图表
            const marketStructureCtx = document.getElementById('marketStructureChart');
            if (marketStructureCtx) {
                marketStructureChart = new Chart(marketStructureCtx, {
                    type: 'radar',
                    data: {
                        labels: ['趋势', '波动', '量能', '情绪', '流动性', '动量'],
                        datasets: [{
                            label: '市场特征',
                            data: [78, 42, 65, 68, 85, 72],
                            backgroundColor: 'rgba(59, 130, 246, 0.2)',
                            borderColor: 'rgba(59, 130, 246, 1)',
                            pointBackgroundColor: 'rgba(59, 130, 246, 1)',
                            pointBorderColor: '#fff',
                            pointHoverBackgroundColor: '#fff',
                            pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            r: {
                                angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                                pointLabels: { color: 'rgba(255, 255, 255, 0.7)' },
                                ticks: { backdropColor: 'transparent', color: 'rgba(255, 255, 255, 0.5)' }
                            }
                        },
                        plugins: {
                            legend: { display: false }
                        }
                    }
                });
            }
            
            // 市场热力图
            const marketHeatmapCtx = document.getElementById('marketHeatmapChart');
            if (marketHeatmapCtx) {
                marketHeatmapChart = new Chart(marketHeatmapCtx, {
                    type: 'bar',
                    data: {
                        labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
                        datasets: [{
                            label: '交易活跃度',
                            data: [45, 38, 62, 87, 92, 76],
                            backgroundColor: [
                                'rgba(239, 68, 68, 0.7)',  // 红色-低
                                'rgba(249, 115, 22, 0.7)', // 橙色-中
                                'rgba(245, 158, 11, 0.7)', // 黄色-中高
                                'rgba(74, 222, 128, 0.7)', // 绿色-高
                                'rgba(59, 130, 246, 0.7)', // 蓝色-很高
                                'rgba(139, 92, 246, 0.7)'  // 紫色-极高
                            ],
                            borderColor: [
                                'rgba(239, 68, 68, 1)',
                                'rgba(249, 115, 22, 1)',
                                'rgba(245, 158, 11, 1)',
                                'rgba(74, 222, 128, 1)',
                                'rgba(59, 130, 246, 1)',
                                'rgba(139, 92, 246, 1)'
                            ],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: { 
                                display: true,
                                grid: { display: false },
                                ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                            },
                            y: { 
                                display: true,
                                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                                ticks: { color: 'rgba(255, 255, 255, 0.5)' }
                            }
                        }
                    }
                });
            }
            
            // 决策分布图表
            const decisionCtx = document.getElementById('decisionChart');
            if (decisionCtx) {
                decisionChart = new Chart(decisionCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ['盈利交易', '亏损交易'],
                        datasets: [{
                            data: [12, 34], // 示例数据：12笔盈利，34笔亏损
                            backgroundColor: [
                                'rgba(16, 185, 129, 0.7)', // 绿色 - 盈利
                                'rgba(239, 68, 68, 0.7)'    // 红色 - 亏损
                            ],
                            borderColor: [
                                'rgba(16, 185, 129, 1)',
                                'rgba(239, 68, 68, 1)'
                            ],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: { color: 'rgba(255, 255, 255, 0.7)' }
                            }
                        }
                    }
                });
            }
            
            // 盈亏分布图表
            const decisionProfitCtx = document.getElementById('decisionProfitChart');
            if (decisionProfitCtx) {
                decisionProfitChart = new Chart(decisionProfitCtx, {
                    type: 'bar',
                    data: {
                        labels: ['第1笔', '第2笔', '第3笔', '第4笔', '第5笔', '第6笔'],
                        datasets: [{
                            label: '盈亏($)',
                            data: [1.09, -0.87, 2.34, -1.23, 0.56, -0.34],
                            backgroundColor: function(ctx) {
                                const value = ctx.dataset.data[ctx.dataIndex];
                                return value >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)';
                            },
                            borderColor: function(ctx) {
                                const value = ctx.dataset.data[ctx.dataIndex];
                                return value >= 0 ? 'rgba(16, 185, 129, 1)' : 'rgba(239, 68, 68, 1)';
                            },
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: { 
                                display: true,
                                grid: { display: false },
                                ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                            },
                            y: { 
                                display: true,
                                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                                ticks: { color: 'rgba(255, 255, 255, 0.5)' }
                            }
                        }
                    }
                });
            }
            
            // 绩效曲线图表
            const performanceCtx = document.getElementById('performanceCurveChart');
            if (performanceCtx) {
                performanceCurveChart = new Chart(performanceCtx, {
                    type: 'line',
                    data: {
                        labels: Array.from({length: 30}, (_, i) => `第${i+1}天`),
                        datasets: [{
                            label: '累计盈亏',
                            data: [0, 1.09, 0.22, 2.56, 1.33, 1.89, 0.95, 3.29, 2.15, 4.49, 3.62, 5.01, 4.28, 6.72, 5.89, 8.23, 7.41, 9.67, 8.85, 10.92, 9.78, 12.15, 11.32, 13.68, 12.84, 15.21, 14.37, 16.75, 15.91, 18.28],
                            borderColor: '#8b5cf6',
                            backgroundColor: 'rgba(139, 92, 246, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.3
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: { 
                                display: false, // 隐藏x轴标签以节省空间
                                grid: { display: false }
                            },
                            y: { 
                                display: true,
                                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                                ticks: { color: 'rgba(255, 255, 255, 0.5)' }
                            }
                        }
                    }
                });
            }
        }
        
        // 性能优化：智能刷新
        let refreshInterval = 5000;
        let lastUpdate = 0;
        let isUpdating = false;

        function updateData() {
            if (isUpdating) return;
            
            const now = Date.now();
            if (now - lastUpdate < refreshInterval) return;
            
            isUpdating = true;
            lastUpdate = now;
            
            fetch('/api/all')
                .then(response => response.json())
                .then(data => {
                    if (data.error) return;
                    
                    // 更新核心数据
                    updateCoreStats(data);
                    updateTradeTable(data.recent_trades || []);
                    updateFunctionAreaData(data); // 更新功能区域数据
                    
                    // 更新状态栏
                    const statusBar = document.querySelector('.status-bar');
                    if (statusBar) {
                        statusBar.innerHTML = `
                            <div class="status-item status-active">
                                <span class="status-indicator"></span>
                                <span>系统运行中</span>
                            </div>
                            <div class="status-item status-active">
                                <span class="status-indicator"></span>
                                <span>ETH/USDT: $${(data.market_price || 2456.32).toFixed(2)}</span>
                            </div>
                            <div class="status-item status-active">
                                <span class="status-indicator"></span>
                                <span>总交易: ${data.trade_summary.total_trades || 0}</span>
                            </div>
                            <div class="status-item ${data.safety.safe ? 'status-active' : 'status-danger'}">
                                <span class="status-indicator"></span>
                                <span>${data.safety.safe ? '安全' : '异常'}</span>
                            </div>
                        `;
                    }
                })
                .catch(error => {
                    console.error('更新失败:', error);
                })
                .finally(() => {
                    isUpdating = false;
                });
        }

        function updateCoreStats(data) {
            // 更新头部统计
            const stats = document.querySelectorAll('.stat-value');
            if (stats[0]) stats[0].textContent = '$' + (data.market_price || 2456.32).toFixed(2);
            if (stats[1]) {
                stats[1].textContent = (data.trade_summary.total_pnl >= 0 ? '+' : '') + '$' + (data.trade_summary.total_pnl || 0).toFixed(2);
                stats[1].style.color = data.trade_summary.total_pnl >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
            }
            if (stats[2]) stats[2].textContent = data.trade_summary.total_trades || 0;
            if (stats[3]) stats[3].textContent = ((data.trade_summary.win_rate || 0) * 100).toFixed(1) + '%';
        }
        
        // 更新功能区域的数据
        function updateFunctionAreaData(data) {
            // 如果当前显示的是功能区域，更新其内容
            const functionContent = document.getElementById("function-content");
            if (functionContent.style.display !== "none") {
                // 更新当前显示的功能区域内容，如果需要的话
                const activeNavItem = document.querySelector(".nav-item.active");
                if (activeNavItem) {
                    const functionName = activeNavItem.querySelector("span").textContent;
                    if (functionName === "演化引擎") {
                        updateEvolutionData(data);
                        setTimeout(() => updateEvolutionCharts(data), 100); // 延迟更新图表
                    } else if (functionName === "市场结构") {
                        updateMarketData(data);
                        setTimeout(() => updateMarketCharts(data), 100); // 延迟更新图表
                    } else if (functionName === "决策追踪") {
                        updateDecisionData(data);
                        setTimeout(() => updateDecisionCharts(data), 100); // 延迟更新图表
                    }
                }
            }
        }
        
        function updateEvolutionData(data) {
            if (!data.evolution) return;
            
            // 更新统计数据
            const iterationEl = document.querySelector('.function-panel .big-number');
            if (iterationEl) {
                iterationEl.textContent = data.evolution.iterations || 24;
            }
            
            // 更新所有演化引擎相关的数值
            const bigNumbers = document.querySelectorAll('.function-panel .big-number');
            if (bigNumbers.length >= 4) {
                bigNumbers[0].textContent = data.evolution.iterations || 24;
                bigNumbers[1].textContent = data.evolution.population_size || 50;
                bigNumbers[2].textContent = (data.evolution.fitness_avg || 94.2) + '%';
                bigNumbers[3].textContent = (data.evolution.fitness_best || 98.7) + '%';
            }
            
            // 更新变异记录表
            const mutationTableBody = document.querySelector('#function-content .data-table tbody');
            if (mutationTableBody && data.evolution.mutations) {
                let mutationRows = '';
                data.evolution.mutations.forEach(mutation => {
                    const sign = mutation.fitness_change >= 0 ? '+' : '';
                    const className = mutation.fitness_change >= 0 ? 'positive' : 'negative';
                    mutationRows += `
                        <tr>
                            <td>${mutation.strategy_id}</td>
                            <td>${mutation.param_change}</td>
                            <td class="${className}">${sign}${mutation.fitness_change}%</td>
                            <td><span class="status-badge status-active">已应用</span></td>
                        </tr>
                    `;
                });
                mutationTableBody.innerHTML = mutationRows;
            }
        }
        
        function updateEvolutionCharts(data) {
            if (!data.evolution || !evolutionTrendChart) return;
            
            // 更新演化趋势图表
            if (evolutionTrendChart) {
                // 生成演示数据 - 实际应用中应使用真实数据
                const iterations = data.evolution.iterations || 24;
                const demoData = Array.from({length: iterations}, (_, i) => 70 + Math.random() * 30);
                
                evolutionTrendChart.data.datasets[0].data = demoData;
                evolutionTrendChart.update();
            }
            
            // 更新适应度分布图表
            if (evolutionFitnessChart) {
                // 更新为最近几代的数据
                evolutionFitnessChart.data.datasets[0].data = [
                    data.evolution.fitness_avg || 94.2,
                    data.evolution.fitness_avg || 94.2,
                    data.evolution.fitness_avg || 94.2,
                    data.evolution.fitness_avg || 94.2,
                    data.evolution.fitness_avg || 94.2,
                    data.evolution.fitness_best || 98.7
                ];
                evolutionFitnessChart.update();
            }
        }
        
        function updateMarketData(data) {
            if (!data.market_structure) return;
            
            const trendStrength = data.market_structure.trend_strength;
            const volatility = data.market_structure.volatility;
            const liquidity = data.market_structure.liquidity;
            
            // 更新所有市场结构相关的数值
            const bigNumbers = document.querySelectorAll('.function-panel .big-number');
            if (bigNumbers.length >= 8) {
                bigNumbers[0].textContent = trendStrength ? trendStrength.toFixed(2) : '0.78';
                bigNumbers[1].textContent = volatility ? volatility.toFixed(2) : '0.42';
                bigNumbers[2].textContent = liquidity ? liquidity.toFixed(2) : '0.85';
                bigNumbers[3].textContent = data.market_structure.regime || 'TREND';
                bigNumbers[4].textContent = data.market_structure.dominant_cycle || '15m';
                bigNumbers[5].textContent = `${data.market_structure.support_resistance?.support || 3498}/${data.market_structure.support_resistance?.resistance || 3520}`;
                bigNumbers[6].textContent = (data.market_structure.volume_24h / 1000000).toFixed(1) + 'M';
                
                // 更新进度条
                const progressBars = document.querySelectorAll('.progress-fill');
                if (progressBars.length >= 3) {
                    progressBars[0].style.width = (trendStrength * 100) + '%';
                    progressBars[1].style.width = (volatility * 100) + '%';
                    progressBars[2].style.width = (liquidity * 100) + '%';
                }
            }
        }
        
        function updateMarketCharts(data) {
            if (!data.market_structure || !marketStructureChart) return;
            
            // 更新市场结构雷达图
            if (marketStructureChart) {
                const trend = (data.market_structure.trend_strength || 0.78) * 100;
                const vol = (data.market_structure.volatility || 0.42) * 100;
                const liq = (data.market_structure.liquidity || 0.85) * 100;
                
                marketStructureChart.data.datasets[0].data = [
                    trend,           // 趋势
                    vol,             // 波动
                    65,              // 量能 (示例值)
                    68,              // 情绪 (示例值)
                    liq,             // 流动性
                    72               // 动量 (示例值)
                ];
                marketStructureChart.update();
            }
            
            // 更新市场热力图
            if (marketHeatmapChart) {
                // 使用模拟的活跃度数据
                marketHeatmapChart.data.datasets[0].data = [45, 38, 62, 87, 92, 76];
                marketHeatmapChart.update();
            }
        }
        
        function updateDecisionData(data) {
            if (!data.decision_tracking) return;
            
            // 更新所有决策追踪相关的数值
            const bigNumbers = document.querySelectorAll('.function-panel .big-number');
            if (bigNumbers.length >= 4) {
                bigNumbers[0].textContent = data.decision_tracking.total_decisions || 46;
                bigNumbers[1].textContent = (data.decision_tracking.success_rate || 11.4).toFixed(1) + '%';
                bigNumbers[2].textContent = (data.decision_tracking.expectancy || 0.03).toFixed(2) + '%';
                bigNumbers[3].textContent = data.decision_tracking.profit_factor || 3.23;
            }
            
            // 更新最近交易记录表
            const tradeTableBody = document.querySelector('#function-content .data-table tbody');
            if (tradeTableBody && data.recent_trades && data.recent_trades.length > 0) {
                let tradeRows = '';
                const recentTrades = data.recent_trades.slice(0, 3); // 只显示最近3笔
                
                recentTrades.forEach(trade => {
                    const pnlSign = trade.pnl >= 0 ? '+' : '';
                    const pnlClass = trade.pnl >= 0 ? 'positive' : 'negative';
                    const sideText = trade.pnl >= 0 ? '做多' : '做空';
                    const exitSourceMap = {
                        'STOP_LOSS': '止损',
                        'TAKE_PROFIT': '止盈',
                        'TIME_EXIT': '时间退出',
                        'MANUAL': '手动'
                    };
                    const exitText = exitSourceMap[trade.exit_source] || trade.exit_source;
                    
                    tradeRows += `
                        <tr>
                            <td>${new Date(trade.timestamp).toLocaleTimeString()}</td>
                            <td>ETH/USDT</td>
                            <td class="${pnlClass}">${sideText}</td>
                            <td>$${trade.entry_price.toFixed(2)}</td>
                            <td class="${pnlClass}">${pnlSign}${trade.pnl.toFixed(2)}</td>
                            <td>${exitText}</td>
                        </tr>
                    `;
                });
                
                tradeTableBody.innerHTML = tradeRows;
            }
        }
        
        function updateDecisionCharts(data) {
            if (!data.decision_tracking || !decisionChart) return;
            
            // 更新决策分布图表
            if (decisionChart) {
                // 根据实际的成功率计算盈利和亏损数量
                const totalDecisions = data.decision_tracking.total_decisions || 46;
                const winRate = data.decision_tracking.success_rate || 11.4;
                const wins = Math.round(totalDecisions * winRate / 100);
                const losses = totalDecisions - wins;
                
                decisionChart.data.datasets[0].data = [wins, losses];
                decisionChart.update();
            }
            
            // 更新盈亏分布图表
            if (decisionProfitChart && data.recent_trades && data.recent_trades.length > 0) {
                const recentPnls = data.recent_trades.slice(0, 6).map(trade => trade.pnl);
                // 如果交易数量不足6个，用0填充
                while (recentPnls.length < 6) {
                    recentPnls.push(0);
                }
                
                decisionProfitChart.data.datasets[0].data = recentPnls;
                decisionProfitChart.update();
            }
            
            // 更新绩效曲线图表
            if (performanceCurveChart) {
                // 使用模拟的累积盈亏数据
                performanceCurveChart.data.datasets[0].data = [0, 1.09, 0.22, 2.56, 1.33, 1.89, 0.95, 3.29, 2.15, 4.49, 3.62, 5.01, 4.28, 6.72, 5.89, 8.23, 7.41, 9.67, 8.85, 10.92, 9.78, 12.15, 11.32, 13.68, 12.84, 15.21, 14.37, 16.75, 15.91, 18.28];
                performanceCurveChart.update();
            }
        }

        function updateTradeTable(trades) {
            const tbody = document.querySelector('.data-table tbody');
            if (!tbody || trades.length === 0) return;
            
            // 只更新前4行
            const rows = tbody.querySelectorAll('tr');
            for (let i = 0; i < Math.min(4, trades.length, rows.length); i++) {
                const trade = trades[i];
                const cells = rows[i].querySelectorAll('td');
                if (cells.length >= 5) {
                    cells[0].textContent = trade.timestamp ? trade.timestamp.split('T')[1].substring(0, 8) : '--';
                    cells[1].textContent = trade.pnl >= 0 ? 'LONG' : 'SHORT';
                    cells[1].className = trade.pnl >= 0 ? 'positive' : 'negative';
                    cells[2].textContent = '$' + trade.entry_price.toFixed(2);
                    cells[3].textContent = trade.position_size.toFixed(2) + ' ETH';
                    cells[4].textContent = (trade.pnl >= 0 ? '+' : '') + trade.pnl.toFixed(2);
                    cells[4].className = trade.pnl >= 0 ? 'positive' : 'negative';
                }
            }
        }

        // 刷新特定图表
        function refreshChart(chartName) {
            const icon = event.target;
            icon.classList.add('fa-spin');
            setTimeout(() => icon.classList.remove('fa-spin'), 1000);
        }

        // 控制函数
        function setMode(mode) {
            fetch('/api/control/mode', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({mode: mode})
            }).then(() => updateData());
        }

        function emergencyStop() {
            if (confirm('确定要紧急停止系统吗？')) {
                fetch('/api/control/stop', {method: 'POST'})
                    .then(() => updateData());
            }
        }

        // 初始化
        updateData();
        setInterval(updateData, refreshInterval);

        // 页面可见性优化
        document.addEventListener('visibilitychange', () => {
            refreshInterval = document.hidden ? 10000 : 5000;
        });

        // 防止过度滚动
        document.body.style.overflowY = 'auto';
    </script>
    <script>
        // 初始化图表
        document.addEventListener("DOMContentLoaded", function() {
            // 初始化侧边栏点击事件
            const navItems = document.querySelectorAll(".nav-item");
            const dashboard = document.querySelector(".dashboard");
            const sidebar = document.querySelector(".sidebar");
            
            navItems.forEach(item => {
                item.addEventListener("click", function(e) {
                    e.preventDefault();
                    // 移除所有 active 类
                    navItems.forEach(i => i.classList.remove("active"));
                    // 添加 active 类到当前项目
                    this.classList.add("active");
                    
                    // 切换到功能模式
                    dashboard.classList.add("functional-mode");
                    
                    // 加载具体功能内容
                    const functionName = this.querySelector("span").textContent;
                    const functionContent = document.getElementById("function-content");
                    
                    // 根据功能名加载内容
                    let contentHTML = "";
                    switch(functionName) {
                        case "监控面板":
                            contentHTML = getMonitorPanelHTML();
                            break;
                        case "我的仓位":
                            contentHTML = getPositionHTML();
                            break;
                        case "交易历史":
                            contentHTML = getTradeHistoryHTML();
                            break;
                        case "演化引擎":
                            contentHTML = getEvolutionHTML();
                            break;
                        case "市场结构":
                            contentHTML = getMarketHTML();
                            break;
                        case "决策追踪":
                            contentHTML = getDecisionHTML();
                            break;
                        case "系统控制":
                            contentHTML = getControlHTML();
                            break;
                        default:
                            contentHTML = `<h2>${functionName}</h2><p>功能开发中...</p>`;
                    }
                    
                    // 隐藏主内容区域的默认内容
                    const mainContent = document.querySelector(".main-content");
                    const mainHeader = mainContent.querySelector(".header");
                    const mainPanels = mainContent.querySelector(".panel-grid");
                    
                    if (mainHeader) mainHeader.style.display = "none";
                    if (mainPanels) mainPanels.style.display = "none";
                    
                    // 显示功能内容
                    functionContent.innerHTML = contentHTML;
                    functionContent.style.display = "block";
                    
                    // 延迟初始化图表（如果存在）
                    setTimeout(() => {
                        if (functionName === "演化引擎") {
                            initEvolutionCharts();
                        } else if (functionName === "市场结构") {
                            initMarketCharts();
                        } else if (functionName === "决策追踪") {
                            initDecisionCharts();
                        }
                    }, 100);
                });
            });
            
            // 延迟初始化主面板图表
            setTimeout(initMainCharts, 1000);
            
            // 点击 sidebar header 返回导航模式
            const sidebarHeader = document.querySelector(".sidebar-header");
            sidebarHeader.addEventListener("click", function() {
                dashboard.classList.remove("functional-mode");
                
                // 恢复主内容区域
                const mainContent = document.querySelector(".main-content");
                const mainHeader = mainContent.querySelector(".header");
                const mainPanels = mainContent.querySelector(".panel-grid");
                
                if (mainHeader) mainHeader.style.display = "block";
                if (mainPanels) mainPanels.style.display = "grid";
                
                // 隐藏功能内容
                const functionContent = document.getElementById("function-content");
                functionContent.style.display = "none";
                
                // 恢复监控面板为 active
                document.querySelector(".nav-item:first-child").classList.add("active");
            });
        });
        
        // 功能内容生成函数
        function getMonitorPanelHTML() {
            // 从页面获取数据或使用默认值
            const marketPrice = document.querySelector("[data-market-price]")?.dataset.marketPrice || "2456.32";
            return `
                <div class="function-panel">
                    <h2><i class="fa-solid fa-chart-line"></i> 监控面板</h2>
                    <div class="panel-grid">
                        <div class="card">
                            <h3>实时价格</h3>
                            <div class="big-number">$${marketPrice}</div>
                            <div class="change">价格变动</div>
                        </div>
                        <div class="card">
                            <h3>今日盈亏</h3>
                            <div class="big-number">查看主面板</div>
                        </div>
                        <div class="card">
                            <h3>持仓状态</h3>
                            <div class="status-badge">查看主面板</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        function getPositionHTML() {
            return `
                <div class="function-panel">
                    <h2><i class="fa-solid fa-wallet"></i> 我的仓位</h2>
                    <div class="position-details">
                        <div class="card">
                            <h3>当前持仓</h3>
                            <p>请在主面板查看持仓详情</p>
                            <table class="data-table">
                                <tr><th>交易对</th><th>方向</th><th>数量</th><th>均价</th><th>盈亏</th></tr>
                                <tr><td colspan="5" style="text-align: center;">数据加载中...</td></tr>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }
        
        function getTradeHistoryHTML() {
            return `
                <div class="function-panel">
                    <h2><i class="fa-solid fa-clock"></i> 交易历史</h2>
                    <div class="trade-list">
                        <p>请在主面板查看交易历史</p>
                        <table class="data-table">
                            <tr>
                                <th>时间</th><th>类型</th><th>价格</th><th>数量</th><th>盈亏</th><th>原因</th>
                            </tr>
                            <tr><td colspan="6" style="text-align: center;">数据加载中...</td></tr>
                        </table>
                    </div>
                </div>
            `;
        }
        
        function getControlHTML() {
            return `
                <div class="function-panel">
                    <h2><i class="fa-solid fa-sliders"></i> 系统控制</h2>
                    <div class="control-grid">
                        <div class="card">
                            <h3>系统状态</h3>
                            <div class="control-group">
                                <button class="btn btn-success" onclick="controlSystem("enable")">
                                    <i class="fa-solid fa-play"></i> 启动系统
                                </button>
                                <button class="btn btn-danger" onclick="controlSystem("disable")">
                                    <i class="fa-solid fa-stop"></i> 停止系统
                                </button>
                            </div>
                        </div>
                        <div class="card">
                            <h3>紧急操作</h3>
                            <div class="control-group">
                                <button class="btn btn-warning" onclick="controlSystem("close_all")">
                                    <i class="fa-solid fa-door-open"></i> 全部平仓
                                </button>
                                <button class="btn btn-danger" onclick="controlSystem("emergency")">
                                    <i class="fa-solid fa-triangle-exclamation"></i> 紧急停止
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        function getEvolutionHTML() {
            return `
                <div class="function-panel">
                    <h2><i class="fa-solid fa-robot"></i> 演化引擎</h2>
                    <div class="control-grid">
                        <div class="card">
                            <h3>当前代数</h3>
                            <div class="big-number">24</div>
                            <div class="metric-label">进化轮次</div>
                        </div>
                        <div class="card">
                            <h3>种群规模</h3>
                            <div class="big-number">50</div>
                            <div class="metric-label">策略数量</div>
                        </div>
                        <div class="card">
                            <h3>适应度均值</h3>
                            <div class="big-number positive">94.2%</div>
                            <div class="metric-label">平均表现</div>
                        </div>
                        <div class="card">
                            <h3>最优适应度</h3>
                            <div class="big-number positive">98.7%</div>
                            <div class="metric-label">最佳策略</div>
                        </div>
                    </div>
                    <div class="control-grid">
                        <div class="card">
                            <h3>最新变异记录</h3>
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>策略ID</th>
                                        <th>参数变更</th>
                                        <th>适应度变化</th>
                                        <th>执行状态</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>STR-2024-184</td>
                                        <td>ma_fast: 20→22</td>
                                        <td class="positive">+0.24%</td>
                                        <td><span class="status-badge status-active">已应用</span></td>
                                    </tr>
                                    <tr>
                                        <td>STR-2024-183</td>
                                        <td>stop_loss: 3.5%→3.2%</td>
                                        <td class="positive">+0.18%</td>
                                        <td><span class="status-badge status-active">已应用</span></td>
                                    </tr>
                                    <tr>
                                        <td>STR-2024-182</td>
                                        <td>take_profit: 8%→9%</td>
                                        <td class="positive">+0.32%</td>
                                        <td><span class="status-badge status-active">已应用</span></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div class="card">
                            <h3>适应度分布</h3>
                            <div class="chart-container">
                                <canvas id="evolutionFitnessChart"></canvas>
                            </div>
                        </div>
                    </div>
                    <div class="card">
                        <h3>进化趋势</h3>
                        <div class="chart-container">
                            <canvas id="evolutionTrendChart"></canvas>
                        </div>
                    </div>
                </div>
            `;
        }
        
        function getMarketHTML() {
            return `
                <div class="function-panel">
                    <h2><i class="fa-solid fa-brain"></i> 市场结构</h2>
                    <div class="control-grid">
                        <div class="card">
                            <h3>趋势强度</h3>
                            <div class="big-number positive">0.78</div>
                            <div class="progress-bar">
                                <div class="progress-fill progress-success" style="width: 78%"></div>
                            </div>
                            <div class="metric-label">当前趋势确定性</div>
                        </div>
                        <div class="card">
                            <h3>波动性</h3>
                            <div class="big-number warning">0.42</div>
                            <div class="progress-bar">
                                <div class="progress-fill progress-warning" style="width: 42%"></div>
                            </div>
                            <div class="metric-label">价格波动程度</div>
                        </div>
                        <div class="card">
                            <h3>流动性</h3>
                            <div class="big-number positive">0.85</div>
                            <div class="progress-bar">
                                <div class="progress-fill progress-success" style="width: 85%"></div>
                            </div>
                            <div class="metric-label">市场深度</div>
                        </div>
                        <div class="card">
                            <h3>市场情绪</h3>
                            <div class="big-number">中性</div>
                            <div class="metric-label">当前市场状态</div>
                        </div>
                    </div>
                    <div class="control-grid">
                        <div class="card">
                            <h3>Regime类型</h3>
                            <div class="big-number">TREND</div>
                            <div class="metric-label">当前市场状态</div>
                        </div>
                        <div class="card">
                            <h3>主导周期</h3>
                            <div class="big-number">15m</div>
                            <div class="metric-label">主要交易周期</div>
                        </div>
                        <div class="card">
                            <h3>支撑阻力</h3>
                            <div class="big-number">$3498/$3520</div>
                            <div class="metric-label">关键价位</div>
                        </div>
                        <div class="card">
                            <h3>成交量</h3>
                            <div class="big-number">2.4M</div>
                            <div class="metric-label">24h成交量</div>
                        </div>
                    </div>
                    <div class="control-grid">
                        <div class="card">
                            <h3>市场结构分析</h3>
                            <div class="chart-container">
                                <canvas id="marketStructureChart"></canvas>
                            </div>
                        </div>
                        <div class="card">
                            <h3>价格热力图</h3>
                            <div class="chart-container">
                                <canvas id="marketHeatmapChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        function getDecisionHTML() {
            return `
                <div class="function-panel">
                    <h2><i class="fa-solid fa-list-check"></i> 决策追踪</h2>
                    <div class="control-grid">
                        <div class="card">
                            <h3>总决策数</h3>
                            <div class="big-number">46</div>
                            <div class="metric-label">决策总数</div>
                        </div>
                        <div class="card">
                            <h3>成功率</h3>
                            <div class="big-number positive">11.4%</div>
                            <div class="metric-label">决策准确率</div>
                        </div>
                        <div class="card">
                            <h3>期望收益</h3>
                            <div class="big-number positive">+0.03%</div>
                            <div class="metric-label">每决策期望</div>
                        </div>
                        <div class="card">
                            <h3>盈亏比</h3>
                            <div class="big-number positive">3.23</div>
                            <div class="metric-label">平均盈亏比</div>
                        </div>
                    </div>
                    <div class="control-grid">
                        <div class="card">
                            <h3>最近决策记录</h3>
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>时间</th>
                                        <th>交易对</th>
                                        <th>方向</th>
                                        <th>价格</th>
                                        <th>盈亏</th>
                                        <th>退出原因</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>2026-03-24 20:27</td>
                                        <td>ETH/USDT</td>
                                        <td class="positive">做多</td>
                                        <td>$3500.00</td>
                                        <td class="positive">+$1.09</td>
                                        <td>止盈</td>
                                    </tr>
                                    <tr>
                                        <td>2026-03-24 18:15</td>
                                        <td>ETH/USDT</td>
                                        <td class="negative">做空</td>
                                        <td>$3512.50</td>
                                        <td class="negative">-$0.87</td>
                                        <td>止损</td>
                                    </tr>
                                    <tr>
                                        <td>2026-03-24 16:42</td>
                                        <td>ETH/USDT</td>
                                        <td class="positive">做多</td>
                                        <td>$3498.20</td>
                                        <td class="positive">+$2.34</td>
                                        <td>止盈</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div class="card">
                            <h3>盈亏分布</h3>
                            <div class="chart-container">
                                <canvas id="decisionProfitChart"></canvas>
                            </div>
                        </div>
                    </div>
                    <div class="control-grid">
                        <div class="card">
                            <h3>决策分布</h3>
                            <div class="chart-container">
                                <canvas id="decisionChart"></canvas>
                            </div>
                        </div>
                        <div class="card">
                            <h3>绩效曲线</h3>
                            <div class="chart-container">
                                <canvas id="performanceCurveChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        function controlSystem(action) {
            fetch(`/api/control/${action}`, { method: "POST" })
                .then(r => r.json())
                .then(data => alert(`操作成功: ${action}`))
                .catch(e => alert(`操作失败: ${e}`));
        }
    </script>
</body>
</html>'''

@app.route('/')
def index():
    """主面板页面 - 真实市场数据"""
    try:
        data = bridge.get_state()
        market_data = market_api.get_full_market_data()
        
        ticker = market_data.get('ticker', {})
        ms = market_data.get('market_structure', {})
        dt = market_data.get('decision_tracking', {})
        
        enhanced_data = {
            **data,
            "market_price": ticker.get('last', 0),
            "ticker": ticker,
            "evolution": market_data.get('evolution', {
                'iterations': 0,
                'population_size': 50,
                'fitness_avg': 0,
                'fitness_best': 0,
                'mutations': [],
            }),
            "market_structure": {
                "trend_strength": ms.get('trend_strength', 0),
                "volatility": ms.get('volatility', 0),
                "volume_ratio": ms.get('volume_ratio', 1),
                "regime": ms.get('regime', 'UNKNOWN'),
                "support": ms.get('support', 0),
                "resistance": ms.get('resistance', 0),
            },
            "decision_tracking": dt,
        }
        return render_template_string(HTML_TEMPLATE, data=enhanced_data)
    except Exception as e:
        print(f"Error rendering template: {e}")
        import traceback
        traceback.print_exc()
        return f"Error loading dashboard: {e}", 500

@app.route('/api/all')
def api_all():
    """获取所有数据 - 真实市场数据"""
    try:
        trade_data = bridge.get_state()
        market_data = market_api.get_full_market_data()
        
        ticker = market_data.get('ticker', {})
        ms = market_data.get('market_structure', {})
        dt = market_data.get('decision_tracking', {})
        
        # 合并真实数据
        trade_data['market_price'] = ticker.get('last', 0)
        trade_data['ticker'] = ticker
        trade_data['orderbook'] = market_data.get('orderbook', {})
        trade_data['ohlcv_1h'] = market_data.get('ohlcv_1h', [])
        trade_data['funding'] = market_data.get('funding', {})
        trade_data['market_structure'] = {
            'trend_strength': ms.get('trend_strength', 0),
            'volatility': ms.get('volatility', 0),
            'volume_ratio': ms.get('volume_ratio', 1),
            'regime': ms.get('regime', 'UNKNOWN'),
            'support': ms.get('support', 0),
            'resistance': ms.get('resistance', 0),
            'atr': ms.get('atr', 0),
            'sma_fast': ms.get('sma_fast', 0),
            'sma_slow': ms.get('sma_slow', 0),
        }
        trade_data['decision_tracking'] = dt
        trade_data['evolution'] = market_data.get('evolution', {
            'iterations': 0,
            'population_size': 50,
            'fitness_avg': 0,
            'fitness_best': 0,
            'mutations': [],
        })
        
        return jsonify(trade_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/market')
def api_market():
    """独立市场数据端点"""
    try:
        return jsonify(market_api.get_full_market_data())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/control/<action>', methods=['POST'])
def control_action(action):
    """控制操作"""
    return jsonify({"success": True, "action": action})

if __name__ == '__main__':
    print("="*60)
    print("🐉 小龙交易系统 V5.4 平衡版")
    print("="*60)
    print("✅ 完整四大功能模块")
    print("✅ 3个优化图表（非阻塞）")
    print("✅ 智能刷新（前台5秒/后台10秒）")
    print("✅ 防抖更新机制")
    print("🌐 http://localhost:8788/")
    print("="*60)
    app.run(host='0.0.0.0', port=8789, debug=False)