/**
 * CLI Router
 * Phase 2A-1 - CLI 命令解析层
 *
 * 职责：将 CLI 文本命令解析为 OperatorCommand
 */
import type { OperatorActorContext, OperatorCommand } from "../types/surface_types";
export interface CliContext {
    actor: OperatorActorContext;
}
export interface CliRouter {
    /**
     * 解析 CLI 原始输入为 OperatorCommand
     * @param rawInput - 原始命令行输入，如 "oc approve apv_123"
     * @param context - CLI 上下文（包含 actor 信息）
     * @returns 标准化 OperatorCommand
     */
    parse(rawInput: string, context: CliContext): OperatorCommand;
}
export declare class DefaultCliRouter implements CliRouter {
    parse(rawInput: string, context: CliContext): OperatorCommand;
    private buildCommand;
}
