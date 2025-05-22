import express from 'express';
import Staff from '../database/models/staff.mjs';

const router = express.Router();

router.get('/', async (req, res) => {
    const { role, teamId, search } = req.query;

    const filter = {};

    if (role) filter.roles = role;
    if (teamId) filter['teamInfo.teamID'] = teamId;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const staff = await Staff.find(filter).lean();

    const allStaff = await Staff.find().lean();
    const allRoles = [...new Set(allStaff.flatMap(s => s.roles))];
    const allTeamIds = [...new Set(allStaff.map(s => s.teamInfo.teamID).filter(Boolean))];

    res.render('staff-list', { staff, allRoles, allTeamIds, selected: { role, teamId, search } });
});

router.get('/:id', async (req, res) => {
    const staff = await Staff.findById(req.params.id).lean();

    if (!staff) return res.status(404).send('Staff not found');

    const teamMembers = await Staff.find({ _id: { $in: staff.teamInfo.members } }).lean();
    const cantWorkWith = await Staff.find({
        $or: [
            { _id: { $in: staff.cantWorkWith } },
            { cantWorkWith: staff._id }
        ]
    }).lean();

    res.render('staff-details', { staff, teamMembers, cantWorkWith });
});

export { router };
