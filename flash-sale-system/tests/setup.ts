// Test setup file
import * as path from 'path';
import * as fs from 'fs';

// Ensure test database directory exists
const testDbDir = path.join(__dirname, '../data');
if (!fs.existsSync(testDbDir)) {
    fs.mkdirSync(testDbDir, { recursive: true });
}

// Set test environment
process.env.NODE_ENV = 'test';

// Global test timeout
jest.setTimeout(30000);

// Global test setup
beforeEach(() => {
    // Clear console between tests to reduce noise
    jest.clearAllMocks();
});

// Global test teardown
afterAll(async () => {
    // Clean up any remaining resources
    await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
    });
});
