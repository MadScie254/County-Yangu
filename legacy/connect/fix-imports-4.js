import fs from 'fs';
import path from 'path';

const srcDir = './src';

// Recursively find all tsx files
function findFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(findFiles(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = findFiles(srcDir);

const getters = [
  'getApplications', 'getTenders', 'getRevenueEntries', 'getAnomalies',
  'getLandRecords', 'getPetitions', 'getWelfarePrograms', 'getHealthDrugs',
  'getNotifications', 'getDepartments', 'getServices', 'getApplicationById',
  'getUnreadCount'
];

const mutations = [
  'addApplication', 'updateApplicationStatus', 'addRevenueEntry',
  'addDepartment', 'addService', 'updateService', 'removeService',
  'votePetition', 'markAllNotificationsRead', 'updateDrugStock',
  'startLiveSimulation', 'stopLiveSimulation', 'subscribe'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  const usedGetters = getters.filter(g => new RegExp(`\\b${g}\\b`).test(content));
  const usedMutations = mutations.filter(m => new RegExp(`\\b${m}\\b`).test(content));

  const allToImportFromStore = [...usedGetters, ...usedMutations];

  if (allToImportFromStore.length > 0) {
    // If not already importing store, add it
    if (!content.includes('@/lib/store')) {
      content = `import { ${allToImportFromStore.join(', ')} } from "@/lib/store";\n` + content;
      changed = true;
    } else {
      // It includes @/lib/store, but maybe not all of them.
      // This regex replaces any import { ... } from "@/lib/store" with the full list
      content = content.replace(/import\s+\{[^}]+\}\s+from\s+["']@\/lib\/store["'];/g, () => {
        return `import { ${allToImportFromStore.join(', ')} } from "@/lib/store";`;
      });
      changed = true;
    }
  }

  // Ensure ServiceItem duplicate is removed. It might be imported from "@/lib/types" and "@/lib/store".
  // Remove ServiceItem from "@/lib/types" if it's there
  if (content.includes('import type {') && content.includes('ServiceItem')) {
    content = content.replace(/\bServiceItem,?/g, '');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
});
