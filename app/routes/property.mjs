import express from 'express';
import Property from '../database/models/properties.mjs';

const router = express.Router()

router.get('/', async (req, res) => {
    const { zone, regionGroup, isIsland, hasRecurringTasks } = req.query;

    const filter = {};
    if (zone) filter.zone = zone;
    if (regionGroup) filter['region.regionGroup'] = regionGroup;
    if (isIsland) filter.isIsland = true;
    if (hasRecurringTasks) filter.hasRecurringTasks = true;

    const properties = await Property.find(filter).lean();

    const allZones = [...new Set(properties.map(p => p.zone).filter(Boolean))];
    const allRegionGroups = [...new Set(properties.map(p => p.region?.regionGroup).filter(Boolean))];

    res.render('properties/index', {
        properties,
        allZones,
        allRegionGroups,
        selected: { zone, regionGroup, isIsland, hasRecurringTasks }
    });

});

router.get('/:id', async (req, res) => {
    const property = await Property.findById(req.params.id).lean();

    if (!property) return res.status(404).send('Property not found');

    res.render('properties/details', { property });
});

export { router }
