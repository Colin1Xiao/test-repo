#!/usr/bin/env python3
"""
V3.5 自适应策略 - 同步版运行器

核心升级：
1. Regime Filter → 只在 TREND 交易
2. Volatility Filter → LOW 波动不交易
3. Dynamic TP/SL → 根据波动强度调整
4. Trend Alignment → 顺势交易

目标：跑 30 笔验证 V3.5 策略
"""

import sys
import os
import json
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
import ccxt

# 添加路径
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / 'core'))

# V3.5 核心模块
from core.v35_strategy import V35Strategy, V35Signal, get_v35_strategy
from core.v35_volatility import get_volatility_filter
from core.kill_switch import KillSwitch


class V35LiveTrading:
    """V3.5 自适应策略实盘（同步版本）"""
    
    TARGET_TRADES = 30
    
    def __init__(self):
        """初始化"""
        # 交易所（使用代理）
        self.exchange = ccxt.okx({
            'enableRateLimit': True,
            'options': {'defaultType': 'swap'},
            'proxies': {
                'http': 'http://127.0.0.1:7890',
                'https': 'http://127.0.0.1:7890'
            }
        })
        
        self.symbol = 'ETH/USDT:USDT'
        
        # V3.5 核心策略
        self.strategy = get_v35_strategy()
        self.volatility_filter = get_volatility_filter()
        self.kill_switch = KillSwitch()
        
        # 数据目录
        self.data_dir = Path(__file__).parent / 'data'
        self.data_dir.mkdir(exist_ok=True)
        
        # V3.5 专用统计文件
        self.stats_file = self.data_dir / 'v35_stats.json'
        self.audit_file = self.data_dir / 'v35_audit.jsonl'
        
        # 初始化统计
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
            "regime_distribution": {
                "trend": 0,
                "range": 0,
                "breakout": 0
            },
            "reject_stats": {
                "regime": 0,
                "volatility": 0,
                "score": 0,
                "direction": 0,
                "volume": 0,
                "price_change": 0
            },
            "signals_checked": 0,
            "signals_passed": 0
        }
        
        self.current_position = None
        self.running = False
        
        self._print_header()
    
    def _print_header(self):
        print("=" * 60, flush=True)
        print("🚀 V3.5 自适应策略启动", flush=True)
        print("=" * 60, flush=True)
        print("核心升级：", flush=True)
        print("  1️⃣ Regime Filter → 只在 TREND 交易", flush=True)
        print("  2️⃣ Volatility Filter → LOW 波动不交易", flush=True)
        print("  3️⃣ Dynamic TP/SL → 随市场调整", flush=True)
        print("  4️⃣ Trend Alignment → 顺势交易", flush=True)
        print(flush=True)
        print("Entry 阈值：Score ≥ 65 | Volume > 1.1x | Price Change > 0.1%", flush=True)
        print("动态参数：MID: TP=0.20%, SL=0.06%, Time=60s", flush=True)
        print("         HIGH: TP=0.35%, SL=0.10%, Time=90s", flush=True)
        print(f"🎯 目标: {self.TARGET_TRADES} 笔", flush=True)
        print("=" * 60, flush=True)
    
    def _load_stats(self):
        if self.stats_file.exists():
            with open(self.stats_file, 'r') as f:
                saved = json.load(f)
                if saved.get("version") == "V3.5":
                    self.stats = saved
                    print(f"📊 加载已有统计: {self.stats['total_trades']} 笔", flush=True)
    
    def _save_stats(self):
        with open(self.stats_file, 'w') as f:
            json.dump(self.stats, f, indent=2, default=str)
    
    def _log_audit(self, event: Dict):
        event["timestamp"] = datetime.now().isoformat()
        with open(self.audit_file, 'a') as f:
            f.write(json.dumps(event) + "\n")
    
    def fetch_candles(self, limit: int = 60) -> List[Dict]:
        try:
            ohlcv = self.exchange.fetch_ohlcv(self.symbol, '1m', limit=limit)
            candles = []
            for row in ohlcv:
                candles.append({
                    "timestamp": row[0],
                    "open": row[1],
                    "high": row[2],
                    "low": row[3],
                    "close": row[4],
                    "volume": row[5]
                })
            return candles
        except Exception as e:
            print(f"❌ 获取 K 线错误: {e}", flush=True)
            return []
    
    def generate_signal_from_data(self, candles: List[Dict]) -> Optional[V35Signal]:
        if len(candles) < 20:
            return None
        
        prices = [c["close"] for c in candles[-20:]]
        volumes = [c["volume"] for c in candles[-20:]]
        
        price_change = (prices[-1] - prices[0]) / prices[0]
        
        avg_volume = sum(volumes[:-5]) / len(volumes[:-5]) if len(volumes) > 5 else 1
        current_volume = volumes[-1]
        volume_ratio = current_volume / avg_volume if avg_volume > 0 else 0
        
        score = 50
        if abs(price_change) > 0.003:
            score += 20
        elif abs(price_change) > 0.002:
            score += 15
        elif abs(price_change) > 0.001:
            score += 10
        
        if volume_ratio > 1.5:
            score += 15
        elif volume_ratio > 1.2:
            score += 10
        elif volume_ratio > 1.0:
            score += 5
        
        momentum = (prices[-1] - prices[-5]) / prices[-5] if prices[-5] > 0 else 0
        if abs(momentum) > 0.002:
            score += 10
        
        direction = "LONG" if price_change > 0 else "SHORT"
        
        return V35Signal(
            score=score,
            direction=direction,
            volume_ratio=volume_ratio,
            price_change=price_change
        )
    
    def check_entry(self):
        candles = self.fetch_candles()
        if not candles:
            return
        
        signal = self.generate_signal_from_data(candles)
        if not signal:
            return
        
        self.stats["signals_checked"] += 1
        
        decision = self.strategy.should_enter(signal, candles)
        
        if not decision.should_enter:
            reason = decision.reason
            for key in ["regime", "volatility", "score", "direction", "volume", "price_change"]:
                if key.upper() in reason:
                    self.stats["reject_stats"][key] += 1
                    break
        
        if self.stats["signals_checked"] % 10 == 0:
            print(f"⏱️  信号检查: {self.stats['signals_checked']} | 通过: {self.stats['signals_passed']}", flush=True)
        
        if not decision.should_enter:
            return
        
        self.execute_entry(decision, candles[-1]["close"])
    
    def execute_entry(self, decision, entry_price: float):
        print(f"\n🟢 V3.5 开仓信号", flush=True)
        print(f"   Score: {decision.signal.score} | Direction: {decision.signal.direction}", flush=True)
        print(f"   Regime: {decision.regime} | Volatility: {decision.volatility_class}", flush=True)
        print(f"   TP: {decision.params['take_profit']*100:.2f}% | SL: {decision.params['stop_loss']*100:.2f}%", flush=True)
        
        self.current_position = {
            "symbol": self.symbol,
            "entry_price": entry_price,
            "entry_time": time.time(),
            "direction": decision.signal.direction,
            "size": 0.01,
            "vol_class": decision.volatility_class,
            "params": decision.params
        }
        
        self.stats["signals_passed"] += 1
        self.stats["regime_distribution"][decision.regime] += 1
        
        self._log_audit({
            "event": "ENTRY",
            "symbol": self.symbol,
            "direction": decision.signal.direction,
            "entry_price": entry_price,
            "score": decision.signal.score,
            "regime": decision.regime,
            "vol_class": decision.volatility_class
        })
        
        print(f"   ✅ 入场成功 @ {entry_price:.2f}", flush=True)
    
    def check_exit(self):
        if not self.current_position:
            return
        
        candles = self.fetch_candles(limit=1)
        if not candles:
            return
        
        current_price = candles[0]["close"]
        
        exit_reason = self.strategy.check_exit(
            self.current_position,
            current_price,
            self.current_position.get("vol_class", "MID")
        )
        
        if exit_reason:
            self.execute_exit(exit_reason, current_price)
    
    def execute_exit(self, exit_reason: str, exit_price: float):
        if not self.current_position:
            return
        
        entry_price = self.current_position["entry_price"]
        direction = self.current_position["direction"]
        
        if direction == "LONG":
            pnl = (exit_price - entry_price) / entry_price
        else:
            pnl = (entry_price - exit_price) / entry_price
        
        self.stats["total_trades"] += 1
        self.stats["total_pnl"] += pnl
        
        if pnl > 0:
            self.stats["wins"] += 1
        else:
            self.stats["losses"] += 1
        
        if exit_reason in self.stats["exit_distribution"]:
            self.stats["exit_distribution"][exit_reason] += 1
        
        vol_class = self.current_position.get("vol_class", "MID")
        if vol_class in self.stats["volatility_distribution"]:
            self.stats["volatility_distribution"][vol_class] += 1
        
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
        
        self._save_stats()
        
        self._log_audit({
            "event": "EXIT",
            "exit_reason": exit_reason,
            "exit_price": exit_price,
            "pnl": pnl,
            "hold_time": trade["hold_time"]
        })
        
        emoji = "✅" if pnl > 0 else "❌"
        print(f"\n{emoji} V3.5 平仓: {exit_reason}", flush=True)
        print(f"   Entry: {entry_price:.2f} → Exit: {exit_price:.2f}", flush=True)
        print(f"   PnL: {pnl*100:.4f}%", flush=True)
        print(f"   总交易: {self.stats['total_trades']}/{self.TARGET_TRADES}", flush=True)
        
        self.current_position = None
        
        if self.stats["total_trades"] >= self.TARGET_TRADES:
            print("\n🎉 V3.5 验证完成！", flush=True)
            self.print_report()
            self.running = False
    
    def print_report(self):
        total = self.stats["total_trades"]
        if total == 0:
            print("❌ 无交易数据", flush=True)
            return
        
        wins = self.stats["wins"]
        losses = self.stats["losses"]
        total_pnl = self.stats["total_pnl"]
        
        win_rate = wins / total * 100 if total > 0 else 0
        avg_pnl = total_pnl / total if total > 0 else 0
        
        winning_trades = [t for t in self.stats["trades"] if t["pnl"] > 0]
        losing_trades = [t for t in self.stats["trades"] if t["pnl"] < 0]
        
        total_wins = sum(t["pnl"] for t in winning_trades)
        total_losses = abs(sum(t["pnl"] for t in losing_trades))
        
        profit_factor = total_wins / total_losses if total_losses > 0 else 0
        avg_win = total_wins / len(winning_trades) if winning_trades else 0
        avg_loss = total_losses / len(losing_trades) if losing_trades else 0
        expectancy = (win_rate/100 * avg_win) - ((1 - win_rate/100) * avg_loss)
        
        print("\n" + "=" * 60, flush=True)
        print("📊 V3.5 验证报告", flush=True)
        print("=" * 60, flush=True)
        print(f"📈 总交易数: {total}", flush=True)
        print(f"✅ 胜率: {win_rate:.1f}%", flush=True)
        print(f"💰 总盈亏: {total_pnl*100:.4f}%", flush=True)
        print(f"🎯 Profit Factor: {profit_factor:.2f}", flush=True)
        print(f"📈 Expectancy: {expectancy*100:.4f}%", flush=True)
        print("=" * 60, flush=True)
        
        if profit_factor > 1.0:
            print("🟢 V3.5 策略有效！profit_factor > 1", flush=True)
        elif profit_factor > 0.9:
            print("🟡 V3.5 接近有效，需要更多数据", flush=True)
        else:
            print("🔴 V3.5 需要迭代，profit_factor < 1", flush=True)
    
    def run(self):
        print("\n🚀 开始运行 V3.5...", flush=True)
        
        self.running = True
        self._load_stats()
        
        cycle_count = 0
        
        while self.running:
            cycle_count += 1
            
            try:
                if self.kill_switch.is_killed():
                    print("🛑 Kill Switch 触发", flush=True)
                    break
                
                if self.stats["total_trades"] >= self.TARGET_TRADES:
                    print(f"\n✅ 已达到目标: {self.TARGET_TRADES} 笔", flush=True)
                    break
                
                if self.current_position:
                    self.check_exit()
                else:
                    self.check_entry()
                
                if cycle_count % 60 == 0:
                    print(f"⏱️  周期 {cycle_count} | 交易 {self.stats['total_trades']}/{self.TARGET_TRADES}", flush=True)
                
                time.sleep(5)
                
            except KeyboardInterrupt:
                print("\n⏸️  用户中断", flush=True)
                break
            except Exception as e:
                print(f"❌ 运行错误: {e}", flush=True)
                time.sleep(10)
        
        self.stats["end_time"] = datetime.now().isoformat()
        self._save_stats()
        
        print("\n👋 V3.5 停止", flush=True)
        self.print_report()


def main():
    trader = V35LiveTrading()
    trader.run()


if __name__ == "__main__":
    main()