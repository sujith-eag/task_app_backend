import mongoose from "mongoose";

// --- Constants ---
export const RolesEnum = [ 'user' ,'student', 'teacher', 'admin', 'hod'];

// --- Embedded Schemas ---
const teachingAssignmentSchema = new mongoose.Schema({
    subject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: true
    },
    batch: { type: Number },
    semester: { type: Number },
    sections: [{ type: String }], // e.g., ['A', 'B']
});

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [/.+\@.+\..+/, 'Please enter a valid email'],
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false, // Don't return password by default
    },
    avatar: { type: String },
    bio: { type: String },
    preferences: {
      theme: { type: String, default: 'light' },
      isDiscoverable: { type: Boolean, default: true },
      canRecieveMessages: { type: Boolean, default: true },
      canRecieveFiles: { type: Boolean, default: true },
    },

    // --- Core Status ---
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false }, // for Email Verification

    // --- Auth Tokens & Security ---
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },

    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    passwordResetOn: { type: Date, select: false }, // Use passwordChangedAt instead?

    // --- Role Management ---
    roles: {
      type: [String], // Array of strings
      enum: RolesEnum,
      default: ['user'],
      required: true,
    },

    // --- ZTA: Device/Session Trust ---
    sessions: [{
        deviceId: { type: String }, // A fingerprint or unique ID
        ipAddress: { type: String },
        userAgent: { type: String },
        // tokenId (jti) ties an issued JWT to this session record so the server can revoke tokens
        tokenId: { type: String },
        lastUsedAt: { type: Date, default: Date.now },
        createdAt: { type: Date, default: Date.now }
    }],
    
    // --- Auditing: Track auth state changes ---
    passwordChangedAt: { type: Date, select: false },
    roleChangedAt: { type: Date },
    lastIp: { type: String }, // Store the last known IP
    lastLoginAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockoutExpires: { type: Date },

    // --- Social Auth ---
    googleId: {
      type: String,
      unique: true,
      sparse: true
    },

    // --- App-Specific Logic ---
    aiGenerations: {
      count: { type: Number, default: 0 },
      lastReset: { type: Date, default: () => new Date() },
    },

    // --- Role-Specific Details ---
    studentDetails: {
      usn: { type: String, unique: true, sparse: true }, // University Seat Number
      applicationStatus: {
        type: String,
        enum: ['not_applied', 'pending', 'approved', 'rejected'],
        default: 'not_applied'
      },
      isStudentVerified: { type: Boolean, default: false },
      section: { type: String, enum: ['A', 'B', 'C'] },
      batch: { type: Number },
      semester: { type: Number },
      enrolledSubjects: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject' }],
    },
    
    teacherDetails: {
      staffId: { type: String, unique: true, sparse: true },
      department: { type: String },
      assignments: [teachingAssignmentSchema],
    },
  }, 
  { timestamps: true }
);

// --- Indexes ---
userSchema.index({ roles: 1 }); // Index the roles array


// --- Middleware ---
// Back-compat: if roles[] is empty, seed it from legacy role on save
userSchema.pre('save', function syncRolesFromRole(next) {
  // Check if 'role' field exists (from legacy) and roles is empty
  if (this.isNew && this.get('role') && (!this.roles || this.roles.length === 0)) {
    this.roles = [this.get('role')];
    this.set('role', undefined); // Unset the legacy field
  }
  
  // Track password changes
  if (this.isModified('password')) {
    this.passwordChangedAt = new Date();
  }
  
  // Track role changes
  if (this.isModified('roles')) {
    this.roleChangedAt = new Date();
  }
  
  next();
});

const User = mongoose.model("User", userSchema);
export default User;