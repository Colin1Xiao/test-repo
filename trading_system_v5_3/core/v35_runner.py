#!/usr/bin/env python3
"""
V3.5 Runner - 独立运行器

关键设计：
1. 独立统计文件（不与 V2 混合）
2. 从 0 开始计数
3. 独立审计日志
4. 30 笔验证报告

运行方式：
python core/v35_runner.py
"""

import os
import sys
import json
import time
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

# 添加路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.v35_strategy import V35Strategy, V35Signal, get_v35_strategy
from core.v35_volatility import get_volatility_filter
from core.execution_engine import ExecutionEngine
from core.position_manager import PositionManager
from core.state_store import StateStore
from core.kill_switch import KillSwitch
from core.constants import GLOBAL_LEVERAGE, PCT


class V35Runner:
    """
    V3.5 独立运行器
    
    目标：跑 30 笔验证 V3.5 策略
    """
    
    TARGET_TRADES = 30
    
    def __init__(self):
        """初始化"""
        print("=" * 60)
        print("🚀 V3.5 自适应策略启动")
        print("=" * 60)
        
        # 核心组件
        self.strategy = get_v35_strategy()
        self.volatility_filter = get_volatility_filter()
        self.execution_engine = ExecutionEngine()
        self.position_manager = PositionManager()
        self.state_store = StateStore()
        self.kill_switch = KillSwitch()
        
        # V3.5 专用统计文件
        self.stats_file = Path(__file__).parent.parent / "logs" / "v35_stats.json"
        self.stats_file.parent.mkdir(exist_ok=True)
        
        # V3.5 专用审计文件
        self.audit_file = Path(__file__).parent.parent / "logs" / "v35_audit.jsonl"
        
        # 初始化统计（从 0 开始）
        self.stats = {
            "version": "V3.5",
            "start_time": datetime.now().isoformat(),
            "total_trades": 0,
            "wins": 0,
            "losses": 0,
            "total_pnl": 0.0,
            "trades": [],
            "exit_distribution": {
                "TAKE_PROFIT": 0,
                "STOP_LOSS": 0,
                "TIME_EXIT": 0,
                "MANUAL": 0
            },
            "volatility_distribution": {
                "MID": 0,
                "HIGH": 0
            },
            "strategy_stats": {}
        }
        
        # 运行状态
        self.running = False
        self.current_position = None
        self.last_check_time = 0
        
        print("✅ 组件初始化完成")
        print(f"📁 统计文件: {self.stats_file}")
        print(f"📁 审计文件: {self.audit_file}")
        print(f"🎯 目标: {self.TARGET_TRADES} 笔")
    
    def load_stats(self):
        """加载统计"""
        if self.stats_file.exists():
            with open(self.stats_file, 'r') as f:
                saved = json.load(f)
                if saved.get("version") == "V3.5":
                    self.stats = saved
                    print(f"📊 加载已有统计: {self.stats['total_trades']} 笔")
    
    def save_stats(self):
        """保存统计"""
        with open(self.stats_file, 'w') as f:
            json.dump(self.stats, f, indent=2, default=str)
    
    def log_audit(self, event: Dict):
        """记录审计日志"""
        event["timestamp"] = datetime.now().isoformat()
        with open(self.audit_file, 'a') as f:
            f.write(json.dumps(event) + "\n")
    
    def generate_signal(self, candles: list) -> Optional[V35Signal]:
        """
        生成信号（简化版）
        
        实际应该调用 scoring_engine
        这里简化为基于价格变化
        """
        if not candles or len(candles) < 10:
            return None
        
        # 计算简单指标
        prices = [c.get("close", c.get("c", 0)) for c in candles[-10:]]
        
        # 价格变化
        price_change = (prices[-1] - prices[0]) / prices[0] if prices[0] > 0 else 0
        
        # 成交量
        volumes = [c.get("volume", c.get("v", 0)) for c in candles[-10:]]
        avg_volume = sum(volumes) / len(volumes) if volumes else 1
        current_volume = volumes[-1] if volumes else 0
        volume_ratio = current_volume / avg_volume if avg_volume > 0 else 0
        
        # 评分（简化）
        score = 50  # 基础分
        
        # 价格变化加分
        if abs(price_change) > 0.002:
            score += 20
        elif abs(price_change) > 0.001:
            score += 10
        
        # 成交量加分
        if volume_ratio > 1.5:
            score += 15
        elif volume_ratio > 1.2:
            score += 10
        
        # 方向
        direction = "LONG" if price_change > 0 else "SHORT"
        
        return V35Signal(
            score=score,
            direction=direction,
            volume_ratio=volume_ratio,
            price_change=price_change
        )
    
    def get_mock_candles(self) -> list:
        """
        获取模拟 K线数据
        
        实际应该从 exchange 或 WebSocket 获取
        """
        import random
        
        base_price = 1900.0  # ETH
        candles = []
        
        for i in range(30):
            change = random.uniform(-0.002, 0.002)
            if i > 0:
                base_price = candles[-1]["close"]
            
            close = base_price * (1 + change)
            candles.append({
                "close": close,
                "volume": random.uniform(100, 200)
            })
        
        return candles
    
    def execute_trade(self, decision, candles: list) -> bool:
        """
        执行交易
        
        Returns:
            是否成功开仓
        """
        try:
            # 模拟执行（实际应该调用 execution_engine）
            entry_price = candles[-1].get("close", 1900.0)
            
            self.current_position = {
                "entry_price": entry_price,
                "entry_time": time.time(),
                "direction": decision.signal.direction,
                "size": 0.01,  # 模拟仓位
                "vol_class": decision.volatility_class,
                "params": decision.params
            }
            
            # 记录审计
            self.log_audit({
                "event": "ENTRY",
                "direction": decision.signal.direction,
                "entry_price": entry_price,
                "score": decision.signal.score,
                "regime": decision.regime,
                "vol_class": decision.volatility_class,
                "params": decision.params
            })
            
            print(f"\n🟢 开仓: {decision.signal.direction} @ {entry_price:.2f}")
            print(f"   Regime: {decision.regime} | Vol: {decision.volatility_class}")
            print(f"   TP: {decision.params['take_profit']*100:.2f}% | SL: {decision.params['stop_loss']*100:.2f}%")
            
            return True
            
        except Exception as e:
            print(f"❌ 执行错误: {e}")
            return False
    
    def check_exit(self, current_price: float) -> Optional[str]:
        """
        检查退出条件
        
        Returns:
            Exit 原因 或 None
        """
        if not self.current_position:
            return None
        
        return self.strategy.check_exit(
            self.current_position,
            current_price,
            self.current_position.get("vol_class", "MID")
        )
    
    def close_position(self, exit_reason: str, exit_price: float):
        """平仓"""
        if not self.current_position:
            return
        
        entry_price = self.current_position["entry_price"]
        direction = self.current_position["direction"]
        
        # 计算 PnL
        if direction == "LONG":
            pnl = (exit_price - entry_price) / entry_price
        else:
            pnl = (entry_price - exit_price) / entry_price
        
        # 更新统计
        self.stats["total_trades"] += 1
        self.stats["total_pnl"] += pnl
        
        if pnl > 0:
            self.stats["wins"] += 1
        else:
            self.stats["losses"] += 1
        
        # Exit 分布
        if exit_reason in self.stats["exit_distribution"]:
            self.stats["exit_distribution"][exit_reason] += 1
        
        # Volatility 分布
        vol_class = self.current_position.get("vol_class", "MID")
        if vol_class in self.stats["volatility_distribution"]:
            self.stats["volatility_distribution"][vol_class] += 1
        
        # 记录交易
        trade = {
            "entry_price": entry_price,
            "exit_price": exit_price,
            "pnl": pnl,
            "exit_reason": exit_reason,
            "direction": direction,
            "vol_class": vol_class,
            "hold_time": time.time() - self.current_position["entry_time"]
        }
        self.stats["trades"].append(trade)
        
        # 更新策略统计
        self.stats["strategy_stats"] = self.strategy.get_stats()
        
        # 保存
        self.save_stats()
        
        # 审计
        self.log_audit({
            "event": "EXIT",
            "exit_reason": exit_reason,
            "exit_price": exit_price,
            "pnl": pnl,
            "hold_time": trade["hold_time"]
        })
        
        # 打印
        emoji = "✅" if pnl > 0 else "❌"
        print(f"\n{emoji} 平仓: {exit_reason} @ {exit_price:.2f}")
        print(f"   PnL: {pnl*100:.4f}%")
        print(f"   总交易: {self.stats['total_trades']} / {self.TARGET_TRADES}")
        
        # 清空持仓
        self.current_position = None
    
    def run_cycle(self):
        """单次运行周期"""
        # 1. 检查 Kill Switch
        if self.kill_switch.is_triggered():
            print("🛑 Kill Switch 触发，停止运行")
            self.running = False
            return
        
        # 2. 获取数据
        candles = self.get_mock_candles()
        
        # 3. 如果有持仓，检查退出
        if self.current_position:
            current_price = candles[-1].get("close", 1900.0)
            exit_reason = self.check_exit(current_price)
            
            if exit_reason:
                self.close_position(exit_reason, current_price)
            
            return  # 有持仓时不开新仓
        
        # 4. 生成信号
        signal = self.generate_signal(candles)
        if not signal:
            return
        
        # 5. V3.5 决策
        decision = self.strategy.should_enter(signal, candles)
        
        if decision.should_enter:
            # 6. 执行
            self.execute_trade(decision, candles)
    
    def run(self):
        """主运行循环"""
        print("\n🚀 开始运行 V3.5...")
        
        self.running = True
        self.load_stats()
        
        cycle_count = 0
        
        while self.running and self.stats["total_trades"] < self.TARGET_TRADES:
            cycle_count += 1
            
            try:
                self.run_cycle()
                
                # 每 10 个周期打印状态
                if cycle_count % 10 == 0:
                    print(f"⏱️  周期 {cycle_count} | 交易 {self.stats['total_trades']}/{self.TARGET_TRADES}")
                
                # 检查是否完成
                if self.stats["total_trades"] >= self.TARGET_TRADES:
                    print("\n" + "=" * 60)
                    print("🎉 V3.5 验证完成！")
                    print("=" * 60)
                    self.print_report()
                    break
                
                # 等待
                time.sleep(5)  # 5秒一个周期
                
            except KeyboardInterrupt:
                print("\n⏸️  用户中断")
                self.running = False
            except Exception as e:
                print(f"❌ 运行错误: {e}")
                time.sleep(10)
        
        # 保存最终统计
        self.stats["end_time"] = datetime.now().isoformat()
        self.save_stats()
    
    def print_report(self):
        """打印验证报告"""
        total = self.stats["total_trades"]
        if total == 0:
            print("❌ 无交易数据")
            return
        
        wins = self.stats["wins"]
        losses = self.stats["losses"]
        total_pnl = self.stats["total_pnl"]
        
        win_rate = wins / total * 100 if total > 0 else 0
        avg_pnl = total_pnl / total if total > 0 else 0
        
        avg_win = sum(t["pnl"] for t in self.stats["trades"] if t["pnl"] > 0) / wins if wins > 0 else 0
        avg_loss = sum(t["pnl"] for t in self.stats["trades"] if t["pnl"] < 0) / losses if losses > 0 else 0
        
        profit_factor = abs(sum(t["pnl"] for t in self.stats["trades"] if t["pnl"] > 0) / 
                           sum(t["pnl"] for t in self.stats["trades"] if t["pnl"] < 0)) if losses > 0 else 0
        
        expectancy = (win_rate/100 * avg_win) + ((1 - win_rate/100) * avg_loss) if total > 0 else 0
        
        print("\n" + "=" * 60)
        print("📊 V3.5 验证报告")
        print("=" * 60)
        print(f"📈 总交易数: {total}")
        print(f"✅ 胜率: {win_rate:.1f}%")
        print(f"💰 总盈亏: {total_pnl*100:.4f}%")
        print(f"📊 平均盈亏: {avg_pnl*100:.4f}%")
        print()
        print(f"🎯 Profit Factor: {profit_factor:.2f}")
        print(f"📈 Expectancy: {expectancy*100:.4f}%")
        print(f"✅ 平均盈利: {avg_win*100:.4f}%")
        print(f"❌ 平均亏损: {avg_loss*100:.4f}%")
        print()
        print("📊 Exit 分布:")
        for reason, count in self.stats["exit_distribution"].items():
            pct = count / total * 100 if total > 0 else 0
            print(f"   {reason}: {count} ({pct:.1f}%)")
        print()
        print("📊 Volatility 分布:")
        for vol, count in self.stats["volatility_distribution"].items():
            pct = count / total * 100 if total > 0 else 0
            print(f"   {vol}: {count} ({pct:.1f}%)")
        print("=" * 60)
        
        # 判断结果
        if profit_factor > 1.0:
            print("🟢 V3.5 策略有效！profit_factor > 1")
        elif profit_factor > 0.9:
            print("🟡 V3.5 接近有效，需要更多数据")
        else:
            print("🔴 V3.5 需要迭代，profit_factor < 1")


def main():
    """入口"""
    runner = V35Runner()
    runner.run()


if __name__ == "__main__":
    main()