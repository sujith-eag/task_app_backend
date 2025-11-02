import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    user: { // The user to notify
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true, 
        index: true 
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String }, // This can now be auto-generated from the entity
	// e.g., /academics/assignments/123abc
    isRead: { type: Boolean, default: false },
    type: {
        type: String,
        enum: ['new_material', 'new_assignment', 'assignment_rejected', 'deadline_approaching', 'general']
    },

    // --- NEW: Entity fields for grouping, batching, and linking ---
    entity: {
        model: { type: String, enum: ['Assignment', 'File', 'User'] },
        id: { type: mongoose.Schema.Types.ObjectId }
    },
    
    // --- NEW: Field for batching ---
    // Can be used by "robust fix" to aggregate actions
    actionCount: { 
        type: Number,
        default: 1
    },
    
    // Auto-delete notifications after 30 days to keep the collection clean
    expiresAt: { 
        type: Date, 
        default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 
        index: true 
    }
}, { timestamps: true });

// This TTL (Time-To-Live) index automatically deletes documents
// when their 'expiresAt' time is reached.
notificationSchema.index({ "expiresAt": 1 }, { expireAfterSeconds: 0 });

// --- NEW: Index to find unread notifications for a user ---
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;