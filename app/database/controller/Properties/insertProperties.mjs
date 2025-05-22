import fs from 'fs';
import path from 'path';
import Property from '../../models/properties.mjs';
import Staff from '../../models/staff.mjs';

const officeLat = 45.1183;
const officeLon = -79.57756;

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = deg => deg * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export async function insertProperties() {
  const rawProperties = JSON.parse(fs.readFileSync(path.resolve('../temp/processedProperties.json'), 'utf-8'));
  const allStaff = await Staff.find().lean();
  const opertoMap = new Map(allStaff.map(s => [parseInt(s.opertoId), s._id]));

  let updated = 0;
  let created = 0;

  for (const raw of rawProperties) {
    const region = raw.region?.regionName
      ? raw.region
      : {
          regionName: raw.zone || 'Unknown',
          regionGroup: 'Unknown Group'
        };

    const mapped = {
      propertyId: raw.propertyId,
      name: raw.name,
      address: raw.address,
      lat: raw.lat,
      lon: raw.lon,
      doorCode: raw.doorCode,
      zone: raw.zone,
      region,
      isIsland: raw.isIsland,
      ownerPreferences: {
        preferredTeamMembers: raw.ownerPreferences.preferredTeamMembers.map(id => opertoMap.get(id)).filter(Boolean),
        strictArrivalTime: raw.ownerPreferences.strictArrivalTime,
        notesForScheduler: raw.ownerPreferences.notesForScheduler,
      },
      isPreferredTeam: raw.isPreferredTeam,
      preferredTeamMembers: raw.preferredTeamMembers.map(id => opertoMap.get(id)).filter(Boolean),
      hasRecurringTasks: raw.hasRecurringTasks,
      taskTypeHistory: raw.taskTypeHistory,
      minExperienceLevel: raw.minExperienceLevel,
      notesForScheduler: raw.notesForScheduler,
      assignedZone: raw.assignedZone,
      distanceFromOffice: raw.lat && raw.lon ? haversineDistance(raw.lat, raw.lon, officeLat, officeLon) : null,
    };

    const existing = await Property.findOne({ propertyId: raw.propertyId });

    if (existing) {
      await Property.updateOne({ propertyId: raw.propertyId }, mapped);
      updated++;
    } else {
      await Property.create(mapped);
      created++;
    }
  }

  console.log(`Properties sync complete: ${created} created, ${updated} updated.`);
}
