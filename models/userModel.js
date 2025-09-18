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
    googleId: { 
      type: String, 
      unique: true, 
      sparse: true 
    },
    role: { 
      type: String, 
      enum: ['user', 'admin'], 
      default: 'user',
    },
    group: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Group' 
    },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false }, // for Mmail Verification
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    avatar: { type: String },
    bio: { type: String },
    preferences: {
        theme: { type: String, default: 'light' },
        isDiscoverable: { type: Boolean, default: true },
        canRecieveMessages: { type: Boolean, default: true },
        canRecieveFiles: { type: Boolean, default: true },
    },
    lastLoginAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockoutExpires: { type: Date },
  }, 
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;