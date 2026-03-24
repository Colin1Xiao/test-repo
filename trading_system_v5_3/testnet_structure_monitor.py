#!/usr/bin/env python3
"""
Testnet 结构监控器
新增：连续性监控（Clustering）+ 状态标签
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime
from collections import deque
import json

sys.path.insert(0, str(Path(__file__).parent / 'core'))

from enhanced_analyzer import EnhancedAnalyzer
from scoring_engine_v423 import ScoringEngineV423
from environment_filter_v1 import EnvironmentFilterV1, EnvironmentContext


class StructureMonitor(EnhancedAnalyzer):
    """
    结构监控器
    
    核心升级：
    1. 连续性监控（consecutive_70+）
    2. 状态标签（PRE_SIGNAL / BUILDING / TRIGGER_ZONE / ACTIVE）
    3. 结构切换判断
    
    状态定义：
    - PRE_SIGNAL: 70+频率<10%，无结构
    - BUILDING: 70+频率>=15% 且 连续70+>=3，结构形成中
    - TRIGGER_ZONE: Score>=80 且 连续70+>=2，接近触发
    - ACTIVE: Score>=85，信号触发
    """
    
    def __init__(self):
        symbols = ['BTC/USDT:USDT', 'ETH/USDT:USDT']
        super().__init__(symbols=symbols)
        
        self.scoring_engine = ScoringEngineV423()
        self.env_filter = EnvironmentFilterV1()
        
        # 监控窗口
        self.score_window = deque(maxlen=20)  # 最近20次评分
        self.consecutive_70 = 0  # 连续70+计数
        self.current_state = "PRE_SIGNAL"
        
        # 统计
        self.state_history = []
        
        print("=" * 80)
        print("🚀 Testnet 结构监控器")
        print("=" * 80)
        print("📋 核心升级: 连续性监控 + 状态标签")
        print("")
        print("🎯 四状态定义:")
        print("  ❄️  PRE_SIGNAL   : 70+频率<10%，无结构")
        print("  ⚠️  BUILDING     : 70+频率>=15% 且 连续70+>=3，结构形成中")
        print("  🔥 TRIGGER_ZONE  : Score>=80 且 连续70+>=2，接近触发")
        print("  🚀 ACTIVE        : Score>=85，信号触发")
        print("")
    
    def _extract_hour(self, timestamp: str) -> int:
        try:
            if ' ' in timestamp:
                return int(timestamp.split(' ')[1].split(':')[0])
            return 0
        except:
            return 0
    
    def _calc_volume_ratio(self, df) -> float:
        try:
            current_vol = df['volume'].iloc[-1]
            avg_vol = df['volume'].tail(20).mean()
            return float(current_vol / avg_vol) if avg_vol > 0 else 0.0
        except:
            return 0.0
    
    def _update_consecutive_70(self, score: int):
        """更新连续70+计数"""
        if score >= 70:
            self.consecutive_70 += 1
        else:
            self.consecutive_70 = 0
    
    def _determine_state(self, score: int, high_70_ratio: float) -> str:
        """
        确定当前状态
        
        优先级：ACTIVE > TRIGGER_ZONE > BUILDING > PRE_SIGNAL
        """
        # ACTIVE: Score>=85
        if score >= 85:
            return "ACTIVE"
        
        # TRIGGER_ZONE: Score>=80 且 连续70+>=2
        if score >= 80 and self.consecutive_70 >= 2:
            return "TRIGGER_ZONE"
        
        # BUILDING: 70+频率>=15% 且 连续70+>=3
        if high_70_ratio >= 15 and self.consecutive_70 >= 3:
            return "BUILDING"
        
        # PRE_SIGNAL: 默认状态
        return "PRE_SIGNAL"
    
    def _get_state_emoji(self, state: str) -> str:
        """获取状态emoji"""
        return {
            "PRE_SIGNAL": "❄️",
            "BUILDING": "⚠️",
            "TRIGGER_ZONE": "🔥",
            "ACTIVE": "🚀"
        }.get(state, "❓")
    
    async def monitor_cycle(self):
        """监控一个周期"""
        for symbol in self.symbols:
            df = await self.fetch_historical_ohlcv(symbol, hours=1)
            if df is None or len(df) < 30:
                continue
            
            current = df.iloc[-1]
            window = df.tail(30)
            
            # 评分
            score_breakdown = self.scoring_engine.calculate_score(
                ohlcv_df=window,
                current_price=current['close'],
                spread_bps=2.0,
                rl_decision='ALLOW'
            )
            
            score = score_breakdown.total_score
            gap = 85 - score
            
            # 更新窗口
            self.score_window.append(score)
            self._update_consecutive_70(score)
            
            # 计算70+频率
            if len(self.score_window) > 0:
                high_70_count = sum(1 for s in self.score_window if s >= 70)
                high_70_ratio = high_70_count / len(self.score_window) * 100
            else:
                high_70_ratio = 0
            
            # 确定状态
            new_state = self._determine_state(score, high_70_ratio)
            
            # 状态切换检测
            if new_state != self.current_state:
                old_state = self.current_state
                self.current_state = new_state
                
                # 记录状态切换
                transition = {
                    'timestamp': datetime.now().isoformat(),
                    'symbol': symbol,
                    'from_state': old_state,
                    'to_state': new_state,
                    'score': score,
                    'high_70_ratio': high_70_ratio,
                    'consecutive_70': self.consecutive_70
                }
                self.state_history.append(transition)
                
                # 状态切换预警
                emoji = self._get_state_emoji(new_state)
                print(f"\n{'='*60}")
                print(f"{emoji} 状态切换: {old_state} → {new_state}")
                print(f"{'='*60}")
                print(f"品种: {symbol}")
                print(f"Score: {score} (Gap: {gap})")
                print(f"70+频率: {high_70_ratio:.1f}%")
                print(f"连续70+: {self.consecutive_70}")
                print(f"{'='*60}\n")
            
            # 常规输出
            emoji = self._get_state_emoji(self.current_state)
            status = "✅" if score >= 85 else "🟡" if score >= 80 else "⚠️" if score >= 70 else "❌"
            
            print(f"{emoji} {status} {symbol} | "
                  f"Score:{score:2d} Gap:{gap:2d} | "
                  f"70+:{high_70_ratio:4.1f}% | "
                  f"连续:{self.consecutive_70:2d} | "
                  f"状态:{self.current_state}")
    
    def generate_structure_report(self) -> str:
        """生成结构监控报告"""
        lines = []
        lines.append("=" * 80)
        lines.append("📊 结构监控报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"当前状态: {self._get_state_emoji(self.current_state)} {self.current_state}")
        lines.append("")
        
        # 当前评分窗口
        if self.score_window:
            lines.append("─" * 80)
            lines.append("📊 最近评分窗口")
            lines.append("─" * 80)
            lines.append(f"窗口大小: {len(self.score_window)}")
            lines.append(f"评分序列: {list(self.score_window)}")
            lines.append(f"最高Score: {max(self.score_window)}")
            lines.append(f"最低Score: {min(self.score_window)}")
            lines.append(f"平均Score: {sum(self.score_window)/len(self.score_window):.1f}")
            
            high_70_count = sum(1 for s in self.score_window if s >= 70)
            high_70_ratio = high_70_count / len(self.score_window) * 100
            lines.append(f"70+频率: {high_70_ratio:.1f}%")
            lines.append(f"连续70+: {self.consecutive_70}")
            lines.append("")
        
        # 状态切换历史
        if self.state_history:
            lines.append("─" * 80)
            lines.append("🔄 状态切换历史")
            lines.append("─" * 80)
            
            for i, transition in enumerate(self.state_history[-5:], 1):
                emoji_from = self._get_state_emoji(transition['from_state'])
                emoji_to = self._get_state_emoji(transition['to_state'])
                lines.append(f"\n切换 {i}:")
                lines.append(f"  时间: {transition['timestamp']}")
                lines.append(f"  品种: {transition['symbol']}")
                lines.append(f"  状态: {emoji_from} {transition['from_state']} → {emoji_to} {transition['to_state']}")
                lines.append(f"  Score: {transition['score']}")
                lines.append(f"  70+频率: {transition['high_70_ratio']:.1f}%")
                lines.append(f"  连续70+: {transition['consecutive_70']}")
        else:
            lines.append("  暂无状态切换记录")
        
        lines.append("")
        
        # 当前状态解读
        lines.append("=" * 80)
        lines.append("🔮 当前状态解读")
        lines.append("=" * 80)
        
        if self.current_state == "PRE_SIGNAL":
            lines.append("❄️ PRE_SIGNAL - 无结构")
            lines.append("  市场处于冷静期，无明确方向")
            lines.append("  建议: 保持待命，等待结构形成")
        elif self.current_state == "BUILDING":
            lines.append("⚠️ BUILDING - 结构形成中")
            lines.append("  70+频率和连续性同时满足")
            lines.append("  建议: 密切关注，准备进入TRIGGER_ZONE")
        elif self.current_state == "TRIGGER_ZONE":
            lines.append("🔥 TRIGGER_ZONE - 接近触发")
            lines.append("  Score>=80且连续70+>=2")
            lines.append("  建议: 进入注意状态，下一周期可能触发")
        elif self.current_state == "ACTIVE":
            lines.append("🚀 ACTIVE - 信号触发")
            lines.append("  Score>=85，交易信号已触发")
            lines.append("  建议: 执行交易（如环境过滤通过）")
        
        lines.append("")
        lines.append("=" * 80)
        lines.append("💡 核心认知:")
        lines.append("  不是等'一个信号'，而是等'市场状态切换'")
        lines.append("  当前状态切换概率: " + 
                    ("低" if self.current_state == "PRE_SIGNAL" else 
                     "中" if self.current_state == "BUILDING" else 
                     "高" if self.current_state == "TRIGGER_ZONE" else "已触发"))
        lines.append("=" * 80)
        
        return "\n".join(lines)


async def main():
    """主函数"""
    monitor = StructureMonitor()
    
    print("🚀 启动结构监控...")
    print("运行50个周期，监控状态切换...\n")
    
    for i in range(50):
        await monitor.monitor_cycle()
        await asyncio.sleep(0.5)
        
        # 每10个周期生成报告
        if (i + 1) % 10 == 0:
            print("\n" + "=" * 80)
            report = monitor.generate_structure_report()
            print(report)
            print("=" * 80 + "\n")
    
    # 最终报告
    print("\n" + "=" * 80)
    print("📊 最终报告")
    print("=" * 80)
    report = monitor.generate_structure_report()
    print(report)
    
    # 保存报告
    report_file = monitor.data_dir / 'testnet_structure_report.txt'
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n✅ 报告已保存: {report_file}")


if __name__ == "__main__":
    asyncio.run(main())
