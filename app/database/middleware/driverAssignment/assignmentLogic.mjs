import {
    driverRelevantCategories,
    driverKeywords,
    driverExclusions,
    largeVehicleTypes
} from './constants.mjs';

import { logInfo } from './logger.mjs';

import {
    groupTasksByZone
} from './clusteringLogic.mjs';

import { smartLoadBalance } from './loadBalancingLogic.mjs';

import { groupAndSortTasks, groupTasksByZonePlain, detectScheduleConflicts } from './utils.mjs';
import { logAssign, logInclude } from './logger.mjs';

export function assignTasksToDrivers(tasks, drivers, allStaff, allTaskRules, populatedTasksForConflicts = []) {
    const taskRulesMap = new Map(allTaskRules.map(rule => [rule.taskRuleId, rule]));
    const staffMap = new Map(allStaff.map(s => [String(s._id), s]));

    const assignments = drivers.map(driver => ({ driver, tasks: [] }));
    const availableDrivers = [...drivers];
    const unassignedTasks = [];

    for (const task of tasks) {
        const rule = taskRulesMap.get(task.taskRuleId?.taskRuleId || task.taskRuleId);
        const taskNameLower = task.taskName.toLowerCase().replace(/\s+/g, ' ');

        const nameSuggestsDriverTask = driverKeywords.some(k => taskNameLower.includes(k));
        const nameSuggestsNonDriverTask = driverExclusions.some(k => taskNameLower.includes(k));
        const isDriverTask =
            task.requiresPickup ||
            (rule && driverRelevantCategories.includes(rule.category)) ||
            (nameSuggestsDriverTask && !nameSuggestsNonDriverTask);



        const assignedStaffObjs = task.assignedStaff.map(id => staffMap.get(String(id))).filter(Boolean);

        const alreadyHasDriver = assignedStaffObjs.some(s => s?.roles.includes('Driver'));
        if (alreadyHasDriver) {
            logInfo(`Skipping driver assignment for "${task.taskName}" — driver already assigned.`);
            continue; // Skip assigning a new driver
        }

        logInfo(`🧹 Evaluating task: ${task.taskName} (${task._id}) on ${task.date}`);

        const needsDriverSupport = assignedStaffObjs.length > 0 && !assignedStaffObjs.some(s => s?.roles.includes('Driver'));

        const isLinenOrSupplyTask = task.requiresLinens || task.requiresSupplies;

        let assignedToDriver = false;

        const driverIds = new Set(drivers.map(d => String(d._id)));
        task.driverId = task.assignedStaff.find(id => driverIds.has(String(id))) || null;

        for (const staffId of task.assignedStaff || []) {
            const assignedDriver = drivers.find(d => d._id.equals(staffId));
            if (assignedDriver) {
                const driverAssignment = assignments.find(a => a.driver._id.equals(assignedDriver._id));
                if (driverAssignment && !driverAssignment.tasks.some(t => t._id.equals(task._id))) {
                    driverAssignment.tasks.push(task);
                    logInclude(task.taskName, assignedDriver.name);
                    assignedToDriver = true;
                }
            }
        }

        if ((isDriverTask || needsDriverSupport) && !assignedToDriver) {
            const taskZone = task.property?.zone || 'Unknown';

            let driver =
                availableDrivers
                    .filter(d => d.zone === taskZone && ((!isLinenOrSupplyTask || !d.vehicle || largeVehicleTypes.includes(d.vehicle))
                    ))
                    .sort((a, b) =>
                        assignments.find(x => x.driver._id.equals(a._id))?.tasks.length - assignments.find(x => x.driver._id.equals(b._id))?.tasks.length
                    )[0] ||
                availableDrivers
                    .filter(d => (!isLinenOrSupplyTask || !d.vehicle || largeVehicleTypes.includes(d.vehicle)))
                    .sort((a, b) =>
                        assignments.find(x => x.driver._id.equals(a._id))?.tasks.length - assignments.find(x => x.driver._id.equals(b._id))?.tasks.length
                    )[0] ||
                drivers
                    .filter(d => (!isLinenOrSupplyTask || !d.vehicle || largeVehicleTypes.includes(d.vehicle))
                    )
                    .sort((a, b) =>
                        assignments.find(x => x.driver._id.equals(a._id))?.tasks.length - assignments.find(x => x.driver._id.equals(b._id))?.tasks.length
                    )[0];

            if (driver) {
                const driverAssignment = assignments.find(a => a.driver._id.equals(driver._id));
                driverAssignment.tasks.push(task);
                logAssign(task.taskName, driver.name, driver.vehicle);
                const idx = availableDrivers.findIndex(d => d._id.equals(driver._id));
                if (idx !== -1) availableDrivers.splice(idx, 1);
                assignedToDriver = true;
            }

            if (!driver) {
                console.warn(`No available driver found for "${task.taskName}" in zone ${taskZone}. Linen/Supply? ${isLinenOrSupplyTask}`);
                console.log(`Available drivers in zone ${taskZone}:`);
                availableDrivers
                    .filter(d => {
                        const allowed = !isLinenOrSupplyTask || largeVehicleTypes.includes(d.vehicle);
                        if (!allowed && d.zone === taskZone) {
                            console.warn(`⚠️ Excluding ${d.name} (${d.vehicle}) from "${task.taskName}" because of vehicle size`);
                        }
                        return d.zone === taskZone && allowed;
                    })

            }


        }

        if (!assignedToDriver) {
            unassignedTasks.push(task);
        }
    }

    // Detect global conflicts based on full populated task list
    const mergedConflictsMap = detectScheduleConflicts(populatedTasksForConflicts, staffMap);
    const mergedConflicts = Object.fromEntries(mergedConflictsMap);

    const assignmentsWithConflicts = assignments.map(a => ({
        driver: a.driver,
        tasks: a.tasks,
        tasksByZone: groupTasksByZonePlain(a.tasks),
        tasksByDate: groupAndSortTasks(a.tasks)
    }));

    return {
        assignments: assignmentsWithConflicts,
        unassignedTasks,
        mergedConflicts
    };
}