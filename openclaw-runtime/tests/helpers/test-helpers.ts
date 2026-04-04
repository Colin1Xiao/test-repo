/**
 * Test Helpers
 * 
 * 通用测试辅助函数：
 * - Correlation ID 生成
 * - 时间戳断言
 * - 仓库初始化/清理
 * - 等待辅助
 */

import { rm, mkdir } from 'fs/promises';
import { join } from 'path';

/**
 * 生成唯一的 correlation ID
 */
export function generateCorrelationId(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 等待指定毫秒数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 验证时间戳顺序 (单调递增)
 */
export function assertTimestampsOrdered(timestamps: number[]): void {
  for (let i = 1; i < timestamps.length; i++) {
    expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
  }
}

/**
 * 验证时间戳在容差范围内
 */
export function assertTimestampWithinRange(
  timestamp: number,
  expected: number,
  toleranceMs: number = 1000
): void {
  expect(timestamp).toBeGreaterThanOrEqual(expected - toleranceMs);
  expect(timestamp).toBeLessThanOrEqual(expected + toleranceMs);
}

/**
 * 验证时间戳顺序 (带容差)
 */
export function assertTimestampOrder(
  before: number,
  after: number,
  toleranceMs: number = 1000
): void {
  expect(after).toBeGreaterThanOrEqual(before - toleranceMs);
}

/**
 * 清理测试数据目录
 */
export async function cleanupTestDataDir(subDir?: string): Promise<void> {
  const dir = subDir
    ? join(process.cwd(), 'test-data', subDir)
    : join(process.cwd(), 'test-data');
  
  try {
    await rm(dir, { recursive: true, force: true });
  } catch (error) {
    // Ignore errors during cleanup
  }
}

/**
 * 初始化测试数据目录
 */
export async function initTestDataDir(subDir?: string): Promise<void> {
  const dir = subDir
    ? join(process.cwd(), 'test-data', subDir)
    : join(process.cwd(), 'test-data');
  
  await mkdir(dir, { recursive: true });
}

/**
 * 重置测试数据目录 (清理 + 初始化)
 */
export async function resetTestDataDir(subDir?: string): Promise<void> {
  await cleanupTestDataDir(subDir);
  await initTestDataDir(subDir);
}

/**
 * 等待条件满足 (轮询)
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const result = await Promise.resolve(condition());
    if (result) {
      return;
    }
    await sleep(intervalMs);
  }
  
  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

/**
 * 抑制控制台输出 (用于测试安静模式)
 */
export function suppressConsole(): () => void {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  
  return () => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  };
}
