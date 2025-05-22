import axios from 'axios';
import fs from 'fs';

export async function mapStaffToRegions(accessToken) {
    const staffTasksURL = 'https://api.vrscheduler.com/api/v1/stafftasks';
    const propertiesURL = 'https://api.vrscheduler.com/api/v1/properties';
    const regionsURL = 'https://api.vrscheduler.com/api/v1/regions';
    const regionGroupsURL = 'https://api.vrscheduler.com/api/v1/regiongroups';

    const regionMap = {};
    const regionGroupMap = {};
    const propertyRegionMap = {};

    try {
        const regionGroupResp = await axios.get(regionGroupsURL, {
            headers: { 'Authorization': `VRS ${accessToken}` }
        });

        regionGroupResp.data.data.forEach(group => {
            regionGroupMap[group.RegionGroupID] = group.RegionGroup;
        });

        const regionResp = await axios.get(regionsURL, {
            headers: { 'Authorization': `VRS ${accessToken}` }
        });

        regionResp.data.data.forEach(region => {
            regionMap[region.RegionID] = {
                RegionName: region.Region,
                RegionGroupID: region.RegionGroupID,
                RegionGroup: regionGroupMap[region.RegionGroupID] || 'Unknown Group'
            };
        });

        let page = 1;
        let hasMore = true;
        let totalProperties = [];

        while (hasMore) {
            const response = await axios.get(propertiesURL, {
                headers: { 'Authorization': `VRS ${accessToken}` },
                params: { per_page: 50, page }
            });

            if (Array.isArray(response.data?.data)) {
                totalProperties = totalProperties.concat(response.data.data);
            }

            hasMore = response.data?.has_more;
            page++;
        }

        totalProperties.forEach(property => {
            const regionData = regionMap[property.RegionID];
            propertyRegionMap[property.PropertyID] = {
                RegionName: regionData?.RegionName || 'Unknown',
                RegionGroup: regionData?.RegionGroup || 'Unknown Group',
                PropertyName: property.PropertyName || 'Unnamed Property'
            };
        });

        console.log(`Loaded properties: ${totalProperties.length}`);

        const today = new Date();
        const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
        const grouped = {};
        let taskPage = 1;
        let taskHasMore = true;

        while (taskHasMore) {
            const taskResp = await axios.get(staffTasksURL, {
                headers: { 'Authorization': `VRS ${accessToken}` },
                params: {
                    TaskStartDate: dateStr,
                    per_page: 100,
                    page: taskPage
                }
            });

            const staffTasks = taskResp.data?.data || [];
            staffTasks.forEach(task => {
                const region = propertyRegionMap[task.PropertyID] || {
                    RegionName: 'Unknown',
                    RegionGroup: 'Unknown Group',
                    PropertyName: 'Unknown Property'
                };

                const date = task.TaskDate || 'Unknown Date';
                const outerKey = date;
                const regionGroupKey = region.RegionGroup;
                const regionKey = region.RegionName;
                const propertyKey = region.PropertyName;
                const taskKey = `${task.TaskID} - ${task.TaskName}`;

                if (!grouped[outerKey]) grouped[outerKey] = {};
                if (!grouped[outerKey][regionGroupKey]) grouped[outerKey][regionGroupKey] = {};
                if (!grouped[outerKey][regionGroupKey][regionKey]) grouped[outerKey][regionGroupKey][regionKey] = {};
                if (!grouped[outerKey][regionGroupKey][regionKey][propertyKey]) grouped[outerKey][regionGroupKey][regionKey][propertyKey] = {};
                if (!grouped[outerKey][regionGroupKey][regionKey][propertyKey][taskKey]) grouped[outerKey][regionGroupKey][regionKey][propertyKey][taskKey] = [];

                grouped[outerKey][regionGroupKey][regionKey][propertyKey][taskKey].push({
                    StaffID: task.StaffID,
                    Name: task.StaffName
                });
            });


            taskHasMore = taskResp.data?.has_more;
            taskPage++;
            await new Promise(resolve => setTimeout(resolve, 750));
        }

        fs.writeFileSync('staff-categorized-date-region-property-task.json', JSON.stringify(grouped, null, 2));
        console.log('Staff categorized by Date > Region > Property > Task saved to staff-categorized-date-region-property-task.json');
        return grouped;

    } catch (err) {
        console.error('Error categorizing staff by date, region, property, and task:', err.message);
        return null;
    }
}