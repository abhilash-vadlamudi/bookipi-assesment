// Global setup for stress and performance tests
module.exports = async () => {
  // Force garbage collection to be available in tests
  if (global.gc) {
    console.log('Garbage collection is available for tests');
  } else {
    console.log('Garbage collection is not available - run with --expose-gc for memory tests');
  }

  // Set Node.js memory limits for stress testing
  if (process.env.NODE_OPTIONS && process.env.NODE_OPTIONS.includes('--max-old-space-size')) {
    console.log('Memory limit detected:', process.env.NODE_OPTIONS);
  } else {
    console.log('Consider setting NODE_OPTIONS="--max-old-space-size=4096 --expose-gc" for stress tests');
  }

  // Optimize for test performance
  process.env.NODE_ENV = 'test';
  
  console.log('Global test setup complete');
};
