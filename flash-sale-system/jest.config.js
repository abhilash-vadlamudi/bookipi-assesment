module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.ts', '**/src/**/*.test.ts'],
    verbose: true,
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/server.ts',
        '!**/node_modules/**'
    ],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
    testTimeout: 60000, // Increased timeout for stress tests
    transform: {
        '^.+\\.ts$': 'ts-jest'
    },
    moduleFileExtensions: ['ts', 'js', 'json'],
    // Optimize for stress tests
    maxWorkers: process.env.NODE_ENV === 'stress-test' ? 1 : '50%',
    // Prevent memory leaks in long-running tests
    logHeapUsage: true,
    detectOpenHandles: true,
    forceExit: true
};
