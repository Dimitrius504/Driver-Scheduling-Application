import express from 'express';
import { generateScheduleForDate } from '../database/middleware/driverAssignment/index.mjs'
import Tasks from '../database/models/tasks.mjs';
import Staff from '../database/models/staff.mjs';
import Schedules from '../database/models/schedules.mjs';
import { officeCoords } from '../database/middleware/driverAssignment/constants.mjs';
import ExcelJS from 'exceljs';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak } from 'docx';
import archiver from 'archiver';


import { haversineDistance } from '../database/middleware/driverAssignment/utils.mjs';
const router = express.Router();

router.get('/', async (req, res) => {
    const { date } = req.query;
    const selectedDate = date ? new Date(date) : new Date();

    try {
        const { assignments, unassignedByDate, staffAssignments } = await generateScheduleForDate(selectedDate);
        console.log("/ Route")
        res.render('schedule/index', {
            assignments,
            unassignedByDate,
            staffAssignments,
            selectedDate: selectedDate.toISOString().split('T')[0],
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Failed to generate schedule');
    }
});

router.get('/driver-schedule', async (req, res) => {
    const { week } = req.query;
    const startDate = week
        ? new Date(`${week}T00:00:00`)
        : new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 7);

    try {
        const { assignments, unassignedByDate, staffAssignments, allStaff, drivers, mergedConflicts } = await generateScheduleForDate(startDate, endDate);
        const driversOnly = allStaff.filter(s => s.roles.includes('Driver'));

        console.log("/driver-schedule Route")
        allStaff.forEach(s => {
            if (s.cantWorkWith?.length) {
                console.log(`${s.name} can't work with`, s.cantWorkWith);
            }
        });

        res.render('schedule/driver-schedule', {
            schedule: {
                assignments,
                unassignedByDate,
                staffAssignments,
                staffMap: Object.fromEntries(allStaff.map(s => [String(s._id), s])),
                drivers: driversOnly,
                conflicts: mergedConflicts,
                staff: allStaff
            },
            selected: { week }
        });


    } catch (err) {
        console.error(err);
        res.status(500).send('Failed to generate driver schedule');
    }
});

// Save updated driver schedule for the week
router.post('/driver-schedule/save', async (req, res) => {
    const { assignments, scheduleWeekStart } = req.body;

    if (!Array.isArray(assignments) || !scheduleWeekStart) {
        return res.status(400).json({ error: 'Invalid payload' });
    }

    console.log("/driver-schedule/save Route")

    try {
        for (const assignment of assignments) {
            const driverId = assignment.driverId;
            for (const taskId of assignment.taskIds) {
                await Tasks.updateOne(
                    { _id: taskId },
                    {
                        $set: {
                            assignedDriver: driverId,
                            scheduleWeekStart: new Date(scheduleWeekStart)
                        }
                    }
                );
            }
        }

        res.json({ success: true, message: 'Driver assignments saved successfully.' });
    } catch (err) {
        console.error('Save failed:', err);
        res.status(500).json({ error: 'Failed to save schedule.' });
    }
});

router.post('/update-driver', async (req, res) => {
    const { taskId, driverId, week } = req.body;

    try {
        const task = await Tasks.findById(taskId);
        if (!task) {
            return res.status(404).send('Task not found');
        }

        console.log("/update-driver Route")
        // Remove existing drivers from the staff array
        const driversOnly = await Staff.find({ roles: 'Driver' });
        const driverIds = driversOnly.map(d => d._id.toString());

        // Remove old driver(s), then add the new one
        task.assignedStaff = task.assignedStaff
            .filter(id => !driverIds.includes(id.toString()))
            .concat(driverId); // ensure new driver is added

        await task.save();

        const redirectUrl = week
            ? `/schedule/driver-schedule?week=${encodeURIComponent(week)}`
            : '/schedule/driver-schedule';

        res.redirect(redirectUrl);
    } catch (err) {
        console.error('Driver update failed', err);
        res.status(500).send('Failed to update driver assignment');
    }
});


router.post('/assign-driver', async (req, res) => {
    const { taskId, driverId, reason, week } = req.body;

    if (!taskId || !driverId || !reason) {
        return res.status(400).send('Missing data for driver assignment');
    }

    try {
        const task = await Tasks.findById(taskId);
        console.log("/assign-driver Route")
        // Avoid duplicate assignments
        if (!task.assignedStaff.includes(driverId)) {
            task.assignedStaff.push(driverId);
        }

        // Save the reason
        task.driverAssignmentReason = reason;

        await task.save();

        const redirectUrl = week
            ? `/schedule/driver-schedule?week=${encodeURIComponent(week)}`
            : '/schedule/driver-schedule';

        console.log('week', redirectUrl)
        res.redirect(redirectUrl);
    } catch (err) {
        console.error('Failed to assign driver:', err);
        res.status(500).send('Driver assignment failed');
    }
});


router.post('/remove-driver', async (req, res) => {
    const { taskId, driverId, week } = req.body;

    if (!taskId || !driverId) {
        return res.status(400).send('Missing required data');
    }

    try {
        console.log("/remove-driver Route")
        await Tasks.updateOne(
            { _id: taskId },
            {
                $pull: { assignedStaff: driverId },
                $unset: { driverAssignmentReason: "" }
            }
        );

        const redirectUrl = week
            ? `/schedule/driver-schedule?week=${encodeURIComponent(week)}`
            : '/schedule/driver-schedule';

        res.redirect(redirectUrl);
    } catch (err) {
        console.error('Driver removal failed:', err);
        res.status(500).send('Failed to remove driver');
    }
});


// SCHEDULES FROM MONGODB
router.get('/driver-reports', async (req, res) => {
    try {
        const schedules = await Schedules.find({})
            .sort({ weekStart: 1 })
            .populate('daySchedules.assignments.taskId', 'taskName date startTime property driverAssignmentReason')
            .populate('daySchedules.assignments.driverId', 'name')
            .populate('daySchedules.unassignedTasks', 'taskName date startTime property')
            .lean();

        // After schedules are fetched and populated
        for (const schedule of schedules) {
            for (const day of schedule.daySchedules) {
                if (day.assignments?.length) {
                    day.assignments.sort((a, b) => {
                        const nameA = a.driverId?.name?.toLowerCase() || '';
                        const nameB = b.driverId?.name?.toLowerCase() || '';
                        return nameA.localeCompare(nameB);
                    });
                }
            }
        }

        const zones = new Set();
        const drivers = new Set();

        schedules.forEach(schedule => {
            schedule.daySchedules.forEach(day => {
                day.assignments.forEach(assignment => {
                    if (assignment.taskId?.property?.zone) zones.add(assignment.taskId.property.zone);
                    if (assignment.driverId?.name) drivers.add(assignment.driverId.name);
                });
            });
        });

        res.render('reports/driver-report', {
            schedules,
            zones: [...zones].sort(),
            drivers: [...drivers].sort(),
        });

    } catch (err) {
        console.error('Failed to load driver reports:', err);
        res.status(500).send('Error loading reports');
    }
});



router.post('/sort-tasks', async (req, res) => {
    const { week } = req.body;
    if (!week) return res.status(400).send('Missing week');

    try {
        const startDate = new Date(week);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 7);

        const {
            assignments,
            unassignedByDate,
            staffAssignments,
            allStaff,
            drivers,
            mergedConflicts
        } = await generateScheduleForDate(startDate, endDate);

        const driversOnly = allStaff.filter(s => s.roles.includes('Driver'));
        const allTasks = new Map();

        // Collect every task
        assignments.forEach(a =>
            Object.values(a.tasksByZone || {}).flat().forEach(t => allTasks.set(String(t._id), t))
        );
        Object.values(unassignedByDate || {}).flat().forEach(t => allTasks.set(String(t._id), t));
        staffAssignments.forEach(s =>
            Object.values(s.tasksByDate || {}).flat().forEach(t => allTasks.set(String(t._id), t))
        );

        // Group by date
        const tasksByDate = Array.from(allTasks.values()).reduce((acc, task) => {
            const rawDate = new Date(task.date);
            if (isNaN(rawDate)) return acc;
            const dateStr = rawDate.toISOString().split('T')[0];
            if (!acc[dateStr]) acc[dateStr] = [];
            acc[dateStr].push(task);
            return acc;
        }, {});

        // Clear all assignments
        for (const task of allTasks.values()) {
            task.assignedStaff = [];
        }

        // Assign tasks efficiently by date
        const driverTaskMap = new Map();

        for (const [dateStr, tasks] of Object.entries(tasksByDate)) {
            const driverLoad = driversOnly.map(driver => ({
                driver,
                tasks: [],
                totalDistance: 0
            }));

            for (const task of tasks) {
                const best = driverLoad.reduce((best, entry) => {
                    const last = entry.tasks.at(-1);
                    const dist = last
                        ? haversineDistance(last.property.lat, last.property.lon, task.property.lat, task.property.lon)
                        : haversineDistance(officeCoords.lat, officeCoords.lon, task.property.lat, task.property.lon);
                    return (dist + entry.totalDistance < best.score)
                        ? { score: dist + entry.totalDistance, entry }
                        : best;
                }, { score: Infinity, entry: null });

                const chosen = best.entry;
                if (chosen) {
                    chosen.tasks.push(task);
                    chosen.totalDistance += best.score;
                    task.assignedStaff = [chosen.driver._id];
                    task.driverId = chosen.driver._id;

                    const id = chosen.driver._id.toString();
                    if (!driverTaskMap.has(id)) driverTaskMap.set(id, []);
                    driverTaskMap.get(id).push(task);
                }
            }
        }

        // Handle conflicts (>= 2) and reassign to idle drivers
        const conflictMap = mergedConflicts || {};
        const taskList = Array.from(allTasks.values());
        const idleDrivers = driversOnly.filter(d => !driverTaskMap.has(d._id.toString()));

        for (const task of taskList) {
            const taskId = String(task._id);
            const conflicts = conflictMap[taskId];
            const currentDriverId = (task.assignedStaff || [])[0]?.toString();

            if (conflicts?.length >= 2 && currentDriverId) {
                const replacement = idleDrivers[0];
                if (replacement) {
                    task.assignedStaff = [replacement._id];
                    driverTaskMap.set(replacement._id.toString(), [task]);
                    idleDrivers.shift();
                }
            }
        }

        // Optimize route order per driver
        const sortedAssignments = [];
        for (const [driverId, tasks] of driverTaskMap.entries()) {
            const driver = allStaff.find(s => s._id.toString() === driverId);
            const tasksGroupedByDate = tasks.reduce((acc, task) => {
                const dateStr = new Date(task.date).toISOString().split('T')[0];
                if (!acc[dateStr]) acc[dateStr] = [];
                acc[dateStr].push(task);
                return acc;
            }, {});

            for (const dayTasks of Object.values(tasksGroupedByDate)) {
                const remaining = [...dayTasks];
                const sortedDay = [];

                let current = remaining.splice(
                    remaining.findIndex(t => t.property?.lat && t.property?.lon) || 0, 1
                )[0] || null;
                if (!current) continue;
                sortedDay.push(current);

                while (remaining.length > 0) {
                    const last = sortedDay.at(-1);
                    const nextIndex = remaining.reduce((closestIdx, task, idx) => {
                        const distToCurrent = haversineDistance(
                            last.property.lat, last.property.lon,
                            task.property.lat, task.property.lon
                        );
                        const distToClosest = haversineDistance(
                            last.property.lat, last.property.lon,
                            remaining[closestIdx].property.lat,
                            remaining[closestIdx].property.lon
                        );
                        return distToCurrent < distToClosest ? idx : closestIdx;
                    }, 0);
                    const next = remaining.splice(nextIndex, 1)[0];
                    sortedDay.push(next);
                }

                sortedAssignments.push(...sortedDay);
            }
        }

        // Group by driver & zone for rendering
        const groupedAssignments = driversOnly.map(driver => {
            const driverTasks = sortedAssignments.filter(t =>
                t.assignedStaff?.some(s => s.toString() === driver._id.toString())
            );

            const tasksByZone = driverTasks.reduce((acc, task) => {
                const zone = task.property?.zone || 'Unknown';
                if (!acc[zone]) acc[zone] = [];
                acc[zone].push(task);
                return acc;
            }, {});

            return {
                driver,
                tasksByZone
            };
        });

        res.render('schedule/driver-schedule', {
            schedule: {
                assignments: groupedAssignments,
                unassignedByDate,
                staffAssignments,
                staffMap: Object.fromEntries(allStaff.map(s => [String(s._id), s])),
                drivers: driversOnly,
                conflicts: mergedConflicts
            },
            selected: { week }
        });

    } catch (err) {
        console.error('Sort task error:', err);
        res.status(500).send('Failed to sort tasks');
    }
});

