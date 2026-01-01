# OAuth 2.1 / OIDC Identity Provider Module

**Module**: `/api/oauth`  
**Created**: January 1, 2026  
**Status**: Phase 2 Complete - Integration Tests

---

## Overview

This module transforms Eagle Campus into an OpenID Connect (OIDC) Identity Provider, enabling student projects to integrate with Eagle Campus authentication and access user profile data.

## Architecture

```
oauth/
├── README.md                    # This file
├── controllers/
│   ├── authorize.controller.js  # Authorization endpoint
│   ├── token.controller.js      # Token endpoint  
│   ├── userinfo.controller.js   # UserInfo endpoint
│   ├── discovery.controller.js  # Discovery & JWKS endpoints
│   ├── client.controller.js     # Client management (admin)
│   └── consent.controller.js    # User consent management
├── services/
│   ├── token.service.js         # JWT generation & validation
│   ├── refreshToken.service.js  # Refresh token rotation
│   ├── pkce.service.js          # PKCE verification
│   ├── client.service.js        # Client CRUD operations
│   └── consent.service.js       # Consent management
├── routes/
│   ├── oauth.routes.js          # OAuth endpoints (/api/oauth/*)
│   ├── discovery.routes.js      # Discovery (/api/.well-known/*)
│   └── client.routes.js         # Client admin routes
├── validators/
│   ├── authorize.validator.js   # Authorization request validation
│   ├── token.validator.js       # Token request validation
│   └── client.validator.js      # Client registration validation
└── middleware/
    ├── oauth.middleware.js      # OAuth-specific middleware
    └── rateLimit.middleware.js  # Per-client rate limiting
```

## Database Models

Located in `/backend/src/models/`:

- `oauthClientModel.js` - OAuth client registration
- `refreshTokenModel.js` - Refresh token storage with rotation
- `authorizationCodeModel.js` - Temporary auth codes
- `userConsentModel.js` - User consent records

## API Endpoints

### OAuth Endpoints (`/api/oauth/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/authorize` | Authorization endpoint |
| POST | `/token` | Token endpoint |
| GET | `/userinfo` | User claims endpoint |
| POST | `/introspect` | Token introspection |
| POST | `/revoke` | Token revocation |

### Discovery Endpoints (`/api/.well-known/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/openid-configuration` | OIDC discovery document |
| GET | `/jwks.json` | JSON Web Key Set |

### Client Management (`/api/oauth/clients/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Register new client |
| GET | `/` | List clients (admin) |
| GET | `/:id` | Get client details |
| PATCH | `/:id` | Update client |
| DELETE | `/:id` | Delete client |
| POST | `/:id/approve` | Approve client |
| POST | `/:id/reject` | Reject client |

### Consent Management (`/api/oauth/consent/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List user's authorized apps |
| DELETE | `/:clientId` | Revoke app access |

## Security

- **PKCE**: Mandatory for all clients
- **Token Signing**: RS256 (asymmetric)
- **Access Token Lifetime**: 15 minutes
- **Refresh Token Lifetime**: 30 days with rotation
- **Redirect URI Validation**: Exact match, no wildcards

## Configuration

Environment variables (add to `.env`):

```env
# OAuth/OIDC Configuration
OAUTH_ISSUER_URL=https://yourdomain.com
OAUTH_ACCESS_TOKEN_LIFETIME=900
OAUTH_REFRESH_TOKEN_LIFETIME=2592000
OAUTH_AUTHORIZATION_CODE_LIFETIME=600

# RSA Keys (for RS256 signing)
# Option 1: File paths
OAUTH_PRIVATE_KEY_PATH=./keys/private_key.pem
OAUTH_PUBLIC_KEY_PATH=./keys/public_key.pem

# Option 2: Base64 encoded keys (for cloud deployment)
# OAUTH_PRIVATE_KEY_BASE64=...
# OAUTH_PUBLIC_KEY_BASE64=...
```

## Usage

See `/docs/oidc-idp-transformation/09-DEVELOPER-STUDY-GUIDE.md` for detailed OAuth/OIDC concepts.

See `/docs/oidc-idp-transformation/QUICK-START-GUIDE.md` for integration guide.

## Testing

### Test Suite Location

All OAuth tests are located in `/backend/src/test/oauth/`:

| File | Description |
|------|-------------|
| `setup.js` | Test utilities, factories, and helpers |
| `oauthCrypto.test.js` | Crypto utilities (RSA, JWT, PKCE) |
| `discovery.test.js` | Discovery endpoints |
| `authorization.test.js` | Authorization endpoint |
| `token.test.js` | Token endpoint with PKCE |
| `refresh.test.js` | Refresh token rotation |
| `userinfo.test.js` | UserInfo endpoint |
| `introspect-revoke.test.js` | Introspection & revocation |
| `client-management.test.js` | Client registration & admin |
| `e2e-flow.test.js` | Complete OAuth flow tests |

### Running Tests

```bash
# Run all OAuth tests
npm test -- --testPathPattern=oauth

# Run specific test file
npm test -- src/test/oauth/token.test.js

# Run with coverage
npm test -- --coverage --testPathPattern=oauth

# Run in watch mode
npm test -- --watch --testPathPattern=oauth
```

### Test Coverage

- ✅ Parameter validation
- ✅ PKCE enforcement (S256 only)
- ✅ Client authentication
- ✅ Authorization code exchange
- ✅ Refresh token rotation
- ✅ Token reuse detection
- ✅ Scope-based claims
- ✅ Token introspection
- ✅ Token revocation
- ✅ Client management workflow
- ✅ Security attack prevention

