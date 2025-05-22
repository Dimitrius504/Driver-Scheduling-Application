import { groupAndSortTasks } from './utils.mjs';

/**
 * Builds staff assignments based on tasks.
 */

export function buildStaffAssignments(allStaff, tasks) {
  return allStaff.map(staff => ({
    staff,
    tasksByDate: groupAndSortTasks(
      tasks.filter(task =>
        task.assignedStaff?.some(s => s.toString() === staff._id.toString())
      )
    )
  }));
}
