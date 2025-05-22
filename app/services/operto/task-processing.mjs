import fs from 'fs';
import path from 'path';

function detectTaskType(name) {
  name = name.toLowerCase();
  if (name.includes('turnover') && name.includes('guest')) return 'Turnover Guest';
  if (name.includes('turnover') && name.includes('owner')) return 'Turnover Owner';
  if (name.includes('linen') || name.includes('lc')) return 'Linen Change';
  if (name.includes('preclean')) return 'Preclean';
  if (name.includes('reminder')) return 'Reminder';
  if (name.includes('packing')) return 'Packing';
  if (name.includes('housekeeping') || name.includes('hk')) return 'Housekeeping';
  if (name.includes('delivery') || name.includes('deliver')) return 'Delivery';
  if (name.includes('pickup') || name.includes('pu')) return 'Pickup';
  return 'General';
}


/**
 * @param {Array} rawTasks - raw task array from the Operto API
 * @returns {Array} processed task objects
 */

export function processTasks(rawTasks) {
  const processedTasks = rawTasks.map(task => ({
    taskId: task.TaskID,
    taskRuleId: task.TaskRuleID || null,
    propertyId: task.Property?.PropertyID || null,
    property: {
      name: task.Property?.PropertyName || "Unknown",
      address: task.Property?.Address || "Unknown",
      lat: task.Property?.Lat || null,
      lon: task.Property?.Lon || null,
      doorCode: task.Property?.DoorCode || "",
      zone: task.Property?.RegionID || "Unknown",
      region: task.Property?.RegionID || "Unknown",
      isIsland: task.Property?.PropertyName?.toLowerCase().includes('island') || false,
    },
    taskName: task.TaskName || "Unnamed Task",
    taskDescription: task.TaskDescription || "",
    department: "Cleaning",
    taskType: detectTaskType(task.TaskName),
    date: task.TaskDate,
    startTime: task.TaskStartTime || task.TaskTime || null,
    endTime: null,
    estimatedEndTime: null,
    minHours: task.MinTimeToComplete || 0,
    maxHours: task.MaxTimeToComplete || 0,
    assignedStaff: task.Staff?.map(s => s.StaffID) || [],
    assignedStaffNames: task.Staff?.map(s => {
      if (!s.Name && !s.StaffName) {
        console.warn("Missing staff name on task:", task.TaskID, s);
      }
      return s.Name || s.StaffName || null;
    }) || [],
    staffRequired: (task.Staff?.length || 1),
    requiresLinens: task.PackLinen || task.RetrieveLinen || task.TaskName.toLowerCase().includes('linen'),
    requiresSupplies: /turnover|preclean|wlp/i.test(task.TaskName),
    packLinen: task.PackLinen || false,
    retrieveLinen: task.RetrieveLinen || false,
    priority: task.Property?.PropertyName?.toLowerCase().includes('island') ? 10 : 1,
    isRecurring: !!task.TaskRuleID,
    isReminder: task.TaskName.toLowerCase().includes('reminder'),
    thirdParty: false,
    active: task.TaskActive,
    internalNotes: task.InternalNotes || "",
    specialInstructions: "",
    taskTags: [],
    flags: [task.Flag1, task.Flag2],
    taskImages: [],
    approved: task.Approved,
    approvedDate: task.ApprovedDate || null,
    completed: task.Completed === '1',
    completeConfirmedDate: task.CompleteConfirmedDate || null,
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  return processedTasks;
}
