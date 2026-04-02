/**
 * QueryGuard - 轮次状态机
 * 
 * 防止 session 并发乱套，解决：
 * - Telegram 多消息并发
 * - bot 重复触发
 * - queue 与用户直发冲突
 * - cancel 后 stale finally 清理
 * 
 * 状态流转：idle → dispatching → running → idle
 */

export type QueryState = 'idle' | 'dispatching' | 'running';

export class QueryGuard {
  private status: QueryState = 'idle';
  private generation = 0;

  /**
   * 预留执行权
   * @returns 是否成功预留
   */
  reserve(): boolean {
    if (this.status !== 'idle') {
      return false;
    }
    this.status = 'dispatching';
    return true;
  }

  /**
   * 取消预留（dispatching → idle）
   */
  cancelReservation(): void {
    if (this.status === 'dispatching') {
      this.status = 'idle';
    }
  }

  /**
   * 尝试开始执行
   * @returns generation token，null 表示无法开始
   */
  tryStart(): number | null {
    if (this.status === 'running') {
      return null;
    }
    this.status = 'running';
    this.generation++;
    return this.generation;
  }

  /**
   * 结束执行（需验证 generation）
   * @param generation 开始时的 token
   * @returns 是否成功结束
   */
  end(generation: number): boolean {
    if (generation !== this.generation) {
      return false; // stale finally，忽略
    }
    this.status = 'idle';
    return true;
  }

  /**
   * 强制结束（用于 cancel）
   */
  forceEnd(): void {
    this.status = 'idle';
  }

  /**
   * 是否正在执行
   */
  isActive(): boolean {
    return this.status !== 'idle';
  }

  /**
   * 获取当前状态
   */
  getState(): QueryState {
    return this.status;
  }

  /**
   * 获取当前 generation（用于调试）
   */
  getGeneration(): number {
    return this.generation;
  }
}

// ============================================================================
// 使用示例
// ============================================================================

/**
 * 在 Telegram 收消息入口使用：
 * 
 * const guard = new QueryGuard();
 * 
 * async function onMessage(message: TelegramMessage) {
 *   if (!guard.reserve()) {
 *     // 上一轮还在执行，排队或拒绝
 *     return;
 *   }
 *   
 *   try {
 *     const gen = guard.tryStart();
 *     if (gen === null) {
 *       return; // 已经在运行
 *     }
 *     
 *     await processMessage(message);
 *     guard.end(gen);
 *   } catch (e) {
 *     guard.forceEnd(); // cancel 时清理
 *     throw e;
 *   }
 * }
 */
