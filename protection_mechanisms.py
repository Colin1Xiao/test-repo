#!/usr/bin/env python3
"""
OpenClaw 保护机制
Protection Mechanisms for Multi-Model System
"""

import re
from typing import Dict, Optional, Tuple, Any
from dataclasses import dataclass


@dataclass
class ProtectionResult:
    """保护机制处理结果"""
    success: bool
    output: str
    status: str
    metadata: Dict


class EmptyOutputProtector:
    """5.1 空输出保护"""
    
    # 空输出检测模式
    EMPTY_PATTERNS = [
        r'^\s*$',  # 纯空白
        r'^Assistant:\s*$',  # 仅 Assistant:
        r'^assistant:\s*$',  # 小写
        r'^\[\w+\]:?\s*$',  # 仅标签如 [Assistant]:
    ]
    
    def __init__(self, max_retries: int = 1):
        self.max_retries = max_retries
        self.retry_count = 0
    
    def is_empty_output(self, output: str) -> bool:
        """检测是否为空输出"""
        if not output or len(output.strip()) < 10:
            return True
        
        for pattern in self.EMPTY_PATTERNS:
            if re.match(pattern, output.strip(), re.IGNORECASE):
                return True
        
        return False
    
    def protect(self, output: str, model: str, retry_func) -> ProtectionResult:
        """
        空输出保护主逻辑
        
        流程：检测 -> 标记 -> 重试 -> fallback
        """
        # 检测空输出
        if not self.is_empty_output(output):
            return ProtectionResult(
                success=True,
                output=output,
                status="normal",
                metadata={"empty_check": "passed"}
            )
        
        # 标记为空输出
        metadata = {
            "empty_detected": True,
            "model": model,
            "original_output": output[:100] if output else ""
        }
        
        # 自动重试
        while self.retry_count < self.max_retries:
            self.retry_count += 1
            metadata["retry_count"] = self.retry_count
            
            try:
                # 调用重试函数
                retry_output = retry_func()
                
                if not self.is_empty_output(retry_output):
                    metadata["retry_success"] = True
                    return ProtectionResult(
                        success=True,
                        output=retry_output,
                        status="retry_success",
                        metadata=metadata
                    )
            except Exception as e:
                metadata["retry_error"] = str(e)
        
        # 重试失败，进入 fallback
        metadata["fallback_triggered"] = True
        return ProtectionResult(
            success=False,
            output="",
            status="empty_after_retry",
            metadata=metadata
        )


class LongTaskDegradation:
    """5.2 长任务降级保护"""
    
    # 阈值配置
    INPUT_LENGTH_THRESHOLD = 5000  # 输入超过 5000 字符视为长输入
    OUTPUT_LENGTH_THRESHOLD = 3000  # 单步输出超过 3000 字符
    MAX_PREVIOUS_OUTPUT = 2000  # 传给 MAIN 的前序输出最大长度
    
    def __init__(self):
        self.compression_applied = False
    
    def check_long_task(self, input_text: str, previous_outputs: list) -> Dict:
        """检查是否为长任务"""
        flags = {
            "long_input": len(input_text) > self.INPUT_LENGTH_THRESHOLD,
            "multi_step": len(previous_outputs) > 1,
            "large_previous_output": any(
                len(str(out)) > self.OUTPUT_LENGTH_THRESHOLD 
                for out in previous_outputs
            )
        }
        flags["needs_compression"] = any(flags.values())
        return flags
    
    def compress_for_main(self, previous_outputs: list) -> str:
        """
        压缩前序输出供 MAIN 汇总
        
        策略：
        1. 只保留每步的核心结论（前 500 字符）
        2. 添加步骤标识
        3. 总长度控制在 MAX_PREVIOUS_OUTPUT 以内
        """
        compressed_parts = []
        
        for i, output in enumerate(previous_outputs, 1):
            output_str = str(output)
            # 提取前 500 字符作为摘要
            summary = output_str[:500].strip()
            if len(output_str) > 500:
                summary += "... [truncated]"
            
            compressed_parts.append(f"[Step {i} Summary]\n{summary}\n")
        
        compressed = "\n".join(compressed_parts)
        
        # 如果仍超过限制，进一步截断
        if len(compressed) > self.MAX_PREVIOUS_OUTPUT:
            compressed = compressed[:self.MAX_PREVIOUS_OUTPUT - 100] + "\n... [further compressed]"
        
        self.compression_applied = True
        return compressed
    
    def protect(self, input_text: str, previous_outputs: list, main_task_func) -> ProtectionResult:
        """长任务降级保护主逻辑"""
        flags = self.check_long_task(input_text, previous_outputs)
        
        if not flags["needs_compression"]:
            # 正常执行
            output = main_task_func("\n\n".join(str(o) for o in previous_outputs))
            return ProtectionResult(
                success=True,
                output=output,
                status="normal",
                metadata={"compression": "not_needed"}
            )
        
        # 需要压缩
        compressed_input = self.compress_for_main(previous_outputs)
        
        metadata = {
            "compression_applied": True,
            "original_input_length": len(input_text),
            "compressed_length": len(compressed_input),
            "flags": flags
        }
        
        try:
            output = main_task_func(compressed_input)
            return ProtectionResult(
                success=True,
                output=output,
                status="compressed_success",
                metadata=metadata
            )
        except Exception as e:
            metadata["error"] = str(e)
            return ProtectionResult(
                success=False,
                output="",
                status="compression_failed",
                metadata=metadata
            )


class SingleStepFailureIsolation:
    """5.3 单步失败不拖垮全链路"""
    
    def __init__(self):
        self.step_results = []
        self.failed_steps = []
    
    def record_step_result(self, step_index: int, model: str, 
                          success: bool, output: str, error: str = None):
        """记录步骤结果"""
        result = {
            "step_index": step_index,
            "model": model,
            "success": success,
            "output": output if success else "",
            "error": error,
            "status": "success" if success else "failed"
        }
        self.step_results.append(result)
        
        if not success:
            self.failed_steps.append(result)
    
    def can_continue(self) -> bool:
        """判断是否可以继续后续步骤"""
        # 只要还有成功的步骤，就可以尝试继续
        return any(r["success"] for r in self.step_results)
    
    def generate_partial_summary(self) -> str:
        """生成部分完成摘要"""
        parts = []
        
        # 总结成功的步骤
        successful = [r for r in self.step_results if r["success"]]
        if successful:
            parts.append("【已完成步骤】")
            for r in successful:
                parts.append(f"  Step {r['step_index']} ({r['model']}): 完成")
                # 添加摘要（前 200 字符）
                summary = r['output'][:200].strip()
                if summary:
                    parts.append(f"    {summary}...")
        
        # 总结失败的步骤
        if self.failed_steps:
            parts.append("\n【未完成步骤】")
            for r in self.failed_steps:
                parts.append(f"  Step {r['step_index']} ({r['model']}): 失败")
                if r['error']:
                    parts.append(f"    原因: {r['error'][:100]}")
        
        parts.append("\n【建议】")
        if successful:
            parts.append("基于已完成的部分，可以：")
            parts.append("1. 查看上述已完成的内容")
            parts.append("2. 针对失败步骤单独重试")
            parts.append