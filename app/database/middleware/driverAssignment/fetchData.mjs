import Tasks from '../../models/tasks.mjs';
import Staff from '../../models/staff.mjs';
import TaskRules from '../../models/task-rules.mjs';

export async function fetchTasks(startDate, endDate) {
  return await Tasks.find({
    date: { $gte: startDate, $lt: endDate }
  })
    .populate('taskRuleId')
    .lean();
}

/* GET DRIVERS AND CLEANERS FOR SCHEDULE */
// export async function fetchDrivers() {
//   return await Staff.find({
//     roles: { $in: ['Driver'] }
//   }).lean();
// }

/* GET DRIVERS ONLY FOR SCHEDULE */
export async function fetchDrivers() {
  return await Staff.find({
    name: { $regex: /^!/ },
    roles: ['Driver']
  }).lean();
}


export async function fetchAllStaff() {
  return await Staff.find().lean().select('+cantWorkWith');

}

export async function fetchTaskRules() {
  return await TaskRules.find().lean();
}

export async function fetchAllData(startDate, endDate) {
  const tasks = await fetchTasks(startDate, endDate);
  const drivers = await fetchDrivers();
  const allStaff = await fetchAllStaff();
  const allTaskRules = await fetchTaskRules();

  console.log('Drivers', drivers)
  return { tasks, drivers, allStaff, allTaskRules };
}
