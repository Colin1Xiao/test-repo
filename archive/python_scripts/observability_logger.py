#!/usr/bin/env python3
"""
OpenClaw 可观测性日志系统
Observability Logger for Multi-Model Routing System
"""

import json
import time
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum
import os


class TaskStatus(Enum):
    """任务状态枚举"""
    SUCCESS = "success"
    TIMEOUT = "timeout"
    EMPTY = "empty"
    PARTIAL = "partial"
    FAILED = "failed"
    FALLBACK_SUCCESS = "fallback_success"
    SKIPPED = "skipped"


class StepStatus(Enum):
    """步骤状态枚举"""
    SUCCESS = "success"
    TIMEOUT = "timeout"
    EMPTY = "empty"
    PARTIAL = "partial"
    FAILED = "failed"
    SKIPPED = "skipped"
    FALLBACK = "fallback"


class ExceptionType(Enum):
    """异常类型枚举"""
    EMPTY_RESPONSE = "empty_response"
    ASSISTANT_STUB_ONLY = "assistant_stub_only"
    STEP_TIMEOUT = "step_timeout"
    SUMMARY_TRUNCATED = "summary_truncated"
    FALLBACK_TRIGGERED = "fallback_triggered"
    SUBAGENT_INVOKE_FAILED = "subagent_invoke_failed"
    MIXED_CHAIN_PARTIAL_SUCCESS = "mixed_chain_partial_success"
    PROVIDER_ERROR = "provider_error"
    PROVIDER_SLOW_RESPONSE = "provider_slow_response"


class TaskType(Enum):
    """任务类型枚举"""
    SINGLE = "single"
    MIXED = "mixed"


@dataclass
class RequestLog:
    """请求级日志"""
    request_id: str
    session_id: str
    user_id: str
    channel: str
    task_type: str
    route_type: str
    selected_model: str
    start_time: str
    end_time: Optional[str] = None
    duration_ms: Optional[int] = None
    final_status: Optional[str] = None
    token_usage_input: Optional[int] = None
    token_usage_output: Optional[int] = None
    error_message: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class StepLog:
    """步骤级日志（混合任务）"""
    step_id: str
    parent_request_id: str
    step_index: int
    step_name: str
    target_model: str
    input_size: int
    output_size: Optional[int] = None
    start_time: str = ""
    end_time: Optional[str] = None
    step_duration_ms: Optional[int] = None
    retry_count: int = 0
    step_status: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class ExceptionLog:
    """异常日志"""
    exception_id: str
    request_id: str
    exception_type: str
    timestamp: str
    details: Dict[str, Any]
    
    def to_dict(self) -> Dict:
        return asdict(self)


