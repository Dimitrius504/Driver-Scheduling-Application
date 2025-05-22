import { driverRelevantCategories, driverKeywords, driverExclusions, largeVehicleTypes, ignoreTaskType, ignoreTasksWithStaff } from './constants.mjs';
import { groupAndSortTasks } from './utils.mjs';

export function handleAssignments(tasks, drivers, taskRulesMap, staffMap) {
  const assignments = drivers.map(driver => ({ driver, tasks: [] }));
  const availableDrivers = [...drivers];
  const unassignedTasks = [];

  for (const task of tasks) {
    const rule = taskRulesMap.get(task.taskRuleId?.taskRuleId || task.taskRuleId);
    const taskNameLower = task.taskName.toLowerCase().replace(/\s+/g, ' ');

    const nameSuggestsDriverTask = driverKeywords.some(k => taskNameLower.includes(k));
    const nameSuggestsNonDriverTask = driverExclusions.some(k => taskNameLower.includes(k));

    const isDriverTask = (rule && driverRelevantCategories.includes(rule.category)) ||
      (nameSuggestsDriverTask && !nameSuggestsNonDriverTask);

    const assignedStaff = task.assignedStaff.map(id => staffMap.get(String(id))).filter(Boolean);
    const needsDriverSupport = assignedStaff.length > 0 && !assignedStaff.some(s => s?.roles.includes('Driver'));

    const isLinenOrSupplyTask = task.requiresLinens || task.requiresSupplies;

    let assignedToDriver = false;

    for (const staffId of task.assignedStaff || []) {
      const assignedDriver = drivers.find(d => d._id.equals(staffId));

      if (assignedDriver) {
        const driverAssignment = assignments.find(a => a.driver._id.equals(assignedDriver._id));

        if (driverAssignment && !driverAssignment.tasks.some(t => t._id.equals(task._id))) {
          driverAssignment.tasks.push(task);
          assignedToDriver = true;
        }
      }
    }

    if ((isDriverTask || needsDriverSupport) && availableDrivers.length && !assignedToDriver) {
      const driver = availableDrivers.find(d => !isLinenOrSupplyTask || largeVehicleTypes.includes(d.vehicle));

      if (driver) {
        const driverAssignment = assignments.find(a => a.driver._id.equals(driver._id));
        driverAssignment.tasks.push(task);
        availableDrivers.splice(availableDrivers.indexOf(driver), 1);
        assignedToDriver = true;
      }
    }

    if (!assignedToDriver) {
      unassignedTasks.push(task);
    }
  }

  return { assignments, unassignedTasks };
}
