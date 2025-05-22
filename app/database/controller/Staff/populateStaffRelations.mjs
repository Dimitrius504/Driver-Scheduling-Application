import mongoose from 'mongoose';
import Staff from '../../models/staff.mjs';
import dotenv from 'dotenv'

dotenv.config()

const uri = `${process.env.MONGO_URI}`
async function main() {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const staff = await Staff.find().lean();

    let updated = 0;

    for (const person of staff) {
        const memberIds = await Staff.find({ opertoId: { $in: person.teamInfo.members } }).select('_id').lean();
        const cantWorkWithIds = await Staff.find({ opertoId: { $in: person.cantWorkWith } }).select('_id').lean();

        const members = memberIds.map(x => x._id);
        const cantWorkWith = cantWorkWithIds.map(x => x._id);

        await Staff.updateOne(
            { _id: person._id },
            {
                $set: {
                    'teamInfo.members': members,
                    cantWorkWith: cantWorkWith
                }
            }
        );

        updated++;
    }

    console.log(`🔄 Updated relations for ${updated} staff members.`);
    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
}

main().catch(console.error);
