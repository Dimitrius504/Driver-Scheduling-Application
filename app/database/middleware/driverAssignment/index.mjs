import { fetchTasks, fetchDrivers, fetchAllStaff, fetchTaskRules } from './fetchData.mjs';
import { assignTasksToDrivers } from './assignmentLogic.mjs';
import { buildStaffAssignments } from './staffAssignments.mjs';
import { groupAndSortTasks } from './utils.mjs';
import { logInfo } from './logger.mjs';
import { fetchAllData } from './fetchData.mjs';
import { groupTasksByZone } from './clusteringLogic.mjs';
import { groupTasksByZonePlain } from './utils.mjs';
import Tasks from '../../models/tasks.mjs';

export async function generateScheduleForDate(startDate, endDate) {
  logInfo(`Generating Schedule From: ${startDate} To: ${endDate}`);

  // Pull all necessary data from DB
  const { tasks, drivers, allStaff, allTaskRules } = await fetchAllData(startDate, endDate);
  const onlyDrivers = allStaff.filter(
    s => s.name.startsWith('!') && s.roles.includes('Driver') && !s.roles.includes('Cleaner') 
  );

  const populatedTasks = await Tasks.find({
    date: { $gte: startDate, $lt: endDate }
  })
    .populate('assignedStaff', 'name cantWorkWith')
    .select('assignedStaff taskName date startTime property')
    .lean();

  const { assignments, unassignedTasks, mergedConflicts } = assignTasksToDrivers(tasks, drivers, allStaff, allTaskRules, populatedTasks);

  return {
    assignments, // don't touch!
    staffAssignments: buildStaffAssignments(allStaff, tasks),
    unassignedByDate: groupAndSortTasks(unassignedTasks),
    allStaff,
    // drivers: allStaff.filter(s => s.roles.includes('Driver')), /* GET DRIVERS AND CLEANER DRIVERS */
    drivers: onlyDrivers,   /** ONLY GET DRIVERS */
    mergedConflicts,
    populatedTasks
  };


}
