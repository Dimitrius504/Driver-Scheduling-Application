export function logAssign(taskName, driverName, vehicle) {
    console.log(`✔️ Assigned "${taskName}" to ${driverName} (${vehicle})`);
  }
  
  export function logInclude(taskName, driverName) {
    console.log(`➕ Included preassigned "${taskName}" for ${driverName}`);
  }
  
  export function logUnassigned(taskName) {
    console.warn(`⚠️ Unassigned: "${taskName}"`);
  }
  
  export function logInfo(message) {
    console.log(`ℹ️ ${message}`);
  }
  