#!/usr/bin/env python3
"""
OCNMPS Bridge v2 - 规则修订版
修复: CODE意图组、CN意图组、REASON中文意图组、LONG前置纠偏
"""

import sys
import os
import re
from typing import Optional, Dict, Any, List

# 添加 OCNMPS 到路径
OCNMPS_DIR = os.path.expanduser("~/.openclaw/workspace/ocnmps")
sys.path.insert(0, OCNMPS_DIR)

from multi_window_router import WindowRouter
from multi_window_session_manager import MultiWindowSessionManager


# ============================================================
# 意图组定义 (v2 修订)
# ============================================================

class IntentGroups:
    """意图组关键词与规则"""
    
    # -------------------- CODE 意图组 --------------------
    CODE_LANGUAGES = [
        "python", "javascript", "typescript", "java", "go", "rust", 
        "shell", "bash", "c++", "c#", "ruby", "php", "swift", "kotlin"
    ]
    
    # 代码实体词 - 必须命中才触发 CODE (区别于架构分析)
    CODE_ENTITIES = [
        "脚本", "函数", "类", "方法", "api实现", "代码实现",
        "代码块", "模块代码", "具体代码", "代码逻辑"
    ]
    
    # 工程问题词
    CODE_ENGINEERING_PROBLEMS = [
        "性能慢", "内存泄漏", "内存暴涨", "崩溃", "报错", "异常",
        "bug", "debug", "调试", "报错堆栈", "错误栈",
        "兼容性问题", "并发问题", "线程问题"
    ]
    
    CODE_CONSTRAINTS = [
        "保留输出格式", "保留语义", "保留行为", "兼容现有",
        "不破坏", "最小改动", "保持接口", "错误处理语义"
    ]
    
    CODE_KEYWORDS = [
        "def ", "class ", "function ", "import ", "const ", "let ",
        "```", "return ", "async ", "await "
    ]
    
    # -------------------- REASON 系统对象词 --------------------
    # 命中这些优先走 REASON，即使有"瓶颈/改造方案"
    REASON_SYSTEM_OBJECTS = [
        "架构", "系统设计", "架构设计", "方案对比", "权衡",
        "影响范围", "观测指标", "路径选择", "模块关系",
        "事件总线", "策略引擎", "agent协作", "数据链路",
        "风险排序", "风险判断", "设计分析", "系统级",
        "整体架构", "模块耦合", "链路风险"
    ]
    
    # -------------------- CN 意图组 --------------------
    CN_WRITE_KEYWORDS = [
        "润色", "改写", "重写", "优化表达", "精简", "简洁",
        "专业", "正式", "清晰", "流畅", "自然", "得体"
    ]
    
    CN_STYLE_KEYWORDS = [
        "统一术语", "统一风格", "风格统一", "术语统一",
        "保留原意", "不增加新事实", "不夸大"
    ]
    
    CN_OUTPUT_KEYWORDS = [
        "中文版本", "中文表达", "中文输出", "中文写成",
        "发给团队", "发给老板", "发给客户", "发给领导",
        "团队阅读", "管理层阅读", "汇报", "报告"
    ]
    
    # -------------------- REASON 意图组 --------------------
    REASON_CN_COMPARE = [
        "比较", "对比", "比对", "比较两种", "对比两种"
    ]
    
    REASON_CN_WEIGH = [
        "权衡", "取舍", "利弊", "优缺点", "pros", "cons"
    ]
    
    REASON_CN_DIMENSIONS = [
        "维度", "多个维度", "六个维度", "从...维度",
        "角度", "层面", "方面", "因素"
    ]
    
    REASON_CN_DECISION = [
        "选择", "决策", "推荐方案", "建议方案",
        "给建议", "做决定", "选哪个", "怎么选"
    ]
    
    REASON_CN_QUALITY = [
        "风险", "收益", "长期收益", "复杂度", "可维护性",
        "扩展性", "故障面", "安全性", "稳定性"
    ]
    
    # -------------------- LONG 意图组 --------------------
    LONG_DOCUMENT_TYPES = [
        "长文", "较长文档", "长文档", "技术设计文档", "方案文档",
        "PRD", "RFC", "架构文档", "需求文档", "规格文档"
    ]
    
    LONG_EXTRACT_ACTIONS = [
        "提炼", "总结", "摘要", "压缩", "提取重点",
        "概括", "归纳", "整理要点"
    ]
    
    LONG_EXTRACT_TARGETS = [
        "核心目标", "关键约束", "主要模块", "已知风险", "待决问题",
        "关键点", "要点", "核心内容", "主要结论"
    ]
    
    LONG_AUDIENCE = [
        "管理层", "高管", "领导", "决策者",
        "快速阅读", "executive summary", "高层摘要"
    ]
    
    # -------------------- 预声明式模式 --------------------
    PREDECLARATION_PATTERNS = [
        r"我会给你一份",
        r"我会给你一篇",
        r"我会给你一段",
        r"接下来我会",
        r"下面是一份",
        r"下面是一篇",
        r"给你一份",
        r"给你一篇",
    ]


