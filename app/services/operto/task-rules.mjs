import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export async function fetchTaskRules(accessToken) {
    const url = 'https://api.vrscheduler.com/api/v1/taskrules';

    try {
        const response = await axios.get(url, {
            headers: {
                'Authorization': `VRS ${accessToken}`,
                'Content-Type': 'application/json'
            },
            params: {
                per_page: 100,
                page: 1
            }
        });

        if (!Array.isArray(response.data?.data)) {
            console.error('Unexpected response from task rules');
            return [];
        }

        const rules = response.data.data.map(entry => {
            const rule = entry.rule || entry;
        
            return {
                TaskRuleID: rule.TaskRuleID,
                TaskName: rule.TaskRule,
                Abbreviation: rule.Abbreviation?.trim(),
                Active: rule.Active,
                CreateDate: rule.CreateDate
            };
        });
        
        
        

        console.log(`Loaded ${rules.length} TaskRules`);
        return rules;
    } catch (err) {
        console.error('Failed to fetch task rules:', err.message);
        return [];
    }
}
