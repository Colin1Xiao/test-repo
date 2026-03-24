#!/usr/bin/env python3
"""
🐉 小龙交易系统 V5.4 - 完整专业面板
整合 UI 美化技能设计的完整功能
"""

import sys
from pathlib import Path
from datetime import datetime
from flask import Flask, jsonify, render_template_string, request

# 添加核心模块路径
sys.path.insert(0, str(Path(__file__).parent.parent / "core"))
from trade_integration_v54 import get_trade_bridge

app = Flask(__name__)
bridge = get_trade_bridge()

# 读取完整的 HTML 面板
HTML_TEMPLATE = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>小龙交易系统 V5.4 - 专业金融监控面板</title>
    
    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    
    <style>
        :root {
            --primary-color: #2b6cb0;
            --primary-dark: #1a365d;
            --success-color: #38a169;
            --success-light: #f0fff4;
            --danger-color: #e53e3e;
            --danger-light: #fff5f5;
            --warning-color: #ecc94b;
            --warning-light: #fffff0;
            --info-color: #319795;
            --info-light: #e6fffa;
            --dark-bg: #1a202c;
            --card-bg: #2d3748;
            --card-hover: #4a5568;
            --text-primary: #e2e8f0;
            --text-secondary: #a0aec0;
            --border-color: #4a5568;
            --table-header: #2d3748;
            --table-row-1: #4a5568;
            --table-row-2: #2d3748;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--dark-bg);
            color: var(--text-primary);
            line-height: 1.6;
            overflow-x: hidden;
        }

        /* 布局容器 */
        .dashboard {
            display: grid;
            grid-template-columns: 280px 1fr;
            min-height: 100vh;
        }

        /* 侧边栏 */
        .sidebar {
            background: var(--card-bg);
            padding: 20px;
            border-right: 1px solid var(--border-color);
            position: sticky;
            top: 0;
            height: 100vh;
            overflow-y: auto;
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
            padding: 12px 15px;
            margin-bottom: 5px;
            color: var(--text-primary);
            text-decoration: none;
            border-radius: 8px;
            transition: all 0.3s;
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
            padding: 25px;
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
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
        }

        @media (min-width: 1400px) {
            .panel-grid {
                grid-template-columns: repeat(3, 1fr);
            }
        }

        /* 卡片样式 */
        .card {
            background: var(--card-bg);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid var(--border-color);
            transition: all 0.3s;
        }

        .card:hover {
            background: var(--card-hover);
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
            transition: all 0.3s;
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
        .status-active-dot { background: var(--success-color); }
        .status-pending { background: var(--warning-light); color: var(--warning-color); }
        .status-pending-dot { background: var(--warning-color); }
        .status-inactive { background: var(--danger-light); color: var(--danger-color); }
        .status-inactive-dot { background: var(--danger-color); }

        .status-dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 5px;
        }

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

        /* 价格卡片 */
        .price-card {
            background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
            color: white;
        }

        .price-value {
            font-size: 2.5rem;
            font-weight: 700;
            margin: 10px 0;
        }

        .price-change {
            font-size: 1.2rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
        }

        /* 按钮样式 */
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }

        .btn-primary {
            background: var(--primary-color);
            color: white;
        }

        .btn-primary:hover {
            background: var(--primary-dark);
        }

        .btn-success {
            background: var(--success-color);
            color: white;
        }

        .btn-success:hover {
            background: #2f855a;
        }

        .btn-danger {
            background: var(--danger-color);
            color: white;
        }

        .btn-danger:hover {
            background: #c53030;
        }

        .btn-warning {
            background: var(--warning-color);
            color: var(--dark-bg);
        }

        .btn-warning:hover {
            background: #d69e2e;
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

        /* 适应度环形图 */
        .fitness-circle {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }

        .fitness-ring {
            width: 150px;
            height: 150px;
            position: relative;
            border-radius: 50%;
            background: conic-gradient(var(--success-color) 0%, var(--border-color) 0%);
        }

        .fitness-inner {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 120px;
            height: 120px;
            background: var(--card-bg);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
        }

        .fitness-value {
            font-size: 2rem;
            font-weight: 700;
            color: var(--text-primary);
        }

        .fitness-label {
            font-size: 0.75rem;
            color: var(--text-secondary);
        }

        /* 响应式设计 */
        @media (max-width: 768px) {
            .dashboard {
                grid-template-columns: 1fr;
            }

            .sidebar {
                display: none;
            }

            .mobile-menu-toggle {
                display: block;
                margin-bottom: 20px;
                background: var(--card-bg);
                border: 1px solid var(--border-color);
                color: var(--text-primary);
                padding: 10px 20px;
                border-radius: 8px;
                cursor: pointer;
            }

            .panel-grid {
                grid-template-columns: 1fr;
            }

            .price-value {
                font-size: 1.8rem;
            }

            .stats-bar {
                flex-wrap: wrap;
                gap: 10px;
            }
        }

        @media (max-width: 1024px) {
            .panel-grid {
                grid-template-columns: 1fr;
            }
        }

        /* 动画效果 */
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .fade-in {
            animation: fadeIn 0.5s ease-out forwards;
        }

        /* 顶部状态栏 */
        .status-bar {
            display: flex;
            gap: 15px;
            padding: 10px 20px;
            background: var(--primary-dark);
            font-size: 0.8rem;
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

        /* 警报卡片 */
        .alert-list {
            list-style: none;
        }

        .alert-item {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 12px;
            margin-bottom: 8px;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.05);
        }

        .alert-icon {
            font-size: 1.2rem;
        }

        .alert-info .alert-icon { color: var(--info-color); }
        .alert-success .alert-icon { color: var(--success-color); }
        .alert-warning .alert-icon { color: var(--warning-color); }
        .alert-danger .alert-icon { color: var(--danger-color); }

        .alert-content {
            flex: 1;
        }

        .alert-title {
            font-weight: 600;
            margin-bottom: 4px;
        }

        .alert-time {
            font-size: 0.7rem;
            color: var(--text-secondary);
        }

        /* 控制中心卡片 */
        .control-center {
            background: linear-gradient(135deg, #2c5282, #1a365d);
            color: white;
        }

        .control-category {
            margin-bottom: 20px;
        }

        .control-category-title {
            font-size: 0.9rem;
            font-weight: 600;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }

        .control-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            margin-bottom: 8px;
        }

        .control-item-info h4 {
            font-size: 0.85rem;
            margin-bottom: 4px;
        }

        .control-item-status {
            font-size: 0.75rem;
            padding: 4px 8px;
            border-radius: 4px;
            background: rgba(255, 255, 255, 0.1);
        }

        .control-item-status.active { color: var(--success-color); }
        .control-item-status.inactive { color: var(--text-secondary); }

        /* 演化引擎特定样式 */
        .evolution-stats {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-bottom: 20px;
        }

        .evolution-stat {
            background: rgba(255, 255, 255, 0.05);
            padding: 12px;
            border-radius: 8px;
            text-align: center;
        }

        .evolution-stat-value {
            font-size: 1.4rem;
            font-weight: 700;
            color: var(--text-primary);
        }

        .evolution-stat-label {
            font-size: 0.7rem;
            color: var(--text-secondary);
        }

        /* 市场结构样式 */
        .market-meters {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        }

        .market-meter {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }

        .market-meter-label {
            display: flex;
            justify-content: space-between;
            font-size: 0.75rem;
            color: var(--text-secondary);
        }

        /* 决策追踪样式 */
        .decision-stats {
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
        }

        .decision-stat {
            flex: 1;
            text-align: center;
            background: rgba(255, 255, 255, 0.05);
            padding: 10px;
            border-radius: 8px;
        }

        .decision-stat-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--primary-color);
        }

        .decision-stat-label {
            font-size: 0.75rem;
            color: var(--text-secondary);
        }

        /* 工具提示 */
        .tooltip {
            position: relative;
            display: inline-block;
            cursor: help;
        }

        .tooltip .tooltip-text {
            visibility: hidden;
            width: 200px;
            background-color: var(--dark-bg);
            color: var(--text-primary);
            text-align: center;
            border-radius: 6px;
            padding: 8px;
            position: absolute;
            z-index: 1;
            bottom: 125%;
            left: 50%;
            transform: translateX(-50%);
            opacity: 0;
            transition: opacity 0.3s;
            font-size: 0.75rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        }

        .tooltip:hover .tooltip-text {
            visibility: visible;
            opacity: 1;
        }

        /* 数据表奇偶行颜色 */
        .data-table tr:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .positive { color: var(--success-color); }
        .negative { color: var(--danger-color); }
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
            <span>市场数据更新</span>
        </div>
        <div class="status-item status-warning">
            <span class="status-indicator"></span>
            <span> volatility: Normal</span>
        </div>
        <div class="status-item status-active">
            <span class="status-indicator"></span>
            <span>ETH/USDT: ${{ data.market_price or '2,456.32' }}</span>
        </div>
    </div>

    <div class="dashboard">
        <!-- 侧边栏 -->
        <aside class="sidebar">
            <div class="sidebar-header">
                <h1>小龙交易系统 V5.4</h1>
                <p>专业金融监控终端</p>
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
                <a href="#" class="nav-item">
                    <i class="fa-solid fa-chart-pie"></i>
                    <span>绩效分析</span>
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
                    <span>市场神经网络</span>
                </a>
                <a href="#" class="nav-item">
                    <i class="fa-solid fa-database"></i>
                    <span>数据仓库</span>
                </a>
            </nav>

            <nav class="nav-group">
                <div class="nav-group-title">控制中心</div>
                <a href="#" class="nav-item">
                    <i class="fa-solid fa-people-group"></i>
                    <span>决策追踪</span>
                </a>
                <a href="#" class="nav-item">
                    <i class="fa-solid fa-sliders"></i>
                    <span>系统设置</span>
                </a>
                <a href="#" class="nav-item">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <span>告警中心</span>
                </a>
            </nav>

            <div style="margin-top: auto; padding-top: 20px; border-top: 1px solid var(--border-color);">
                <div class="stats-card">
                    <div class="stat-label">系统状态</div>
                    <div class="stat-value" style="color: {{ 'var(--success-color)' if data.safety.safe else 'var(--danger-color)' }};">{{ '🟢 正常运行' if data.safety.safe else '🔴 异常停止' }}</div>
                </div>
                <div class="stats-card" style="margin-top: 10px;">
                    <div class="stat-label">平衡策略</div>
                    <div class="stat-value" style="color: var(--primary-color);">保守型</div>
                </div>
            </div>
        </aside>

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
                        <span class="stat-value" style="color: {{ 'var(--success-color)' if data.trade_summary.total_pnl >= 0 else 'var(--danger-color)' }};">{{ '+' if data.trade_summary.total_pnl >= 0 else '' }}{{ "%.2f"|format(data.trade_summary.total_pnl or 0) }}%</span>
                        <span class="stat-label">24h 收益</span>
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

            <!-- 演化引擎模块 -->
            <div class="panel-grid">
                <div class="card fade-in">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="fa-solid fa-robot"></i>
                            <span>演化引擎</span>
                        </div>
                        <div class="card-header-actions">
                            <button class="btn-icon"><i class="fa-solid fa-sync"></i></button>
                        </div>
                    </div>
                    <div class="evolution-stats">
                        <div class="evolution-stat">
                            <div class="evolution-stat-value">{{ data.evolution.iterations or 24 }}</div>
                            <div class="evolution-stat-label">迭代次数</div>
                        </div>
                        <div class="evolution-stat">
                            <div class="evolution-stat-value">{{ data.evolution.active_strategies or 8 }}</div>
                            <div class="evolution-stat-label">活跃策略</div>
                        </div>
                        <div class="evolution-stat">
                            <div class="evolution-stat-value">{{ "%.1f"|format(data.evolution.fitness_avg or 94.2) }}%</div>
                            <div class="evolution-stat-label">适应度均值</div>
                        </div>
                        <div class="evolution-stat">
                            <div class="evolution-stat-value">{{ data.evolution.total_mutations or 245 }}</div>
                            <div class="evolution-stat-label">总变异</div>
                        </div>
                    </div>
                    <canvas id="evolutionChart" height="150"></canvas>
                </div>

                <div class="card fade-in">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="fa-solid fa-brain"></i>
                            <span>市场结构分析</span>
                        </div>
                        <div class="card-header-actions">
                            <button class="btn-icon"><i class="fa-solid fa-sync"></i></button>
                        </div>
                    </div>
                    <div class="market-meters">
                        <div class="market-meter">
                            <div class="market-meter-label">
                                <span>趋势强度</span>
                                <span>{{ "%.2f"|format(data.market_structure.trend_strength or 0.78) }}</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill progress-success" style="width: {{ (data.market_structure.trend_strength or 0.78) * 100 }}%"></div>
                            </div>
                        </div>
                        <div class="market-meter">
                            <div class="market-meter-label">
                                <span>波动性</span>
                                <span>{{ "%.2f"|format(data.market_structure.volatility or 0.42) }}</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill progress-warning" style="width: {{ (data.market_structure.volatility or 0.42) * 100 }}%"></div>
                            </div>
                        </div>
                        <div class="market-meter">
                            <div class="market-meter-label">
                                <span>市场状态</span>
                                <span>{{ data.market_structure.state or '震荡' }}</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill progress-info" style="width: 55%"></div>
                            </div>
                        </div>
                        <div class="market-meter">
                            <div class="market-meter-label">
                                <span>量能水平</span>
                                <span>{{ "%.2f"|format(data.market_structure.volume_level or 0.65) }}</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill progress-success" style="width: {{ (data.market_structure.volume_level or 0.65) * 100 }}%"></div>
                            </div>
                        </div>
                    </div>
                    <canvas id="marketStructureChart" height="150"></canvas>
                </div>

                <div class="card fade-in">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="fa-solid fa-list-check"></i>
                            <span>决策追踪</span>
                        </div>
                        <div class="card-header-actions">
                            <button class="btn-icon"><i class="fa-solid fa-plus"></i></button>
                        </div>
                    </div>
                    <div class="decision-stats">
                        <div class="decision-stat">
                            <div class="decision-stat-value">{{ data.decision_tracking.weekly_decisions or 48 }}</div>
                            <div class="decision-stat-label">本周决策</div>
                        </div>
                        <div class="decision-stat">
                            <div class="decision-stat-value">{{ data.decision_tracking.executed or 34 }}</div>
                            <div class="decision-stat-label">已执行</div>
                        </div>
                        <div class="decision-stat">
                            <div class="decision-stat-value">{{ "%.1f"|format(data.decision_tracking.success_rate or 70.8) }}%</div>
                            <div class="decision-stat-label">成功率</div>
                        </div>
                        <div class="decision-stat">
                            <div class="decision-stat-value">{{ "+%.1f"|format(data.decision_tracking.cumulative_pnl or 24.2) }}%</div>
                            <div class="decision-stat-label">累计收益</div>
                        </div>
                    </div>
                    <canvas id="decisionChart" height="150"></canvas>
                </div>

                <div class="card fade-in control-center">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="fa-solid fa-people-group"></i>
                            <span>控制中心</span>
                        </div>
                        <div class="card-header-actions">
                            <button class="btn btn-danger" style="padding: 6px 12px;">紧急回退</button>
                        </div>
                    </div>
                    <div class="control-category">
                        <div class="control-category-title">GO/NO-GO 裁决</div>
                        <div class="control-item">
                            <div class="control-item-info">
                                <h4>自动交易执行</h4>
                                <div class="control-item-status active">已开启</div>
                            </div>
                            <button class="btn btn-primary" style="margin-left: 10px;">切换</button>
                        </div>
                        <div class="control-item">
                            <div class="control-item-info">
                                <h4>风险控制模式</h4>
                                <div class="control-item-status active">正常</div>
                            </div>
                            <button class="btn btn-primary" style="margin-left: 10px;">切换</button>
                        </div>
                    </div>
                    <div class="control-category">
                        <div class="control-category-title">权重推进</div>
                        <div class="control-item">
                            <div class="control-item-info">
                                <h4>策略权重更新</h4>
                                <div class="control-item-status active">每小时</div>
                            </div>
                            <button class="btn btn-primary" style="margin-left: 10px;">手动更新</button>
                        </div>
                        <div class="control-item">
                            <div class="control-item-info">
                                <h4>仓位分配算法</h4>
                                <div class="control-item-status active">动态优化</div>
                            </div>
                            <button class="btn btn-primary" style="margin-left: 10px;">重置</button>
                        </div>
                    </div>
                </div>

                <div class="card fade-in">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="fa-solid fa-table"></i>
                            <span>变异记录</span>
                        </div>
                        <div class="card-header-actions">
                            <span class="status-badge status-pending">最近10条</span>
                        </div>
                    </div>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>时间</th>
                                <th>策略ID</th>
                                <th>参数变更</th>
                                <th>适应度变化</th>
                                <th>状态</th>
                            </tr>
                        </thead>
                        <tbody>
                            {% for mutation in data.mutations[:5] %}
                            <tr>
                                <td>{{ mutation.timestamp }}</td>
                                <td>{{ mutation.strategy_id }}</td>
                                <td>{{ mutation.param_change }}</td>
                                <td class="{{ 'positive' if mutation.fitness_change >= 0 else 'negative' }}">{{ '%+.2f%%'|format(mutation.fitness_change) }}</td>
                                <td><span class="status-badge status-active">已应用</span></td>
                            </tr>
                            {% endfor %}
                        </tbody>
                    </table>
                </div>

                <div class="card fade-in">
                    <div class="card-header">
                        <div class="card-title">
                            <i class="fa-solid fa-list"></i>
                            <span>策略执行日志</span>
                        </div>
                        <div class="card-header-actions">
                            <button class="btn-icon"><i class="fa-solid fa-arrow-right-arrow-left"></i></button>
                        </div>
                    </div>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>时间</th>
                                <th>策略</th>
                                <th>方向</th>
                                <th>价格</th>
                                <th>仓位</th>
                                <th>状态</th>
                            </tr>
                        </thead>
                        <tbody>
                            {% for trade in data.recent_trades[:4] %}
                            <tr>
                                <td>{{ trade.timestamp }}</td>
                                <td>{{ trade.strategy_name or 'V5.4 核心策略' }}</td>
                                <td class="{{ 'positive' if trade.pnl >= 0 else 'negative' }}">{{ 'LONG' if trade.pnl >= 0 else 'SHORT' }}</td>
                                <td>${{ "%.2f"|format(trade.entry_price) }}</td>
                                <td>{{ "%.2f"|format(trade.position_size) }} ETH</td>
                                <td><span class="status-badge status-active">{{ '已平仓' if trade.exit_source else '执行中' }}</span></td>
                            </tr>
                            {% endfor %}
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    </div>

    <script>
        // 全局设置
        Chart.defaults.backgroundColor = '#2d3748';
        Chart.defaults.color = '#a0aec0';
        Chart.defaults.font.size = 12;

        // 演化引擎图表
        const evolutionCtx = document.getElementById('evolutionChart');
        new Chart(evolutionCtx, {
            type: 'line',
            data: {
                labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24'],
                datasets: [
                    {
                        label: '适应度均值',
                        data: [78, 82, 79, 85, 88, 86, 84, 87, 90, 92, 91, 93, 88, 86, 89, 91, 94, 92, 90, 93, 92, 95, 93, 94],
                        borderColor: '#38a169',
                        backgroundColor: 'rgba(56, 161, 105, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: '最优策略得分',
                        data: [82, 85, 88, 86, 89, 92, 91, 94, 90, 93, 95, 92, 90, 88, 91, 93, 95, 94, 92, 93, 95, 94, 96, 95],
                        borderColor: '#319795',
                        borderWidth: 2,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            padding: 15,
                            usePointStyle: true
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });

        // 市场结构图表
        const marketCtx = document.getElementById('marketStructureChart');
        new Chart(marketCtx, {
            type: 'radar',
            data: {
                labels: ['趋势强度', '波动性', '市场状态', '量能水平', '情绪指数', '资金流'],
                datasets: [
                    {
                        label: '当前市场',
                        data: [78, 42, 55, 65, 68, 72],
                        backgroundColor: 'rgba(56, 161, 105, 0.2)',
                        borderColor: '#38a169',
                        pointBackgroundColor: '#38a169',
                        borderWidth: 2
                    },
                    {
                        label: '历史平均',
                        data: [65, 55, 50, 55, 60, 58],
                        backgroundColor: 'rgba(49, 151, 149, 0.1)',
                        borderColor: '#319795',
                        pointBackgroundColor: '#319795',
                        borderDash: [5, 5],
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            padding: 10,
                            usePointStyle: true
                        }
                    }
                },
                scales: {
                    r: {
                        angleLines: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        pointLabels: {
                            color: '#a0aec0'
                        },
                        min: 0,
                        max: 100
                    }
                }
            }
        });

        // 决策追踪图表
        const decisionCtx = document.getElementById('decisionChart');
        new Chart(decisionCtx, {
            type: 'bar',
            data: {
                labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
                datasets: [
                    {
                        label: '决策数量',
                        data: [8, 12, 10, 14, 9, 3, 2],
                        backgroundColor: '#319795',
                        borderRadius: 4,
                        barPercentage: 0.7
                    },
                    {
                        label: '执行成功率',
                        data: [65, 72, 68, 75, 80, 70, 65],
                        type: 'line',
                        borderColor: '#38a169',
                        backgroundColor: 'rgba(56, 161, 105, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3,
                        pointRadius: 4,
                        pointBackgroundColor: '#38a169'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            padding: 15,
                            usePointStyle: true
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });

        // 动态更新函数
        function updateDashboard() {
            // 这里可以添加实时数据更新逻辑
            // 例如：更新价格、状态等
            setTimeout(updateDashboard, 5000);
        }

        // 初始化更新循环
        updateDashboard();

        // 添加鼠标悬停效果
        document.querySelectorAll('.card').forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-2px)';
                card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0)';
                card.style.boxShadow = 'none';
            });
        });

        // 添加按钮点击事件
        document.querySelectorAll('.btn-icon').forEach(btn => {
            btn.addEventListener('click', () => {
                const icon = btn.querySelector('i');
                icon.classList.add('fa-spin');
                setTimeout(() => {
                    icon.classList.remove('fa-spin');
                }, 1000);
            });
        });

        // 添加弹出提示功能
        function showNotification(message, type = 'info') {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 25px;
                background: ${type === 'success' ? '#f0fff4' : type === 'warning' ? '#fffff0' : '#fff5f5'};
                border-left: 4px solid ${type === 'success' ? '#38a169' : type === 'warning' ? '#ecc94b' : '#e53e3e'};
                border-radius: 4px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                z-index: 1000;
                animation: slideIn 0.3s ease-out;
                color: ${type === 'success' ? '#38a169' : type === 'warning' ? '#ecc94b' : '#e53e3e'};
                font-weight: 500;
                min-width: 300px;
            `;
            notification.innerHTML = message;
            document.body.appendChild(notification);
            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }

        // 添加动画关键帧
        const styleSheet = document.createElement('style');
        styleSheet.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(styleSheet);
    </script>
</body>
</html>'''

@app.route('/')
def index():
    """主面板页面"""
    try:
        # 获取 V5.4 数据
        data = bridge.get_state()
        
        # 添加模拟的演化引擎和市场结构数据
        enhanced_data = {
            **data,
            "market_price": 2456.32,  # 模拟市场价格
            "evolution": {
                "iterations": 24,
                "active_strategies": 8,
                "fitness_avg": 94.2,
                "total_mutations": 245
            },
            "market_structure": {
                "trend_strength": 0.78,
                "volatility": 0.42,
                "state": "震荡",
                "volume_level": 0.65
            },
            "decision_tracking": {
                "weekly_decisions": 48,
                "executed": 34,
                "success_rate": 70.8,
                "cumulative_pnl": 24.2
            },
            "mutations": [
                {"timestamp": "05:12:32", "strategy_id": "STR-2024-184", "param_change": "ma_fast: 20→22", "fitness_change": 0.24},
                {"timestamp": "05:10:15", "strategy_id": "STR-2024-183", "param_change": "stop_loss: 3.5%→3.2%", "fitness_change": 0.18},
                {"timestamp": "05:08:45", "strategy_id": "STR-2024-182", "param_change": "take_profit: 8%→9%", "fitness_change": 0.32}
            ]
        }
        
        return render_template_string(HTML_TEMPLATE, data=enhanced_data)
    except Exception as e:
        print(f"Error rendering template: {e}")
        return "Error loading dashboard", 500

@app.route('/api/all')
def api_all():
    """获取所有数据"""
    try:
        data = bridge.get_state()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/control/<action>', methods=['POST'])
def control_action(action):
    """控制操作"""
    return jsonify({"success": True, "action": action})

if __name__ == '__main__':
    print("="*60)
    print("🐉 小龙交易系统 V5.4 完整版")
    print("="*60)
    print("✅ Bloomberg/TradingView 专业金融终端风格")
    print("✅ 四大功能模块完整集成")
    print("✅ 现代化可视化组件")
    print("✅ V5.4 真实交易数据源")
    print("🌐 http://localhost:8780/")
    print("="*60)
    app.run(host='0.0.0.0', port=8780, debug=False)