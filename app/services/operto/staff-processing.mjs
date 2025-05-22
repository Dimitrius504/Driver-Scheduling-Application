import fs from 'fs';
import path from 'path';

const teams = {
  'Cleaners': [
    ['*Alicia Barajas', 'Angela Steeves', 'Maria Cecilia Prieto'],
    ['Rohan', '*Jessica Moseley'],
    ['Lilibeth Tesoro', '*Paul'],
    ['Joaquin De Leon', 'Ethel'],
    ['Mimi', 'Jose Morales Jr'],
    ['Noreen Barbosa', 'Kyle'],
    ['Crisel Mae Carlos', '*Mike'],
    ['*Roland', 'Lorena Bersamina'],
    ['Imelda Reyes', 'Vanessa Mesa'],
    ['Loremel', 'Joey Oandasan'],
    ['Judith', 'Arnel Ugo Villalba'],
    ['Winnie', 'Arvie Galvez'],
    ['Flor', 'John'],
    ['Lee Ann Autentico', 'Christian Ibarra'],
    ['Rizza', 'George Regala']
  ]
};

const thirdPartyCompanies = [
  "Vavavabroom Cleaning", "Domestic Divas", "SMF Home Services (Sue)", "Jennifer Lyndsay"
];

const vehicleAssignments = {
  '*Paul': 'Escape',
  '*Mike': 'Van',
  '*Alicia Barajas': 'Van',
  '*Jessica Moseley': 'Truck',
  '*Roland': 'Truck',
  '!Mike Briant' : 'Truck',
  '!Matthew Bongers' : 'Truck',
  '!Kent' : 'Truck',
  '!Alysha' : 'Truck'
};

const initialCantWorkWithMap = {
  6083: [3237, 5845, 27749]
};

const buildBiDirectionalMap = (map) => {
  const result = {};
  for (const [key, valueList] of Object.entries(map)) {
    if (!result[key]) result[key] = new Set();
    for (const other of valueList) {
      result[key].add(other.toString());
      const otherStr = other.toString();
      if (!result[otherStr]) result[otherStr] = new Set();
      result[otherStr].add(key.toString());
    }
  }
  return Object.fromEntries(Object.entries(result).map(([k, v]) => [k, Array.from(v)]));
};

const cantWorkWithMap = buildBiDirectionalMap(initialCantWorkWithMap);

function isThirdParty(name) {
  return thirdPartyCompanies.includes(name);
}

function findTeam(name, staffList) {
  for (let i = 0; i < teams.Cleaners.length; i++) {
    if (teams.Cleaners[i].includes(name)) {
      return {
        teamID: `Team${i + 1}`,
        members: teams.Cleaners[i]
          .map(memberName => {
            const found = staffList.find(({ Name }) => Name === memberName);
            return found?.StaffID;
          })
          .filter(Boolean)
      };
    }
  }
  return { teamID: 'General', members: [] };
}

export function processStaff(rawStaffData) {
  const activeStaff = rawStaffData.filter(s => s.Active);
  const allOpertoIds = new Set(activeStaff.map(s => String(s.StaffID)));

  return activeStaff.map(staff => {
    const createDate = new Date(
      staff.CreateDate.slice(0, 4),
      staff.CreateDate.slice(4, 6) - 1,
      staff.CreateDate.slice(6, 8)
    );

    const isStarred = staff.Name.startsWith('*');
    const isOnlyDriver = staff.Name.startsWith('!');

    const isLeader = ['*Alicia Barajas', '*Jessica Moseley', 'Lilibeth Tesoro', 'Mimi', 'Noreen Barbosa', 'Sonia'].includes(staff.Name);
    const vehicle = vehicleAssignments[staff.Name] || 'None';
    const teamInfo = findTeam(staff.Name, rawStaffData);

    const opertoIdStr = String(staff.StaffID);

    const cantWorkWith = cantWorkWithMap[opertoIdStr]
      ? cantWorkWithMap[opertoIdStr].filter(id => allOpertoIds.has(id))
      : [];

    const roles = [
      ...(isOnlyDriver ? ['Driver'] : []),
      ...(isStarred && !isOnlyDriver ? ['Driver', 'Cleaner'] : []),
      ...(!isStarred && !isOnlyDriver ? ['Cleaner'] : []),
      ...(createDate.getFullYear() === 2025 ? ['Newbie'] : []),
      ...(isLeader ? ['Team Leader'] : []),
      ...(isThirdParty(staff.Name) ? ['ThirdParty'] : [])
    ];


    return {
      opertoId: opertoIdStr,
      name: staff.Name,
      email: staff.Email || "No email provided",
      phone: staff.Phone,
      isActive: staff.Active,
      createDate,
      roles,
      onlyDriver: isOnlyDriver,
      teamInfo: {
        teamID: teamInfo.teamID,
        teamRole: isLeader ? 'Team Leader' : 'Team Member',
        members: teamInfo.members,
        dedicatedOwnerCleans: false,
        housekeepingGuests: false,
        zone: 'Unknown'
      },
      schedule: { shifts: [], changes: [] },
      additionalInfo: {
        comments: '',
        lastModified: new Date()
      },
      vehicle,
      cantWorkWith
    };
  });
}
