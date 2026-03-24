#!/usr/bin/env python3
"""
OpenClaw 回退策略处理器
Fallback Handler for Multi-Model System
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class FallbackStrategy(Enum):
    """回退策略枚举"""
    USE_PREVIOUS_STEP = "use_previous_step"  # 使用前序结果
    USE_ALTERNATIVE_MODEL = "use_alternative_model"  # 使用替代模型
    USE_SUMMARY = "use_summary"  # 使用摘要
    RETURN_PARTIAL = "return_partial"  # 返回部分结果
    DEGRADE_TO_SIMPLE = "degrade_to_simple"  # 降级到简单处理


class ErrorType(Enum):
    """错误类型枚举"""
    TIMEOUT = "timeout"
    EMPTY_RESPONSE = "empty_response"
    PROVIDER_ERROR = "provider_error"
    PROVIDER_SLOW = "provider_slow_response"
    SUBAGENT_FAILED = "subagent_failed"
    UNKNOWN = "unknown"


@dataclass
class StepResult:
    """步骤结果"""
    step_index: int
    model: str
    success: bool
    output: str
    error: Optional[str] = None
    error_type: Optional[str] = None


@dataclass
class FallbackDecision:
    """回退决策"""
    strategy: FallbackStrategy
    target_model: Optional[str]
    use_previous_results: List[int]  # 使用哪些前序步骤的结果
    user_message_template: str


class FallbackHandler:
    """回退策略处理器"""
    
    def __init__(self):
        # 链路配置
        self.chain_configs = {
            "GROK-CODE -> CODE -> MAIN": {
                "steps": ["GROK-CODE", "CODE", "MAIN"],
                "fallback_rules": {
                    0: FallbackDecision(  # GROK-CODE 失败
                        strategy=FallbackStrategy.USE_ALTERNATIVE_MODEL,
                        target_model="CODE",
                        use_previous_results=[],
                        user_message_template="grok_code_failed"
                    ),
                    1: FallbackDecision(  # CODE 失败
                        strategy=FallbackStrategy.USE_PREVIOUS_STEP,
                        target_model=None,
                        use_previous_results=[0],
                        user_message_template="code_failed"
                    ),
                    2: FallbackDecision(  # MAIN 失败
                        strategy=FallbackStrategy.USE_SUMMARY,
                        target_model=None,
                        use_previous_results=[0, 1],
                        user_message_template="main_failed"
                    )
                }
            },
            "LONG -> REASON -> MAIN": {
                "steps": ["LONG", "REASON", "MAIN"],
                "fallback_rules": {
                    0: FallbackDecision(  # LONG 失败
                        strategy=FallbackStrategy.USE_ALTERNATIVE_MODEL,
                        target_model="REASON",
                        use_previous_results=[],
                        user_message_template="long_failed"
                    ),
                    1: FallbackDecision(  # REASON 失败
                        strategy=FallbackStrategy.USE_PREVIOUS_STEP,
                        target_model=None,
                        use_previous_results=[0],
                        user_message_template="reason_failed"
                    ),
                    2: FallbackDecision(  # MAIN 失败
                        strategy=FallbackStrategy.USE_SUMMARY,
                        target_model=None,
                        use_previous_results=[0, 1],
                        user_message_template="main_failed"
                    )
                }
            },
            "REASON -> CN -> MAIN": {
                "steps": ["REASON", "CN", "MAIN"],
                "fallback_rules": {
                    0: FallbackDecision(  # REASON 失败
                        strategy=FallbackStrategy.DEGRADE_TO_SIMPLE,
                        target_model=None,
                        use_previous_results=[],
                        user_message_template="reason_failed_simple"
                    ),
                    1: FallbackDecision(  # CN 失败
                        strategy=FallbackStrategy.USE_PREVIOUS_STEP,
                        target_model=None,
                        use_previous_results=[0],
                        user_message_template="cn_failed"
                    ),
                    2: FallbackDecision(  # MAIN 失败
                        strategy=FallbackStrategy.USE_SUMMARY,
                        target_model=None,
                        use_previous_results=[0, 1],
                        user_message_template="main_failed"
                    )
                }
            }
        }
        
        # 错误类型到回退策略的映射
        self.error_fallback_map = {
            ErrorType.TIMEOUT: {"retry": False, "fallback": True},
            ErrorType.EMPTY_RESPONSE: {"retry": True, "retry_count": 1, "fallback": True},
            ErrorType.PROVIDER_SLOW: {"retry": True, "retry_count": 1, "fallback": True},
            ErrorType.PROVIDER_ERROR: {"retry": True, "retry_count": 2, "fallback": True},
            ErrorType.SUBAGENT_FAILED: {"retry": False, "fallback": True},
            ErrorType.UNKNOWN: {"retry": False, "fallback": True}
        }
    
    def get_chain_key(self, models: List[str]) -> str:
        """获取链路标识"""
        return " -> ".join(models)
    
    def decide_fallback(self, chain_models: List[str], 
                       failed_step_index: int,
                       error_type: ErrorType) -> FallbackDecision:
        """
        决策回退策略
        
        输入：
        - chain_models: 链路模型列表
        - failed_step_index: 失败步骤索引
        - error_type: 错误类型
        
        输出：
        - FallbackDecision: 回退决策
        """
        chain_key = self.get_chain_key(chain_models)
        
        # 检查是否已知链路
        if chain_key not in self.chain_configs:
            # 未知链路，使用通用回退策略
            return self._generic_fallback(failed_step_index, len(chain_models))
        
        config = self.chain_configs[chain_key]
        
        # 检查是否有特定回退规则
        if failed_step_index in config["fallback_rules"]:
            return config["fallback_rules"][failed_step_index]
        
        # 使用通用回退
        return self._generic_fallback(failed_step_index, len(chain_models))
    
    def _generic_fallback(self, failed_step: int, total_steps: int) -> FallbackDecision:
        """通用回退策略"""
        if failed_step == total_steps - 1:
            # 最后一步失败，使用所有前序结果
            return FallbackDecision(
                strategy=FallbackStrategy.USE_SUMMARY,
                target_model=None,
                use_previous_results=list(range(failed_step)),
                user_message_template="main_failed"
            )
        else:
            # 中间步骤失败，使用之前的结果
            return FallbackDecision(
                strategy=FallbackStrategy.USE_PREVIOUS_STEP,
                target_model=None,
                use_previous_results=list(range(failed_step)),
                user_message_template="step_failed"
            )
    
    def should_retry(self, error_type: ErrorType) -> Tuple[bool, int]:
        """
        判断是否应该重试
        
        返回：(是否重试, 重试次数)
        """
        config = self.error_fallback_map.get(error_type, {})
        
        if not config.get("retry", False):
            return False, 0
        
        return True, config.get("retry_count", 1)
    
    def generate_fallback_output(self, decision: FallbackDecision,
                                 step_results: List[StepResult]) -> Dict:
        """
        生成回退后的输出
        
        输入：
        - decision: 回退决策
        - step_results: 所有步骤结果
        
        输出：
        - 包含降级结果和用户消息的字典
        """
        # 收集前序成功结果
        previous_outputs = []
        for idx in decision.use_previous_results:
            if idx < len(step_results) and step_results[idx].success:
                previous_outputs.append({
                    "step": idx + 1,
                    "model": step_results[idx].model,
                    "output": step_results[idx].output[:500] + "..." if len(step_results[idx].output) > 500 else step_results[idx].output
                })
        
        # 生成用户消息
        user_message = self._generate_user_message(
            decision.user_message_template,
            previous_outputs,
            step_results
        )
        
        # 构建输出
        output = {
            "fallback_triggered": True,
            "strategy": decision.strategy.value,
            "failed_step": step_results[-1].step_index if step_results else None,
            "previous_results": previous_outputs,
            "user_message": user_message,
            "status": "partial_success" if previous_outputs else "failed"
        }
        
        return output
    
    def _generate_user_message(self, template: str, 
                              previous_outputs: List[Dict],
                              step_results: List[StepResult]) -> str:
        """生成用户侧消息"""
        
        templates = {
            "grok_code_failed": """【部分完成结果】

