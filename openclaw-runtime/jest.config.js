/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  
  // Transform TypeScript to ESM using tsconfig paths
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.test.json',
      },
    ],
  },
  
  // Use tsconfig paths for module resolution - remove .js extension
  moduleNameMapper: {
    // Absolute imports
    '^src/(.*)\\.js$': '<rootDir>/src/$1.ts',
    '^tests/(.*)\\.js$': '<rootDir>/tests/$1.ts',
  },
  
  // Don't transform or map node_modules
  transformIgnorePatterns: [
    'node_modules/',
  ],
  
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
};
