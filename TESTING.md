# Backend Testing Guide

## Overview

This project uses Jest with MongoDB Memory Server for isolated, fast testing. Tests are written for all admin modules with comprehensive coverage.

## Test Infrastructure

### Setup
- **Jest**: Test runner configured for ES modules
- **Babel**: ES module transformation
- **MongoDB Memory Server**: In-memory database for isolated tests
- **Supertest**: HTTP assertion library (ready for integration tests)

### Directory Structure
```
backend/
├── jest.config.js          # Jest configuration
├── babel.config.json       # Babel ES module config
├── src/
│   ├── test/
│   │   ├── setup.js        # Global test setup/teardown
│   │   ├── utils.js        # Test utilities & factories
│   │   └── app.js          # Express app for integration tests
│   └── api/
│       └── admin/
│           ├── applications/__tests__/
│           ├── management/__tests__/
│           ├── reports/__tests__/
│           ├── subjects/__tests__/
│           └── teacher-assignments/__tests__/
```

## Running Tests

### Available Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run only admin module tests
npm run test:admin

# Run with verbose debugging output
npm run test:debug
```

### Running Specific Tests

```bash
# Run tests matching a pattern
npm test -- --testPathPatterns="applications"

# Run a single test file
npm test -- src/api/admin/subjects/__tests__/subjects.service.test.js

# Run tests with a specific name
npm test -- -t "should create a new subject"
```

## Writing Tests

### Test Structure

```javascript
import { createTestUser, createTestSubject } from '../../../../test/utils.js';

describe('Service Name', () => {
  // Setup before each test
  beforeEach(async () => {
    // Create test data
  });

  describe('functionName', () => {
    it('should do something expected', async () => {
      // Arrange
      const input = createTestSubject();
      
      // Act
      const result = await serviceFunction(input);
      
      // Assert
      expect(result).toBeDefined();
    });

    it('should throw error for invalid input', async () => {
      await expect(
        serviceFunction(invalidInput)
      ).rejects.toThrow('Expected error message');
    });
  });
});
```

### Test Utilities

#### User Factories
```javascript
// Create different user types
const admin = await createTestAdmin();
const teacher = await createTestTeacher();
const student = await createTestStudent();
const pending = await createPendingApplication();
const user = await createTestUser({ role: 'teacher' });
```

#### Subject Factory
```javascript
const subject = await createTestSubject({
  name: 'Custom Name',
  semester: 3,
});
```

#### Auth Helpers
```javascript
const token = generateTestToken(user);
const cookie = getAuthCookie(user);
```

#### Mock Helpers
```javascript
const req = createMockRequest({ user: admin, body: { ... } });
const res = createMockResponse();
const next = createMockNext();
```

## Test Coverage

### Current Coverage (86 Tests)

| Module | Tests | Coverage |
|--------|-------|----------|
| Applications | 13 | Service layer |
| Management | 24 | Service layer |
| Reports | 20 | Service layer |
| Subjects | 16 | Service layer |
| Teacher Assignments | 13 | Service layer |

### Coverage Goals
- **Branches**: 50%
- **Functions**: 50%
- **Lines**: 50%
- **Statements**: 50%

Run `npm run test:coverage` to generate coverage report in `coverage/` directory.

## Development Logging

### Logger Usage

```javascript
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ModuleName');

// Different log levels
logger.debug('Debugging info', { meta: 'data' });
logger.info('General information');
logger.warn('Warning message');
logger.error('Error occurred', { error: err.message });
logger.success('Operation completed');

// Request/Response logging
logger.request(req);
logger.response(200, data, durationMs);

// Operation timing
await logger.time('Operation name', async () => {
  return await someAsyncOperation();
});
```

### Log Levels
- **debug**: Detailed debugging, dev only
- **info**: General information
- **warn**: Warnings that don't stop execution
- **error**: Errors (always logged)
- **success**: Successful operations

## Custom Error Classes

```javascript
import { 
  NotFoundError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
} from '../utils/errors.js';

// Usage in services
if (!user) throw new NotFoundError('User not found');
if (!valid) throw new ValidationError('Invalid email format');
if (!authenticated) throw new AuthenticationError();
if (!authorized) throw new AuthorizationError('Admin access required');
if (exists) throw new ConflictError('Email already registered');
```

## Best Practices

### DO
- ✅ Clean database between tests (automatic with setup.js)
- ✅ Use factories for consistent test data
- ✅ Test both success and error cases
- ✅ Use descriptive test names
- ✅ Keep tests isolated and independent
- ✅ Mock external services (email, etc.)

### DON'T
- ❌ Share state between tests
- ❌ Make real HTTP/email calls
- ❌ Use hardcoded ObjectIds
- ❌ Skip error case testing
- ❌ Write tests that depend on order

## Troubleshooting

### Common Issues

**Tests timing out**
- Increase timeout in jest.config.js
- Check for unresolved promises
- Ensure database operations complete

**ES Module errors**
- Verify babel.config.json is correct
- Check imports use .js extension
- Ensure package.json has "type": "module"

**MongoDB connection issues**
- MongoDB Memory Server starts automatically
- Check for port conflicts
- Verify Node.js version compatibility

## Future Improvements

- [ ] Integration tests with supertest
- [ ] Controller layer tests
- [ ] E2E test suite
- [ ] Visual coverage reports in CI
- [ ] Performance benchmarks
