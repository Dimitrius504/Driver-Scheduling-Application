import fs from 'fs';
import path from 'path';

export function processProperties(rawProperties) {
  const cleanAddress = (address) => address ? address.replace(/\s+/g, ' ').trim() : 'Unknown';
  const isIslandProperty = (name) => name?.toLowerCase().includes('island') || false;

  return rawProperties.map(property => {
    // Normalize region
    const regionName = typeof property.region === 'string' ? property.region : property.region?.regionName || 'Unknown';
    const regionGroup = typeof property.region === 'string' ? property.zone : 'Unknown Group';

    return {
      propertyId: property.propertyId,
      name: property.name?.trim() || 'Unnamed Property',
      address: cleanAddress(property.address),
      lat: property.lat || null,
      lon: property.lon || null,
      doorCode: property.doorCode?.trim() || "",
      zone: property.zone || regionName || 'Unknown',
      region: {
        regionName,
        regionGroup
      },
      isIsland: isIslandProperty(property.name),
      active: property.active,
      internalNotes: property.internalNotes?.trim() || "",

      ownerPreferences: {
        preferredTeamMembers: [],
        strictArrivalTime: false,
        notesForScheduler: ""
      },

      isPreferredTeam: false,
      preferredTeamMembers: [],
      hasRecurringTasks: false,
      taskTypeHistory: [],
      minExperienceLevel: isIslandProperty(property.name) ? "Elite" : "Any",
      notesForScheduler: "",
      assignedZone: "",
      distanceFromOffice: null,

      createdAt: property.createdAt 
        ? new Date(property.createdAt)
        : new Date(),

      updatedAt: new Date()
    };
  });
}
