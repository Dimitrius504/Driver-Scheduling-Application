import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import TaskRules from '../../models/task-rules.mjs';
import Tasks from '../../models/tasks.mjs';

export async function insertTaskRules() {
  const rawData = JSON.parse(fs.readFileSync(path.resolve('../temp/processedTaskRules.json'), 'utf-8'));

  console.log(`Importing ${rawData.length} task rules...`);

  await TaskRules.deleteMany({});
  console.log('Existing Task Rules wiped.');

  const rulesToInsert = rawData.map(rule => ({
    taskRuleId: rule.taskRuleId,
    name: rule.name,
    abbreviation: rule.abbreviation,
    active: rule.active ?? true,
    department: rule.department || 'Unknown',
    taskType: rule.taskType || 'Other',
    minTime: rule.minTime || 0,
    maxTime: rule.maxTime || 0,
    recurring: rule.recurring ?? false,
    packLinen: rule.packLinen ?? false,
    retrieveLinen: rule.retrieveLinen ?? false,
    internalNotes: rule.internalNotes || '',
    createdAt: rule.createdAt ? new Date(rule.createdAt) : new Date(),
    category: rule.category || 'Uncategorized'
  }));

  const result = await TaskRules.insertMany(rulesToInsert, { ordered: false });
  console.log(`✅ Inserted ${result.length} task rules.`);

  for (const rule of rulesToInsert) {
    await Tasks.updateMany(
      { taskRuleId: rule.taskRuleId },
      {
        $set: {
          department: rule.department,
          taskType: rule.taskType,
          isRecurring: rule.recurring,
          packLinen: rule.packLinen,
          retrieveLinen: rule.retrieveLinen,
        }
      }
    );
  }

  console.log('🔄 Tasks updated with Task Rule data.');
}
