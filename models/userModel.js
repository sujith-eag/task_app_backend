import mongoose from "mongoose";

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
    },
    password: { 
      type: String,
      required: [true, 'Password is required'], 
      minlength: 8,
    },
    avatar: { type: String },
    bio: { type: String },
    preferences: {
      theme: { type: String, default: 'light' },
      isDiscoverable: { type: Boolean, default: true },
      canRecieveMessages: { type: Boolean, default: true },
      canRecieveFiles: { type: Boolean, default: true },
    },

    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false }, // for Mmail Verification
    emailVerificationToken: String,
    emailVerificationExpires: Date,

    passwordResetToken: String,
    passwordResetExpires: Date,
    passwordResetOn: Date,

    lastLoginAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockoutExpires: { type: Date },

    googleId: { 
      type: String, 
      unique: true, 
      sparse: true 
    },
    aiGenerations: {
      count: { type: Number, default: 0 },
      lastReset: { type: Date, default: () => new Date() },
    },
    role: {
      type: String,
      enum: [ 'user' ,'student', 'teacher', 'admin', 'hod'],
      default: 'user',
      required: true,
    },

    // --- Role-Specific Details ---
    studentDetails: {
      usn: { type: String, unique: true, sparse: true }, // University Seat Number
      isStudentVerified: { type: Boolean, default: false },
      section: { type: String, enum: ['A', 'B', 'C'] },
      batch: { type: Number },
      applicationStatus: {
        type: String,
        enum: ['not_applied', 'pending', 'approved', 'rejected'],
        default: 'not_applied'
      },
      enrolledSubjects: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Subject' }],
    },
    
    teacherDetails: {
      staffId: { type: String, unique: true, sparse: true },
      department: { type: String },
      subjectsTaught: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Subject' 
		  }],
    },
  }, 
  { timestamps: true }
);

// Indexing for faster queries
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ 'studentDetails.usn': 1 });
userSchema.index({ 'teacherDetails.staffId': 1 });

const User = mongoose.model("User", userSchema);
export default User;