router.post('/save-sorted-schedule', async (req, res) => {
    const { week, assignmentsJson, mergedConflicts } = req.body;

    if (!week || !assignmentsJson) {
        return res.status(400).send('Missing week or assignments');
    }

    try {
        const [year, month, day] = week.split('-');
        const weekStart = new Date(Number(year), Number(month) - 1, Number(day)); // Safe local parsing
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        console.log('Original Week Param:', week);
        console.log('Interpreted weekStart:', weekStart.toISOString());


        const assignments = JSON.parse(assignmentsJson);

        // Update individual tasks
        for (const { taskId, driverId } of assignments) {
            const existingTask = await Tasks.findById(taskId).select('assignedStaff');

            await Tasks.updateOne(
                { _id: taskId },
                {
                    $set: {
                        assignedDriver: driverId,
                        scheduleWeekStart: weekStart,
                        assignedStaff: existingTask?.assignedStaff || []
                    }
                }
            );

        }

        // Build daySchedules from updated tasks
        const taskIds = assignments.map(a => a.taskId);
        const tasks = await Tasks.find({ _id: { $in: taskIds } }).populate('property').populate('assignedStaff').lean();
        const taskMap = new Map(tasks.map(t => [String(t._id), t]));
        const dayMap = new Map();

        for (const { taskId, driverId } of assignments) {
            const task = taskMap.get(taskId);
            if (!task) continue;

            const taskDate = new Date(task.date);
            taskDate.setHours(0, 0, 0, 0); // Normalize to local midnight

            const dateStr = taskDate.toISOString().split('T')[0];
            if (!dayMap.has(dateStr)) {
                dayMap.set(dateStr, { date: taskDate, assignments: [], unassignedTasks: [] });
            }

            dayMap.get(dateStr).assignments.push({
                taskId,
                driverId,
                reason: task.driverAssignmentReason || undefined
            });
        }

        const daySchedules = Array.from(dayMap.values()).sort((a, b) => a.date - b.date);

        const allDriverIds = Array.from(new Set(assignments.map(a => a.driverId)));
        const allStaff = await Staff.find({ _id: { $in: allDriverIds } });

        // Remove duplicate weeks
        const duplicates = await Schedules.aggregate([
            {
                $group: {
                    _id: "$weekStart",
                    ids: { $push: "$_id" },
                    count: { $sum: 1 }
                }
            },
            { $match: { count: { $gt: 1 } } }
        ]);

        for (const dup of duplicates) {
            const schedules = await Schedules.find({ _id: { $in: dup.ids } }).sort({ updatedAt: -1 });
            const [keep, ...remove] = schedules;
            await Schedules.deleteMany({ _id: { $in: remove.map(r => r._id) } });
        }

        const savedSchedule = await Schedules.findOneAndUpdate(
            { weekStart },
            {
                weekStart,
                weekEnd,
                daySchedules,
                staff: allStaff.map(s => s._id),
                createdBy: req.user?._id || null,
                conflicts: mergedConflicts,
            },
            { upsert: true, new: true }
        );

        res.redirect(`/schedule/driver-reports/${savedSchedule._id}`);
    } catch (err) {
        console.error('❌ Failed to save sorted schedule:', err);
        res.status(500).send('Failed to save schedule');
    }
});

