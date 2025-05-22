import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const staffSchema = new Schema({
    opertoId: String,
    name: { type: String },
    email: { type: String },
    phone: String,
    isActive: { type: Boolean, default: true },
    createDate: { type: Date, default: Date.now },
    roles: [{ type: String }],
    teamInfo: {
        teamID: String,
        teamRole: { type: String, enum: ["Team Leader", "Team Member"], default: "Team Member" },
        members: [{ type: mongoose.Schema.Types.Mixed }],
        zone: String
    },
      
    schedule: {
        shifts: [{
            date: Date,
            type: String,
            zone: String,
            isFixed: Boolean,
            needsLinens: { type: Boolean, default: false },
            needsSupplies: { type: Boolean, default: false },
            pairedWith: [{ type: Schema.Types.ObjectId, ref: 'Staff' }]
        }],
        changes: [{
            date: Date,
            changedBy: { type: Schema.Types.ObjectId, ref: 'Staff' },
            reason: String
        }]
    },
    additionalInfo: {
        comments: String,
        lastModified: { type: Date, default: Date.now }
    },
    vehicle: { type: String, default: 'None' },
    cantWorkWith: [{ type: mongoose.Schema.Types.Mixed }]
});


// Define a virtual property to automatically set the 'Newbie' role based on createDate
staffSchema.virtual('isNewbie').get(function () {
    return this.createDate >= new Date('2025-01-01');
});

const Staff = model('Staff', staffSchema);
export default Staff;


// Types of Shifts:
// HK w LC - LC Linen Change - Will have to pick up Linens
// HK2 - Will need to pick up towels
// Turnover to guest (has lines)
// Turnover to owners (no linens)
// WLP - White Linen Program (needs linens)
// Preclean, Put on WLP (both need Linens)
// Linen Packing - Checkbox [needs linens]
// IN DRIVER SCHEDULE SHOULD SAY NEEDS LINENS AND SUPPLIES - SUPPLIES GO WITH TURNOVER TO GUEST / PRECLEAN / PUT ON WLP - Greeting supplies

// Each team has a certain vehicle
// Paul has an escape - big precleans or big turnovers - he may have issues
// Mike has van
// Alicia has van
// Jess (hopefully) has truck
// Roland has a truck


// Team Leads:
// Alica
// Jess
// Lilibeth - may be under beth
// MIMI
// Noreen
// Sonia
