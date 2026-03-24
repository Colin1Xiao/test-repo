#!/usr/bin/env python3
"""V3.8 运行器 - 动态 Trailing"""
import sys, json, time
from pathlib import Path
from datetime import datetime
import ccxt

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / 'core'))

from core.v38_strategy import V38Strategy, V38Signal, get_v38_strategy
from core.kill_switch import KillSwitch

class V38LiveTrading:
    TARGET_TRADES = 30
    
    def __init__(self):
        self.exchange = ccxt.okx({'enableRateLimit': True, 'options': {'defaultType': 'swap'}, 'proxies': {'http': 'http://127.0.0.1:7890', 'https': 'http://127.0.0.1:7890'}})
        self.symbol = 'ETH/USDT:USDT'
        self.strategy = get_v38_strategy()
        self.kill_switch = KillSwitch()
        self.data_dir = Path(__file__).parent / 'data'
        self.data_dir.mkdir(exist_ok=True)
        self.stats_file = self.data_dir / 'v38_stats.json'
        self.stats = {
            "version": "V3.8", "total_trades": 0, "wins": 0, "losses": 0, "total_pnl": 0.0,
            "trades": [], "exit_distribution": {"STOP_LOSS": 0, "TRAILING_STOP": 0, "TIME_EXIT": 0},
            "signals_checked": 0, "signals_passed": 0,
            "trailing_stages": {"conservative": 0, "moderate": 0, "aggressive": 0}
        }
        self.current_position = None
        self.running = False
        print("="*60, flush=True)
        print("🚀 V3.8 动态 Trailing 启动", flush=True)
        print("="*60, flush=True)
        print("核心改变：动态 trailing (0.15%/0.20%/0.30%)", flush=True)
        print(f"🎯 目标: {self.TARGET_TRADES} 笔", flush=True)
        print("="*60, flush=True)
    
    def _save(self): json.dump(self.stats, open(self.stats_file, 'w'), indent=2)
    
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
        elif vr > 1.2: s += 10
        return V38Signal(score=s, direction="LONG" if pc > 0 else "SHORT", volume_ratio=vr, price_change=pc)
    
    def check_entry(self):
        c = self.fetch()
        if not c: return
        sig = self.signal(c)
        if not sig: return
        self.stats["signals_checked"] += 1
        d = self.strategy.should_enter(sig, c)
        if not d.should_enter: return
        print(f"\n🟢 开仓 | 评分: {d.entry_score}", flush=True)
        self.current_position = {
            "entry_price": c[-1]["close"], "entry_time": time.time(),
            "direction": d.trend_direction, "peak_price": c[-1]["close"]
        }
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
            self.stats["exit_distribution"][ex] = self.stats["exit_distribution"].get(ex, 0) + 1
            self.stats["trailing_stages"] = self.strategy.stats["trailing_stages"].copy()
            self.stats["trades"].append({"pnl": pnl, "exit_reason": ex})
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
        trades = self.stats["trades"]
        w = [x for x in trades if x["pnl"] > 0]
        l = [x for x in trades if x["pnl"] < 0]
        aw = sum(x["pnl"] for x in w) / len(w) if w else 0
        al = abs(sum(x["pnl"] for x in l) / len(l)) if l else 0
        pf = (aw * len(w)) / (al * len(l)) if l else 0
        wr = len(w) / t * 100
        max_win = max([x["pnl"] for x in trades]) if trades else 0
        
        print("\n" + "="*60, flush=True)
        print("📊 V3.8 验证报告", flush=True)
        print("="*60, flush=True)
        print(f"📈 总交易: {t} | 胜率: {wr:.1f}%", flush=True)
        print(f"💰 总盈亏: {self.stats['total_pnl']*100:.4f}%", flush=True)
        print(f"🎯 PF: {pf:.2f}", flush=True)
        print(f"✅ avg_win: {aw*100:.4f}% | ❌ avg_loss: {al*100:.4f}%", flush=True)
        print(f"🏆 max_win: {max_win*100:.4f}%", flush=True)
        print()
        print("Exit:", self.stats["exit_distribution"], flush=True)
        print("Trailing:", self.stats["trailing_stages"], flush=True)
        print("="*60, flush=True)
        
        if pf >= 1.2: print("🟢 成功！", flush=True)
        elif pf >= 1.0: print("🟡 临界", flush=True)
        else: print("🔴 需迭代", flush=True)
    
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
    V38LiveTrading().run()