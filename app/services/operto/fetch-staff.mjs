import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.resolve(__dirname, '../../temp');

dotenv.config();

export async function fetchStaff(accessToken) {
    const url = 'https://api.vrscheduler.com/api/v1/staff';
    let allStaff = [];
    let page = 1;
    let hasMore = true;

    try {
        while (hasMore) {
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `VRS ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    per_page: 50,
                    page: page
                }
            });

            if (response.data && response.data.data && Array.isArray(response.data.data)) {
                const staffList = response.data.data.map(staff => ({
                    StaffID: staff.StaffID,
                    Name: staff.Name,
                    Email: staff.Email,
                    Phone: staff.Phone.trim(),
                    CountryID: staff.CountryID,
                    Active: staff.Active,
                    CreateDate: staff.CreateDate
                }));
                allStaff = allStaff.concat(staffList);
                hasMore = response.data.has_more;
                page++;
            } else {
                console.error('Unexpected data format:', response.data);
                hasMore = false;
            }
        }

        fs.writeFileSync(path.join(tempDir, 'fetch-staff.json'), JSON.stringify(allStaff, null, 2), 'utf-8');

        return allStaff;
    } catch (error) {
        console.error('❌ Failed to fetch all staff:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        return null;
    }
}
function determineStaffCategory(taskName, staffName) {
    taskName = taskName.toLowerCase();
    
    if (staffName.includes("!")) {
        return "Driver";
    }

    // Other categorizations based on the task name
    if (taskName.includes("clean")) {
        return "Cleaning Staff";
    } else if (taskName.includes("maintenance")) {
        return "Maintenance Staff";
    } else if (taskName.includes("check out")) {
        return "Checkout Staff";
    } else if (taskName.includes("inspection")) {
        return "Inspection Staff";
    } else {
        return "General Staff"; // Default category for tasks that do not match any specific category
    }
}


export async function fetchAndCategorizeStaffByTasks(accessToken) {
    const url = 'https://api.vrscheduler.com/api/v1/stafftasks';
    let categorizedStaff = {};

    const taskDate = '20250319';

    try {
        const response = await axios.get(url, {
            headers: {
                'Authorization': `VRS ${accessToken}`,
                'Content-Type': 'application/json'
            },
            params: {
                per_page: 100,
                CompletedStartDate: taskDate,
                CompletedEndDate: taskDate
            }
        });

        if (response.data && Array.isArray(response.data.data)) {
            response.data.data.forEach(staffTask => {
                const category = determineStaffCategory(staffTask.TaskName, staffTask.StaffName);
                if (!categorizedStaff[category]) {
                    categorizedStaff[category] = [];
                }
                categorizedStaff[category].push({
                    StaffID: staffTask.StaffID,
                    StaffName: staffTask.StaffName,
                    TaskID: staffTask.TaskID,
                    TaskName: staffTask.TaskName
                });
            });
        
            console.log('Categorized Staff by Tasks:', JSON.stringify(categorizedStaff, null, 2));
            fs.writeFileSync(path.join(tempDir, 'categorized-staff.json'), JSON.stringify(categorizedStaff, null, 2), 'utf-8');
        
            return categorizedStaff;
        }
        
    } catch (error) {
        console.error('Failed to fetch or categorize staff by tasks:', error);
        return null;
    }
}
