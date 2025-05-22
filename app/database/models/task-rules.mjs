import mongoose from 'mongoose';
const { Schema, model } = mongoose;


const taskRuleSchema = new Schema({
    taskRuleId: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    abbreviation: { type: String },
    active: { type: Boolean, default: true },
    department: { type: String, default: 'Unknown' },  // Maintenance, Housekeeping, Linen etc
    taskType: { type: String, default: 'Other' },
    minTime: { type: Number, default: 0 },
    maxTime: { type: Number, default: 0 },
    recurring: { type: Boolean, default: false },
    packLinen: { type: Boolean, default: false },
    retrieveLinen: { type: Boolean, default: false },
    internalNotes: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    category: { type: String }
  });
  
const TaskRules = model('Task Rules', taskRuleSchema);
export default TaskRules;