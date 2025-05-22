/**
 * Groups tasks by their property zone.
 * This is a light clustering strategy that can be expanded later.
 *
 * @param {Array} tasks - List of task objects with embedded property data
 * @returns {Map<string, Array>} - A Map where key is zone name and value is list of tasks in that zone
 */

export function groupTasksByZone(tasks) {
    const zoneGroups = new Map();

    for (const task of tasks) {
        const zone = task.property?.zone || 'Unknown';
        if (!zoneGroups.has(zone)) {
            zoneGroups.set(zone, []);
        }
        zoneGroups.get(zone).push(task);
    }

    return zoneGroups;
}




/**
 *
 * @param {Array} tasks - List of task objects with embedded property data
 * @returns {Map<string, Array>} - Map of region to tasks
 */
export function groupTasksByRegion(tasks) {
    const regionGroups = new Map();

    for (const task of tasks) {
        const region = task.property?.region || 'Unknown';
        if (!regionGroups.has(region)) {
            regionGroups.set(region, []);
        }
        regionGroups.get(region).push(task);
    }

    return regionGroups;
}