import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { loginAndGetTokens } from '../services/operto/operto-authentication.mjs';
import { fetchTasks } from '../services/operto/fetch-tasks.mjs';
import { fetchStaff } from '../services/operto/fetch-staff.mjs';
import { fetchProperties } from '../services/operto/fetch-propertyData.mjs';
import { fetchTaskRules } from '../services/operto/fetch-task-rules.mjs';

import { processTasks } from '../services/operto/task-processing.mjs';
import { processStaff } from '../services/operto/staff-processing.mjs';
import { processTaskRules } from '../services/operto/process-taskRules.mjs';
import { processProperties } from '../services/operto/properties-processing.mjs';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.resolve(__dirname, '.././temp');

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

async function main() {
  const { accessToken } = await loginAndGetTokens();
  if (!accessToken) {
    console.error('❌ Failed to obtain access token');
    return;
  }

  console.log('✅ Access token acquired');

  // ==================== TASK RULES ====================
  try {
    console.log('📦 Fetching task rules...');
    const rawTaskRules = await fetchTaskRules(accessToken);
    fs.writeFileSync(path.join(tempDir, 'taskRulesData.json'), JSON.stringify(rawTaskRules, null, 2));
    console.log(`✅ Saved ${rawTaskRules.length} raw task rules`);
  } catch (err) {
    console.error('❌ Failed to fetch/save task rules:', err.message);
  }

  // ==================== PROCESS TASK RULES ====================
  try {
    console.log('🔍 Processing task rules...');
    processTaskRules();
  } catch (err) {
    console.error('❌ Failed to process task rules:', err.message);
  }

  // ==================== TASKS ====================
  try {
    console.log('📦 Fetching tasks...');
    const startDate = '2025-05-19';
    const endDate = '2025-09-06';
    const rawTasks = await fetchTasks(accessToken, startDate, endDate);

    if (!Array.isArray(rawTasks)) throw new Error('Returned tasks is not an array');
    if (rawTasks.length === 0) console.warn('⚠️ No tasks returned from Operto API.');

    const processedTasks = processTasks(rawTasks);
    fs.writeFileSync(path.join(tempDir, 'processedTasks.json'), JSON.stringify(processedTasks, null, 2));
    console.log(`✅ Saved ${processedTasks.length} processed tasks`);
  } catch (err) {
    console.error('❌ Failed to fetch/save tasks:', err.message);
  }

  // ==================== STAFF ====================
  try {
    console.log('📦 Fetching staff...');
    const rawStaff = await fetchStaff(accessToken);
    const staff = processStaff(rawStaff);
    fs.writeFileSync(path.join(tempDir, 'processedStaff.json'), JSON.stringify(staff, null, 2));
    console.log(`✅ Saved ${staff.length} processed staff`);
  } catch (err) {
    console.error('❌ Failed to fetch/save staff:', err.message);
  }

  // ==================== PROPERTIES ====================
  try {
    console.log('📦 Fetching properties...');
    const rawProperties = await fetchProperties(accessToken);
    if (!Array.isArray(rawProperties)) throw new Error('Returned properties is not an array');

    const processedProperties = processProperties(rawProperties);
    fs.writeFileSync(path.join(tempDir, 'processedProperties.json'), JSON.stringify(processedProperties, null, 2));
    console.log(`✅ Saved ${processedProperties.length} processed properties`);
  } catch (err) {
    console.error('❌ Failed to fetch/save properties:', err.message);
  }


}

main();
