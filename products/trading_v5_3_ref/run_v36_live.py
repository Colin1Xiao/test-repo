#!/usr/bin/env python3
"""V3.6 评分制策略运行器 - 修正版"""
import sys, json, time
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
import ccxt

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / 'core'))

from core.v36_strategy import V36Strategy, V36Signal, get_v36_strategy
from core.kill_switch import KillSwitch

class V36LiveTrading:
    TARGET_TRADES = 30
    
    def __init__(self):
        self.exchange = ccxt.okx({'enableRateLimit': True, 'options': {'defaultType': 'swap'}, 'proxies': {'http': 'http://127.0.0.1:7890', 'https': 'http://127.0.0.1:7890'}})
        self.symbol = 'ETH/USDT:USDT'
        self.strategy = get_v36_strategy()
        self.kill_switch = KillSwitch()
        self.data_dir = Path(__file__).parent / 'data'
        self.data_dir.mkdir(exist_ok=True)
        self.stats_file = self.data_dir / 'v36_stats.json'
        self.stats = {"version": "V3.6-修正版", "total_trades": 0, "wins": 0, "losses": 0, "total_pnl": 0.0, "trades": [], "signals_checked": 0, "signals_passed": 0}
        self.current_position = None
        self.running = False
        print("=" * 60, flush=True)
        print("🚀 V3.6 评分制策略（修正版）启动", flush=True)
        print("⚠️ 无硬过滤：所有条件参与评分", flush=True)
        print("评分: Regime(0-2) + Vol(0-2) + Signal(0-1) + Dir(0-1) + Vol(0-1) + Price(0-1)", flush=True)
        print(f"🎯 入场: score >= 4 | 目标: {self.TARGET_TRADES} 笔", flush=True)
        print("=" * 60, flush=True)
    
    def _save(self):
        with open(self.stats_file, 'w') as f: json.dump(self.stats, f, indent=2)
    
    def fetch(self, limit=60):
        try: return [{"close": r[4], "volume": r[5]} for r in self.exchange.fetch_ohlcv(self.symbol, '1m', limit=limit)]
        except: return []
    
    def signal(self, c):
        if len(c) < 20: return None
        p = [x["close"] for x in c[-20:]]
        v = [x["volume"] for x in c[-20:]]
        pc = (p[-1] - p[0]) / p[0]
        av = sum(v[:-5]) / len(v[:-5]) if len(v) > 5 else 1
        vr = v[-1] / av if av > 0 else 0
        s = 50
        if abs(pc) > 0.003: s += 20
        elif abs(pc) > 0.002: s += 15
        if vr > 1.5: s += 15
        return V36Signal(score=s, direction="LONG" if pc > 0 else "SHORT", volume_ratio=vr, price_change=pc)
    
    def check_entry(self):
        c = self.fetch()
        if not c: return
        sig = self.signal(c)
        if not sig: return
        self.stats["signals_checked"] += 1
        d = self.strategy.should_enter(sig, c)
        if not d.should_enter: return
        print(f"\n🟢 开仓 | 评分: {d.entry_score} | {d.breakdown}", flush=True)
        self.current_position = {"entry_price": c[-1]["close"], "entry_time": time.time(), "direction": d.trend_direction, "vol_score": d.vol_score, "params": d.params}
        self.stats["signals_passed"] += 1
    
    def check_exit(self):
        if not self.current_position: return
        c = self.fetch(10)
        if not c: return
        ex = self.strategy.check_exit(self.current_position, c[-1]["close"], c)
        if ex:
            ep = self.current_position["entry_price"]
            pnl = (c[-1]["close"] - ep) / ep
            if self.current_position["direction"] == "SHORT": pnl = -pnl
            self.stats["total_trades"] += 1
            self.stats["total_pnl"] += pnl
            self.stats["wins" if pnl > 0 else "losses"] += 1
            self.stats["trades"].append({"pnl": pnl})
            self._save()
            print(f"\n{'✅' if pnl > 0 else '❌'} 平仓: {ex} | PnL: {pnl*100:.4f}%", flush=True)
            print(f"   总交易: {self.stats['total_trades']}/{self.TARGET_TRADES}", flush=True)
            self.current_position = None
            if self.stats["total_trades"] >= self.TARGET_TRADES:
                self.report()
                self.running = False
    
    def report(self):
        t = self.stats["total_trades"]
        if t == 0: return
        wr = self.stats["wins"] / t * 100
        w = [x for x in self.stats["trades"] if x["pnl"] > 0]
        l = [x for x in self.stats["trades"] if x["pnl"] < 0]
        tw, tl = sum(x["pnl"] for x in w), abs(sum(x["pnl"] for x in l))
        pf = tw / tl if tl > 0 else 0
        print(f"\n📊 总交易: {t} | 胜率: {wr:.1f}% | PF: {pf:.2f}", flush=True)
        print("🟢 有效！" if pf > 1.0 else "🔴 需迭代", flush=True)
    
    def run(self):
        print("\n🚀 运行中...", flush=True)
        self.running = True
        i = 0
        while self.running:
            try:
                i += 1
                if self.kill_switch.is_killed() or self.stats["total_trades"] >= self.TARGET_TRADES: break
                self.check_exit() if self.current_position else self.check_entry()
                if i % 60 == 0: print(f"⏱️  周期 {i} | 交易 {self.stats['total_trades']}/{self.TARGET_TRADES}", flush=True)
                time.sleep(5)
            except KeyboardInterrupt: break
        self._save()
        self.report()

if __name__ == "__main__":
    V36LiveTrading().run()