#!/usr/bin/env python3
"""
Real-time Monitoring Dashboard
实时监控仪表板
"""

import curses
import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List


class Dashboard:
    """监控仪表板"""
    
    def __init__(self, stdscr):
        self.stdscr = stdscr
        self.data = {}
        self.alerts = []
        self.running = True
        
        # 初始化 curses
        curses.curs_set(0)
        self.stdscr.nodelay(1)
        self.stdscr.timeout(1000)
        
        # 颜色
        curses.start_color()
        curses.init_pair(1, curses.COLOR_GREEN, curses.COLOR_BLACK)   # 上涨
        curses.init_pair(2, curses.COLOR_RED, curses.COLOR_BLACK)     # 下跌
        curses.init_pair(3, curses.COLOR_YELLOW, curses.COLOR_BLACK)  # 警告
        curses.init_pair(4, curses.COLOR_CYAN, curses.COLOR_BLACK)    # 信息
        curses.init_pair(5, curses.COLOR_MAGENTA, curses.COLOR_BLACK) # 标题
        
        self.COLOR_GREEN = curses.color_pair(1)
        self.COLOR_RED = curses.color_pair(2)
        self.COLOR_YELLOW = curses.color_pair(3)
        self.COLOR_CYAN = curses.color_pair(4)
        self.COLOR_MAGENTA = curses.color_pair(5)
    
    def update_data(self, symbol: str, data: Dict):
        """更新数据"""
        self.data[symbol] = {
            'timestamp': datetime.now().isoformat(),
            **data
        }
    
    def add_alert(self, alert: Dict):
        """添加告警"""
        self.alerts.insert(0, alert)
        if len(self.alerts) > 20:
            self.alerts = self.alerts[:20]
    
    def draw_header(self):
        """绘制标题"""
        height, width = self.stdscr.getmaxyx()
        
        title = "🤖 加密货币自动监控系统"
        self.stdscr.attron(self.COLOR_MAGENTA | curses.A_BOLD)
        self.stdscr.addstr(0, (width - len(title)) // 2, title)
        self.stdscr.attroff(self.COLOR_MAGENTA | curses.A_BOLD)
        
        time_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        self.stdscr.addstr(1, width - len(time_str) - 2, time_str)
        
        self.stdscr.addstr(2, 0, "═" * width)
    
    def draw_symbol_card(self, symbol: str, data: Dict, y: int, x: int, width: int):
        """绘制币种卡片"""
        if not data:
            return
        
        # 边框
        self.stdscr.addstr(y, x, "╔" + "═" * (width-2) + "╗")
        for i in range(1, 6):
            self.stdscr.addstr(y+i, x, "║")
            self.stdscr.addstr(y+i, x+width-1, "║")
        self.stdscr.addstr(y+6, x, "╚" + "═" * (width-2) + "╝")
        
        # 标题
        title = f" {symbol} "
        self.stdscr.addstr(y, x + (width-len(title))//2, title)
        
        # 价格
        price = data.get('price', 0)
        change = data.get('change', 0)
        price_str = f"${price:,.2f}"
        change_str = f"[{change:+.2f}%]"
        
        color = self.COLOR_GREEN if change >= 0 else self.COLOR_RED
        self.stdscr.attron(color)
        self.stdscr.addstr(y+1, x+2, f"{price_str} {change_str}")
        self.stdscr.attroff(color)
        
        # 技术分
        tech_score = data.get('tech_score', 0)
        self.stdscr.addstr(y+2, x+2, f"技术分：{tech_score:.2f}")
        
        # 预测分
        pred_score = data.get('pred_score', 0)
        self.stdscr.addstr(y+3, x+2, f"预测分：{pred_score:.2f}")
        
        # 综合
        combined = data.get('combined', 0)
        signal = data.get('signal', 'HOLD')
        self.stdscr.addstr(y+4, x+2, f"综合：{combined:.2f}  {signal}")
        
        # CSI
        csi = data.get('csi', 50)
        csi_str = f"CSI: {csi:.0f}"
        if csi < 20:
            self.stdscr.attron(self.COLOR_GREEN)
        elif csi > 80:
            self.stdscr.attron(self.COLOR_RED)
        self.stdscr.addstr(y+5, x+2, csi_str)
        self.stdscr.attroff(self.COLOR_GREEN | self.COLOR_RED)
    
    def draw_alerts(self, y: int, x: int, max_height: int):
        """绘制告警列表"""
        self.stdscr.addstr(y, x, "📋 最近告警")
        self.stdscr.addstr(y+1, x, "─" * 50)
        
        for i, alert in enumerate(self.alerts[:max_height-2]):
            if y+2+i >= max_height:
                break
            
            time_str = datetime.fromisoformat(alert['timestamp']).strftime('%H:%M:%S')
            level = alert.get('level', 'INFO')
            title = alert.get('title', '')[:45]
            
            level_str = {
                'INFO': 'ℹ️',
                'WARNING': '⚠️',
                'CRITICAL': '🚨'
            }.get(level, '📢')
            
            self.stdscr.addstr(y+2+i, x, f"{time_str} {level_str} {title}")
    
    def draw_help(self, y: int, x: int):
        """绘制帮助"""
        self.stdscr.addstr(y, x, "按 Q 退出 | 按 R 刷新 | 按 S 保存快照")
    
    def draw(self):
        """绘制仪表板"""
        self.stdscr.clear()
        height, width = self.stdscr.getmaxyx()
        
        # 标题
        self.draw_header()
        
        # 币种卡片
        card_width = min(60, width // 2 - 2)
        card_height = 8
        
        symbols = list(self.data.keys())
        for i, symbol in enumerate(symbols[:4]):
            row = i // 2
            col = (i % 2) * (card_width + 2) + 2
            
            if row * card_height + 5 >= height - 5:
                break
            
            self.draw_symbol_card(
                symbol,
                self.data[symbol],
                4 + row * card_height,
                col + 2,
                card_width
            )
        
        # 告警列表
        alert_x = width - 52
        if alert_x > card_width + 4:
            self.draw_alerts(4, alert_x, height - 6)
        
        # 帮助
        self.draw_help(height - 2, 2)
        
        # 状态栏
        status = f"监控中：{len(self.data)} 币种 | 告警：{len(self.alerts)} 条"
        self.stdscr.addstr(height - 1, 0, " " * (width-1))
        self.stdscr.addstr(height - 1, 0, status, self.COLOR_CYAN)
        
        self.stdscr.refresh()
    
    def handle_input(self):
        """处理输入"""
        key = self.stdscr.getch()
        
        if key == ord('q') or key == ord('Q'):
            self.running = False
        elif key == ord('r') or key == ord('R'):
            # 刷新
            pass
        elif key == ord('s') or key == ord('S'):
            # 保存快照
            snapshot_file = Path(__file__).parent / f"monitor_snapshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(snapshot_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'timestamp': datetime.now().isoformat(),
                    'data': self.data,
                    'alerts': self.alerts
                }, f, indent=2, ensure_ascii=False)
    
    def run(self, update_callback=None):
        """运行仪表板"""
        while self.running:
            self.draw()
            self.handle_input()
            
            if update_callback:
                update_callback()


def main(stdscr):
    """主函数"""
    dashboard = Dashboard(stdscr)
    
    # 模拟数据更新
    import random
    
    def update_data():
        symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'DOGE/USDT']
        for symbol in symbols:
            dashboard.update_data(symbol, {
                'price': random.uniform(50, 70000),
                'change': random.uniform(-5, 5),
                'tech_score': random.uniform(0, 1),
                'pred_score': random.uniform(0, 1),
                'combined': random.uniform(0, 1),
                'signal': random.choice(['BUY', 'SELL', 'HOLD']),
                'csi': random.uniform(0, 100)
            })
    
    dashboard.run(update_data)


if __name__ == '__main__':
    curses.wrapper(main)
