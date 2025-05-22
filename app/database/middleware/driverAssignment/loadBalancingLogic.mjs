export function smartLoadBalance(zoneTasks, drivers) {
    const assignmentsByDriver = new Map(drivers.map(driver => [driver._id.toString(), []]));
  
    // Sort tasks by start time
    zoneTasks.sort((a, b) => a.startTime.localeCompare(b.startTime));
  
    let driverIndex = 0;
  
    for (const task of zoneTasks) {
      const driver = drivers[driverIndex];
  
      if (!driver) continue; // Safety check
  
      assignmentsByDriver.get(driver._id.toString()).push(task);
  
      driverIndex = (driverIndex + 1) % drivers.length; // Round robin
    }
  
    return assignmentsByDriver;
  }
  