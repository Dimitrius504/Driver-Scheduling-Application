import { officeCoords } from './constants.mjs';


export function groupAndSortTasks(taskList) {
    if (!Array.isArray(taskList)) return {};

    return taskList.reduce((acc, task) => {
        const day = task.date.toISOString().split('T')[0];
        if (!acc[day]) acc[day] = [];
        acc[day].push(task);
        // Sort by startTime within the day
        acc[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
        return acc;
    }, {});
}

export function groupTasksByZonePlain(taskList) {
    if (!Array.isArray(taskList)) return {};

    return taskList.reduce((acc, task) => {
        const zone = task.property?.zone || 'Unknown';
        if (!acc[zone]) acc[zone] = [];
        acc[zone].push(task);
        acc[zone] = sortTasksByDistanceFromOffice(acc[zone]);

        // Sort by date then startTime
        acc[zone].sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            if (dateA - dateB !== 0) {
                return dateA - dateB;
            }
            return a.startTime.localeCompare(b.startTime);
        });

        return acc;
    }, {});
}

export function haversineDistance(lat1, lon1, lat2, lon2) {
    if ([lat1, lon1, lat2, lon2].some(val => val === null || val === undefined || isNaN(val))) {
        console.warn('Invalid coordinates in haversineDistance:', { lat1, lon1, lat2, lon2 });
        return Infinity; // Use a large number so it's deprioritized in sorting
    }

    const R = 6371;
    const toRad = deg => deg * Math.PI / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}



export function sortTasksByDistanceFromOffice(tasks) {
    return [...tasks].sort((a, b) => {
        const dA = haversineDistance(officeCoords.lat, officeCoords.lon, a.property.lat, a.property.lon);
        const dB = haversineDistance(officeCoords.lat, officeCoords.lon, b.property.lat, b.property.lon);
        return dA - dB;
    });
}