class OCNMPSBridgeV2:
    """OCNMPS 路由桥接器 v2 - 规则修订版"""
    
    def __init__(self):
        self.manager = MultiWindowSessionManager()
        self._session_cache = {}
    
    # ============================================================
    # 意图检测方法
    # ============================================================
    
    def _check_code_intent(self, prompt: str) -> Dict[str, Any]:
        """检测代码意图 - 必须命中代码实体才触发"""
        prompt_lower = prompt.lower()
        score = 0
        reasons = []
        
        # 先检查是否命中 REASON 系统对象 - 如果命中，CODE 不应该抢
        has_system_object = any(obj in prompt for obj in IntentGroups.REASON_SYSTEM_OBJECTS)
        if has_system_object:
            return {
                "detected": False,
                "score": 0,
                "reasons": ["命中系统/架构对象，CODE让路"],
                "recommended_model": "CODE",
                "yield_to_reason": True
            }
        
        # 必须命中代码实体词
        has_entity = any(ent in prompt for ent in IntentGroups.CODE_ENTITIES)
        has_code_keyword = any(kw in prompt for kw in IntentGroups.CODE_KEYWORDS)
        
        if not (has_entity or has_code_keyword):
            return {
                "detected": False,
                "score": 0,
                "reasons": ["未命中代码实体"],
                "recommended_model": "CODE"
            }
        
        if has_entity:
            score += 2
            reasons.append("包含代码实体")
        if has_code_keyword:
            score += 3
            reasons.append("包含代码关键词")
        
        # 检查编程语言
        has_language = any(lang in prompt_lower for lang in IntentGroups.CODE_LANGUAGES)
        if has_language:
            score += 2
            reasons.append("包含编程语言")
        
        # 检查工程问题
        has_problem = any(prob in prompt for prob in IntentGroups.CODE_ENGINEERING_PROBLEMS)
        if has_problem:
            score += 2
            reasons.append("包含工程问题")
        
        # 检查约束条件
        has_constraint = any(c in prompt for c in IntentGroups.CODE_CONSTRAINTS)
        if has_constraint:
            score += 1
            reasons.append("包含约束条件")
        
        # 组合规则: 语言 + 代码实体 + 工程问题 = 强代码信号
        if has_language and (has_entity or has_code_keyword) and has_problem:
            score += 3
            reasons.append("语言+代码实体+工程问题组合")
        
        return {
            "detected": score >= 4,
            "score": score,
            "reasons": reasons,
            "recommended_model": "GROK-CODE" if "debug" in prompt_lower or "报错" in prompt or "异常" in prompt else "CODE"
        }
    
    def _check_cn_intent(self, prompt: str) -> Dict[str, Any]:
        """检测中文写作意图"""
        score = 0
        reasons = []
        
        # 写作类关键词
        has_write = any(kw in prompt for kw in IntentGroups.CN_WRITE_KEYWORDS)
        if has_write:
            score += 2
            reasons.append("包含写作关键词")
        
        # 风格要求
        has_style = any(kw in prompt for kw in IntentGroups.CN_STYLE_KEYWORDS)
        if has_style:
            score += 2
            reasons.append("包含风格要求")
        
        # 输出场景
        has_output = any(kw in prompt for kw in IntentGroups.CN_OUTPUT_KEYWORDS)
        if has_output:
            score += 2
            reasons.append("包含输出场景")
        
        # 组合规则
        if has_write and (has_style or has_output):
            score += 2
            reasons.append("写作+风格/场景组合")
        
        return {
            "detected": score >= 3,
            "score": score,
            "reasons": reasons,
            "recommended_model": "CN"
        }
    
    def _check_reason_intent(self, prompt: str) -> Dict[str, Any]:
        """检测推理意图"""
        prompt_lower = prompt.lower()
        score = 0
        reasons = []
        has_cn_output = False
        
        # 系统对象词 - 强推理信号
        has_system_object = any(obj in prompt for obj in IntentGroups.REASON_SYSTEM_OBJECTS)
        if has_system_object:
            score += 4
            reasons.append("包含系统/架构对象")
        
        # 比较类
        has_compare = any(kw in prompt for kw in IntentGroups.REASON_CN_COMPARE)
        if has_compare:
            score += 2
            reasons.append("包含比较意图")
        
        # 权衡类
        has_weigh = any(kw in prompt for kw in IntentGroups.REASON_CN_WEIGH)
        if has_weigh:
            score += 2
            reasons.append("包含权衡意图")
        
        # 维度类
        has_dimension = any(kw in prompt for kw in IntentGroups.REASON_CN_DIMENSIONS)
        if has_dimension:
            score += 1
            reasons.append("包含维度分析")
        
        # 决策类
        has_decision = any(kw in prompt for kw in IntentGroups.REASON_CN_DECISION)
        if has_decision:
            score += 2
            reasons.append("包含决策意图")
        
        # 质量维度
        has_quality = any(kw in prompt for kw in IntentGroups.REASON_CN_QUALITY)
        if has_quality:
            score += 1
            reasons.append("包含质量维度")
        
        # 检查中文输出需求
        cn_output_signals = ["中文", "发给团队", "结论说明", "团队阅读"]
        has_cn_output = any(s in prompt for s in cn_output_signals)
        
        # 组合规则: 比较 + 权衡/决策 = 强推理信号
        if has_compare and (has_weigh or has_decision):
            score += 2
            reasons.append("比较+权衡/决策组合")
        
        # 组合规则: 系统对象 + 分析 = 强推理信号
        if has_system_object and (has_compare or has_weigh or has_decision):
            score += 2
            reasons.append("系统对象+分析组合")
        
        return {
            "detected": score >= 3,
            "score": score,
            "reasons": reasons,
            "recommended_model": "REASON",
            "needs_cn_chain": has_cn_output
        }
    
    def _check_long_intent(self, prompt: str) -> Dict[str, Any]:
        """检测长文总结意图"""
        score = 0
        reasons = []
        is_predeclared = False
        
        # 检查预声明式模式
        for pattern in IntentGroups.PREDECLARATION_PATTERNS:
            if re.search(pattern, prompt):
                is_predeclared = True
                score += 3
                reasons.append(f"预声明式: {pattern}")
                break
        
        # 文档类型
        has_doc_type = any(kw in prompt for kw in IntentGroups.LONG_DOCUMENT_TYPES)
        if has_doc_type:
            score += 2
            reasons.append("包含文档类型")
        
        # 提取动作
        has_extract = any(kw in prompt for kw in IntentGroups.LONG_EXTRACT_ACTIONS)
        if has_extract:
            score += 2
            reasons.append("包含提取动作")
        
        # 提取目标
        has_target = any(kw in prompt for kw in IntentGroups.LONG_EXTRACT_TARGETS)
        if has_target:
            score += 1
            reasons.append("包含提取目标")
        
        # 受众转换
        has_audience = any(kw in prompt for kw in IntentGroups.LONG_AUDIENCE)
        if has_audience:
            score += 1
            reasons.append("包含受众转换")
        
        # 组合规则: 预声明/文档类型 + 提取动作 = 强长文信号
        if (is_predeclared or has_doc_type) and has_extract:
            score += 2
            reasons.append("文档+提取组合")
        
        # 检查中文输出需求
        has_cn_output = any(s in prompt for s in ["中文", "管理层", "团队"])
        
        return {
            "detected": score >= 3,
            "score": score,
            "reasons": reasons,
            "recommended_model": "LONG",
            "needs_cn_chain": has_cn_output,
            "is_predeclared": is_predeclared
        }
    
    # ============================================================
    # 核心路由逻辑
    # ============================================================
    
    def analyze_intent(self, prompt: str) -> Dict[str, Any]:
        """
        分析任务意图，返回最佳路由建议
        
        优先级: REASON(系统对象) > CODE(代码实体) > LONG > CN
        """
        # 按优先级检测意图
        reason_result = self._check_reason_intent(prompt)
        code_result = self._check_code_intent(prompt)
        long_result = self._check_long_intent(prompt)
        cn_result = self._check_cn_intent(prompt)
        
        # 构建结果
        intents = [
            ("REASON", reason_result),
            ("CODE", code_result),
            ("LONG", long_result),
            ("CN", cn_result),
        ]
        
        # 特殊处理: 如果 CODE 让路给 REASON
        if code_result.get("yield_to_reason"):
            code_result = {"detected": False, "score": 0, "reasons": code_result["reasons"], "recommended_model": "CODE"}
        
        # 找最高分
        best_intent = None
        best_score = 0
        best_result = None
        
        for intent_name, result in intents:
            if result["detected"] and result["score"] > best_score:
                best_intent = intent_name
                best_score = result["score"]
                best_result = result
        
        # 构建推荐
        if best_intent:
            model = best_result["recommended_model"]
            chain = [model]
            
            # 检查是否需要追加 CN
            if best_result.get("needs_cn_chain") and model != "CN":
                chain.append("CN")
            
            # 如果是 GROK-CODE，构建完整链路
            if model == "GROK-CODE":
                chain = ["GROK-CODE", "CODE", "MAIN"]
            
            return {
                "detected": True,
                "intent": best_intent,
                "score": best_score,
                "reasons": best_result["reasons"],
                "recommended_model": model,
                "chain": chain if len(chain) > 1 else None,
                "all_intents": {name: r for name, r in intents}
            }
        
        return {
            "detected": False,
            "intent": None,
            "score": 0,
            "reasons": [],
            "recommended_model": "default",
            "chain": None,
            "all_intents": {name: r for name, r in intents}
        }
    
    def should_use_ocnmps(self, prompt: str) -> bool:
        """判断是否应该使用 OCNMPS 路由"""
        result = self.analyze_intent(prompt)
        return result["detected"]
    
    def route(self, prompt: str, profile: str = "standard", priority: str = "P1") -> Dict[str, Any]:
        """执行路由决策"""
        # 先做桥接层意图分析
        bridge_analysis = self.analyze_intent(prompt)
        
        # 如果桥接层检测到明确意图，优先使用
        if bridge_analysis["detected"]:
            return {
                "task_type": bridge_analysis["intent"].lower(),
                "is_mixed": bridge_analysis["chain"] is not None,
                "selected_model": bridge_analysis["recommended_model"],
                "chain": bridge_analysis["chain"],
                "confidence": bridge_analysis["score"] / 10,
                "bridge_analysis": bridge_analysis,
                "source": "bridge_v2"
            }
        
        # 否则调用 OCNMPS 原生路由
        session = self.manager.create_session(
            channel_type="openclaw",
            window_type="interactive",
            routing_profile=profile,
            priority_level=priority
        )
        
        try:
            router = WindowRouter(session)
            decision = router.route(prompt)
            
            return {
                "task_type": decision.task_type,
                "is_mixed": decision.is_mixed,
                "selected_model": getattr(decision, "selected_model", None),
                "chain": getattr(decision, "chain", None),
                "confidence": getattr(decision, "confidence", 1.0),
                "source": "ocnmps_native"
            }
        finally:
            self.manager.close_session(session.session_id)
    
    def get_model_recommendation(self, prompt: str) -> Dict[str, Any]:
        """获取模型推荐"""
        result = self.route(prompt)
        
        if result["source"] == "bridge_v2":
            if result["chain"]:
                return {
                    "use_ocnmps": True,
                    "recommended_model": result["chain"][0],
                    "chain": result["chain"],
                    "task_type": result["task_type"],
                    "reason": f"{result['task_type']}任务，桥接检测: {', '.join(result['bridge_analysis']['reasons'])}"
                }
            else:
                return {
                    "use_ocnmps": True,
                    "recommended_model": result["selected_model"],
                    "chain": None,
                    "task_type": result["task_type"],
                    "reason": f"{result['task_type']}任务，桥接检测: {', '.join(result['bridge_analysis']['reasons'])}"
                }
        else:
            if result["is_mixed"]:
                return {
                    "use_ocnmps": True,
                    "recommended_model": result["chain"][0] if result["chain"] else "MAIN",
                    "chain": result["chain"],
                    "task_type": result["task_type"],
                    "reason": f"OCNMPS原生路由: {result['task_type']}"
                }
            else:
                return {
                    "use_ocnmps": True,
                    "recommended_model": result["selected_model"],
                    "chain": None,
                    "task_type": result["task_type"],
                    "reason": f"OCNMPS原生路由: {result['task_type']}"
                }


