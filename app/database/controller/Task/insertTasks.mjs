import fs from 'fs';
import path from 'path';
import Staff from '../../models/staff.mjs';
import Tasks from '../../models/tasks.mjs';
import TaskRules from '../../models/task-rules.mjs';
import { taskRulesRequiringPickup, ignoreTasksWithStaff, ignoreTaskType } from '../../middleware/driverAssignment/constants.mjs';

function addHoursToTime(startTime, hoursToAdd) {
  const [hour, minute] = startTime.split(':').map(Number);
  const base = new Date();
  base.setHours(hour, minute, 0, 0);
  const future = new Date(base.getTime() + hoursToAdd * 60 * 60 * 1000);
  return future.toTimeString().slice(0, 5);
}

export async function insertTasks() {
  const rawTaskData = JSON.parse(fs.readFileSync(path.resolve('../temp/processedTasks.json'), 'utf-8'));

  console.log(`Importing ${rawTaskData.length} task records...`);

  const [allStaff, allTaskRules] = await Promise.all([
    Staff.find().lean(),
    TaskRules.find().lean(),
  ]);

  const staffByOpertoId = {};
  allStaff.forEach(s => staffByOpertoId[s.opertoId] = s._id);

  const taskRuleMap = new Map(allTaskRules.map(r => [String(r._id), r]));
  const ruleByName = new Map(allTaskRules.map(r => [r.name.trim(), r]));

  let created = 0;
  let updated = 0;
  let pickupCounter = 0;

  for (const raw of rawTaskData) {
    if (ignoreTaskType.has(raw.taskName)) {
      console.log(`Skipping task ${raw.taskName} due to ignored task type: ${raw.taskType}`);
      continue;
    }

    const staffNames = raw.assignedStaffNames || [];
    if (staffNames.some(name => ignoreTasksWithStaff.has(name))) {
      console.log(`Skipping task ${raw.taskName} due to ignored staff: ${staffNames.join(', ')}`);
      continue;
    }


    const assignedStaff = Array.isArray(raw.assignedStaff)
      ? raw.assignedStaff
        .filter(Boolean)
        .map(id => {
          if (staffByOpertoId[id]) return staffByOpertoId[id];
          if (allStaff.find(s => s._id.toString() === id)) return id;
          return null;
        })
        .filter(Boolean)
      : [];

    const failedStaffIds = raw.assignedStaff?.filter(id => {
      return !(staffByOpertoId[id] || allStaff.some(s => s._id.toString() === id));
    });
    if (failedStaffIds?.length) {
      console.warn(`⚠️ Unmatched assignedStaff IDs for task ${raw.taskId}:`, failedStaffIds);
    }

    const [year, month, day] = raw.date.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);

    const rule = ruleByName.get(raw.taskName.trim());

    const baseTask = {
      taskId: raw.taskId,
      taskRuleId: raw.taskRuleId,
      propertyId: raw.propertyId,
      property: raw.property,
      taskName: raw.taskName,
      taskDescription: raw.taskDescription || '',
      department: raw.department || '',
      taskType: raw.taskType || '',
      date: localDate,
      startTime: raw.startTime || '',
      endTime: raw.endTime || '',
      estimatedEndTime: raw.estimatedEndTime || '',
      minHours: raw.minHours || 0,
      maxHours: raw.maxHours || 0,
      assignedStaff,
      staffRequired: raw.staffRequired || 1,
      requiresLinens: raw.requiresLinens || false,
      requiresSupplies: raw.requiresSupplies || false,
      packLinen: raw.packLinen || false,
      retrieveLinen: raw.retrieveLinen || false,
      requiresPickup:
        (rule && taskRulesRequiringPickup.has(rule.name)) ||
        raw.taskName.toLowerCase().includes('turnover'),
      priority: raw.priority || 1,
      isRecurring: raw.isRecurring || false,
      isReminder: raw.isReminder || false,
      thirdParty: raw.thirdParty || false,
      active: raw.active !== false,
      internalNotes: raw.internalNotes || '',
      specialInstructions: raw.specialInstructions || '',
      taskTags: raw.taskTags || [],
      flags: raw.flags || [],
      taskImages: raw.taskImages || [],
      approved: raw.approved || false,
      approvedDate: raw.approvedDate ? new Date(raw.approvedDate) : null,
      completed: raw.completed || false,
      completeConfirmedDate: raw.completeConfirmedDate ? new Date(raw.completeConfirmedDate) : null,
      createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
      updatedAt: new Date(),
    };

    const existing = await Tasks.findOne({ taskId: raw.taskId });
    if (existing) {
      await Tasks.updateOne({ taskId: raw.taskId }, baseTask);
      // Sync assigned staff to pickup task if one exists
      await Tasks.updateMany(
        {
          parentTaskId: raw.taskId,
          taskTags: 'AutoPickup'
        },
        {
          $set: {
            assignedStaff: baseTask.assignedStaff,
            updatedAt: new Date()
          }
        }
      );

      updated++;
    } else {
      await Tasks.create(baseTask);
      created++;
    }

    if (baseTask.requiresPickup && baseTask.assignedStaff.length > 0) {
      const pickupTaskId = `pickup-${raw.taskId}-${pickupCounter++}`;
      const pickupTime = addHoursToTime(raw.startTime, raw.maxHours);

      const pickupTask = {
        ...baseTask,
        parentTaskId: baseTask.taskId,
        taskId: pickupTaskId,
        taskName: `Pickup for ${raw.taskName}`,
        startTime: pickupTime,
        retrieveLinen: true,
        requiresPickup: false,
        internalNotes: 'Auto-created pickup task',
        taskTags: ['AutoPickup'],
        assignedStaff: [...baseTask.assignedStaff],
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const exists = await Tasks.findOne({ taskId: pickupTaskId });
      if (!exists) {
        await Tasks.create(pickupTask);
        created++;
      }
      
    }
  }
  try {
    console.log('🔄 Running pickup task staff sync patch...');

    const allPickupTasks = await Tasks.find({ taskTags: 'AutoPickup' }).lean();

    for (const pickup of allPickupTasks) {
      const baseId = pickup.taskId.replace(/^pickup-/, '').replace(/-\d+$/, '');
      const parent = await Tasks.findOne({ taskId: baseId });

      if (!parent) {
        console.warn(`❌ Could not find parent task for ${pickup.taskId} (baseId: ${baseId})`);
        continue;
      }

      if (Array.isArray(parent.assignedStaff) && parent.assignedStaff.length > 0) {
        const needsUpdate = JSON.stringify(pickup.assignedStaff) !== JSON.stringify(parent.assignedStaff);
        if (needsUpdate) {
          await Tasks.updateOne({ _id: pickup._id }, { $set: { assignedStaff: parent.assignedStaff } });
          console.log(`Updated assignedStaff for pickup task: ${pickup.taskName}`);
        }
      }
    }
  } catch (err) {
    console.error('Pickup sync failed:', err);
  }


}
