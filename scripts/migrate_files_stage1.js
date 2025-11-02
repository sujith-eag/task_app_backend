import mongoose from 'mongoose';
import File from '../src/models/fileModel.js';
import Migration from '../src/models/migrationModel.js';

// Minimal migration intended to be run programmatically after the server
// has established the mongoose connection. This file intentionally does
// not read environment variables or attempt to connect/disconnect.

async function migrate({ runOnceName = null } = {}) {
  console.log('Migration started: applying Stage-1 defaults via Mongoose model');

  const ops = [
    { filter: { context: { $exists: false } }, update: { $set: { context: 'personal' } } },
    { filter: { deletedAt: { $exists: false } }, update: { $set: { deletedAt: null } } },
    { filter: { $or: [ { path: { $exists: false } }, { path: null }, { path: '' } ] }, update: { $set: { path: ',' } } },
    { filter: { description: { $exists: false } }, update: { $set: { description: null } } },
    { filter: { sharedWithClass: { $exists: false } }, update: { $set: { sharedWithClass: null } } },
    // Remove legacy sharedWith field when present
    { filter: { sharedWith: { $exists: true } }, update: { $unset: { sharedWith: "" } } }
  ];

  let totalUpdated = 0;
  // Handle documents missing `isDeleted` carefully to avoid violating
  // the partial unique index on (parentId, fileName, isDeleted:false).
  // For each document with no isDeleted field, set it to `false` only if
  // no other document with same parentId+fileName already has isDeleted:false.
  // Otherwise mark this document as deleted (true) to avoid duplicate-key errors.
  const missingIsDeletedCursor = File.find({ isDeleted: { $exists: false } }).cursor();
  for await (const doc of missingIsDeletedCursor) {
    try {
      const existsNonDeleted = await File.exists({ parentId: doc.parentId ?? null, fileName: doc.fileName, isDeleted: false });
      if (existsNonDeleted) {
        const r = await File.updateOne({ _id: doc._id }, { $set: { isDeleted: true, deletedAt: new Date() } });
        const modified = r.modifiedCount ?? r.nModified ?? 0;
        totalUpdated += modified;
        console.log('set isDeleted=true for', String(doc._id), 'to avoid duplicate non-deleted sibling');
      } else {
        const r = await File.updateOne({ _id: doc._id }, { $set: { isDeleted: false } });
        const modified = r.modifiedCount ?? r.nModified ?? 0;
        totalUpdated += modified;
        console.log('set isDeleted=false for', String(doc._id));
      }
    } catch (err) {
      console.error('Failed to set isDeleted for', String(doc._id), err);
    }
  }
  for (const { filter, update } of ops) {
    try {
      const res = await File.updateMany(filter, update);
      const matched = res.matchedCount ?? res.n ?? 0;
      const modified = res.modifiedCount ?? res.nModified ?? 0;
      totalUpdated += modified;
      console.log('updateMany', JSON.stringify(filter), '->', JSON.stringify(update), ' matched=', matched, ' modified=', modified);
    } catch (err) {
      console.error('updateMany failed for filter', filter, err);
    }
  }

  // Ensure indexes
  try {
    await File.createIndexes();
    console.log('Indexes ensured.');
  } catch (err) {
    console.error('Error creating indexes:', err);
  }

  // Record migration run
  if (runOnceName) {
    try {
      await Migration.findOneAndUpdate(
        { name: runOnceName },
        { $set: { appliedAt: new Date(), meta: { migratedCount: totalUpdated } } },
        { upsert: true }
      );
      console.log(`Upserted migration record '${runOnceName}'. migratedCount=${totalUpdated}`);
    } catch (err) {
      console.error('Failed to upsert migration record:', err);
    }
  }

  console.log('Migration finished.');
}

export default migrate;
