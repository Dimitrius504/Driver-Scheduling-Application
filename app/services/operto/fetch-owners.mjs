import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const ownersURL = 'https://api.vrscheduler.com/api/v1/owners';

export async function fetchOwners(accessToken) {
    let allOwners = [];
    let page = 1;
    let hasMore = true;

    async function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    try {
        while (hasMore) {
            console.log(`Fetching Owners - Page ${page}`);

            const response = await axios.get(ownersURL, {
                headers: {
                    'Authorization': `VRS ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    per_page: 50,
                    page: page
                }
            });

            if (response.data?.data) {
                allOwners = allOwners.concat(response.data.data);
                hasMore = response.data.has_more;
                page++;
            } else {
                console.error('Unexpected response format:', response.data);
                break;
            }

            await wait(500);
        }

        const formattedOwners = allOwners.map(owner => ({
            ownerId: owner.OwnerID,
            ownerName: owner.OwnerName || "Unknown",
            email: owner.OwnerEmail || "",
            phone: owner.OwnerPhone || ""
        }));

        fs.writeFileSync(path.resolve('./ownersData.json'), JSON.stringify(formattedOwners, null, 2), 'utf-8');

        console.log(`✅ Successfully fetched ${formattedOwners.length} owners.`);
        console.log('Saved to ownersData.json');

        return formattedOwners;
    } catch (error) {
        console.error('Failed to fetch or process owners:', error.message);
        return null;
    }
}