router.get('/driver-reports/:id', async (req, res) => {
    try {
        const schedule = await Schedules.findById(req.params.id).lean();
        if (!schedule) return res.status(404).send('Schedule not found');

        const startDate = new Date(schedule.weekStart);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);
        endDate.setHours(0, 0, 0, 0);

        const { mergedConflicts } = await generateScheduleForDate(startDate, endDate);

        const taskIds = schedule.daySchedules.flatMap(day => day.assignments.map(a => a.taskId));

        // Get tasks with populated property and assignedStaff
        const fullTasks = await Tasks.find({ _id: { $in: taskIds } })
            .populate('property')
            .populate('assignedStaff')
            .lean();

        const taskMap = Object.fromEntries(fullTasks.map(t => [String(t._id), t]));

        // Collect all staff IDs from the schedule for driver dropdown
        const assignedIds = new Set(
            schedule.staff.map(s => typeof s === 'object' ? String(s._id) : String(s))
        );

        // Load full staff list for dropdown
        const allStaff = await Staff.find({ _id: { $in: Array.from(assignedIds) } }).lean();
        const staffMap = Object.fromEntries(allStaff.map(s => [String(s._id), s]));

        for (const day of schedule.daySchedules) {
            const seenTasks = new Set();
            const removedTasks = [];

            day.assignments = day.assignments.filter(assignment => {
                const task = taskMap[assignment.taskId];
                if (!task) return false;

                const key = `${task.taskName}-${task.property?.name}-${task.startTime}`;
                if (seenTasks.has(key)) {
                    removedTasks.push({
                        taskName: task.taskName,
                        propertyName: task.property?.name,
                        startTime: task.startTime,
                        assignmentId: assignment._id || 'NoAssignmentID'
                    });
                    return false;
                }

                seenTasks.add(key);
                assignment.task = task;
                return true;
            });

            // Sort by startTime ascending
            day.assignments.sort((a, b) => {
                const timeA = a.task?.startTime ?? '';
                const timeB = b.task?.startTime ?? '';
                return timeA.localeCompare(timeB);
            });


            if (removedTasks.length > 0) {
                console.log(`🛑 Removed duplicate tasks for day ${day.date}:`);
                removedTasks.forEach(t => {
                    console.log(`- Task "${t.taskName}" at "${t.propertyName}" @ ${t.startTime} (AssignmentID: ${t.assignmentId})`);
                });
            }
        }

        // Replace schedule.staff with full records
        schedule.staff = allStaff.sort((a, b) => a.name.localeCompare(b.name));
        schedule.staffMap = staffMap;

        schedule.conflicts = mergedConflicts;

        res.render('schedule/view', { schedule });
    } catch (err) {
        console.error("❌ Error loading driver report:", err);
        res.status(500).send('Error loading report');
    }
});