⚠️ 诊断步骤遇到问题，已切换至备用方案。

✅ 当前状态：
使用 CODE 模型直接生成修复方案。

💡 说明：
原诊断模型暂时不可用，但仍可为您提供代码修复建议。""",
            
            "code_failed": """【部分完成结果】

✅ 已完成：
诊断分析（GROK-CODE）
{previous_outputs}

⚠️ 未完成：
代码修复生成（CODE）
原因：生成步骤遇到技术问题

💡 建议：
基于上述诊断分析，您可以：
1. 手动参考诊断建议进行修复
2. 稍后重试完整修复流程""",
            
            "main_failed": """【部分完成结果】

✅ 已完成：
{previous_outputs}

⚠️ 未完成：
最终汇总（MAIN）
原因：汇总步骤遇到技术问题

💡 建议：
基于上述已完成的内容，您可以继续推进。""",
            
            "long_failed": """【服务降级通知】

⚠️ 文档总结步骤遇到问题。

✅ 当前状态：
直接使用推理模型分析原始输入。

💡 说明：
虽然缺少结构化摘要，但仍可为您提供分析建议。""",
            
            "reason_failed": """【部分完成结果】

✅ 已完成：
文档摘要（LONG）
{previous_outputs}

⚠️ 未完成：
推理分析（REASON）
原因：推理步骤遇到技术问题

