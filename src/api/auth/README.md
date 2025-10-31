# Auth Module

## Overview

The Auth module handles user authentication, registration, email verification, and password reset functionality for the Eagle Campus application.

## Directory Structure

```
auth/
├── routes/
│   └── auth.routes.js        # Route definitions
├── controllers/
│   └── auth.controller.js    # Request/response handlers
├── services/
│   └── auth.service.js       # Business logic
├── validators/
│   └── auth.validators.js    # Joi validation schemas
└── policies/
    └── auth.policies.js      # Authorization policies (placeholder)
```

## Features

### 1. User Registration
- **Endpoint**: `POST /api/auth/register`
- **Access**: Public
- **Rate Limited**: Yes (5 requests per 15 minutes per IP)
- **Validation**: Name (2-50 chars), valid email, strong password
- **Process**:
  - Check if email exists
  - If user exists and verified: reject registration
  - If user exists and unverified: update details and resend verification
  - If new user: create account with hashed password
  - Generate email verification token (24-hour expiry)
  - Send verification email with link
  - Atomic operation: rollback on email failure for new users

### 2. User Login
- **Endpoint**: `POST /api/auth/login`
- **Access**: Public
- **Rate Limited**: Yes (5 requests per 15 minutes per IP)
- **Security Features**:
  - Failed login attempt tracking
  - Account lockout after 5 failed attempts (10-minute duration)
  - Requires email verification
  - Returns JWT token (3-day expiry)
- **Response**: User profile + JWT token

### 3. Email Verification
- **Endpoint**: `GET /api/auth/verifyemail/:token`
- **Access**: Public
- **Process**:
  - Hash token and find matching user
  - Check token expiry (24 hours)
  - Mark user as verified
  - Clear verification token

### 4. Forgot Password
- **Endpoint**: `POST /api/auth/forgotpassword`
- **Access**: Public
- **Rate Limited**: Yes (5 requests per 15 minutes per IP)
- **Security**:
  - Requires verified account
  - Prevents duplicate requests (check existing valid token)
  - Generic response to prevent email enumeration
  - Token expires in 10 minutes
- **Process**:
  - Generate password reset token
  - Hash and store token
  - Send reset email with link

### 5. Reset Password
- **Endpoint**: `PUT /api/auth/resetpassword/:resettoken`
- **Access**: Public
- **Validation**: Strong password + confirmation match
- **Process**:
  - Verify token validity and expiry
  - Hash new password
  - Clear reset token
  - Save updated password

## Security Features

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character (@$!%*?&)

### Token Management
- **Email Verification**: SHA256 hashed, 24-hour expiry
- **Password Reset**: SHA256 hashed, 10-minute expiry
- **JWT Authentication**: 3-day expiry

### Rate Limiting
- All auth endpoints limited to 5 requests per 15 minutes per IP
- Prevents brute force attacks
- Uses `authLimiter` middleware

### Account Security
- Password hashing with bcrypt (10 salt rounds)
- Failed login tracking (max 5 attempts)
- Temporary account lockout (10 minutes)
- Email verification required before login

## Data Flow

### Registration Flow
```
Client Request
  → Rate Limiter
  → Validator (registerSchema)
  → Controller (registerUser)
  → Service (registerUserService)
    → Check existing user
    → Hash password
    → Generate verification token
    → Save user
    → Send verification email
  → Response (201 Created)
```

### Login Flow
```
Client Request
  → Rate Limiter
  → Validator (loginSchema)
  → Controller (loginUser)
  → Service (loginUserService)
    → Find user (with sensitive fields)
    → Check verification status
    → Check lockout status
    → Verify password
    → Update login tracking
    → Generate JWT
  → Response (200 OK with token)
```

### Password Reset Flow
```
Forgot Password Request
  → Rate Limiter
  → Validator (forgotPasswordSchema)
  → Controller (forgotPassword)
  → Service (forgotPasswordService)
    → Find user
    → Check existing token
    → Generate reset token
    → Send reset email
  → Response (200 OK - generic message)

Reset Password Request
  → Validator (resetPasswordSchema)
  → Controller (resetPassword)
  → Service (resetPasswordService)
    → Verify token and expiry
    → Hash new password
    → Clear token
    → Save password
  → Response (200 OK)
```

## Service Layer Methods

### `registerUserService(userData)`
- **Parameters**: `{ name, email, password }`
- **Returns**: `{ message: string }`
- **Throws**: Error on validation failure, email send failure, or verified user exists