router.post('/update-task', async (req, res) => {
    const { taskId, driverId, startTime, reason, week, scheduleId } = req.body;

    try {
        await Tasks.updateOne(
            { _id: taskId },
            {
                $set: {
                    assignedDriver: driverId || null,
                    startTime,
                    driverAssignmentReason: reason || null,
                }
            }
        );

        res.redirect(`/schedule/driver-reports/${scheduleId}`);
    } catch (err) {
        console.error("❌ Failed to update task:", err);
        res.status(500).send('Error updating task');
    }
});


router.get('/driver-reports/:id/export', async (req, res) => {
    try {
        const schedule = await Schedules.findById(req.params.id).lean();
        if (!schedule) return res.status(404).send('Schedule not found');

        const taskIds = schedule.daySchedules.flatMap(day => day.assignments.map(a => a.taskId));
        const tasks = await Tasks.find({ _id: { $in: taskIds } }).populate('property').lean();
        const taskMap = Object.fromEntries(tasks.map(t => [String(t._id), t]));

        // Collect ALL staff IDs (drivers + assignedStaff)
        const allStaffIds = new Set(schedule.staff.map(id => String(id)));
        for (const task of tasks) {
            (task.assignedStaff || []).forEach(id => allStaffIds.add(String(id)));
        }

        const staff = await Staff.find({ _id: { $in: Array.from(allStaffIds) } }).lean();
        const staffMap = Object.fromEntries(staff.map(s => [String(s._id), s.name]));

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Driver Schedule');

        sheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Driver', key: 'driver', width: 25 },
            { header: 'Task Name', key: 'taskName', width: 30 },
            { header: 'Property', key: 'property', width: 25 },
            { header: 'Zone', key: 'zone', width: 15 },
            { header: 'Address', key: 'address', width: 15 },
            { header: 'Time', key: 'startTime', width: 12 },
            { header: 'Assigned Staff', key: 'assignedStaff', width: 35 },
            { header: 'Reason', key: 'reason', width: 30 },
        ];

        for (const day of schedule.daySchedules) {
            for (const assignment of day.assignments) {
                const task = taskMap[assignment.taskId];
                if (!task) continue;

                sheet.addRow({
                    date: new Date(day.date).toISOString().split('T')[0],
                    driver: staffMap[String(assignment.driverId)] || '[Unknown Driver]',
                    taskName: task.taskName,
                    property: task.property?.name || '',
                    zone: task.property?.zone || '',
                    address: task.property?.address,
                    startTime: task.startTime,
                    assignedStaff: (task.assignedStaff || []).map(id => staffMap[String(id)] || '[Unknown]').join(', '),
                    reason: assignment.reason || '',
                });
            }
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Driver-Schedule-${schedule.weekStart.toISOString().split('T')[0]}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('❌ Excel export failed:', err);
        res.status(500).send('Failed to generate Excel file');
    }
});

