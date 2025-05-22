import { mongoose } from 'mongoose';
const { Schema, model } = mongoose;

const propertySchema = new Schema({
  propertyId: { type: Number, required: true, unique: true },
  name: String,
  address: String,
  lat: Number,
  lon: Number,
  doorCode: String,
  zone: String,
  region: {
    regionName: String,
    regionGroup: String,
  },
  isIsland: Boolean,
  active: { type: Boolean, default: true },
  internalNotes: String,
  ownerPreferences: {
    preferredTeamMembers: [{ type: mongoose.Types.ObjectId, ref: 'Staff' }],
    strictArrivalTime: { type: Boolean, default: false },
    notesForScheduler: { type: String, default: "" },
  },
  isPreferredTeam: { type: Boolean, default: false },
  preferredTeamMembers: [{ type: mongoose.Types.ObjectId, ref: 'Staff' }],
  hasRecurringTasks: { type: Boolean, default: false },
  taskTypeHistory: [String],
  minExperienceLevel: { type: String, default: "Any" },
  notesForScheduler: { type: String, default: "" },
  assignedZone: { type: String, default: "" },
  distanceFromOffice: { type: Number, default: null },
  
}, { timestamps: true });

const Property = model('Property', propertySchema);
export default Property;
