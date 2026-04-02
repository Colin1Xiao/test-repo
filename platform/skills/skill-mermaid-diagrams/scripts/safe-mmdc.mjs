#!/usr/bin/env node
/**
 * Safe Mermaid CLI wrapper
 * 
 * Provides a secure way to call mmdc without shell injection risks.
 */

import { spawn } from 'child_process';
import path from 'path';

export async function safeMmdc(args, options = {}) {
  return new Promise((resolve, reject) => {
    // Validate arguments to prevent path traversal or command injection
    const cleanArgs = args.map(arg => {
      if (typeof arg !== 'string') return String(arg);
      // Basic validation: no shell metacharacters
      if (/[;&|`$(){}[\]<>]/.test(arg)) {
        throw new Error('Invalid argument contains shell metacharacters');
      }
      // Ensure paths are within expected directories
      if (arg.includes('..') || arg.startsWith('/')) {
        throw new Error('Invalid path argument');
      }
      return arg;
    });

    const mmdc = spawn('mmdc', cleanArgs, {
      ...options,
      stdio: options.stdio || ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    if (mmdc.stdout) {
      mmdc.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }

    if (mmdc.stderr) {
      mmdc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    mmdc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`mmdc failed with code ${code}: ${stderr}`));
      }
    });

    mmdc.on('error', (error) => {
      reject(error);
    });
  });
}