class ObservabilityLogger:
    """可观测性日志记录器"""
    
    def __init__(self, log_dir: str = "/Users/colin/.openclaw/workspace/logs"):
        self.log_dir = log_dir
        self.request_logs: List[RequestLog] = []
        self.step_logs: List[StepLog] = []
        self.exception_logs: List[ExceptionLog] = []
        
        # 确保日志目录存在
        os.makedirs(log_dir, exist_ok=True)
        
        # 日志文件路径
        self.request_log_file = os.path.join(log_dir, "requests.log")
        self.step_log_file = os.path.join(log_dir, "steps.log")
        self.exception_log_file = os.path.join(log_dir, "exceptions.log")
    
    def generate_request_id(self) -> str:
        """生成请求 ID"""
        return f"req_{uuid.uuid4().hex[:12]}"
    
    def generate_step_id(self) -> str:
        """生成步骤 ID"""
        return f"step_{uuid.uuid4().hex[:12]}"
    
    def start_request(self, session_id: str, user_id: str, channel: str,
                     task_type: str, route_type: str, selected_model: str) -> str:
        """开始记录请求"""
        request_id = self.generate_request_id()
        
        log = RequestLog(
            request_id=request_id,
            session_id=session_id,
            user_id=user_id,
            channel=channel,
            task_type=task_type,
            route_type=route_type,
            selected_model=selected_model,
            start_time=datetime.now().isoformat()
        )
        
        self.request_logs.append(log)
        return request_id
    
    def end_request(self, request_id: str, status: TaskStatus,
                   token_input: Optional[int] = None,
                   token_output: Optional[int] = None,
                   error_message: Optional[str] = None):
        """结束记录请求"""
        for log in self.request_logs:
            if log.request_id == request_id:
                log.end_time = datetime.now().isoformat()
                log.final_status = status.value
                log.token_usage_input = token_input
                log.token_usage_output = token_output
                log.error_message = error_message
                
                # 计算耗时
                if log.start_time:
                    start = datetime.fromisoformat(log.start_time)
                    end = datetime.fromisoformat(log.end_time)
                    log.duration_ms = int((end - start).total_seconds() * 1000)
                
                # 立即写入文件
                self._append_to_file(self.request_log_file, log.to_dict())
                break
    
    def start_step(self, parent_request_id: str, step_index: int,
                  step_name: str, target_model: str, input_text: str) -> str:
        """开始记录步骤"""
        step_id = self.generate_step_id()
        
        log = StepLog(
            step_id=step_id,
            parent_request_id=parent_request_id,
            step_index=step_index,
            step_name=step_name,
            target_model=target_model,
            input_size=len(input_text),
            start_time=datetime.now().isoformat()
        )
        
        self.step_logs.append(log)
        return step_id
    
    def end_step(self, step_id: str, status: TaskStatus, output_text: Optional[str] = None,
                retry_count: int = 0):
        """结束记录步骤"""
        for log in self.step_logs:
            if log.step_id == step_id:
                log.end_time = datetime.now().isoformat()
                log.step_status = status.value
                log.output_size = len(output_text) if output_text else 0
                log.retry_count = retry_count
                
                # 计算耗时
                if log.start_time:
                    start = datetime.fromisoformat(log.start_time)
                    end = datetime.fromisoformat(log.end_time)
                    log.step_duration_ms = int((end - start).total_seconds() * 1000)
                
                # 立即写入文件
                self._append_to_file(self.step_log_file, log.to_dict())
                break
    
    def log_exception(self, request_id: str, exception_type: str, details: Dict):
        """记录异常"""
        log = ExceptionLog(
            exception_id=f"exc_{uuid.uuid4().hex[:12]}",
            request_id=request_id,
            exception_type=exception_type,
            timestamp=datetime.now().isoformat(),
            details=details
        )
        
        self.exception_logs.append(log)
        self._append_to_file(self.exception_log_file, log.to_dict())
    
    # ==================== 异常专项日志 ====================
    
    def log_empty_response(self, request_id: str, model: str, output_preview: str):
        """记录空输出异常"""
        self.log_exception(
            request_id=request_id,
            exception_type=ExceptionType.EMPTY_RESPONSE.value,
            details={
                "model": model,
                "output_preview": output_preview[:100],
                "action": "auto_retry_triggered"
            }
        )
    
    def log_assistant_stub_only(self, request_id: str, model: str):
        """记录仅返回 Assistant: 的异常"""
        self.log_exception(
            request_id=request_id,
            exception_type=ExceptionType.ASSISTANT_STUB_ONLY.value,
            details={
                "model": model,
                "pattern": "Assistant:",
                "action": "marked_as_empty"
            }
        )
    
    def log_step_timeout(self, request_id: str, step_index: int, model: str, timeout_seconds: int):
        """记录步骤超时"""
        self.log_exception(
            request_id=request_id,
            exception_type=ExceptionType.STEP_TIMEOUT.value,
            details={
                "step_index": step_index,
                "model": model,
                "timeout_configured": timeout_seconds,
                "action": "fallback_activated"
            }
        )
    
    def log_summary_truncated(self, request_id: str, original_length: int, compressed_length: int):
        """记录 MAIN 汇总截断"""
        self.log_exception(
            request_id=request_id,
            exception_type=ExceptionType.SUMMARY_TRUNCATED.value,
            details={
                "original_input_length": original_length,
                "compressed_length": compressed_length,
                "compression_ratio": compressed_length / original_length if original_length > 0 else 0,
                "action": "compression_applied"
            }
        )
    
    def log_fallback_triggered(self, request_id: str, from_model: str, to_model: str, reason: str):
        """记录 fallback 触发"""
        self.log_exception(
            request_id=request_id,
            exception_type=ExceptionType.FALLBACK_TRIGGERED.value,
            details={
                "from_model": from_model,
                "to_model": to_model,
                "reason": reason,
                "action": "fallback_success" if to_model else "fallback_failed"
            }
        )
    
    def log_subagent_invoke_failed(self, request_id: str, step_index: int, error: str):
        """记录子代理调用失败"""
        self.log_exception(
            request_id=request_id,
            exception_type=ExceptionType.SUBAGENT_INVOKE_FAILED.value,
            details={
                "step_index": step_index,
                "error": error,
                "action": "partial_result_returned"
            }
        )
    
    def log_mixed_chain_partial_success(self, request_id: str, completed_steps: int, total_steps: int):
        """记录混合任务部分成功"""
        self.log_exception(
            request_id=request_id,
            exception_type=ExceptionType.MIXED_CHAIN_PARTIAL_SUCCESS.value,
            details={
                "completed_steps": completed_steps,
                "total_steps": total_steps,
                "completion_rate": completed_steps / total_steps if total_steps > 0 else 0,
                "action": "partial_summary_generated"
            }
        )
    
    def log_provider_error(self, request_id: str, model: str, error_code: str, error_message: str):
        """记录上游提供商错误"""
        self.log_exception(
            request_id=request_id,
            exception_type=ExceptionType.PROVIDER_ERROR.value,
            details={
                "model": model,
                "error_code": error_code,
                "error_message": error_message[:200],
                "action": "retry_or_fallback"
            }
        )
    
    def log_provider_slow_response(self, request_id: str, model: str, actual_duration_ms: int, timeout_ms: int):
        """记录上游慢响应"""
        self.log_exception(
            request_id=request_id,
            exception_type=ExceptionType.PROVIDER_SLOW_RESPONSE.value,
            details={
                "model": model,
                "actual_duration_ms": actual_duration_ms,
                "timeout_configured_ms": timeout_ms,
                "utilization_ratio": actual_duration_ms / timeout_ms if timeout_ms > 0 else 0,
                "action": "monitor_for_trend"
            }
        )
    
    def _append_to_file(self, filepath: str, data: Dict):
        """追加写入日志文件"""
        with open(filepath, 'a', encoding='utf-8') as f:
            f.write(json.dumps(data, ensure_ascii=False) + '\n')
    
    def get_stats(self) -> Dict:
        """获取统计信息"""
        total_requests = len(self.request_logs)
        success_requests = sum(1 for log in self.request_logs if log.final_status == TaskStatus.SUCCESS.value)
        timeout_requests = sum(1 for log in self.request_logs if log.final_status == TaskStatus.TIMEOUT.value)
        failed_requests = sum(1 for log in self.request_logs if log.final_status == TaskStatus.FAILED.value)
        
        avg_duration = 0
        durations = [log.duration_ms for log in self.request_logs if log.duration_ms]
        if durations:
            avg_duration = sum(durations) / len(durations)
        
        return {
            "total_requests": total_requests,
            "success": success_requests,
            "timeout": timeout_requests,
            "failed": failed_requests,
            "success_rate": success_requests / total_requests if total_requests > 0 else 0,
            "avg_duration_ms": avg_duration
        }
    
    def get_model_stats(self) -> Dict:
        """获取各模型统计（含 P50/P95/P99）"""
        model_stats = {}
        
        # 收集每个模型的耗时列表
        model_durations = {}
        
        for log in self.request_logs:
            model = log.selected_model
            if model not in model_stats:
                model_stats[model] = {
                    "count": 0,
                    "success": 0,
                    "timeout": 0,
                    "failed": 0,
                    "empty": 0,
                    "total_duration_ms": 0,
                    "durations": []
                }
                model_durations[model] = []
            
            model_stats[model]["count"] += 1
            if log.final_status == TaskStatus.SUCCESS.value:
                model_stats[model]["success"] += 1
            elif log.final_status == TaskStatus.TIMEOUT.value:
                model_stats[model]["timeout"] += 1
            elif log.final_status == TaskStatus.FAILED.value:
                model_stats[model]["failed"] += 1
            elif log.final_status == TaskStatus.EMPTY.value:
                model_stats[model]["empty"] += 1
            
            if log.duration_ms:
                model_stats[model]["total_duration_ms"] += log.duration_ms
                model_durations[model].append(log.duration_ms)
        
        # 计算百分位数
        for model in model_stats:
            durations = sorted(model_durations.get(model, []))
            count = len(durations)
            
            if count > 0:
                model_stats[model]["avg_duration_ms"] = model_stats[model]["total_duration_ms"] / model_stats[model]["count"]
                model_stats[model]["p50_duration_ms"] = durations[count // 2] if count > 0 else 0
                model_stats[model]["p95_duration_ms"] = durations[int(count * 0.95)] if count > 0 else 0
                model_stats[model]["p99_duration_ms"] = durations[int(count * 0.99)] if count > 0 else 0
            
            # 计算比率
            total = model_stats[model]["count"]
            model_stats[model]["success_rate"] = model_stats[model]["success"] / total if total > 0 else 0
            model_stats[model]["timeout_rate"] = model_stats[model]["timeout"] / total if total > 0 else 0
            model_stats[model]["empty_rate"] = model_stats[model]["empty"] / total if total > 0 else 0
            
            # 删除原始 durations 列表
            del model_stats[model]["durations"]
        
        return model_stats
    
    def get_chain_stats(self) -> Dict:
        """获取混合任务链路统计"""
        chain_stats = {}
        
        # 统计混合任务
        mixed_requests = [log for log in self.request_logs if log.route_type == TaskType.MIXED.value]
        
        for log in mixed_requests:
            # 获取该请求的所有步骤
            steps = [s for s in self.step_logs if s.parent_request_id == log.request_id]
            
            if not steps:
                continue
            
            # 构建链路标识
            chain_key = " -> ".join([s.target_model for s in sorted(steps, key=lambda x: x.step_index)])
            
            if chain_key not in chain_stats:
                chain_stats[chain_key] = {
                    "count": 0,
                    "success": 0,
                    "partial": 0,
                    "failed": 0,
                    "total_duration_ms": 0,
                    "step_failure_distribution": {}
                }
            
            chain_stats[chain_key]["count"] += 1
            
            if log.final_status == TaskStatus.SUCCESS.value:
                chain_stats[chain_key]["success"] += 1
            elif log.final_status == TaskStatus.PARTIAL.value:
                chain_stats[chain_key]["partial"] += 1
            else:
                chain_stats[chain_key]["failed"] += 1
            
            if log.duration_ms:
                chain_stats[chain_key]["total_duration_ms"] += log.duration_ms
            
            # 统计哪一步最容易失败
            for step in steps:
                if step.step_status in [TaskStatus.FAILED.value, TaskStatus.TIMEOUT.value]:
                    step_name = f"step_{step.step_index}_{step.target_model}"
                    if step_name not in chain_stats[chain_key]["step_failure_distribution"]:
                        chain_stats[chain_key]["step_failure_distribution"][step_name] = 0
                    chain_stats[chain_key]["step_failure_distribution"][step_name] += 1
        
        # 计算平均耗时
        for chain in chain_stats:
            count = chain_stats[chain]["count"]
            if count > 0:
                chain_stats[chain]["avg_duration_ms"] = chain_stats[chain]["total_duration_ms"] / count
        
        return chain_stats
    
    def get_grok_code_observation(self) -> Dict:
        """GROK-CODE 专项观察指标"""
        grok_logs = [log for log in self.request_logs if log.selected_model == "xai/grok-code-fast-1"]
        
        if not grok_logs:
            return {"message": "No GROK-CODE logs yet"}
        
        durations = [log.duration_ms for log in grok_logs if log.duration_ms]
        sorted_durations = sorted(durations) if durations else []
        
        empty_count = sum(1 for log in grok_logs if log.final_status == TaskStatus.EMPTY.value)
        timeout_count = sum(1 for log in grok_logs if log.final_status == TaskStatus.TIMEOUT.value)
        
        return {
            "total_calls": len(grok_logs),
            "empty_count": empty_count,
            "timeout_count": timeout_count,
            "empty_rate": empty_count / len(grok_logs) if grok_logs else 0,
            "timeout_rate": timeout_count / len(grok_logs) if grok_logs else 0,
            "avg_duration_ms": sum(durations) / len(durations) if durations else 0,
            "p50_duration_ms": sorted_durations[len(sorted_durations) // 2] if sorted_durations else 0,
            "p95_duration_ms": sorted_durations[int(len(sorted_durations) * 0.95)] if sorted_durations else 0,
            "max_duration_ms": max(durations) if durations else 0,
            "recommendation": "Consider increasing timeout if P95 > 40s or empty_rate > 5%"
        }
    
    def get_key_metrics_report(self) -> Dict:
        """
        生成关键指标报告
        可以回答以下问题：
        1. 哪个模型最慢
        2. 哪条链路最容易失败
        3. 空输出发生在哪个模型
        4. 超时发生在第几步
        5. fallback 是否真正救回结果
        """
        report = {
            "generated_at": datetime.now().isoformat(),
            "summary": self.get_stats(),
            "model_performance": {},
            "chain_performance": {},
            "exception_summary": {},
            "top_issues": []
        }
        
        # 模型性能排名（按平均耗时）
        model_stats = self.get_model_stats()
        sorted_models = sorted(
            model_stats.items(),
            key=lambda x: x[1].get("avg_duration_ms", 0),
            reverse=True
        )
        
        report["model_performance"] = {
            "slowest_models": [
                {
                    "model": model,
                    "avg_duration_ms": stats.get("avg_duration_ms", 0),
                    "p95_duration_ms": stats.get("p95_duration_ms", 0),
                    "timeout_rate": stats.get("timeout_rate", 0)
                }
                for model, stats in sorted_models[:3]
            ],
            "most_unstable_models": [
                {
                    "model": model,
                    "empty_rate": stats.get("empty_rate", 0),
                    "timeout_rate": stats.get("timeout_rate", 0),
                    "success_rate": stats.get("success_rate", 0)
                }
                for model, stats in sorted(
                    model_stats.items(),
                    key=lambda x: x[1].get("empty_rate", 0) + x[1].get("timeout_rate", 0),
                    reverse=True
                )[:3]
            ]
        }
        
        # 链路性能
        report["chain_performance"] = self.get_chain_stats()
        
        # 异常汇总
        exception_counts = {}
        for log in self.exception_logs:
            exc_type = log.exception_type
            if exc_type not in exception_counts:
                exception_counts[exc_type] = 0
            exception_counts[exc_type] += 1
        
        report["exception_summary"] = exception_counts
        
        # 关键问题识别
        issues = []
        
        # 检查 GROK-CODE
        grok_obs = self.get_grok_code_observation()
        if grok_obs.get("p95_duration_ms", 0) > 40000:
            issues.append({
                "severity": "high",
                "model": "GROK-CODE",
                "issue": "P95 duration approaching timeout",
                "value": f"{grok_obs['p95_duration_ms']:.0f}ms",
                "recommendation": "Consider increasing timeout to 60s"
            })
        
        if grok_obs.get("empty_rate", 0) > 0.05:
            issues.append({
                "severity": "medium",
                "model": "GROK-CODE",
                "issue": "High empty response rate",
                "value": f"{grok_obs['empty_rate']:.1%}",
                "recommendation": "Check provider API stability"
            })
        
        # 检查 MAIN 汇总
        main_logs = [log for log in self.request_logs if log.selected_model == "bailian/kimi-k2.5"]
        main_timeouts = sum(1 for log in main_logs if log.final_status == TaskStatus.TIMEOUT.value)
        if main_logs and main_timeouts / len(main_logs) > 0.1:
            issues.append({
                "severity": "high",
                "model": "MAIN",
                "issue": "High summary timeout rate",
                "value": f"{main_timeouts}/{len(main_logs)}",
                "recommendation": "Check if compression is working"
            })
        
        report["top_issues"] = issues
        
        return report


# 全局日志实例
logger = ObservabilityLogger()


if __name__ == "__main__":
    # 测试日志系统
    print("测试可观测性日志系统")
    
    # 模拟一个请求
    req_id = logger.start_request(
        session_id="session_001",
        user_id="5885419859",
        channel="telegram",
        task_type="code_debug",
        route_type="mixed",
        selected_model="GROK-CODE"
    )
    
    # 模拟步骤
    step_id = logger.start_step(
        parent_request_id=req_id,
        step_index=1,
        step_name="diagnosis",
        target_model="GROK-CODE",
        input_text="分析报错: IndexError"
    )
    
    time.sleep(0.1)
    logger.end_step(step_id, TaskStatus.SUCCESS, "根因: 索引越界")
    
    # 结束请求
    logger.end_request(req_id, TaskStatus.SUCCESS, token_input=100, token_output=200)
    
    # 打印统计
    print("\n统计信息:")
    print(json.dumps(logger.get_stats(), indent=2))
    
    print("\n模型统计:")
    print(json.dumps(logger.get_model_stats(), indent=2))