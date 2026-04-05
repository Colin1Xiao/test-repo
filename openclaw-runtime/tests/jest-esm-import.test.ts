/**
 * Jest ESM Import Test
 * 
 * Purpose: Test Jest ESM module resolution for src imports
 */

import { describe, it, expect } from '@jest/globals';
import { InstanceRegistry } from '../src/coordination/instance_registry.js';

describe('Jest ESM Import Test', () => {
  it('should import InstanceRegistry from src', () => {
    expect(InstanceRegistry).toBeDefined();
    expect(typeof InstanceRegistry).toBe('function');
  });
});
