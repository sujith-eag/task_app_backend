export default {
  testEnvironment: 'node',
  
  // Transform ES modules
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  
  // Handle ES modules
  transformIgnorePatterns: [
    'node_modules/(?!(module-that-needs-transform)/)',
  ],
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/*.test.js',
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.js'],
  
  // Inject jest globals
  injectGlobals: true,
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/api/**/*.js',
    '!src/api/**/__tests__/**',
    '!src/api/**/routes/**',
    '!**/node_modules/**',
  ],
  
  coverageDirectory: 'coverage',
  
  coverageReporters: ['text', 'lcov', 'html'],
  
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  
  // Timeouts
  testTimeout: 30000,
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Detect open handles
  detectOpenHandles: true,
  
  // Force exit after tests
  forceExit: true,
  
  // Module name mapper for path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