### `loginUserService(credentials)`
- **Parameters**: `{ email, password }`
- **Returns**: User object with JWT token
- **Throws**: Error on invalid credentials, unverified account, or locked account

### `verifyEmailService(token)`
- **Parameters**: `token` (string from URL)
- **Returns**: `{ message: string }`
- **Throws**: Error on invalid or expired token

### `forgotPasswordService(email)`
- **Parameters**: `email` (string)
- **Returns**: `{ message: string }` (generic message)
- **Throws**: Error on duplicate request, unverified account, or email send failure

### `resetPasswordService(token, newPassword)`
- **Parameters**: `token` (string from URL), `newPassword` (string)
- **Returns**: `{ message: string }`
- **Throws**: Error on invalid/expired token

## Validation Schemas

### `registerSchema`
- `name`: string (2-50 chars, trimmed)
- `email`: valid email format
- `password`: strong password pattern

### `loginSchema`
- `email`: valid email format
- `password`: required string

### `forgotPasswordSchema`
- `email`: valid email format

### `resetPasswordSchema`
- `password`: strong password pattern
- `confirmPassword`: must match password

## Dependencies

### Internal
- `User` model (userModel.js)
- Email service (email.service.js)
- Email templates (utils/emailTemplate.js)
- asyncHandler (HTTP utility)
- Rate limiter middleware

### External
- `jsonwebtoken` - JWT generation
- `bcryptjs` - Password hashing
- `joi` - Request validation
- `crypto` - Token generation

## Constants

```javascript
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 10
EMAIL_VERIFICATION_EXPIRY_HOURS = 24
PASSWORD_RESET_EXPIRY_MINUTES = 10
JWT_EXPIRY = '3d'
```

## Error Handling

All controllers use `asyncHandler` wrapper for automatic error handling:
- Validation errors: 400 Bad Request
- Unauthorized errors: 403 Forbidden
- Authentication errors: 400 Bad Request (generic message)
- Server errors: 500 Internal Server Error

Service layer throws errors with appropriate messages and optional `statusCode` property.

## Email Templates

### Verification Email
- Template: `verificationEmail.html`
- Variables: `name`, `verificationUrl`
- Subject: "Verify Your Email Address for Eagle Campus"

### Password Reset Email
- Template: `passwordReset.html`
- Variables: `name`, `resetUrl`
- Subject: "Password Reset Request for Eagle Campus"

## Environment Variables

Required environment variables:
- `JWT_SECRET` - Secret for JWT signing
- `FRONTEND_URL` - Base URL for email links

## Testing Considerations

### Unit Tests
- Service layer methods (mocked User model, email service)
- Validator schemas
- Token generation and hashing utilities

### Integration Tests
- Full registration → verification → login flow
- Failed login attempts and lockout
- Password reset flow
- Rate limiting behavior

### Security Tests
- Token expiry validation
- Password strength enforcement
- Email enumeration prevention
- Brute force protection

## Future Enhancements

- [ ] OAuth integration (Google, GitHub)
- [ ] Two-factor authentication (2FA)
- [ ] Remember me functionality
- [ ] Session management
- [ ] Device tracking
- [ ] IP-based restrictions
- [ ] Suspicious activity detection
- [ ] Password history (prevent reuse)
- [ ] Account recovery options

## Migration Notes

### Breaking Changes from Previous Version
- Import paths updated to use `_common/` directory
- Validation now at route level (not in controller)
- Business logic extracted to service layer
- asyncHandler imported from common utilities

### Backward Compatibility
- API endpoints unchanged
- Request/response formats unchanged
- JWT token format unchanged
- Database schema unchanged

## Usage Examples

### Register a New User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

### Forgot Password
```bash
curl -X POST http://localhost:5000/api/auth/forgotpassword \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com"
  }'
```

### Reset Password
```bash
curl -X PUT http://localhost:5000/api/auth/resetpassword/TOKEN_HERE \
  -H "Content-Type: application/json" \
  -d '{
    "password": "NewSecurePass123!",
    "confirmPassword": "NewSecurePass123!"
  }'
```

## Related Modules

- **Users Module**: User profile management (requires authentication)
- **Admin Module**: User management and role assignment
- **Middleware**: Auth, RBAC, rate limiting

## Changelog

### Version 2.0.0 (Phase 0 Refactoring)
- ✅ Separated business logic into service layer
- ✅ Created Joi validation schemas
- ✅ Extracted validators to separate module
- ✅ Implemented consistent error handling
- ✅ Added comprehensive documentation
- ✅ Updated import paths to use `_common/`
- ✅ Improved code organization and maintainability
