import User from '../models/userModel.js';
import Migration from '../models/migrationModel.js';

/**
 * Migrates the 'role' field (string) to a 'roles' field (array).
 * This function is idempotent and records its application in the `migrations` collection.
 */
export async function migrateUserRoles() {
  const migrationName = 'migrate_user_role_to_roles_v1';
  // Check if already applied
  const existing = await Migration.findOne({ name: migrationName }).lean();
  if (existing) {
    console.log(`Migration '${migrationName}' already applied at ${existing.appliedAt}`);
    return;
  }

  console.log('🚀 Starting user role migration...');

  try {
    const result = await User.updateMany(
      {
        // Find all documents that still have the old 'role' field and it's a string
        role: { $exists: true, $type: 'string' }
      },
      [
        {
          // 1. Create the new 'roles' array from the old 'role' value
          $set: {
            roles: ['$role'] // '$role' references the value of the old field
          }
        },
        {
          // 2. Remove the old 'role' field
          $unset: 'role'
        }
      ]
    );

    console.log('✅ Role migration complete!');
    console.log(`   Documents matched: ${result.matchedCount}`);
    console.log(`   Documents modified: ${result.modifiedCount}`);

    // Record migration as applied
    await Migration.create({ name: migrationName, meta: { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount } });

    if (result.matchedCount === 0) {
      console.log('   (No documents needed to be migrated.)');
    }

  } catch (error) {
    console.error('❌ Error during role migration:', error);
    // Do not mark migration as applied on error
    throw error;
  }
}

export default migrateUserRoles;
