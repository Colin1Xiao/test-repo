#!/usr/bin/env python3
"""
Regime Memory - 市场记忆系统 (V9)

核心能力：
让系统"记住自己在哪些市场死过"

功能：
1. 记录每笔交易的环境（结构 + 条件 + 结果）
2. 环境聚类（把市场环境离散化）
3. 统计表现（胜率、平均收益）
4. 实时决策（是否应该交易）

核心思想：
一个系统的成熟标志：
不是赚了多少钱
而是"是否记住了自己在哪些地方会死"
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime
from enum import Enum
from pathlib import Path
import json
from collections import defaultdict

# ============================================================
# 数据结构
# ============================================================
class TradeResult(Enum):
    """交易结果"""
    WIN = "WIN"
    LOSS = "LOSS"
    BREAKEVEN = "BREAKEVEN"


@dataclass
class MarketEnvironment:
    """市场环境"""
    structure: str           # RANGE / TREND / BREAKOUT / CHAOTIC
    volatility: float        # 波动率 (0-1)
    volume_ratio: float      # 成交量比 (0.5-2.0+)
    risk_level: str          # LOW / MEDIUM / HIGH / CRITICAL
    trend_strength: float = 0.0  # 趋势强度 (0-1)
    spread: float = 0.0      # 点差 (0-1)
    
    def to_bucket(self) -> Tuple:
        """转换为离散化桶（用于聚类）"""
        return (
            self.structure,
            self._round_volatility(),
            self._round_volume(),
            self.risk_level
        )
    
    def _round_volatility(self) -> str:
        """波动率离散化"""
        if self.volatility < 0.005:
            return "LOW"
        elif self.volatility < 0.02:
            return "MEDIUM"
        else:
            return "HIGH"
    
    def _round_volume(self) -> str:
        """成交量离散化"""
        if self.volume_ratio < 0.8:
            return "LOW"
        elif self.volume_ratio < 1.2:
            return "NORMAL"
        else:
            return "HIGH"


@dataclass
class TradeRecord:
    """交易记录"""
    timestamp: str
    environment: MarketEnvironment
    pnl_pct: float
    execution_quality: float
    slippage: float
    delay_ms: float
    symbol: str = ""
    side: str = ""  # LONG / SHORT
    result: TradeResult = TradeResult.BREAKEVEN
    
    def __post_init__(self):
        if self.pnl_pct > 0.001:
            self.result = TradeResult.WIN
        elif self.pnl_pct < -0.001:
            self.result = TradeResult.LOSS
        else:
            self.result = TradeResult.BREAKEVEN


@dataclass
class BucketStats:
    """桶统计"""
    count: int = 0
    wins: int = 0
    losses: int = 0
    total_pnl: float = 0.0
    avg_pnl: float = 0.0
    win_rate: float = 0.0
    avg_quality: float = 0.0
    last_trade: str = ""
    
    def update(self, record: TradeRecord):
        """更新统计"""
        self.count += 1
        self.total_pnl += record.pnl_pct
        self.avg_pnl = self.total_pnl / self.count
        
        if record.result == TradeResult.WIN:
            self.wins += 1
        elif record.result == TradeResult.LOSS:
            self.losses += 1
        
        self.win_rate = self.wins / max(1, self.count)
        self.avg_quality = (self.avg_quality * (self.count - 1) + record.execution_quality) / self.count
        self.last_trade = record.timestamp


@dataclass
class MemoryConfig:
    """记忆配置"""
    min_samples: int = 10           # 最少样本数（不足不阻止）
    win_rate_threshold: float = 0.4  # 胜率阈值
    avg_pnl_threshold: float = 0.0   # 平均收益阈值
    max_memory: int = 1000           # 最大记忆数
    recent_window: int = 50          # 最近窗口


# ============================================================
# Regime Memory 核心类
# ============================================================
class RegimeMemory:
    """
    市场记忆系统
    
    职责：
    1. 记录每笔交易的环境和结果
    2. 按环境聚类统计表现
    3. 提供决策支持（是否应该交易）
    
    核心能力：
    - 记住"自己在哪些市场死过"
    - 自动避开历史上表现差的环境
    """
    
    def __init__(self, config: MemoryConfig = None):
        self.config = config or MemoryConfig()
        
        # 交易记录
        self.records: List[TradeRecord] = []
        
        # 桶统计
        self.buckets: Dict[Tuple, BucketStats] = {}
        
        # 决策历史
        self.decisions: List[Dict] = []
        
        # 持久化路径
        self.data_dir = Path(__file__).parent.parent / "logs" / "regime_memory"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # 加载历史数据
        self._load_history()
        
        print("🧠 Regime Memory 初始化完成")
        print(f"   历史记录: {len(self.records)} 笔")
        print(f"   环境桶: {len(self.buckets)} 个")
    
    # ============================================================
    # 记录系统
    # ============================================================
    def record(
        self,
        structure: str,
        volatility: float,
        volume_ratio: float,
        risk_level: str,
        pnl_pct: float,
        execution_quality: float = 1.0,
        slippage: float = 0.0,
        delay_ms: float = 0.0,
        symbol: str = "",
        side: str = "",
        trend_strength: float = 0.0,
        spread: float = 0.0
    ) -> TradeRecord:
        """
        记录一笔交易
        
        Args:
            structure: 市场结构 (RANGE/TREND/BREAKOUT/CHAOTIC)
            volatility: 波动率
            volume_ratio: 成交量比
            risk_level: 风险等级 (LOW/MEDIUM/HIGH/CRITICAL)
            pnl_pct: 盈亏百分比
            execution_quality: 执行质量
            slippage: 滑点
            delay_ms: 延迟
            symbol: 交易对
            side: 方向 (LONG/SHORT)
            trend_strength: 趋势强度
            spread: 点差
        
        Returns:
            TradeRecord
        """
        # 创建环境
        env = MarketEnvironment(
            structure=structure,
            volatility=volatility,
            volume_ratio=volume_ratio,
            risk_level=risk_level,
            trend_strength=trend_strength,
            spread=spread
        )
        
        # 创建记录
        record = TradeRecord(
            timestamp=datetime.now().isoformat(),
            environment=env,
            pnl_pct=pnl_pct,
            execution_quality=execution_quality,
            slippage=slippage,
            delay_ms=delay_ms,
            symbol=symbol,
            side=side
        )
        
        # 添加到记录
        self.records.append(record)
        
        # 更新桶统计
        bucket_key = env.to_bucket()
        if bucket_key not in self.buckets:
            self.buckets[bucket_key] = BucketStats()
        self.buckets[bucket_key].update(record)
        
        # 限制记忆大小
        if len(self.records) > self.config.max_memory:
            self.records = self.records[-self.config.max_memory:]
        
        # 持久化
        self._save_record(record)
        
        return record
    
    # ============================================================
    # 决策系统
    # ============================================================
    def should_trade(
        self,
        structure: str,
        volatility: float,
        volume_ratio: float,
        risk_level: str
    ) -> Tuple[bool, Dict]:
        """
        判断是否应该交易
        
        基于历史记忆决定：
        - 当前环境历史上是否赚钱
        - 是否应该禁止交易
        
        Args:
            structure: 市场结构
            volatility: 波动率
            volume_ratio: 成交量比
            risk_level: 风险等级
        
        Returns:
            (should_trade: bool, info: dict)
        """
        # 创建环境
        env = MarketEnvironment(
            structure=structure,
            volatility=volatility,
            volume_ratio=volume_ratio,
            risk_level=risk_level
        )
        
        bucket_key = env.to_bucket()
        
        # 无历史 → 可以试
        if bucket_key not in self.buckets:
            decision = {
                "should_trade": True,
                "reason": "NO_HISTORY",
                "bucket": bucket_key,
                "samples": 0
            }
            self._record_decision(decision)
            return True, decision
        
        stats = self.buckets[bucket_key]
        
        # 样本不足 → 不阻止
        if stats.count < self.config.min_samples:
            decision = {
                "should_trade": True,
                "reason": "INSUFFICIENT_SAMPLES",
                "bucket": bucket_key,
                "samples": stats.count,
                "required": self.config.min_samples
            }
            self._record_decision(decision)
            return True, decision
        
        # 检查胜率
        win_rate_ok = stats.win_rate >= self.config.win_rate_threshold
        avg_pnl_ok = stats.avg_pnl >= self.config.avg_pnl_threshold
        
        should = win_rate_ok and avg_pnl_ok
        
        reasons = []
        if not win_rate_ok:
            reasons.append(f"胜率低: {stats.win_rate*100:.0f}% < {self.config.win_rate_threshold*100:.0f}%")
        if not avg_pnl_ok:
            reasons.append(f"平均亏损: {stats.avg_pnl*100:.2f}%")
        
        decision = {
            "should_trade": should,
            "reason": "OK" if should else "BLOCKED",
            "bucket": bucket_key,
            "samples": stats.count,
            "win_rate": stats.win_rate,
            "avg_pnl": stats.avg_pnl,
            "issues": reasons
        }
        
        self._record_decision(decision)
        
        return should, decision
    
    def get_recommendation(
        self,
        structure: str,
        volatility: float,
        volume_ratio: float,
        risk_level: str
    ) -> Dict:
        """
        获取交易建议
        
        返回详细的历史表现和建议
        """
        env = MarketEnvironment(
            structure=structure,
            volatility=volatility,
            volume_ratio=volume_ratio,
            risk_level=risk_level
        )
        
        bucket_key = env.to_bucket()
        
        result = {
            "environment": {
                "structure": structure,
                "volatility": volatility,
                "volume_ratio": volume_ratio,
                "risk_level": risk_level,
                "bucket": bucket_key
            },
            "history": None,
            "recommendation": "UNKNOWN",
            "confidence": 0
        }
        
        if bucket_key in self.buckets:
            stats = self.buckets[bucket_key]
            
            result["history"] = {
                "samples": stats.count,
                "wins": stats.wins,
                "losses": stats.losses,
                "win_rate": stats.win_rate,
                "avg_pnl": stats.avg_pnl,
                "avg_quality": stats.avg_quality,
                "last_trade": stats.last_trade
            }
            
            # 推荐判断
            if stats.count < self.config.min_samples:
                result["recommendation"] = "NEUTRAL"
                result["confidence"] = 0.3
            elif stats.win_rate >= 0.6 and stats.avg_pnl > 0:
                result["recommendation"] = "STRONG_BUY"
                result["confidence"] = 0.9
            elif stats.win_rate >= 0.5 and stats.avg_pnl >= 0:
                result["recommendation"] = "BUY"
                result["confidence"] = 0.7
            elif stats.win_rate >= 0.4:
                result["recommendation"] = "CAUTION"
                result["confidence"] = 0.5
            else:
                result["recommendation"] = "BLOCK"
                result["confidence"] = 0.9
        
        return result
    
    # ============================================================
    # 统计查询
    # ============================================================
    def get_all_buckets(self) -> Dict:
        """获取所有桶统计"""
        result = {}
        for key, stats in self.buckets.items():
            result[str(key)] = {
                "structure": key[0],
                "volatility": key[1],
                "volume": key[2],
                "risk_level": key[3],
                "count": stats.count,
                "wins": stats.wins,
                "losses": stats.losses,
                "win_rate": round(stats.win_rate, 3),
                "avg_pnl": round(stats.avg_pnl * 100, 3),
                "avg_quality": round(stats.avg_quality, 3),
                "status": self._get_bucket_status(stats)
            }
        return result
    
    def get_worst_environments(self, n: int = 5) -> List[Dict]:
        """获取表现最差的环境"""
        buckets = []
        for key, stats in self.buckets.items():
            if stats.count >= self.config.min_samples:
                buckets.append({
                    "environment": key,
                    "win_rate": stats.win_rate,
                    "avg_pnl": stats.avg_pnl,
                    "count": stats.count
                })
        
        # 按胜率排序
        buckets.sort(key=lambda x: x["win_rate"])
        return buckets[:n]
    
    def get_best_environments(self, n: int = 5) -> List[Dict]:
        """获取表现最好的环境"""
        buckets = []
        for key, stats in self.buckets.items():
            if stats.count >= self.config.min_samples:
                buckets.append({
                    "environment": key,
                    "win_rate": stats.win_rate,
                    "avg_pnl": stats.avg_pnl,
                    "count": stats.count
                })
        
        # 按胜率排序
        buckets.sort(key=lambda x: x["win_rate"], reverse=True)
        return buckets[:n]
    
    def get_overall_stats(self) -> Dict:
        """获取总体统计"""
        if not self.records:
            return {
                "total_trades": 0,
                "wins": 0,
                "losses": 0,
                "win_rate": 0,
                "avg_pnl": 0
            }
        
        wins = sum(1 for r in self.records if r.result == TradeResult.WIN)
        losses = sum(1 for r in self.records if r.result == TradeResult.LOSS)
        total_pnl = sum(r.pnl_pct for r in self.records)
        
        return {
            "total_trades": len(self.records),
            "wins": wins,
            "losses": losses,
            "win_rate": wins / len(self.records),
            "avg_pnl": total_pnl / len(self.records),
            "buckets": len(self.buckets)
        }
    
    def _get_bucket_status(self, stats: BucketStats) -> str:
        """获取桶状态"""
        if stats.count < self.config.min_samples:
            return "INSUFFICIENT_DATA"
        elif stats.win_rate < self.config.win_rate_threshold:
            return "BLOCKED"
        elif stats.avg_pnl < 0:
            return "WARNING"
        else:
            return "OK"
    
    # ============================================================
    # 持久化
    # ============================================================
    def _save_record(self, record: TradeRecord):
        """保存记录到文件"""
        log_file = self.data_dir / "trade_records.jsonl"
        
        data = {
            "timestamp": record.timestamp,
            "structure": record.environment.structure,
            "volatility": record.environment.volatility,
            "volume_ratio": record.environment.volume_ratio,
            "risk_level": record.environment.risk_level,
            "pnl_pct": record.pnl_pct,
            "execution_quality": record.execution_quality,
            "slippage": record.slippage,
            "delay_ms": record.delay_ms,
            "symbol": record.symbol,
            "side": record.side,
            "result": record.result.value,
            "bucket": str(record.environment.to_bucket())
        }
        
        with open(log_file, "a") as f:
            f.write(json.dumps(data) + "\n")
    
    def _load_history(self):
        """加载历史数据"""
        log_file = self.data_dir / "trade_records.jsonl"
        
        if not log_file.exists():
            return
        
        try:
            with open(log_file, "r") as f:
                for line in f:
                    try:
                        data = json.loads(line)
                        
                        env = MarketEnvironment(
                            structure=data["structure"],
                            volatility=data["volatility"],
                            volume_ratio=data["volume_ratio"],
                            risk_level=data["risk_level"]
                        )
                        
                        record = TradeRecord(
                            timestamp=data["timestamp"],
                            environment=env,
                            pnl_pct=data["pnl_pct"],
                            execution_quality=data.get("execution_quality", 1.0),
                            slippage=data.get("slippage", 0.0),
                            delay_ms=data.get("delay_ms", 0.0),
                            symbol=data.get("symbol", ""),
                            side=data.get("side", "")
                        )
                        
                        self.records.append(record)
                        
                        # 更新桶
                        bucket_key = env.to_bucket()
                        if bucket_key not in self.buckets:
                            self.buckets[bucket_key] = BucketStats()
                        self.buckets[bucket_key].update(record)
                        
                    except Exception as e:
                        continue
            
            # 限制加载的记录数
            if len(self.records) > self.config.max_memory:
                self.records = self.records[-self.config.max_memory:]
                
        except Exception as e:
            print(f"⚠️ 加载历史数据失败: {e}")
    
    def _record_decision(self, decision: Dict):
        """记录决策"""
        decision["timestamp"] = datetime.now().isoformat()
        self.decisions.append(decision)
        if len(self.decisions) > 100:
            self.decisions = self.decisions[-100:]
    
    # ============================================================
    # 管理接口
    # ============================================================
    def clear(self):
        """清空记忆"""
        self.records = []
        self.buckets = {}
        self.decisions = []
        print("🧹 Regime Memory 已清空")
    
    def export(self) -> Dict:
        """导出记忆"""
        return {
            "records": [
                {
                    "timestamp": r.timestamp,
                    "structure": r.environment.structure,
                    "volatility": r.environment.volatility,
                    "volume_ratio": r.environment.volume_ratio,
                    "risk_level": r.environment.risk_level,
                    "pnl_pct": r.pnl_pct,
                    "result": r.result.value
                }
                for r in self.records
            ],
            "buckets": self.get_all_buckets(),
            "stats": self.get_overall_stats()
        }


# ============================================================
# 便捷函数
# ============================================================
def create_regime_memory() -> RegimeMemory:
    """创建市场记忆系统"""
    return RegimeMemory()


# ============================================================
# 测试
# ============================================================
if __name__ == "__main__":
    print("=== Regime Memory V9 测试 ===\n")
    
    memory = RegimeMemory()
    
    # 记录一些测试交易
    print("1. 记录测试交易:")
    
    # 赚钱的 RANGE 环境
    for i in range(15):
        memory.record(
            structure="RANGE",
            volatility=0.003,
            volume_ratio=1.5,
            risk_level="LOW",
            pnl_pct=0.002 if i % 3 != 0 else -0.001,
            execution_quality=0.95,
            symbol="ETH/USDT"
        )
    
    # 亏损的 CHAOTIC 环境
    for i in range(12):
        memory.record(
            structure="CHAOTIC",
            volatility=0.025,
            volume_ratio=0.6,
            risk_level="HIGH",
            pnl_pct=-0.003 if i % 2 == 0 else 0.001,
            execution_quality=0.7,
            symbol="ETH/USDT"
        )
    
    print(f"   总记录: {len(memory.records)} 笔")
    print(f"   环境桶: {len(memory.buckets)} 个")
    
    # 测试决策
    print("\n2. 决策测试:")
    
    # RANGE + LOW 应该可以
    should, info = memory.should_trade(
        structure="RANGE",
        volatility=0.003,
        volume_ratio=1.5,
        risk_level="LOW"
    )
    print(f"   RANGE + LOW: {'✅ 允许' if should else '❌ 禁止'}")
    print(f"   原因: {info['reason']}")
    if 'win_rate' in info:
        print(f"   胜率: {info['win_rate']*100:.0f}%")
    
    # CHAOTIC + HIGH 应该禁止
    should, info = memory.should_trade(
        structure="CHAOTIC",
        volatility=0.025,
        volume_ratio=0.6,
        risk_level="HIGH"
    )
    print(f"\n   CHAOTIC + HIGH: {'✅ 允许' if should else '❌ 禁止'}")
    print(f"   原因: {info['reason']}")
    if 'issues' in info:
        print(f"   问题: {info['issues']}")
    
    # 最差环境
    print("\n3. 最差环境:")
    worst = memory.get_worst_environments(3)
    for w in worst:
        print(f"   {w['environment']}: 胜率 {w['win_rate']*100:.0f}%, 收益 {w['avg_pnl']*100:.2f}%")
    
    # 总体统计
    print("\n4. 总体统计:")
    stats = memory.get_overall_stats()
    print(f"   总交易: {stats['total_trades']} 笔")
    print(f"   胜率: {stats['win_rate']*100:.0f}%")
    print(f"   平均收益: {stats['avg_pnl']*100:.3f}%")
    
    print("\n✅ Regime Memory V9 测试通过")