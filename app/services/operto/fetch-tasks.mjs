import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs'
import { ignoreTasksWithStaff, ignoreTaskType } from '../../database/middleware/driverAssignment/constants.mjs'

dotenv.config();

export async function fetchTasks(accessToken, startDate, endDate, maxRetries = 3) {
    
    const url = 'https://api.vrscheduler.com/api/v1/tasks';
    let allTasks = [];
    let page = 1;
    let hasMore = true;

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    try {
        while (hasMore) {
            console.log(`Fetching Page ${page} for ${startDate} to ${endDate}...`);

            let response;
            let attempt = 0;

            while (attempt < maxRetries) {
                try {
                    response = await axios.get(url, {
                        headers: {
                            'Authorization': `VRS ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        params: {
                            per_page: 50,
                            page: page,
                            TaskStartDate: startDate,
                            TaskEndDate: endDate
                        }
                    });
                    break; // If success, exit retry loop
                } catch (error) {
                    attempt++;
                    if (attempt >= maxRetries) {
                        throw error; // Give up after max retries
                    }
                    console.warn(`Error fetching page ${page} for ${startDate} - ${endDate}, attempt ${attempt} of ${maxRetries}. Retrying in 5s...`);
                    await wait(5000);
                }
            }

            if (response.data && Array.isArray(response.data.data)) {
                allTasks = allTasks.concat(response.data.data);
                hasMore = response.data.has_more;
                page++;
            } else {
                hasMore = false;
            }

            await wait(500);
        }


        // Filter tasks based on staff and task type
        const filteredTasks = allTasks.filter(task => {
            const taskName = task.TaskName?.trim();
            const assignedStaffNames = (task.AssignedStaff || []).map(s => s.Name?.trim()).filter(Boolean);

            const hasIgnoredStaff = assignedStaffNames.some(name => ignoreTasksWithStaff.has(name));
            const isIgnoredType = ignoreTaskType.has(taskName);

            return !hasIgnoredStaff && !isIgnoredType;
        });

        return filteredTasks;

    } catch (error) {
        console.error(`Failed to fetch tasks ${startDate} - ${endDate} after ${maxRetries} attempts:`, error.message);
        return [];
    }
}
