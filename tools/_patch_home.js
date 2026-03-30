const fs = require('fs');
const filePath = 'c:\\Users\\syu02\\GLOVEUP\\GLOVEUP\\home\\home.js';

let c = fs.readFileSync(filePath, 'utf8');

// 1. Add coachGymSection and coachGymNavItem declarations
c = c.replace(
  "const coachNavItem = document.getElementById('coach-nav-item');",
  "const coachGymSection = document.getElementById('coach-gym');\r\n    const coachNavItem = document.getElementById('coach-nav-item');\r\n    const coachGymNavItem = document.getElementById('coach-gym-nav-item');"
);

// 2. Add coachGymSection to the condition
c = c.replace(
  '(coachDashboardSection || coachManagementSection) && role',
  '(coachDashboardSection || coachManagementSection || coachGymSection) && role'
);

// 3. Show coachGymNavItem
c = c.replace(
  "if (coachNavItem) coachNavItem.style.display = '';",
  "if (coachNavItem) coachNavItem.style.display = '';\r\n        if (coachGymNavItem) coachGymNavItem.style.display = '';"
);

// 4. Update the hash routing to handle 3 sections
c = c.replace(
  "const showManagement = window.location.hash === '#coach-management';",
  "const hash = window.location.hash;\r\n            const showManagement = hash === '#coach-management';\r\n            const showGym = hash === '#coach-gym';"
);

// 5. Update dashboard visibility to also hide for gym
c = c.replace(
  "if (coachDashboardSection) coachDashboardSection.style.display = showManagement ? 'none' : '';",
  "if (coachDashboardSection) coachDashboardSection.style.display = (showManagement || showGym) ? 'none' : '';"
);

// 6. Add gym section visibility after management
c = c.replace(
  "if (coachManagementSection) coachManagementSection.style.display = showManagement ? '' : 'none';",
  "if (coachManagementSection) coachManagementSection.style.display = showManagement ? '' : 'none';\r\n            if (coachGymSection) coachGymSection.style.display = showGym ? '' : 'none';"
);

fs.writeFileSync(filePath, c, 'utf8');

// Verify
const updated = fs.readFileSync(filePath, 'utf8');
console.log('Has coachGymSection:', updated.includes('coachGymSection'));
console.log('Has coachGymNavItem:', updated.includes('coachGymNavItem'));
console.log('Has showGym:', updated.includes('showGym'));
console.log('Done!');