router.get('/driver-reports/:id/export-driver', async (req, res) => {
    const { driverId } = req.query;

    if (!driverId) return res.status(400).send('Missing driver ID');

    try {
        const schedule = await Schedules.findById(req.params.id).lean();
        if (!schedule) return res.status(404).send('Schedule not found');

        const taskIds = schedule.daySchedules.flatMap(day => day.assignments.map(a => a.taskId));
        const tasks = await Tasks.find({ _id: { $in: taskIds } }).populate('property').lean();
        const taskMap = Object.fromEntries(tasks.map(t => [String(t._id), t]));

        // Build a full staff map (drivers + assigned)
        const allStaffIds = new Set(schedule.staff.map(id => String(id)));
        for (const task of tasks) {
            (task.assignedStaff || []).forEach(id => allStaffIds.add(String(id)));
        }

        const staff = await Staff.find({ _id: { $in: Array.from(allStaffIds) } }).lean();
        const staffMap = Object.fromEntries(staff.map(s => [String(s._id), s.name]));

        const driver = staff.find(s => String(s._id) === String(driverId));
        if (!driver) return res.status(404).send('Driver not found');

        const workbook = new ExcelJS.Workbook();
        const sanitizedName = (driver.name + ' Schedule').replace(/[*?:\\/\[\]]/g, '');
        const sheet = workbook.addWorksheet(sanitizedName || 'DriverSchedule');

        sheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Task Name', key: 'taskName', width: 30 },
            { header: 'Property', key: 'property', width: 25 },
            { header: 'Zone', key: 'zone', width: 15 },
            { header: 'Address', key: 'address', width: 30 },
            { header: 'Time', key: 'startTime', width: 12 },
            { header: 'Assigned Staff', key: 'assignedStaff', width: 35 },
            { header: 'Reason', key: 'reason', width: 30 },
        ];

        for (const day of schedule.daySchedules) {
            for (const assignment of day.assignments) {
                if (String(assignment.driverId) !== String(driverId)) continue;

                const task = taskMap[assignment.taskId];
                if (!task) continue;

                sheet.addRow({
                    date: new Date(day.date).toISOString().split('T')[0],
                    taskName: task.taskName,
                    property: task.property?.name || '',
                    zone: task.property?.zone || '',
                    address: task.property?.address,
                    startTime: task.startTime,
                    assignedStaff: (task.assignedStaff || []).map(id => staffMap[String(id)] || '[Unknown]').join(', '),
                    reason: assignment.reason || '',
                });
            }
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${driver.name.replace(/\s+/g, '_')}-Schedule-${schedule.weekStart.toISOString().split('T')[0]}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('❌ Driver Excel export failed:', err);
        res.status(500).send('Failed to generate driver report');
    }
});