# ============================================================
# 便捷接口
# ============================================================

_bridge_v2 = None

def get_ocnmps_bridge_v2() -> OCNMPSBridgeV2:
    """获取全局桥接v2实例"""
    global _bridge_v2
    if _bridge_v2 is None:
        _bridge_v2 = OCNMPSBridgeV2()
    return _bridge_v2


def route_task_v2(prompt: str) -> Dict[str, Any]:
    """快捷路由接口 v2"""
    return get_ocnmps_bridge_v2().route(prompt)


def get_model_for_task_v2(prompt: str) -> Dict[str, Any]:
    """快捷模型推荐接口 v2"""
    return get_ocnmps_bridge_v2().get_model_recommendation(prompt)


# ============================================================
# CLI 测试
# ============================================================

if __name__ == "__main__":
    # 使用之前的测试用例
    test_cases = [
        ("任务1: 架构分析", "分析我当前 OpenClaw vNext 架构的潜在瓶颈，重点看事件总线、Judge Agent、策略引擎和 Dashboard 数据生成链路。请指出最可能先出问题的 3 个点，给出原因、影响范围、观测指标，以及一版低风险改造方案。"),
        ("任务2: 代码修复", "下面这段 Python 脚本在处理大日志文件时很慢，而且偶尔会内存暴涨。请分析性能瓶颈、找出可能的内存问题，并给出一个尽量低风险的重构方案，要求保留现有输出格式和错误处理语义。"),
        ("任务3: 中文润色", "请把下面这段技术汇报改写成更专业、更简洁、适合发给团队的中文版本，要求保留原意，不夸大结论，不增加新事实，并统一术语风格。"),
        ("任务4: 长文总结", "我会给你一份较长的技术设计文档。请先提炼核心目标、关键约束、主要模块、已知风险和待决问题，再输出一版适合管理层快速阅读的摘要。要求信息不遗漏重点，但整体要比原文短很多。"),
        ("任务5: 复杂推理", "请比较两种 OpenClaw 升级路径：A. 继续强化本地事件驱动与自治运维能力；B. 引入更多外部接口和远程控制能力。请从安全性、复杂度、可维护性、扩展性、故障面和长期收益六个维度做权衡，给出推荐方案，并用中文写成一段适合发给团队的结论说明。"),
        ("简单问答", "Python 是什么？"),
    ]
    
    print("=" * 70)
    print("🧪 OCNMPS Bridge v2 测试")
    print("=" * 70)
    
    bridge = OCNMPSBridgeV2()
    
    for name, task in test_cases:
        print(f"\n【{name}】")
        print(f"输入: {task[:50]}...")
        
        result = bridge.get_model_recommendation(task)
        
        print(f"触发: {'✅' if result['use_ocnmps'] else '❌'}")
        print(f"推荐: {result['recommended_model']}")
        if result['chain']:
            print(f"链路: {' → '.join(result['chain'])}")
        print(f"类型: {result['task_type']}")
        print(f"原因: {result['reason']}")
    
    print("\n" + "=" * 70)
    print("✅ v2 测试完成")