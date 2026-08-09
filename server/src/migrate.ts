/**
 * ONE-TIME MIGRATION SCRIPT
 * Migrates existing users & userData from server/db.json into MongoDB Atlas.
 *
 * Run ONCE from your local machine AFTER setting up MongoDB Atlas:
 *
 *   cd server
 *   MONGODB_URI="your_atlas_connection_string" npx ts-node src/migrate.ts
 *
 * Or on Windows PowerShell:
 *   $env:MONGODB_URI="your_atlas_connection_string"
 *   npx ts-node src/migrate.ts
 */

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';
if (!MONGODB_URI) {
  console.error('ERROR: Set MONGODB_URI environment variable before running this script.');
  process.exit(1);
}

const DB_PATH = path.join(__dirname, '..', 'db.json');

async function migrate() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.\n');

  if (!fs.existsSync(DB_PATH)) {
    console.log('No db.json found — nothing to migrate. Fresh install.');
    await mongoose.disconnect();
    return;
  }

  const raw     = fs.readFileSync(DB_PATH, 'utf-8');
  const db: any = JSON.parse(raw);
  const users    = db.users    || [];
  const userData = db.userData || [];

  console.log(`Found ${users.length} users and ${userData.length} userData records in db.json.\n`);

  // Import models AFTER mongoose.connect()
  const { UserModel, UserDataModel } = await import('./models');

  // Migrate users
  let usersInserted = 0, usersSkipped = 0;
  for (const user of users) {
    try {
      const existing = await UserModel.findOne({ userId: user.userId });
      if (existing) {
        console.log(`  [SKIP] User already in Atlas: ${user.email}`);
        usersSkipped++;
        continue;
      }
      const { _id, __v, ...clean } = user;
      await UserModel.create(clean);
      console.log(`  [OK]   Migrated user: ${user.email}`);
      usersInserted++;
    } catch (err: any) {
      console.error(`  [ERR]  Failed to migrate user ${user.email}:`, err.message);
    }
  }

  // Migrate userData
  let dataInserted = 0, dataSkipped = 0;
  for (const ud of userData) {
    try {
      const existing = await UserDataModel.findOne({ userId: ud.userId });
      if (existing) {
        console.log(`  [SKIP] UserData already in Atlas for userId: ${ud.userId}`);
        dataSkipped++;
        continue;
      }
      const { _id, __v, ...clean } = ud;
      await UserDataModel.create(clean);
      console.log(`  [OK]   Migrated userData for userId: ${ud.userId}`);
      dataInserted++;
    } catch (err: any) {
      console.error(`  [ERR]  Failed to migrate userData for ${ud.userId}:`, err.message);
    }
  }

  console.log('\n════════════════════════════════════');
  console.log('Migration Complete!');
  console.log(`  Users:    ${usersInserted} inserted, ${usersSkipped} skipped (already existed)`);
  console.log(`  UserData: ${dataInserted} inserted, ${dataSkipped} skipped (already existed)`);
  console.log('════════════════════════════════════\n');
  console.log('You can now deploy to Render. db.json is no longer needed.');

  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Fatal migration error:', err);
  mongoose.disconnect();
  process.exit(1);
});
