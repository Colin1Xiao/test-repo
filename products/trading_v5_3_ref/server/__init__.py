# V5.3 Trading Server - 统一入口
"""
小龙交易系统 V5.3 统一监控服务器

架构:
- server/
  ├── __init__.py
  ├── main.py              # FastAPI 应用入口
  ├── config.py            # 配置管理
  ├── routers/
  │   ├── __init__.py
  │   ├── dashboard.py     # 主面板路由
  │   ├── evolution.py     # 演化引擎路由
  │   ├── structure.py     # 市场结构路由
  │   ├── decision.py      # 决策追踪路由
  │   ├── control.py       # 控制平面路由
  │   └── public.py        # 公网访问路由
  ├── static/
  │   ├── css/
  │   └── js/
  ├── templates/
  │   └── dashboard.html
  └── utils/
      ├── state_reader.py
      └── data_aggregator.py

启动方式:
  python -m server.main
  或
  uvicorn server.main:app --host 0.0.0.0 --port 8765
"""

__version__ = "5.3.0"
__author__ = "小龙"