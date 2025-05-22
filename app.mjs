import express from 'express';
import hbs from 'hbs';
import path from 'path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { router as staffRoutes } from './app/routes/staff.mjs';
import { router as taskRoutes } from './app/routes/tasks.mjs';
import { router as propertyRoutes } from './app/routes/property.mjs'
import { router as taskRuleRoutes } from './app/routes/taskrules.mjs'
import { router as scheduleRoutes } from './app/routes/schedule.mjs'
import { router as dashboardRoutes } from './app/routes/dashboard.mjs'
import { router as opertoRoutes } from './app/routes/operto.mjs'
import { groupTasksByZonePlain } from './app/database/middleware/driverAssignment/utils.mjs';
import dotenv from 'dotenv'
import moment from 'moment';

dotenv.config()

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'app', 'views'));
app.set('view options', { layout: 'layouts/main' });

hbs.registerPartials(path.join(__dirname, 'app', 'views/partials'));

// HELPERS
hbs.registerHelper('ifCond', function (v1, operator, v2, options) {
    switch (operator) {
        case '==': return (v1 == v2) ? options.fn(this) : options.inverse(this);
        case '===': return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case '!=': return (v1 != v2) ? options.fn(this) : options.inverse(this);
        case '!==': return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case '<': return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case '<=': return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case '>': return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case '>=': return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        default: return options.inverse(this);
    }
});

app.use(express.urlencoded({ extended: true }));

hbs.registerPartials(path.join(__dirname, 'views/partials'));

hbs.registerHelper('ifEquals', function (arg1, arg2, options) {
    return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});

hbs.registerHelper('ifCond', function (v1, operator, v2, options) {
    switch (operator) {
        case '==':
            return (v1 == v2) ? options.fn(this) : options.inverse(this);
        default:
            return options.inverse(this);
    }
});

hbs.registerHelper('hasKeys', function (obj) {
    return obj && Object.keys(obj).length > 0;
});

hbs.registerHelper('groupByZone', (tasks) => {
    const grouped = {};

    for (const task of tasks) {
        const zone = task.property?.zone || 'Unknown';
        if (!grouped[zone]) grouped[zone] = [];
        grouped[zone].push(task);
    }

    return grouped;
});

hbs.registerHelper('objectEntries', function (object) {
    return Object.entries(object).map(([key, value]) => ({ key, value }));
});

hbs.registerHelper('json', function (context) {
    return JSON.stringify(context, null, 2);
});

hbs.registerHelper('groupTasksByZonePlain', groupTasksByZonePlain)

hbs.registerHelper('toString', function (value) {
    return String(value);
});

hbs.registerHelper('lookupIndex', function (array, index) {
    return Array.isArray(array) ? array[index] : undefined;
});

hbs.registerHelper('eq', function (a, b) {
    return a?.toString() === b?.toString();
});

hbs.registerHelper('conflictsForTask', function (conflicts, taskId) {
    if (!Array.isArray(conflicts)) return [];
    return conflicts.filter(c => c.includes(taskId));
});

hbs.registerHelper('includes', function (set, value) {
    return set?.has?.(value?.toString());
});

hbs.registerHelper('toString', val => val?.toString?.() || '');

hbs.registerHelper('conflictsForTask', function (conflicts, taskId) {
    if (!conflicts || !taskId) return [];
    return conflicts[taskId] || [];
});

hbs.registerHelper('groupByDriver', function (assignments) {
    const groups = {};
    for (const a of assignments) {
        const name = a.driverId?.name || 'Unknown Driver';
        if (!groups[name]) groups[name] = { name, tasks: [] };
        groups[name].tasks.push(a);
    }
    return Object.values(groups);
});

hbs.registerHelper('formatDate', function (dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-CA');
});

hbs.registerHelper('isCurrentWeek', function (weekStart) {
    const today = new Date();
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return today >= start && today <= end;
});

hbs.registerHelper('formatDate', function (date) {
    return moment(date).format('dddd, MMMM Do YYYY');
});

hbs.registerHelper('lookupDriver', function (staffArray, driverId) {
    if (!Array.isArray(staffArray)) {
        return '[Invalid staff data]';
    }

    const driver = staffArray.find(s => String(s._id) === String(driverId));
    return driver ? driver.name : '[Unknown Driver]';
});

hbs.registerHelper('lookupStaff', function (staffArray, staffObjOrId) {
    if (!Array.isArray(staffArray)) return '[Missing staff array]';

    const staffId = typeof staffObjOrId === 'object' && staffObjOrId._id
        ? staffObjOrId._id
        : staffObjOrId;

    const match = staffArray.find(s => String(s._id) === String(staffId));
    return match?.name || '[Unknown Staff]';
});

hbs.registerHelper('pickupTaskName', function (taskName) {
    if (!taskName) return false;
    return taskName.toLowerCase().includes('pickup');
});

hbs.registerHelper('isDropoffTask', function (task) {
    if (!task) return false;

    const isPickup = task.taskName?.toLowerCase().includes('pickup');
    const hasStaff = Array.isArray(task.assignedStaff) && task.assignedStaff.length > 0;

    return !isPickup && hasStaff;
});

hbs.registerHelper('or', function (a, b) {
    return a || b;
});


app.use('/staff', staffRoutes);
app.use('/tasks', taskRoutes);
app.use('/properties', propertyRoutes);
app.use('/taskrules', taskRuleRoutes);
app.use('/schedule', scheduleRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/operto', opertoRoutes);


const uri = `${process.env.MONGO_URI}`

await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    ssl: true,
    tlsAllowInvalidCertificates: false,
    tlsInsecure: false,
    tls: true,
    minVersion: 'TLSv1.2',
});

console.log('Connected to database:', mongoose.connection.name);

const PORT = process.env.PORT;

if (process.env.ENVIRONMENT === 'local') {
    app.listen(3000, () => console.log(`Server running on http://localhost:${PORT}`));

} else {
    app.listen(PORT, () => console.log(`Server running in production on port ${PORT}`))
}