router.post('/update-or-delete-task', async (req, res) => {
    let { taskId, scheduleId, driverId, startTime, reason, pickupDropoff, requiresLinens, requiresSupplies, action, assignedStaff } = req.body;

    if (Array.isArray(scheduleId)) scheduleId = scheduleId[0];
    if (scheduleId.includes(',')) scheduleId = scheduleId.split(',')[0];

    try {
        if (action === 'delete') {
            // Delete task and remove from schedule
            await Tasks.deleteOne({ _id: taskId });
            await Schedules.updateOne(
                { _id: scheduleId },
                { $pull: { 'daySchedules.$[].assignments': { taskId } } }
            );
            console.log(`Deleted task ${taskId}`);
        } else {
            // Carefully update everything
            const updateFields = {
                assignedDriver: driverId || null,
                startTime,
                driverAssignmentReason: reason || null,
                assignedStaff
            };

            // Only update these if they exist in the form
            if (pickupDropoff !== undefined) updateFields.pickupDropoff = pickupDropoff || '';
            if (requiresLinens !== undefined) updateFields.requiresLinens = requiresLinens === 'true';
            if (requiresSupplies !== undefined) updateFields.requiresSupplies = requiresSupplies === 'true';

            await Tasks.updateOne(
                { _id: taskId },
                { $set: updateFields }
            );

            console.log(`Saved task ${taskId}`, updateFields);
        }

        res.redirect(`/schedule/driver-reports/${scheduleId}`);
    } catch (err) {
        console.error("Failed to update/delete task:", err);
        res.status(500).send('Error processing task');
    }
});

