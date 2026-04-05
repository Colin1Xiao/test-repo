/**
 * Operator Command Dispatch
 * Phase 2A-1 - 命令分发层
 *
 * 职责：
 * - 接受统一 OperatorCommand
 * - 映射到：view action / control action / hitl action / navigation action
 * - 返回 OperatorCommandResult
 */
import type { DispatchContext, OperatorCommand, OperatorCommandResult } from "../types/surface_types";
export interface OperatorCommandDispatch {
    /**
     * 分发命令到对应处理器
     * @param command - 标准化命令对象
     * @param context - 分发上下文（包含 actor、navigation 状态等）
     * @returns 命令执行结果
     */
    dispatch(command: OperatorCommand, context?: DispatchContext): Promise<OperatorCommandResult>;
}
export type CommandHandlerCategory = "view" | "control" | "hitl" | "navigation";
/**
 * 命令映射配置
 * commandType -> { category, targetType, handler }
 */
export interface CommandMapping {
    category: CommandHandlerCategory;
    targetType: string;
    handler: string;
    returnsUpdatedView: boolean;
    returnsActionResult: boolean;
}
export declare const COMMAND_REGISTRY: Record<string, CommandMapping>;
export declare const PHASE_2A1_MINIMAL_COMMANDS: string[];
