import Tasks from '../models/tasks.mjs';
import Staff from '../models/staff.mjs';

export async function relinkAssignedStaff() {
  const staffList = await Staff.find({}, '_id opertoId').lean();
  const opertoMap = Object.fromEntries(staffList.map(s => [s.opertoId, s._id.toString()]));

  const tasks = await Tasks.find({ assignedOpertoIds: { $exists: true, $ne: [] } }).lean();

  let updatedCount = 0;

  for (const task of tasks) {
    const newAssigned = [];

    for (const oid of task.assignedOpertoIds) {
      const staffId = opertoMap[oid];
      if (staffId) {
        newAssigned.push(staffId);
      } else {
        console.warn(`No staff found for opertoId ${oid} in task ${task.taskId}`);
      }
    }

    await Tasks.updateOne({ _id: task._id }, { $set: { assignedStaff: newAssigned } });
    updatedCount++;
  }

  console.log(`Relinked assignedStaff in ${updatedCount} tasks.`);
}