router.get('/driver-reports/:id/export-bundle', async (req, res) => {
    try {
        const schedule = await Schedules.findById(req.params.id).lean();
        if (!schedule) return res.status(404).send('Schedule not found');

        const taskIds = schedule.daySchedules.flatMap(day => day.assignments.map(a => a.taskId));
        const tasks = await Tasks.find({ _id: { $in: taskIds } }).populate('property').lean();
        const taskMap = Object.fromEntries(tasks.map(t => [String(t._id), t]));

        const allStaffIds = new Set(schedule.staff.map(id => String(id)));
        for (const task of tasks) {
            if (Array.isArray(task.assignedStaff)) {
                task.assignedStaff.forEach(id => allStaffIds.add(String(id)));
            }
        }

        const staff = await Staff.find({ _id: { $in: Array.from(allStaffIds) } }).lean();
        const staffMap = Object.fromEntries(staff.map(s => [String(s._id), s.name]));

        const to12Hour = (timeStr) => {
            if (!timeStr) return 'No Time';
            const [h, m] = timeStr.split(':').map(Number);
            const date = new Date();
            date.setHours(h, m || 0);
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        };

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Driver Schedule');
        sheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Driver', key: 'driver', width: 25 },
            { header: 'Task Name', key: 'taskName', width: 30 },
            { header: 'Property', key: 'property', width: 25 },
            { header: 'Zone', key: 'zone', width: 15 },
            { header: 'Time', key: 'startTime', width: 12 },
            { header: 'Assigned Staff', key: 'assignedStaff', width: 30 },
            { header: 'Reason', key: 'reason', width: 30 },
        ];

        for (const day of schedule.daySchedules) {
            for (const assignment of day.assignments) {
                const task = taskMap[assignment.taskId];
                if (!task) continue;

                const driverName = staffMap[String(assignment.driverId)] || '[Unknown Driver]';
                const assignedStaffNames = (task.assignedStaff || []).map(id => staffMap[String(id)] || '[Unknown]').join(', ');

                sheet.addRow({
                    date: new Date(day.date).toISOString().split('T')[0],
                    driver: driverName,
                    taskName: task.taskName,
                    property: task.property?.name || '',
                    zone: task.property?.zone || '',
                    startTime: to12Hour(task.startTime),
                    assignedStaff: assignedStaffNames,
                    reason: assignment.reason || ''
                });
            }
        }

        const excelBuffer = await workbook.xlsx.writeBuffer();

        const docParagraphs = [
            new Paragraph({
                children: [new TextRun({ text: "Full Staff Schedule", bold: true, size: 32 })],
                heading: HeadingLevel.HEADING_1,
                spacing: { after: 400 }
            })
        ];

        const driverMap = {};
        for (const day of schedule.daySchedules) {
            const dateStr = new Date(day.date).toLocaleDateString('en-CA');
            for (const assignment of day.assignments) {
                const driverId = String(assignment.driverId);
                const task = taskMap[assignment.taskId];
                if (!task) continue;
                if (!driverMap[driverId]) driverMap[driverId] = {};
                if (!driverMap[driverId][dateStr]) driverMap[driverId][dateStr] = [];
                driverMap[driverId][dateStr].push({ task, assignment });
            }
        }

        for (const [driverId, days] of Object.entries(driverMap)) {
            docParagraphs.push(new Paragraph({
                text: staffMap[driverId] || '[Unknown Driver]',
                heading: HeadingLevel.HEADING_1,
                spacing: { after: 300 }
            }));

            const sortedDays = Object.entries(days).sort(([a], [b]) => new Date(a) - new Date(b));
            for (const [date, taskList] of sortedDays) {
                docParagraphs.push(new Paragraph({
                    text: date,
                    heading: HeadingLevel.HEADING_2,
                    spacing: { after: 150 }
                }));

                const seenTasks = new Set();
                const uniqueTaskList = [];
                for (const { task, assignment } of taskList) {
                    const key = `${task.taskName}-${task.property?.name}-${task.startTime}`;
                    if (seenTasks.has(key)) continue;
                    seenTasks.add(key);
                    uniqueTaskList.push({ task, assignment });
                }

                uniqueTaskList.sort((a, b) => {
                    const [ah, am] = (a.task.startTime || '00:00').split(':').map(Number);
                    const [bh, bm] = (b.task.startTime || '00:00').split(':').map(Number);
                    return ah * 60 + am - (bh * 60 + bm);
                });

                for (let i = 0; i < uniqueTaskList.length; i++) {
                    const { task, assignment } = uniqueTaskList[i];
                    const prop = task.property || {};
                    const assignedStaffNames = (task.assignedStaff || []).map(id => staffMap[String(id)] || '[Unknown]').join(', ');

                    const autoRequiresLinens = /Housekeeping|HK|HK2|Linen|LC|Turnover/i.test(task.taskName);
                    const autoRequiresSupplies = /WLP|Pre-Clean|Supplies|Deep|Turnover/i.test(task.taskName);

                    const requiresLinens = task.requiresLinens !== undefined ? task.requiresLinens : autoRequiresLinens;
                    const requiresSupplies = task.requiresSupplies !== undefined ? task.requiresSupplies : autoRequiresSupplies;

                    let pickupOrDropoff = '';
                    const laterPickupTask = uniqueTaskList.slice(i + 1).find(({ task: nextTask }) => {
                        return nextTask.property?.name === prop.name && /pickup/i.test(nextTask.taskName);
                    });

                    if (laterPickupTask) {
                        pickupOrDropoff = 'Pickup';
                    } else if (/Cleaning/i.test(task.department || '')) {
                        pickupOrDropoff = 'Drop-off';
                    }

                    const taskLineParts = [
                        to12Hour(task.startTime),
                        `Staff: ${assignedStaffNames || 'None'}`,
                        pickupOrDropoff,
                        `Property: ${prop.name || 'Unknown'}`,
                        prop.address ? `Address: ${prop.address}` : '',
                        requiresLinens ? 'Requires Linens' : '',
                        requiresSupplies ? 'Requires Supplies' : ''
                    ];

                    const formattedLine = `• ${taskLineParts.filter(Boolean).join(' | ')}`;

                    docParagraphs.push(new Paragraph({
                        text: formattedLine,
                        spacing: { after: 100 },
                        indent: { left: 720 }
                    }));
                }

                docParagraphs.push(new Paragraph({ text: '' }));
            }

            docParagraphs.push(new Paragraph({ children: [new PageBreak()] }));
        }

        const doc = new Document({ sections: [{ children: docParagraphs }] });
        const docBuffer = await Packer.toBuffer(doc);

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="Driver-Schedule-Bundle-${schedule.weekStart.toISOString().split('T')[0]}.zip"`);

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(res);
        archive.append(excelBuffer, { name: 'Driver-Schedule.xlsx' });
        archive.append(docBuffer, { name: 'Driver-Schedule.docx' });

        await archive.finalize();
    } catch (err) {
        console.error('❌ Export bundle failed:', err);
        res.status(500).send('Failed to export bundle');
    }
});




export { router };





// TASKS TO REMOVE _ DOUBLE CHECK
// Agi Monday
// Villas Daily ???
// Birch Biweekly
// Day Before Departure Checkup
// Inspection(s) - Post-Property Inspection ex
// Weekly Office Cleaning
// WaterTest / Septic
// Greeting
// Owner Clean
// Andrea Mcqueen Weekly HK
