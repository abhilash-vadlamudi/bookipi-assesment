// Global teardown for stress and performance tests
module.exports = async () => {
  // Force garbage collection at the end
  if (global.gc) {
    global.gc();
    console.log('Final garbage collection executed');
  }

  // Log final memory usage
  const memoryUsage = process.memoryUsage();
  console.log('Final memory usage:', {
    rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB`,
    heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
    heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
    external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)}MB`
  });

  console.log('Global test teardown complete');
};
