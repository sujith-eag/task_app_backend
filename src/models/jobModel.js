import mongoose from 'mongoose';

const { Schema } = mongoose;

const jobSchema = new Schema(
  {
    type: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    folderId: { type: Schema.Types.ObjectId, ref: 'File', required: false },
    status: { type: String, enum: ['queued', 'processing', 'done', 'failed'], default: 'queued' },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

const Job = mongoose.model('Job', jobSchema);

export default Job;
