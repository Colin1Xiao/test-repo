"""
OCNMPS 灰度集成配置
控制桥接行为，支持快速回退
"""

# ==================== 主开关 ====================
OCNMPS_ENABLED = True  # 总开关，False 则完全禁用桥接

# ==================== 灰度比例 ====================
# 0.0 = 不使用桥接，1.0 = 全量使用
# 建议先从 0.3 开始灰度
OCNMPS_GRAY_RATIO = 0.3  # 建议从0.3开始灰度

# ==================== 任务类型开关 ====================
# 可以单独控制某些类型是否走桥接
INTENT_SWITCHES = {
    "CODE": True,      # 代码任务
    "REASON": True,    # 推理任务
    "LONG": True,      # 长文总结
    "CN": True,        # 中文写作
}

# ==================== 回退配置 ====================
# 当桥接返回的模型不可用时的回退策略
FALLBACK_MODEL = "default"  # 回退到默认模型

# ==================== 日志配置 ====================
LOG_ROUTING_DECISIONS = True  # 记录路由决策日志
LOG_FILE = "~/.openclaw/workspace/ocnmps_routing.log"

# ==================== 统计配置 ====================
STATS_FILE = "~/.openclaw/workspace/ocnmps_stats.json"


# ==================== 硬性刹车条件 ====================
# 任一条件触发就自动维持或回退，不用临时判断

BRAKE_CONDITIONS = {
    # 平均评分
    "avg_score_threshold": 4.0,           # 低于此值触发警告
    "avg_score_consecutive_days": 2,      # 连续N天低于阈值触发刹车
    
    # 回退率
    "fallback_rate_threshold": 0.10,      # 回退率超过10%触发刹车
    
    # 延迟
    "latency_threshold_ms": 200,           # 平均延迟超过200ms触发警告
    "latency_severe_ms": 500,              # 平均延迟超过500ms触发刹车
    
    # 低分样本
    "low_score_burst": 3,                  # 单日低分(≤2分)超过N条触发警告
    
    # 误路由
    "misroute_burst": 5,                   # 单类意图误路由超过N条触发刹车
}


def check_brake_conditions(daily_stats: list) -> dict:
    """
    检查刹车条件
    
    Args:
        daily_stats: 每日统计列表
    
    Returns:
        dict: {
            "should_brake": bool,
            "brakes_triggered": list,
            "warnings": list,
        }
    """
    brakes_triggered = []
    warnings = []
    
    # 1. 平均评分连续N天低于阈值
    low_score_days = 0
    for day in daily_stats:
        if day.get("avg_score") and day["avg_score"] < BRAKE_CONDITIONS["avg_score_threshold"]:
            low_score_days += 1
        else:
            low_score_days = 0
        
        if low_score_days >= BRAKE_CONDITIONS["avg_score_consecutive_days"]:
            brakes_triggered.append(
                f"平均评分连续 {low_score_days} 天低于 {BRAKE_CONDITIONS['avg_score_threshold']}"
            )
            break
    
    # 2. 回退率超过阈值
    for day in daily_stats:
        if day.get("fallback_rate", 0) > BRAKE_CONDITIONS["fallback_rate_threshold"]:
            brakes_triggered.append(
                f"回退率 {day['fallback_rate']*100:.1f}% 超过 {BRAKE_CONDITIONS['fallback_rate_threshold']*100:.0f}%"
            )
            break
    
    # 3. 延迟警告/刹车
    for day in daily_stats:
        latency = day.get("avg_latency_ms", 0)
        if latency > BRAKE_CONDITIONS["latency_severe_ms"]:
            brakes_triggered.append(
                f"延迟 {latency:.0f}ms 超过 {BRAKE_CONDITIONS['latency_severe_ms']}ms"
            )
            break
        elif latency > BRAKE_CONDITIONS["latency_threshold_ms"]:
            warnings.append(
                f"延迟 {latency:.0f}ms 超过警告阈值 {BRAKE_CONDITIONS['latency_threshold_ms']}ms"
            )
    
    # 4. 低分样本爆发
    for day in daily_stats:
        if day.get("low_score_count", 0) >= BRAKE_CONDITIONS["low_score_burst"]:
            warnings.append(
                f"单日低分样本 {day['low_score_count']} 条"
            )
            break
    
    return {
        "should_brake": len(brakes_triggered) > 0,
        "brakes_triggered": brakes_triggered,
        "warnings": warnings,
    }


def should_use_bridge(intent: str = None) -> bool:
    """
    判断是否应该使用桥接
    
    Args:
        intent: 任务意图类型 (CODE/REASON/LONG/CN)
    
    Returns:
        bool: 是否使用桥接
    """
    import random
    
    if not OCNMPS_ENABLED:
        return False
    
    # 检查意图类型开关
    if intent and intent in INTENT_SWITCHES:
        if not INTENT_SWITCHES[intent]:
            return False
    
    # 灰度比例判断
    return random.random() < OCNMPS_GRAY_RATIO


def get_bridge_version():
    """获取当前桥接版本"""
    return "v2"


# ==================== 快速开关命令 ====================
# 在运行时可以通过修改配置文件调整
# 
# 全量开启：OCNMPS_GRAY_RATIO = 1.0
# 全量关闭：OCNMPS_ENABLED = False
# 仅代码任务：只保留 INTENT_SWITCHES["CODE"] = True
# 仅推理任务：只保留 INTENT_SWITCHES["REASON"] = True