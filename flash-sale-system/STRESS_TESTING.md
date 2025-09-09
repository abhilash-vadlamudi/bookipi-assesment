# Flash Sale System - Stress Testing Guide

## 🚀 Comprehensive Stress Test Suite

The Flash Sale system now includes a complete stress testing framework designed to validate system performance under extreme conditions typical of real flash sale events.

## 📁 Test Structure

```
src/tests/
├── stress/          # High concurrency and race condition tests
├── load/            # Sustained load and throughput tests  
├── performance/     # Response time and resource usage tests
├── breaking-point/  # System limits and failure point analysis
└── integration/     # End-to-end API validation tests
```

## 🧪 Test Categories

### 1. **Stress Tests** (`src/tests/stress/`)
- **Concurrent Purchase Stress**: 100+ simultaneous purchase attempts on limited inventory
- **Rate Limiting Validation**: Extreme load on authentication endpoints
- **Database Performance**: High-volume concurrent database operations
- **Data Consistency**: Concurrent read/write operations validation
- **Memory Stress**: Large payload handling and rapid sequential requests

### 2. **Load Tests** (`src/tests/load/`)
- **Performance Baselines**: Light/medium/heavy load comparisons
- **Sustained Load**: 30-second continuous request streams
- **Memory Leak Detection**: Multi-cycle memory usage analysis
- **Recovery Testing**: Post-spike performance validation

### 3. **Performance Tests** (`src/tests/performance/`)
- **Response Time Analysis**: P95/P99 latency measurements
- **Throughput Benchmarks**: Requests/second under varying loads
- **Resource Monitoring**: Memory usage and garbage collection efficiency
- **Database Query Performance**: Query latency under load

### 4. **Breaking Point Tests** (`src/tests/breaking-point/`)
- **Maximum Load Discovery**: Automated breaking point identification
- **System Recovery**: Post-overload recovery time analysis
- **Memory Exhaustion**: Heap limit and memory leak detection
- **Connection Limits**: Simultaneous connection handling

## 🏃‍♂️ Running Stress Tests

### Quick Commands
```bash
# Run all stress tests
npm run test:all-stress

# Run individual test suites
npm run test:stress          # High concurrency tests
npm run test:load           # Sustained load tests
npm run test:performance    # Performance benchmarks
npm run test:breaking-point # System limits

# Run with memory monitoring
NODE_OPTIONS="--max-old-space-size=4096 --expose-gc" npm run test:all-stress
```

### Individual Test Categories
```bash
# Stress tests (concurrency focus)
npm run test:stress

# Load tests (sustained performance)
npm run test:load

# Performance tests (response time/throughput)
npm run test:performance

# Breaking point tests (system limits)
npm run test:breaking-point
```

## 📊 Performance Metrics

### Key Performance Indicators (KPIs)
- **Response Time**: < 100ms average, < 200ms P95
- **Throughput**: > 100 requests/second sustained
- **Success Rate**: > 95% under normal load, > 80% under stress
- **Memory Growth**: < 50% increase during sustained load
- **Recovery Time**: < 5 seconds after load spikes

### Test Outputs
Each test suite provides detailed metrics:
- **Concurrent Request Handling**: Success rates and response times
- **Memory Usage Analysis**: Heap growth and garbage collection efficiency
- **Throughput Measurements**: Requests per second under various loads
- **Error Categorization**: Detailed breakdown of failure types
- **Recovery Performance**: Post-stress system behavior

## 🎯 Test Scenarios

### Flash Sale Simulation
```javascript
// Simulates real flash sale conditions
- 100+ concurrent users attempting purchases
- Limited inventory (10 items) race conditions
- High-volume product stress testing (50,000 inventory)
- Rate limiting under authentication floods
- Memory usage during traffic spikes
```

### System Resilience
```javascript
// Tests system breaking points and recovery
- Progressive load increase (100 → 1000 requests)
- Connection exhaustion scenarios
- Memory leak detection across cycles
- Database connection pool limits
- Post-overload recovery validation
```

## 🔧 Configuration

### Test Configuration Files
```javascript
// Stress test thresholds
STRESS_CONFIG = {
  CONCURRENT_USERS: 100,
  RATE_LIMIT_REQUESTS: 50,
  SUSTAINED_LOAD_DURATION: 30000, // 30 seconds
  MEMORY_LEAK_THRESHOLD: 50 // 50% growth limit
}

// Performance benchmarks
PERF_CONFIG = {
  RESPONSE_TIME_THRESHOLD: 100, // ms
  THROUGHPUT_THRESHOLD: 100,    // req/sec
  SUCCESS_RATE_THRESHOLD: 99,   // percent
}
```

### Environment Variables
```bash
# Optimize for stress testing
export NODE_OPTIONS="--max-old-space-size=4096 --expose-gc"
export NODE_ENV=test

# Enable detailed logging
export DEBUG=flash-sale:*
```

## 📈 Expected Results

### Baseline Performance
- **Health Checks**: < 50ms average response time
- **Flash Sale Queries**: < 100ms average response time
- **Purchase Operations**: < 200ms average response time
- **Concurrent Load**: Handle 100+ simultaneous requests

### Stress Test Benchmarks
- **Race Conditions**: Properly handle 100 concurrent purchase attempts
- **Rate Limiting**: Activate under 50+ rapid authentication attempts
- **Memory Stability**: < 50% memory growth during sustained load
- **System Recovery**: Return to baseline within 5 seconds post-stress

### Breaking Point Analysis
- **Maximum Load**: Identify sustainable concurrent request limits
- **Failure Gracefully**: Maintain partial service under extreme load
- **Recovery Capability**: Restore full functionality after overload

## 🚨 Failure Scenarios

### What Stress Tests Validate
1. **Database Race Conditions**: Concurrent inventory updates
2. **Memory Leaks**: Sustained load memory growth
3. **Connection Exhaustion**: TCP connection limits
4. **Response Time Degradation**: Performance under load
5. **System Recovery**: Post-stress restoration

### Expected Failure Points
- **Connection Limits**: 500+ simultaneous connections
- **Memory Exhaustion**: Sustained high-frequency requests
- **Database Locks**: Extremely high concurrent writes
- **Rate Limiting**: Rapid authentication attempts

## 🔍 Monitoring During Tests

### Real-time Metrics
```bash
# Monitor during stress tests
top -p $(pgrep -f "npm.*test")     # CPU/Memory usage
netstat -an | grep :3000           # Connection counts
watch "ps aux | grep node"         # Process monitoring
```

### Performance Analysis
- **Memory Snapshots**: Taken during sustained load tests
- **Response Time Distribution**: P50, P95, P99 measurements
- **Error Rate Analysis**: Categorized failure types
- **Throughput Patterns**: Requests/second over time

## 💡 Optimization Insights

### Common Performance Bottlenecks
1. **Database Connection Pool**: Limit concurrent connections
2. **Memory Allocation**: Large object creation during load
3. **Event Loop Blocking**: Synchronous operations under load
4. **TCP Connection Limits**: OS-level connection restrictions

### Stress Test Benefits
- **Validates Real-world Performance**: Simulates actual flash sale traffic
- **Identifies Breaking Points**: Discovers system limits before production
- **Memory Leak Detection**: Catches memory issues early
- **Capacity Planning**: Provides concrete performance metrics
- **Recovery Validation**: Ensures system resilience

---

**The stress test suite provides comprehensive validation that the Flash Sale system can handle real-world traffic patterns and recover gracefully from overload conditions.** 🎯
