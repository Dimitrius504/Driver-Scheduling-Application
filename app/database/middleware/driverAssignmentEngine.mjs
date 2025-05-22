import Tasks from '../models/tasks.mjs';
import Staff from '../models/staff.mjs';
import TaskRules from '../models/task-rules.mjs';

export async function generateScheduleForDate(startDate, endDate) {
  console.log('Generating Schedule From:', startDate, 'To:', endDate);

  const allStaff = await Staff.find().lean();

  const tasks = await Tasks.find({
    date: { $gte: startDate, $lt: endDate }
  }).populate('taskRuleId').lean();

  const drivers = await Staff.find({ roles: { $in: ['Driver'] } }).lean();
  const allTaskRules = await TaskRules.find().lean();

  const taskRulesMap = new Map(allTaskRules.map(rule => [rule.taskRuleId, rule]));
  const staffMap = new Map(allStaff.map(s => [String(s._id), s]));

  const assignments = drivers.map(driver => ({ driver, tasks: [] }));
  const availableDrivers = [...drivers];
  const unassignedTasks = [];

  const driverRelevantCategories = ['Delivery/Pickup Tasks', 'Driving Tasks', 'Pickup'];
  const driverKeywords = ['off', 'pick up', 'pickup', 'pu ', 'deliver', 'delivery', 'garbage', 'drive'];
  const driverExclusions = ['put on', 'setup', 'set up', 'install'];
  const largeVehicleTypes = ['Truck', 'Van', 'SUV'];

  for (const task of tasks) {
    const rule = taskRulesMap.get(task.taskRuleId?.taskRuleId || task.taskRuleId);

    const taskNameLower = task.taskName.toLowerCase().replace(/\s+/g, ' ');

    const nameSuggestsDriverTask = driverKeywords.some(k => taskNameLower.includes(k));
    const nameSuggestsNonDriverTask = driverExclusions.some(k => taskNameLower.includes(k));

    const isDriverTask =
      (rule && driverRelevantCategories.includes(rule.category)) ||
      (nameSuggestsDriverTask && !nameSuggestsNonDriverTask);

    const assignedStaff = task.assignedStaff.map(id => staffMap.get(String(id))).filter(Boolean);
    const needsDriverSupport = assignedStaff.length > 0 && !assignedStaff.some(s => s?.roles.includes('Driver'));

    const isLinenOrSupplyTask = task.requiresLinens || task.requiresSupplies;

    let assignedToDriver = false;

    // Check if any already-assigned staff is a driver
    for (const staffId of task.assignedStaff || []) {
      const assignedDriver = drivers.find(d => d._id.equals(staffId));

      if (assignedDriver) {
        const driverAssignment = assignments.find(a => a.driver._id.equals(assignedDriver._id));

        if (driverAssignment && !driverAssignment.tasks.some(t => t._id.equals(task._id))) {
          driverAssignment.tasks.push(task);
          console.log(`Including existing task "${task.taskName}" for driver ${assignedDriver.name}`);
          assignedToDriver = true;
        }
      }
    }

    // if ((isDriverTask || needsDriverSupport) && availableDrivers.length && !assignedToDriver) {
    //   const driver = availableDrivers.find(d => !isLinenOrSupplyTask || largeVehicleTypes.includes(d.vehicle));

    //   if (driver) {
    //     const driverAssignment = assignments.find(a => a.driver._id.equals(driver._id));
    //     driverAssignment.tasks.push(task);
    //     console.log(`Assigned "${task.taskName}" to ${driver.name} (${driver.vehicle})`);
    //     availableDrivers.splice(availableDrivers.indexOf(driver), 1);
    //     assignedToDriver = true;
    //   }
    // }

    // if (!assignedToDriver) {
    //   unassignedTasks.push(task);
    // }
  }

  const groupAndSortTasks = taskList =>
    taskList.reduce((acc, task) => {
      const day = task.date.toISOString().split('T')[0];
      if (!acc[day]) acc[day] = [];
      acc[day].push(task);
      acc[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
      return acc;
    }, {});

  const staffAssignments = allStaff.map(staff => ({
    staff,
    tasksByDate: groupAndSortTasks(
      tasks.filter(task => task.assignedStaff?.some(s => s.toString() === staff._id.toString()))
    )
  }));

  return {
    assignments: assignments.map(a => ({
      driver: a.driver,
      tasksByDate: groupAndSortTasks(a.tasks)
    })),
    staffAssignments,
    unassignedByDate: groupAndSortTasks(unassignedTasks)
  };
}
