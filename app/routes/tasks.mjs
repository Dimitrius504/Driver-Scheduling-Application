import express from 'express';
import mongoose from 'mongoose';
import Task from '../database/models/tasks.mjs';
import TaskRule from '../database/models/task-rules.mjs';

const router = express.Router();

const toStartOfDayUTC = (d) => {
    const date = new Date(d);
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
};

router.get('/', async (req, res) => {
    const { week, date, staff, unassigned, completed, property, zone, isIsland, upcoming, sort } = req.query;

    const filter = {};

    if (week) {
        const start = toStartOfDayUTC(week);
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        filter.date = { $gte: start, $lt: end };
    }
    if (date) filter.date = toStartOfDayUTC(date);
    if (upcoming) filter.date = { $gte: toStartOfDayUTC(new Date()) };
    if (staff) filter.assignedStaff = new mongoose.Types.ObjectId(staff);
    if (unassigned) filter.assignedStaff = { $size: 0 };
    if (completed) filter.completed = completed === 'true';
    if (property) filter['property.name'] = property;
    if (zone) filter['property.zone'] = zone;
    if (isIsland) filter['property.isIsland'] = true;

    let sortOption = { date: 1, startTime: 1 };
    if (sort === 'time-asc') sortOption = { startTime: 1 };
    if (sort === 'time-desc') sortOption = { startTime: -1 };
    if (sort === 'date-asc') sortOption = { date: 1 };
    if (sort === 'date-desc') sortOption = { date: -1 };
    if (sort === 'priority') sortOption = { priority: -1 };

    const tasks = await Task.find(filter)
        .populate('assignedStaff', '_id name')
        .populate('taskRuleId')
        .sort(sortOption)
        .lean();

    const taskRules = await TaskRule.find().lean();

    const allZones = [...new Set(tasks.map(t => t.property?.zone).filter(Boolean))];
    const allProperties = [...new Set(tasks.map(t => t.property?.propertyId).filter(Boolean))];

    res.render('tasks/index', {
        tasks,
        taskRules,
        allZones,
        allProperties,
        selected: { week, date, staff, unassigned, completed, property, zone, isIsland, upcoming, sort }
    });
    console.log('Tasks Fetched:', tasks.length);

});

router.get('/:id', async (req, res) => {
    const task = await Task.findById(req.params.id)
        .populate('assignedStaff', '_id name')
        .lean();

    if (!task) return res.status(404).send('Task not found');

    const taskRule = await TaskRule.findOne({ taskRuleId: task.taskRuleId }).lean();

    task.taskRuleData = taskRule;

    res.render('tasks/details', { task });
});

export { router };