export function detectScheduleConflicts(tasks, staffMap) {
    const conflicts = new Map();

    // Helper to safely add a conflict message
    function addConflict(taskId, message) {
        if (!conflicts.has(taskId)) {
            conflicts.set(taskId, new Set());
        }
        const existing = conflicts.get(taskId);
        if (existing instanceof Set) {
            existing.add(message);
        } else {
            const fixedSet = new Set(Array.isArray(existing) ? existing : []);
            fixedSet.add(message);
            conflicts.set(taskId, fixedSet);
        }
    }

    console.log('Verifying staffMap:');
    for (const [id, staff] of staffMap.entries()) {
        if (staff.cantWorkWith?.length) {
            console.log(`✅ ${staff.name} has cantWorkWith:`, staff.cantWorkWith.map(id => id.toString()));
        }
    }

    // --- Schedule-based conflicts (same day, same time)
    const byDate = tasks.reduce((acc, task) => {
        const date = task.date?.toISOString().split('T')[0];
        if (!acc[date]) acc[date] = [];
        acc[date].push(task);
        return acc;
    }, {});

    for (const date in byDate) {
        const tasksForDay = byDate[date].sort((a, b) => a.startTime.localeCompare(b.startTime));
        for (let i = 0; i < tasksForDay.length; i++) {
            const t1 = tasksForDay[i];
            for (let j = i + 1; j < tasksForDay.length; j++) {
                const t2 = tasksForDay[j];
                if (t1.startTime === t2.startTime) {
                    addConflict(String(t1._id), 'Scheduling Conflict');
                    addConflict(String(t2._id), 'Scheduling Conflict');
                }
            }
        }
    }

    // --- Staff "can't work with" conflicts
    for (const task of tasks) {
        const staffInTask = (task.assignedStaff || [])
            .map(s => staffMap.get(String(s._id)))
            .filter(Boolean);

        for (let i = 0; i < staffInTask.length; i++) {
            const s1 = staffInTask[i];
            const s1CantWorkWith = (s1.cantWorkWith || []).map(id => id.toString());
            for (let j = i + 1; j < staffInTask.length; j++) {
                const s2 = staffInTask[j];
                const s2CantWorkWith = (s2.cantWorkWith || []).map(id => id.toString());

                if (
                    s1CantWorkWith.includes(String(s2._id)) ||
                    s2CantWorkWith.includes(String(s1._id))
                ) {
                    addConflict(String(task._id), `Staff Conflict: ${s1.name} can’t work with ${s2.name}`);
                }
            }
        }
    }

    // --- Zone overlap: multiple drivers assigned to same zone and time
    const driversByDateTimeZone = {};

    for (const task of tasks) {
        const zone = task.property?.zone || 'Unknown';
        const dateStr = task.date?.toISOString().split('T')[0];
        const key = `${dateStr}|${task.startTime}|${zone}`;

        const assignedDrivers = (task.assignedStaff || []).map(String);

        for (const driverId of assignedDrivers) {
            if (!driverId || driverId === 'undefined') continue;

            if (!driversByDateTimeZone[key]) {
                driversByDateTimeZone[key] = new Map();
            }

            const driverMap = driversByDateTimeZone[key];

            if (driverMap.has(driverId)) {
                const conflictingTask = driverMap.get(driverId);
                const driver = staffMap.get(driverId);
                const zoneLabel = zone || 'Unknown Zone';

                console.log(`⚠️ Zone Conflict for ${driver?.name} in ${zoneLabel} at ${task.startTime}`);

                addConflict(String(task._id), `Zone Conflict: ${driver?.name || 'Driver'} already assigned in ${zoneLabel}`);
                addConflict(String(conflictingTask._id), `Zone Conflict: ${driver?.name || 'Driver'} already assigned in ${zoneLabel}`);
            } else {
                driverMap.set(driverId, task);
            }
        }
    }

    const tasksByDriverDate = new Map();

    for (const task of tasks) {
        const driverIds = (task.assignedStaff || []).map(id => String(id));
        const dateStr = task.date?.toISOString().split('T')[0];

        for (const driverId of driverIds) {
            const key = `${driverId}|${dateStr}`;
            if (!tasksByDriverDate.has(key)) {
                tasksByDriverDate.set(key, []);
            }
            tasksByDriverDate.get(key).push(task);
        }
    }

    // Analyze inefficient driving patterns
    for (const [key, taskList] of tasksByDriverDate.entries()) {
        const [driverId, dateStr] = key.split('|');
        const driver = staffMap.get(driverId);
        const sortedTasks = [...taskList].sort((a, b) => a.startTime.localeCompare(b.startTime));

        let totalBounceDistance = 0;
        let bouncePoints = [];

        for (let i = 1; i < sortedTasks.length - 1; i++) {
            const prev = sortedTasks[i - 1];
            const current = sortedTasks[i];
            const next = sortedTasks[i + 1];

            // Compare current tasks location with previous and next
            const toPrev = haversineDistance(
                current.property.lat, current.property.lon,
                prev.property.lat, prev.property.lon
            );

            const toNext = haversineDistance(
                current.property.lat, current.property.lon,
                next.property.lat, next.property.lon
            );

            const returnDistance = haversineDistance(
                prev.property.lat, prev.property.lon,
                next.property.lat, next.property.lon
            );

            // If total trip would have been shorter by skipping 'current', flag it
            if (toPrev + toNext > returnDistance + 10) { // 10km margin
                const extraDistance = (toPrev + toNext - returnDistance);

                totalBounceDistance += extraDistance;
                
                // Attach metadata to the bounce task
                bouncePoints.push({
                    task: current,
                    problemProperty: current.property?.name || 'Unknown Property',
                    extraDistance: extraDistance.toFixed(1),
                    prev: prev.property?.name,
                    next: next.property?.name
                });
                
            }
        }

        if (bouncePoints.length) {
            for (const bounce of bouncePoints) {
                const t = bounce.task;
                const driver = (t.assignedStaff || [])[0];
            
                const message = `Routing Conflict: ${driver?.name || 'Driver'} travels inefficiently to "${bounce.problemProperty}" (+${bounce.extraDistance} km vs direct from "${bounce.prev}" to "${bounce.next}")`;
            
                addConflict(String(t._id), message);
                console.log('Routing Conflict:', message);
            }
            

            console.log(`Routing conflict for ${driver?.name} on ${dateStr}. Extra km: ${totalBounceDistance.toFixed(2)}`);
        }
    }


    // Convert sets to arrays for frontend
    const cleanConflicts = new Map();
    for (const [taskId, conflictSet] of conflicts.entries()) {
        cleanConflicts.set(taskId, Array.from(conflictSet));
    }

    console.log('Final conflicts for frontend:', Object.fromEntries(cleanConflicts.entries()));
    return cleanConflicts;
}
