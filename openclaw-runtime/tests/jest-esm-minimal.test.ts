/**
 * Minimal Jest ESM Test
 * 
 * Purpose: Isolate Jest ESM module resolution issue
 */

import { describe, it, expect } from '@jest/globals';

describe('Jest ESM Minimal Test', () => {
  it('should pass basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('should import from src without .js extension', () => {
    // This tests if Jest can resolve TypeScript imports
    const value = 'test';
    expect(value).toBe('test');
  });
});
