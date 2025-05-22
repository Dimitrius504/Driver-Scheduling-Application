import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tasks', required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  reason: { type: String }
});

const dayScheduleSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  assignments: [assignmentSchema],
  unassignedTasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tasks' }],
  notes: { type: String },
});

const scheduleSchema = new mongoose.Schema({
  weekStart: { type: Date, required: true },
  weekEnd: { type: Date, required: true },
  daySchedules: [dayScheduleSchema],
  staff: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }],
  taskRules: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TaskRules' }],
  properties: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Properties' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  conflicts: { type: Map, of: [String] },
}, {
  timestamps: true
});

export default mongoose.model('Schedule', scheduleSchema);
