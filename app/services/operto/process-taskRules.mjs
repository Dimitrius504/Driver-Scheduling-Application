import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function taskTypeLogic(name) {
  const lower = name.toLowerCase();
  if (lower.includes('owner') || lower.includes('lori track') || lower.includes('moore') || lower.includes('casa')) return 'Owner Clean';
  if (lower.includes('turnover') || lower.includes('to ') || lower.includes('hk') || lower.includes('house') || lower.includes('clean')) return 'Housekeeping';
  if (lower.includes('linen') || lower.includes('lc') || lower.includes('wlp') || lower.includes('drop off') || lower.includes('pickup') || lower.includes('pu')) return 'Linen';
  if (lower.includes('maint') || lower.includes('hot tub') || lower.includes('damages') || lower.includes('repair') || lower.includes('lawn')) return 'Maintenance';
  if (lower.includes('reminder') || lower.includes('greet') || lower.includes('interview') || lower.includes('checkup')) return 'Reminder';
  if (lower.includes('garbage')) return 'Garbage';
  if (lower.includes('inspect') || lower.includes('cottage check') || lower.includes('preclean')) return 'Inspection';
  if (lower.includes('deliver') || lower.includes('pickup') || lower.includes('pu') || lower.includes('del')) return 'Delivery';
  if (lower.includes('drive') || lower.includes('driving')) return 'Driving';
  return 'Other';
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.resolve(__dirname, '../../temp');

export function processTaskRules() {

  const rawRules = JSON.parse(fs.readFileSync(path.join(tempDir, 'taskRulesData.json'), 'utf-8'));
  const allTasks = JSON.parse(fs.readFileSync(path.join(tempDir, 'processedTasks.json'), 'utf-8'));

  const taskMap = allTasks.reduce((acc, task) => {
    if (!acc[task.taskRuleId]) acc[task.taskRuleId] = [];
    acc[task.taskRuleId].push(new Date(task.date));
    return acc;
  }, {});

  const processedRules = rawRules
    .filter(rule =>
      rule.active &&
      !rule.taskName.toLowerCase().includes("don't use") &&
      !rule.taskName.toLowerCase().includes("test")
    )
    .map(rule => {
      const relatedDates = taskMap[rule.taskRuleId] || [];
      const isRecurring = relatedDates.length >= 2 && relatedDates.every(date => relatedDates[0].getDay() === date.getDay());
      const taskType = taskTypeLogic(rule.taskName);
      const packLinen = /Linen|HK|LC/i.test(rule.taskName) || taskType === 'Linen';

      return {
        taskRuleId: rule.taskRuleId,
        name: rule.taskName.trim(),
        abbreviation: rule.abbreviation?.trim() || '',
        active: rule.active,
        department: rule.department || 'Unknown',
        taskType,
        minTime: rule.minTime || 0,
        maxTime: rule.maxTime || 0,
        recurring: isRecurring,
        packLinen,
        retrieveLinen: packLinen,
        internalNotes: rule.internalNotes?.trim() || "",
        createdAt: rule.createdAt || new Date(),
        category: taskType
      };
    });


  fs.writeFileSync(path.join(tempDir, 'processedTaskRules.json'), JSON.stringify(processedRules, null, 2));
  console.log(`Successfully processed ${processedRules.length} task rules.`);
}
