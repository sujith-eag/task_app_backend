import mongoose from 'mongoose';

export const AuthEventTypes = [
    'LOGIN_SUCCESS',
    'LOGIN_FAILURE',
    'LOGOUT',
    'PASSWORD_RESET_REQUEST',
    'PASSWORD_RESET_SUCCESS',
    'PASSWORD_CHANGE',
    'EMAIL_VERIFY_REQUEST',
    'EMAIL_VERIFIED',
    'SESSION_CREATED',
    'SESSION_DESTROYED',
    'ROLE_CHANGED',
    'ACCOUNT_LOCKED',
    'ACCOUNT_UNLOCKED',
    'MFA_CHALLENGE',
    'MFA_SUCCESS',
    'MFA_FAILURE',
    'MFA_ENFORCED',
    'MFA_DISABLED'
];

const authEventSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
        required: false
    },
    actor: { type: String, required: true, index: true },
    eventType: {
        type: String,
        enum: AuthEventTypes,
        required: true
    },
    ipAddress: { type: String },
    userAgent: { type: String },
    deviceId: { type: String, index: true },
    origin: {
      type: String,
      enum: ['web', 'mobile', 'api', 'system'],
      default: 'web'
    },
    severity: {
        type: String,
        enum: ['info', 'warning', 'critical'],
        required: true
    },
    context: {
        type: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: { createdAt: 'timestamp', updatedAt: false }
});

// TTL Index: Auto-delete logs older than 90 days
authEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

const AuthEvent = mongoose.model('AuthEvent', authEventSchema);
export default AuthEvent;
