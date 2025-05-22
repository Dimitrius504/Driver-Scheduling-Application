import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const taskSchema = new Schema({
    taskId: { type: String, required: true, unique: true },
    taskRuleId: { type: Number }, // Recurring detection
    propertyId: { type: Number, required: true },
    property: {
        name: { type: String, required: true },
        address: String,
        lat: Number,
        lon: Number,
        doorCode: String,
        zone: String,
        region: String,
        isIsland: { type: Boolean, default: false } // Smart Flag
    },
    taskName: { type: String, required: true },
    taskDescription: { type: String, default: "" },
    department: { type: String }, // Ex: Cleaning, Maintenance
    taskType: { type: String }, // Ex: Turnover, Linen, Preclean
    date: { type: Date, required: true },
    startTime: { type: String },
    endTime: { type: String },
    estimatedEndTime: { type: String },
    minHours: { type: Number },
    maxHours: { type: Number },
    requiresPickup: Boolean,
    pickupTaskTemplate: Object,
    assignedOpertoIds: [{ type: String }],
    assignedStaff: [{ type: Schema.Types.ObjectId, ref: 'Staff' }],
    assignedDriver: { type: Schema.Types.ObjectId, ref: 'Staff' },
    driverAssignmentReason: {
        type: String, // e.g. "Pickup", "Drop-off", "Linen Pickup", etc.
        default: null
    },
    scheduleWeekStart: { type: Date },
    staffRequired: { type: Number, default: 1 },

    requiresLinens: { type: Boolean, default: false },
    requiresSupplies: { type: Boolean, default: false },
    packLinen: { type: Boolean, default: false },
    retrieveLinen: { type: Boolean, default: false },

    priority: { type: Number, default: 1 },
    isRecurring: { type: Boolean, default: false },
    isReminder: { type: Boolean, default: false },
    thirdParty: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    pickupDropoff: { type: String, enum: ['Pickup', 'Drop-off', ''], default: '' },

    internalNotes: String,
    specialInstructions: String,
    taskTags: [String],
    flags: [Boolean],
    taskImages: [String],

    approved: { type: Boolean, default: false },
    approvedDate: Date,
    completed: { type: Boolean, default: false },
    completeConfirmedDate: Date,

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});


const findTask = async (query) => {
    const db = getDb();
    return await db.collection('staff').findOne(query);
};

const Tasks = model('Tasks', taskSchema);
export default Tasks;
