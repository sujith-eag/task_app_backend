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
    role: { 
      type: String, 
      enum: ['user', 'admin'], 
      default: 'user',
    },
    avatar: { type: String },
    bio: { type: String },
    isActive: { type: Boolean, default: true },
    preferences: {
        theme: { type: String, default: 'light' },
        isDiscoverable: { type: Boolean, default: true },
        canRecieveMessages: { type: Boolean, default: true },
        canRecieveFiles: { type: Boolean, default: true },
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
  }, 
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;