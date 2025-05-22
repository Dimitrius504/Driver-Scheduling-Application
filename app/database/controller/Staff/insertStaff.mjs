import fs from 'fs';
import path from 'path';
import Staff from '../../models/staff.mjs';

export async function insertStaff() {
  const rawStaffData = JSON.parse(fs.readFileSync(path.resolve('../temp/processedStaff.json'), 'utf-8'));
  if (!Array.isArray(rawStaffData)) throw new Error('Staff data is not an array');

  console.log(`🔄 Processing ${rawStaffData.length} staff records...`);

  await Staff.deleteMany({});
  // console.log('Existing staff wiped.');

  const insertResults = [];

  for (const raw of rawStaffData) {
    const doc = {
      opertoId: raw.opertoId?.toString(),
      name: raw.name || 'Unknown',
      email: raw.email || 'No email provided',
      phone: raw.phone || '',
      isActive: raw.isActive ?? true,
      createDate: raw.createDate ? new Date(raw.createDate) : new Date(),
      roles: Array.isArray(raw.roles) ? raw.roles : [],
      teamInfo: {
        teamID: raw.teamInfo?.teamID?.toString() || '',
        teamRole: raw.teamInfo?.teamRole || 'Team Member',
        members: [],
        zone: raw.teamInfo?.zone || 'Unknown',
      },
      schedule: {
        shifts: [],
        changes: [],
      },
      additionalInfo: {
        comments: raw.additionalInfo?.comments || '',
        lastModified: raw.additionalInfo?.lastModified
          ? new Date(raw.additionalInfo.lastModified)
          : new Date(),
      },
      vehicle: typeof raw.vehicle === 'string' && ['Truck', 'Van', 'Escape', 'SUV'].includes(raw.vehicle)
        ? raw.vehicle
        : 'None',
      cantWorkWith: [],
    };

    try {
      const inserted = await Staff.create(doc);
      insertResults.push({ opertoId: doc.opertoId, _id: inserted._id });
    } catch (err) {
      console.error(`Failed inserting ${raw.name}: ${err.message}`);
    }
  }

  const idMap = new Map(insertResults.map(s => [s.opertoId, s._id]));

  for (const raw of rawStaffData) {
    const mongoId = idMap.get(raw.opertoId?.toString());
    if (!mongoId) continue;

    const memberIds = (raw.teamInfo?.members || [])
      .map(id => idMap.get(id.toString()))
      .filter(Boolean);

    const cantWorkWithIds = (raw.cantWorkWith || [])
      .map(id => idMap.get(id.toString()))
      .filter(Boolean);

    await Staff.updateOne(
      { _id: mongoId },
      {
        $set: {
          'teamInfo.members': memberIds,
          cantWorkWith: cantWorkWithIds,
        }
      }
    );
  }

  console.log(`Inserted and linked ${insertResults.length} staff members.`);
}
