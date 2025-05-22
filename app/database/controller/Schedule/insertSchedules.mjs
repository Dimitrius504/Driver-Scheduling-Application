import Schedule from '../../models/schedules.mjs';
import Tasks from '../../models/tasks.mjs';
import Staff from '../../models/staff.mjs';
import TaskRules from '../../models/task-rules.mjs';
import Properties from '../../models/properties.mjs';
import { detectScheduleConflicts } from '../../middleware/driverAssignment/utils.mjs';

function addHoursToTime(startTime, hoursToAdd) {
  const [h, m] = startTime.split(':').map(Number);
  const base = new Date();
  base.setHours(h, m, 0, 0);
  const future = new Date(base.getTime() + hoursToAdd * 60 * 60 * 1000);
  return future.toTimeString().slice(0, 5);
}

export async function generateAndSaveSchedule() {
  const staff = await Staff.find().lean();
  const taskRules = await TaskRules.find().lean();
  const properties = await Properties.find().lean();
  const staffMap = new Map(staff.map(s => [String(s._id), s]));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endDate = new Date('2025-10-31');
  endDate.setHours(23, 59, 59, 999);

  let currentWeek = new Date(today);
  currentWeek.setDate(currentWeek.getDate() - currentWeek.getDay());

  const schedules = [];

  while (currentWeek <= endDate) {
    const weekStart = new Date(currentWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const existingSchedule = await Schedule.findOne({ weekStart });
    if (existingSchedule?.locked) {
      console.log(`🔒 Skipping locked schedule for week starting ${weekStart.toDateString()}`);
      currentWeek.setDate(currentWeek.getDate() + 7);
      continue;
    }

    const tasks = await Tasks.find({ date: { $gte: weekStart, $lte: weekEnd } })
      .populate('assignedStaff', '_id name roles cantWorkWith')
      .lean();

    const conflicts = detectScheduleConflicts(tasks, staffMap);
    const daySchedules = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      date.setHours(0, 0, 0, 0);

      const tasksForDay = tasks.filter(t => {
        const taskDate = new Date(t.date);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate.getTime() === date.getTime();
      });

      const assignments = [];
      const unassignedTasks = [];

      for (const task of tasksForDay) {
        const driver = (task.assignedStaff || []).find(s => s.roles.includes('Driver'));

        assignments.push({
          taskId: task._id,
          driverId: driver ? driver._id : null,
          assignedStaff: task.assignedStaff?.map(s => s._id) || [],
          reason: task.driverAssignmentReason || ''
        });


        if (!(task.assignedStaff || []).some(s => s.roles.includes('Driver'))) {
          unassignedTasks.push(task._id);
        }

        // Check if this task already has a pickup task created
        if (task.requiresPickup && task.maxHours && task.startTime) {
          const existingPickup = await Tasks.findOne({
            taskTags: 'AutoPickup',
            internalNotes: 'Auto-generated pickup task',
            taskName: `Pickup for ${task.taskName}`,
            date: task.date
          });

          if (!existingPickup) {
            const pickupTime = addHoursToTime(task.startTime, task.maxHours);
            const pickupTask = await Tasks.create({
              taskId: `pickup-${task._id}`,
              taskRuleId: task.taskRuleId,
              propertyId: task.propertyId,
              property: task.property,
              taskName: `Pickup for ${task.taskName}`,
              date: task.date,
              startTime: pickupTime,
              assignedStaff: task.assignedStaff?.map(s => s._id).filter(Boolean) || [],
              staffRequired: task.staffRequired || 1,
              retrieveLinen: true,
              requiresPickup: false,
              internalNotes: 'Auto-generated pickup task',
              taskTags: ['AutoPickup'],
              active: true,
            });

            assignments.push({
              taskId: pickupTask._id,
              driverId: driver ? driver._id : null,
              reason: 'Auto-assigned Pickup'
            });

            if (!driver) unassignedTasks.push(pickupTask._id);
          }
        }
      }

      daySchedules.push({
        date,
        assignments,
        unassignedTasks,
        notes: ''
      });
    }

    // Only delete existing schedule if not locked
    await Schedule.deleteMany({ weekStart });

    const newSchedule = new Schedule({
      weekStart,
      weekEnd,
      daySchedules,
      staff: staff.map(s => s._id),
      taskRules: taskRules.map(r => r._id),
      properties: properties.map(p => p._id),
      conflicts: Object.fromEntries(conflicts)
    });

    schedules.push(newSchedule.save());
    currentWeek.setDate(currentWeek.getDate() + 7);
  }

  await Promise.all(schedules);
  console.log(`Inserted ${schedules.length} schedule(s).`);
  return { success: true, count: schedules.length };
}
