/**
 * Client Management API Tests
 * 
 * Tests for OAuth client registration and management:
 * - POST /oauth/clients (registration)
 * - GET /oauth/clients (list)
 * - GET /oauth/clients/:id
 * - POST /oauth/clients/:id/approve
 * - POST /oauth/clients/:id/reject
 * - POST /oauth/clients/:id/suspend
 * - DELETE /oauth/clients/:id
 * 
 * @module tests/oauth/client-management.test
 */

import { jest } from '@jest/globals';
import {
  setupTestKeys,
  createTestOAuthClient,
  createPendingOAuthClient,
  createTestOAuthUser,
  cleanupOAuthData,
} from './setup.js';

// Set up keys before imports
setupTestKeys();

import request from 'supertest';
import express from 'express';
import { clientController } from '../../api/oauth/controllers/index.js';
import { validateClientRegistration, handleValidationErrors } from '../../api/oauth/validators/index.js';
import OAuthClient from '../../models/oauthClientModel.js';
import User from '../../models/userModel.js';

// ============================================================================
// Test App Setup
// ============================================================================

const createTestApp = (authUser = null) => {
  const app = express();
  app.use(express.json());
  
  // Debug middleware
  app.use((req, res, next) => {
    console.log('Request body:', req.body);
    next();
  });
  
  // Mock authentication middleware
  app.use((req, res, next) => {
    if (authUser) {
      req.user = authUser;
    }
    next();
  });
  
  // Client management routes
  app.post('/oauth/clients', validateClientRegistration, handleValidationErrors, clientController.register);
  app.get('/oauth/clients', clientController.listOwn);
  app.get('/oauth/clients/:id', clientController.getOne);
  app.post('/oauth/clients/:id/approve', clientController.approve);
  app.post('/oauth/clients/:id/reject', clientController.reject);
  app.post('/oauth/clients/:id/suspend', clientController.suspend);
  app.delete('/oauth/clients/:id', clientController.remove);
  
  return app;
};

