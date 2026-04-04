/**
 * Jest Global Setup
 * 
 * 全局测试配置：
 * - 临时目录管理
 * - 全局超时设置
 * - 错误处理
 */

import { mkdir, rm } from 'fs/promises';
import { join } from 'path';

// 临时测试目录
export const TEST_DATA_DIR = join(process.cwd(), 'test-data');

// 全局超时 (30 秒)
jest.setTimeout(30000);

// 每个测试前清理临时目录
beforeEach(async () => {
  try {
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
    await mkdir(TEST_DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to cleanup test data directory:', error);
  }
});

// 所有测试后清理临时目录
afterAll(async () => {
  try {
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
  } catch (error) {
    console.error('Failed to cleanup test data directory:', error);
  }
});

// 全局错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
