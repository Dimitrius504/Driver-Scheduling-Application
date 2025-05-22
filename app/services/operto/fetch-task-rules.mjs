import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';


dotenv.config();



export async function fetchTaskRules(accessToken) {
    const url = 'https://api.vrscheduler.com/api/v1/taskrules';

    let allRules = [];
    let page = 1;
    let hasMore = true;

const __dirname = path.dirname(fileURLToPath(import.meta.url));



    async function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    try {
        while (hasMore) {
            console.log(`Fetching Task Rules - Page ${page}`);

            const response = await axios.get(url, {
                headers: {
                    'Authorization': `VRS ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    per_page: 100,
                    page: page
                }
            });

            if (Array.isArray(response.data?.data)) {
                allRules = allRules.concat(response.data.data);
            } else {
                console.error('Unexpected response from task rules');
                break;
            }

            hasMore = response.data?.has_more;
            page++;
            await wait(500);
        }

        const formattedRules = allRules.map(rule => ({
            taskRuleId: rule.TaskRuleID,
            taskName: rule.TaskRule?.trim() || 'Unnamed Rule',
            abbreviation: rule.Abbreviation?.trim() || '',
            active: rule.Active,
            department: rule.Department || 'Unknown',
            minTime: rule.MinTimeToComplete || 0,
            maxTime: rule.MaxTimeToComplete || 0,
            recurring: rule.Recurring || false,
            packLinen: rule.PackLinen || false,
            retrieveLinen: rule.RetrieveLinen || false,
            internalNotes: rule.InternalNotes?.trim() || "",
            createdAt: rule.CreateDate 
                ? new Date(`${rule.CreateDate.toString().substring(0,4)}-${rule.CreateDate.toString().substring(4,6)}-${rule.CreateDate.toString().substring(6,8)}`) 
                : new Date(),
            category: rule.category || 'Uncategorized'

        }));

        const outputPath = path.resolve(__dirname, '../../temp/taskRulesData.json');
        fs.writeFileSync(outputPath, JSON.stringify(formattedRules, null, 2));
        
        console.log(`Successfully fetched ${formattedRules.length} task rules.`);
        console.log(`Saved to taskRulesData.json`);

        return formattedRules;
    } catch (err) {
        console.error('Failed to fetch task rules:', err.message);
        return [];
    }
}