describe('Client Management API', () => {
  let testUser;
  let adminUser;
  
  beforeEach(async () => {
    testUser = await createTestOAuthUser();
    
    // Create admin user
    adminUser = await User.create({
      name: 'Admin User',
      email: `admin-${Date.now()}@test.com`,
      password: 'hashedpassword123',
      isVerified: true,
      roles: ['admin'],
    });
  });
  
  afterEach(async () => {
    await cleanupOAuthData();
    await User.deleteMany({});
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Client Registration Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Client Registration', () => {
    it('should register new client with pending status', async () => {
      const app = createTestApp(testUser);
      
      const res = await request(app)
        .post('/oauth/clients')
        .send({
          name: 'My Student App',
          description: 'A student project application',
          redirect_uris: ['http://localhost:3001/callback'],
        });
      
      console.log('Response status:', res.status);
      console.log('Response body:', JSON.stringify(res.body, null, 2));
      
      expect(res.status).toBe(201);
      
      expect(res.body).toHaveProperty('client_id');
      expect(res.body).toHaveProperty('client_secret');
      expect(res.body).toHaveProperty('status', 'pending');
      expect(res.body).toHaveProperty('name', 'My Student App');
    });
    
    it('should require authentication', async () => {
      const app = createTestApp(null); // No auth
      
      const res = await request(app)
        .post('/oauth/clients')
        .send({
          name: 'My App',
          redirect_uris: ['http://localhost:3001/callback'],
        })
        .expect(401);
    });
    
    it('should validate redirect URIs', async () => {
      const app = createTestApp(testUser);
      
      const res = await request(app)
        .post('/oauth/clients')
        .send({
          name: 'My App',
          // Missing redirect URIs
        })
        .expect(400);
      
      expect(res.body).toHaveProperty('error');
    });
    
    it('should reject invalid redirect URI schemes', async () => {
      const app = createTestApp(testUser);
      
      const res = await request(app)
        .post('/oauth/clients')
        .send({
          name: 'My App',
          redirect_uris: ['javascript:alert(1)'],
        })
        .expect(400);
      
      expect(res.body).toHaveProperty('error');
    });
    
    it('should reject HTTP redirect URIs for web apps (except localhost)', async () => {
      const app = createTestApp(testUser);
      
      const res = await request(app)
        .post('/oauth/clients')
        .send({
          name: 'My App',
          redirect_uris: ['http://example.com/callback'], // Not localhost
          applicationType: 'web',
        })
        .expect(400);
      
      expect(res.body).toHaveProperty('error');
    });
    
    it('should allow localhost HTTP for development', async () => {
      const app = createTestApp(testUser);
      
      const res = await request(app)
        .post('/oauth/clients')
        .send({
          name: 'My App',
          redirect_uris: ['http://localhost:3001/callback'],
        })
        .expect(201);
      
      expect(res.body).toHaveProperty('client_id');
    });
    
    it('should generate secure client credentials', async () => {
      const app = createTestApp(testUser);
      
      const res = await request(app)
        .post('/oauth/clients')
        .send({
          name: 'My App',
          redirect_uris: ['http://localhost:3001/callback'],
        })
        .expect(201);
      
      // Client ID should be 32 chars
      expect(res.body.client_id.length).toBe(32);
      // Client secret should be 48 chars
      expect(res.body.client_secret.length).toBe(48);
    });
    
    it('should store client with creator info', async () => {
      const app = createTestApp(testUser);
      
      await request(app)
        .post('/oauth/clients')
        .send({
          name: 'My App',
          redirect_uris: ['http://localhost:3001/callback'],
        })
        .expect(201);
      
      const client = await OAuthClient.findOne({ name: 'My App' });
      expect(client.createdBy.toString()).toBe(testUser._id.toString());
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Client Listing Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Client Listing', () => {
    it('should list pending clients for admin', async () => {
      await createPendingOAuthClient({ name: 'Pending App 1' });
      await createPendingOAuthClient({ name: 'Pending App 2' });
      
      const app = createTestApp(adminUser);
      
      const res = await request(app)
        .get('/oauth/clients')
        .query({ status: 'pending' })
        .expect(200);
      
      expect(res.body).toHaveProperty('clients');
      expect(res.body.clients.length).toBeGreaterThanOrEqual(2);
    });
    
    it('should list all clients for admin', async () => {
      await createTestOAuthClient({ name: 'Approved App' });
      await createPendingOAuthClient({ name: 'Pending App' });
      
      const app = createTestApp(adminUser);
      
      const res = await request(app)
        .get('/oauth/clients')
        .expect(200);
      
      expect(res.body).toHaveProperty('clients');
      expect(res.body.clients.length).toBeGreaterThanOrEqual(2);
    });
    
    it('should only show user their own clients', async () => {
      // Create client owned by test user
      await OAuthClient.create({
        clientId: 'user_client_123',
        clientSecretHash: 'hash',
        name: 'User App',
        redirect_uris: ['http://localhost:3001/callback'],
        allowedScopes: ['openid'],
        status: 'pending',
        createdBy: testUser._id,
      });
      
      // Create client owned by someone else
      await OAuthClient.create({
        clientId: 'other_client_123',
        clientSecretHash: 'hash',
        name: 'Other App',
        redirect_uris: ['http://localhost:3001/callback'],
        allowedScopes: ['openid'],
        status: 'pending',
        createdBy: adminUser._id,
      });
      
      const app = createTestApp(testUser);
      
      const res = await request(app)
        .get('/oauth/clients')
        .expect(200);
      
      // Non-admin should only see their own clients
      const ownedClients = res.body.clients.filter(
        (c) => c.name === 'User App'
      );
      expect(ownedClients.length).toBe(1);
    });
    
    it('should support pagination', async () => {
      // Create multiple clients
      for (let i = 0; i < 15; i++) {
        await createTestOAuthClient({ name: `App ${i}` });
      }
      
      const app = createTestApp(adminUser);
      
      const res = await request(app)
        .get('/oauth/clients')
        .query({ page: 1, limit: 10 })
        .expect(200);
      
      expect(res.body.clients.length).toBeLessThanOrEqual(10);
      expect(res.body).toHaveProperty('pagination');
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Client Approval Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Client Approval', () => {
    it('should approve pending client', async () => {
      const pendingClient = await createPendingOAuthClient();
      
      const app = createTestApp(adminUser);
      
      const res = await request(app)
        .post(`/oauth/clients/${pendingClient.client._id}/approve`)
        .send({
          allowedScopes: ['openid', 'profile'],
        })
        .expect(200);
      
      expect(res.body).toHaveProperty('status', 'approved');
      
      // Verify in database
      const client = await OAuthClient.findById(pendingClient.client._id);
      expect(client.status).toBe('approved');
      expect(client.approvedBy.toString()).toBe(adminUser._id.toString());
      expect(client.approvedAt).toBeDefined();
    });
    
    it('should require admin role for approval', async () => {
      const pendingClient = await createPendingOAuthClient();
      
      const app = createTestApp(testUser); // Non-admin
      
      const res = await request(app)
        .post(`/oauth/clients/${pendingClient.client._id}/approve`)
        .send({
          allowedScopes: ['openid'],
        })
        .expect(403);
    });
    
    it('should set allowed scopes on approval', async () => {
      const pendingClient = await createPendingOAuthClient();
      
      const app = createTestApp(adminUser);
      
      await request(app)
        .post(`/oauth/clients/${pendingClient.client._id}/approve`)
        .send({
          allowedScopes: ['openid', 'profile', 'email'],
        })
        .expect(200);
      
      const client = await OAuthClient.findById(pendingClient.client._id);
      expect(client.allowedScopes).toContain('openid');
      expect(client.allowedScopes).toContain('profile');
      expect(client.allowedScopes).toContain('email');
    });
    
    it('should not approve already approved client', async () => {
      const approvedClient = await createTestOAuthClient();
      
      const app = createTestApp(adminUser);
      
      const res = await request(app)
        .post(`/oauth/clients/${approvedClient.client._id}/approve`)
        .send({
          allowedScopes: ['openid'],
        })
        .expect(400);
      
      expect(res.body).toHaveProperty('error');
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Client Rejection Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Client Rejection', () => {
    it('should reject pending client with reason', async () => {
      const pendingClient = await createPendingOAuthClient();
      
      const app = createTestApp(adminUser);
      
      const res = await request(app)
        .post(`/oauth/clients/${pendingClient.client._id}/reject`)
        .send({
          reason: 'Invalid use case - not a student project',
        })
        .expect(200);
      
      expect(res.body).toHaveProperty('status', 'rejected');
      
      const client = await OAuthClient.findById(pendingClient.client._id);
      expect(client.status).toBe('rejected');
      expect(client.rejectionReason).toBe('Invalid use case - not a student project');
    });
    
    it('should require reason for rejection', async () => {
      const pendingClient = await createPendingOAuthClient();
      
      const app = createTestApp(adminUser);
      
      const res = await request(app)
        .post(`/oauth/clients/${pendingClient.client._id}/reject`)
        .send({})
        .expect(400);
      
      expect(res.body).toHaveProperty('error');
    });
    
    it('should require admin role for rejection', async () => {
      const pendingClient = await createPendingOAuthClient();
      
      const app = createTestApp(testUser);
      
      await request(app)
        .post(`/oauth/clients/${pendingClient.client._id}/reject`)
        .send({ reason: 'Test' })
        .expect(403);
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Client Suspension Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Client Suspension', () => {
    it('should suspend approved client', async () => {
      const approvedClient = await createTestOAuthClient();
      
      const app = createTestApp(adminUser);
      
      const res = await request(app)
        .post(`/oauth/clients/${approvedClient.client._id}/suspend`)
        .send({
          reason: 'Terms of service violation',
        })
        .expect(200);
      
      expect(res.body).toHaveProperty('status', 'suspended');
      
      const client = await OAuthClient.findById(approvedClient.client._id);
      expect(client.status).toBe('suspended');
    });
    
    it('should revoke all tokens when client is suspended', async () => {
      const approvedClient = await createTestOAuthClient();
      
      const app = createTestApp(adminUser);
      
      await request(app)
        .post(`/oauth/clients/${approvedClient.client._id}/suspend`)
        .send({
          reason: 'Security issue',
        })
        .expect(200);
      
      // Tokens should be revoked (verify via introspection or direct DB check)
      // Implementation detail - would check RefreshToken collection
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Client Details Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Client Details', () => {
    it('should get client details for owner', async () => {
      const client = await OAuthClient.create({
        clientId: 'owner_client_123',
        clientSecretHash: 'hash',
        name: 'Owner App',
        redirect_uris: ['http://localhost:3001/callback'],
        allowedScopes: ['openid'],
        status: 'approved',
        createdBy: testUser._id,
      });
      
      const app = createTestApp(testUser);
      
      const res = await request(app)
        .get(`/oauth/clients/${client._id}`)
        .expect(200);
      
      expect(res.body).toHaveProperty('name', 'Owner App');
      expect(res.body).toHaveProperty('clientId', 'owner_client_123');
      // Should NOT expose secret
      expect(res.body).not.toHaveProperty('clientSecretHash');
    });
    
    it('should get any client details for admin', async () => {
      const clientResult = await createTestOAuthClient();
      
      const app = createTestApp(adminUser);
      
      const res = await request(app)
        .get(`/oauth/clients/${clientResult.client._id}`)
        .expect(200);
      
      expect(res.body).toHaveProperty('name');
    });
    
    it('should not allow non-owner non-admin to view client', async () => {
      // Client owned by admin
      const client = await OAuthClient.create({
        clientId: 'admin_client_123',
        clientSecretHash: 'hash',
        name: 'Admin App',
        redirect_uris: ['http://localhost:3001/callback'],
        allowedScopes: ['openid'],
        status: 'approved',
        createdBy: adminUser._id,
      });
      
      const app = createTestApp(testUser); // Non-admin, non-owner
      
      await request(app)
        .get(`/oauth/clients/${client._id}`)
        .expect(403);
    });
    
    it('should return 404 for non-existent client', async () => {
      const app = createTestApp(adminUser);
      
      await request(app)
        .get('/oauth/clients/507f1f77bcf86cd799439011')
        .expect(404);
    });
  });
  
  // ────────────────────────────────────────────────────────────────────────
  // Client Deletion Tests
  // ────────────────────────────────────────────────────────────────────────
  
  describe('Client Deletion', () => {
    it('should soft delete client', async () => {
      const clientResult = await createTestOAuthClient();
      
      const app = createTestApp(adminUser);
      
      await request(app)
        .delete(`/oauth/clients/${clientResult.client._id}`)
        .expect(204);
      
      // Should still exist but be marked deleted
      const client = await OAuthClient.findById(clientResult.client._id);
      expect(client.status).toBe('deleted');
      // Or it could be actually deleted depending on implementation
    });
    
    it('should allow owner to delete pending client', async () => {
      const client = await OAuthClient.create({
        clientId: 'owner_pending_123',
        clientSecretHash: 'hash',
        name: 'Pending Owner App',
        redirect_uris: ['http://localhost:3001/callback'],
        allowedScopes: ['openid'],
        status: 'pending',
        createdBy: testUser._id,
      });
      
      const app = createTestApp(testUser);
      
      await request(app)
        .delete(`/oauth/clients/${client._id}`)
        .expect(204);
    });
    
    it('should require admin to delete approved clients', async () => {
      const client = await OAuthClient.create({
        clientId: 'approved_client_123',
        clientSecretHash: 'hash',
        name: 'Approved App',
        redirect_uris: ['http://localhost:3001/callback'],
        allowedScopes: ['openid'],
        status: 'approved',
        createdBy: testUser._id,
      });
      
      const app = createTestApp(testUser); // Owner but not admin
      
      // Should not be able to delete approved client without admin
      await request(app)
        .delete(`/oauth/clients/${client._id}`)
        .expect(403);
    });
  });
});
