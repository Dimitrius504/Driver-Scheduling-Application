import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Staff from '../../models/staff.mjs';
import Tasks from '../../models/tasks.mjs';
import TaskRules from '../../models/task-rules.mjs';
import { taskRulesRequiringPickup } from '../../middleware/driverAssignment/constants.mjs';

function addHoursToTime(startTime, hoursToAdd) {
  const [hour, minute] = startTime.split(':').map(Number);
  const base = new Date();
  base.setHours(hour, minute, 0, 0);
  const future = new Date(base.getTime() + hoursToAdd * 60 * 60 * 1000);
  return future.toTimeString().slice(0, 5);
}

export async function insertTasks() {
  const rawTaskData = JSON.parse(
    fs.readFileSync(path.resolve('../temp/processedTasks.json'), 'utf-8')
  );

  console.log(`Importing ${rawTaskData.length} task records...`);

  const [allStaff, allTaskRules] = await Promise.all([
    Staff.find().lean(),
    TaskRules.find().lean(),
  ]);

  const staffByOpertoId = {};
  allStaff.forEach((s) => (staffByOpertoId[s.opertoId] = s._id));

  const taskRuleMap = new Map(allTaskRules.map((r) => [String(r._id), r]));

  const transformedTasks = [];
  let pickupCounter = 0;

  for (const raw of rawTaskData) {
    const assignedStaff = Array.isArray(raw.assignedStaff)
      ? raw.assignedStaff
        .filter(Boolean)
        .map((id) => staffByOpertoId[id.toString()])
        .filter(Boolean)
      : [];

    const baseTask = {
      taskId: raw.taskId,
      taskRuleId: raw.taskRuleId,
      propertyId: raw.propertyId,
      property: raw.property,
      taskName: raw.taskName,
      taskDescription: raw.taskDescription || '',
      department: raw.department || '',
      taskType: raw.taskType || '',
      date: new Date(raw.date),
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
      requiresPickup: false,
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
      completeConfirmedDate: raw.completeConfirmedDate
        ? new Date(raw.completeConfirmedDate)
        : null,
      createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date(),
    };


    transformedTasks.push(baseTask);

    const rule = allTaskRules.find(r => r.name.trim() === raw.taskName.trim());


    if (rule && taskRulesRequiringPickup.has(rule.name)) {
      baseTask.requiresPickup = true;
    
      const pickupTime = addHoursToTime(raw.startTime, raw.maxHours);
      const pickupTask = {
        ...baseTask,
        taskId: `pickup-${raw.taskId}-${pickupCounter++}`,
        taskName: `Pickup for ${raw.taskName}`,
        startTime: pickupTime,
        requiresPickup: false,
        retrieveLinen: true,
        internalNotes: 'Auto-created pickup task',
        taskTags: ['AutoPickup'],
        assignedStaff: [...baseTask.assignedStaff],
        completed: false,
      };
    
      transformedTasks.push(pickupTask);
    }    
  }    
  await Tasks.deleteMany({});
  console.log('Existing tasks wiped.');

  const result = await Tasks.insertMany(transformedTasks, { ordered: false });
  console.log(`Inserted ${result.length} task records.`);

  return true;
}
