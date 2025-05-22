import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

export async function fetchCategorizedTasks(accessToken) {
    const url = 'https://api.vrscheduler.com/api/v1/tasks';
    let allTasks = [];
    let page = 1;
    let hasMore = true;
    const taskDate = '20250702';

    async function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function categorizeTask(taskName) {
        taskName = taskName.toLowerCase(); // Normalize taskName to lowercase for easier matching
    
        // Housekeeping related tasks
        if (taskName.includes("clean") || taskName.includes("housekeeping") || taskName.includes("linen") || taskName.includes("hk") || taskName.includes("villas daily")) return "Housekeeping";
        if (taskName.includes("turnover")) return "Turnover";
        if (taskName.includes("preclean")) return "Pre-Clean";
    
        // Maintenance related tasks
        if (taskName.includes("maintenance") || taskName.includes("cottage check") || taskName.includes("property check")) return "Maintenance";
        if (taskName.includes("hot tub")) return "Hot Tub Maintenance";
        if (taskName.includes("lawn care") || taskName.includes("garden")) return "Lawn and Garden Maintenance";
        if (taskName.includes("pest control")) return "Pest Control";
    
        // Concierge and Guest Services
        if (taskName.includes("concierge")) return "Concierge Services";
        if (taskName.includes("delivery") || taskName.includes("pickup") || taskName.includes("drop off")) return "Delivery and Pickup Services";
        if (taskName.includes("shopping")) return "Shopping";
        if (taskName.includes("child care") || taskName.includes("serving")) return "Concierge Child Care and Serving";
    
        // Inspection related tasks
        if (taskName.includes("inspection")) return "Inspection";
        if (taskName.includes("check")) return "Checkup";
    
        // Administrative tasks
        if (taskName.includes("meeting") || taskName.includes("reminder")) return "Administrative";
        if (taskName.includes("greet") || taskName.includes("interview")) return "Guest Interaction";
    
        // Specialized tasks
        if (taskName.includes("steam clean")) return "Deep Cleaning and Maintenance";
        if (taskName.includes("damage")) return "Damage Inspection and Repair";
    
        return "General Task";
    }
    

    try {
        while (hasMore) {
            console.log(`Fetching Page ${page}...`);

            const response = await axios.get(url, {
                headers: {
                    'Authorization': `VRS ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    per_page: 50,
                    page: page,
                    TaskStartDate: taskDate,
                    TaskEndDate: taskDate
                }
            });

            if (response.data && Array.isArray(response.data.data)) {
                allTasks = allTasks.concat(response.data.data);
                hasMore = response.data.has_more;
                page++;
            } else {
                console.error('Unexpected data format:', response.data);
                hasMore = false;
            }

            await wait(1000);
        }

        console.log(`Total Tasks Retrieved: ${allTasks.length}`);

        allTasks.sort((a, b) => (a.TaskStartTime > b.TaskStartTime ? 1 : -1));
        // Categorizing and grouping tasks
        const categorizedTasks = allTasks.reduce((acc, task) => {
            const category = categorizeTask(task.TaskName);
            const formattedTask = {
                TaskID: task.TaskID,
                TaskName: task.TaskName,
                TaskDescription: task.TaskDescription || "No description",
                StartTime: task.TaskStartTime || "Unknown",
                EstimatedTime: `${task.MinTimeToComplete}-${task.MaxTimeToComplete} hours`,
                Property: {
                    Name: task.Property?.PropertyName || "Unknown",
                    Address: task.Property?.Address || "Unknown",
                    Coordinates: {
                        Lat: task.Property?.Lat || "N/A",
                        Lon: task.Property?.Lon || "N/A"
                    },
                    Region: task.Property?.RegionID || "N/A",
                    DoorCode: task.Property?.DoorCode || "N/A"
                },
                AssignedStaff: task.Staff ? task.Staff.map(staff => staff.Name).join(", ") : "No staff assigned",
                Completed: task.Completed === '1' ? "✅ Completed" : "❌ Not completed",
                Notes: task.InternalNotes || "No additional notes"
            };

            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(formattedTask);
            return acc;
        }, {});

        console.log("📝 Categorized Driver Schedule Report:");
        Object.keys(categorizedTasks).forEach(category => {
            console.log(`Category: ${category}`);
            console.table(categorizedTasks[category]);
        });
        fs.writeFileSync('categorized-tasks.json', JSON.stringify(categorizedTasks, null, 2), 'utf-8');
        return categorizedTasks;
    } catch (error) {
        if (error.response && error.response.status === 401) {
            throw new Error('TokenExpired');
        }
        console.error('Failed to fetch or process tasks:', error.message);
        return null;
    }
}