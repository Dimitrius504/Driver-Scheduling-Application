import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.resolve(__dirname, '../../temp');

dotenv.config();

export async function fetchProperties(accessToken) {
    const propertiesURL = 'https://api.vrscheduler.com/api/v1/properties';
    const regionsURL = 'https://api.vrscheduler.com/api/v1/regions';
    const regionGroupsURL = 'https://api.vrscheduler.com/api/v1/regiongroups';

    const regionMap = {};
    const regionGroupMap = {};

    // Fetch Region Groups
    const regionGroupResp = await axios.get(regionGroupsURL, {
        headers: { 'Authorization': `VRS ${accessToken}` }
    });

    regionGroupResp.data.data.forEach(group => {
        regionGroupMap[group.RegionGroupID] = group.RegionGroup;
    });

    // Fetch Regions
    const regionResp = await axios.get(regionsURL, {
        headers: { 'Authorization': `VRS ${accessToken}` }
    });

    regionResp.data.data.forEach(region => {
        regionMap[region.RegionID] = {
            RegionName: region.Region,
            RegionGroup: regionGroupMap[region.RegionGroupID] || 'Unknown Group'
        };
    });

    let page = 1;
    let hasMore = true;
    let allProperties = [];

    while (hasMore) {
        const response = await axios.get(propertiesURL, {
            headers: { 'Authorization': `VRS ${accessToken}` },
            params: { per_page: 50, page }
        });

        if (Array.isArray(response.data?.data)) {
            allProperties = allProperties.concat(response.data.data);
        }

        hasMore = response.data?.has_more;
        page++;
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`✅ Loaded ${allProperties.length} Properties`);

    const formattedProperties = allProperties.map(property => {
        const regionData = regionMap[property.RegionID] || {};
        return {
            propertyId: property.PropertyID,
            name: property.PropertyName || "Unnamed Property",
            address: property.Address || "Unknown",
            lat: property.Lat || null,
            lon: property.Lon || null,
            doorCode: property.DoorCode || "",
            zone: regionData.RegionName || 'Unknown',
            region: regionData.RegionGroup || 'Unknown Group',
            isIsland: property.PropertyName?.toLowerCase().includes('island') || false,
            active: property.Active,
            internalNotes: property.InternalNotes || "",
            createdAt: new Date(),
            updatedAt: new Date()
        };
    });

    fs.writeFileSync(path.join(tempDir, 'propertiesData.json'), JSON.stringify(formattedProperties, null, 2), 'utf-8');

    console.log('✅ Properties data saved to propertiesData.json');

    return formattedProperties;
}