💡 建议：
基于上述文档摘要，您可以继续推进。""",
            
            "cn_failed": """【部分完成结果】

✅ 已完成：
分析（REASON）
{previous_outputs}

⚠️ 未完成：
中文润色（CN）
原因：润色步骤遇到技术问题

💡 说明：
返回未润色的原始分析结果，内容完整但表达方式较直接。""",
            
            "reason_failed_simple": """【服务降级通知】

⚠️ 分析步骤遇到技术问题。

✅ 当前状态：
已切换至简化处理模式。

💡 建议：
请稍后重试，或简化问题后再次尝试。""",
            
            "step_failed": """【部分完成结果】

✅ 已完成：
{previous_outputs}

⚠️ 当前步骤遇到问题，无法继续。

💡 建议：
基于已完成的部分继续，或稍后重试。"""
        }
        
        message = templates.get(template, templates["step_failed"])
        
        # 替换占位符
        if previous_outputs:
            outputs_text = "\n\n".join([
                f"Step {o['step']} ({o['model']}):\n{o['output'][:200]}"
                for o in previous_outputs
            ])
            message = message.replace("{previous_outputs}", outputs_text)
        else:
            message = message.replace("{previous_outputs}", "（无）")
        
        return message


class FallbackExecutor:
    """回退执行器"""
    
    def __init__(self, handler: FallbackHandler):
        self.handler = handler
    
    def execute_with_fallback(self, chain_models: List[str], 
                              execute_func) -> Dict:
        """
        执行链路，支持回退
        
        输入：
        - chain_models: 链路模型列表
        - execute_func: 执行函数，返回 StepResult
        
        输出：
        - 最终结果（成功或回退后）
        """
        step_results = []
        
        for i, model in enumerate(chain_models):
            try:
                # 执行步骤
                result = execute_func(i, model)
                step_results.append(result)
                
                if not result.success:
                    # 步骤失败，决策回退
                    error_type = ErrorType(result.error_type) if result.error_type else ErrorType.UNKNOWN
                    
                    # 检查是否可重试
                    should_retry, retry_count = self.handler.should_retry(error_type)
                    
                    if should_retry:
                        # 执行重试
                        retry_success = False
                        for retry in range(retry_count):
                            result = execute_func(i, model, retry=True)
                            if result.success:
                                retry_success = True
                                step_results[-1] = result
                                break
                        
                        if retry_success:
                            continue
                    
                    # 重试失败或不可重试，执行回退
                    decision = self.handler.decide_fallback(
                        chain_models, i, error_type
                    )
                    
                    fallback_output = self.handler.generate_fallback_output(
                        decision, step_results
                    )
                    
                    return fallback_output
                    
            except Exception as e:
                # 执行异常，执行回退
                decision = self.handler.decide_fallback(
                    chain_models, i, ErrorType.UNKNOWN
                )
                
                fallback_output = self.handler.generate_fallback_output(
                    decision, step_results
                )
                
                return fallback_output
        
        # 全部成功
        return {
            "fallback_triggered": False,
            "status": "success",
            "results": step_results
        }


if __name__ == "__main__":
    # 测试回退策略
    print("测试回退策略处理器...")
    
    handler = FallbackHandler()
    
    # 测试决策
    decision = handler.decide_fallback(
        ["GROK-CODE", "CODE", "MAIN"],
        0,  # GROK-CODE 失败
        ErrorType.TIMEOUT
    )
    
    print(f"\n回退决策: {decision}")
    
    # 测试重试判断
    should_retry, retry_count = handler.should_retry(ErrorType.EMPTY_RESPONSE)
    print(f"Empty Response 是否重试: {should_retry}, 次数: {retry_count}")
    
    should_retry, retry_count = handler.should_retry(ErrorType.TIMEOUT)
    print(f"Timeout 是否重试: {should_retry}, 次数: {retry_count}")
    
    # 测试输出生成
    step_results = [
        StepResult(0, "GROK-CODE", False, "", "timeout", "timeout"),
    ]
    
    output = handler.generate_fallback_output(decision, step_results)
    print(f"\n回退输出:\n{output['user_message']}")