import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { insertStaff } from '../database/controller/Staff/insertStaff.mjs';
import { insertTaskRules } from '../database/controller/Task/insertTaskRules.mjs';
import { insertTasks } from '../database/controller/Task/insertTasks.mjs';
import { insertProperties } from '../database/controller/Properties/insertProperties.mjs';
import { generateAndSaveSchedule } from '../database/controller/Schedule/insertSchedules.mjs';

import Staff from '../database/models/staff.mjs';
import TaskRules from '../database/models/task-rules.mjs';
import Tasks from '../database/models/tasks.mjs';
import Properties from '../database/models/properties.mjs';
import Schedules from '../database/models/schedules.mjs';

import { backupCollection } from '../database/utils/backup.mjs';
import { relinkAssignedStaff } from '../database/utils/relinkedAssignedStaff.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });


const uri = process.env.MONGO_URI;

async function main() {
  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');

    // Backups
    await backupCollection(Staff, 'staff');
    await backupCollection(TaskRules, 'task-rules');
    await backupCollection(Properties, 'properties');
    await backupCollection(Tasks, 'tasks');
    await backupCollection(Schedules, 'schedules');

    // // Insert fresh data
    await insertStaff();
    try {
      await insertTaskRules();
      console.log('✅ Tasks inserted successfully.');
    } catch (err) {
      console.error('❌ insertTasks failed:', err);
    }

    await insertProperties();
    try {
      await insertTasks();
      console.log('Tasks inserted successfully.');
    } catch (err) {
      console.error('insertTasks failed:', err);
    }


    await relinkAssignedStaff(); // Ensure assignedStaff is always up-to-date


    const { count } = await generateAndSaveSchedule();


    console.log(`Saved ${count} weekly schedule(s).`);
    console.log('CWD:', process.cwd());

  } catch (err) {
    console.error('Error during sync:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB connection closed.');
  }
}

main();
