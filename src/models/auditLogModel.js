import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },

  actor: {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    roles: [{ type: String }]
  },
  action: { type: String, required: true, index: true },
  entityType: { type: String, required: true },
  entityId: { type: String, required: true },
  // context categorizes the action; keep enum strict and allow missing (undefined) as default
  context: { type: String, enum: ['personal', 'academic_material', 'assignment'], default: undefined },

  ipAddress: { type: String, default: null },
  userAgent: { type: String, default: null },

  data: {
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    diff: { type: mongoose.Schema.Types.Mixed }
  }
}, { timestamps: false });

// TTL Index: ~200 days
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 200 * 24 * 60 * 60 });

// Compound index for finding all history for a specific document
// Compound index for common queries over action + target entity
AuditLogSchema.index({ entityType: 1, entityId: 1 });
AuditLogSchema.index({ action: 1, entityType: 1, entityId: 1 });

export default mongoose.model('AuditLog', AuditLogSchema);
