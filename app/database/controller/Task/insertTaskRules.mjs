import fs from 'fs';
import path from 'path';
import TaskRules from '../../models/task-rules.mjs';
import Tasks from '../../models/tasks.mjs';

export async function insertTaskRules() {
  const rawData = JSON.parse(fs.readFileSync(path.resolve('../temp/processedTaskRules.json'), 'utf-8'));
  console.log(`Importing ${rawData.length} task rules...`);

  let created = 0;
  let updated = 0;

  for (const rule of rawData) {
    const existing = await TaskRules.findOne({ taskRuleId: rule.taskRuleId });

    const baseRule = {
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
      category: rule.category || 'Uncategorized',
      updatedAt: new Date(),
    };

    if (!existing) {
      baseRule.createdAt = new Date();
      await TaskRules.create(baseRule);
      created++;
    } else {
      await TaskRules.updateOne({ taskRuleId: rule.taskRuleId }, baseRule);
      updated++;
    }

    // Update any existing Tasks that reference this rule
    await Tasks.updateMany(
      { taskRuleId: rule.taskRuleId },
      {
        $set: {
          department: baseRule.department,
          taskType: baseRule.taskType,
          isRecurring: baseRule.recurring,
          packLinen: baseRule.packLinen,
          retrieveLinen: baseRule.retrieveLinen,
        }
      }
    );
  }

  console.log(`Task Rules processed: ${created} created, ${updated} updated.`);
  console.log(`Related tasks updated with rule info.`);
}
