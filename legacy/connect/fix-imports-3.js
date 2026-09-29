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

const mutationNames = [
  'addApplication', 'updateApplicationStatus', 'addRevenueEntry',
  'addDepartment', 'addService', 'updateService', 'removeService',
  'votePetition', 'markAllNotificationsRead', 'updateDrugStock',
  'startLiveSimulation', 'stopLiveSimulation', 'subscribe', 'getApplicationById'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  const usedMutations = mutationNames.filter(m => new RegExp(`\\b${m}\\b`).test(content));

  if (usedMutations.length > 0) {
    // Make sure we only add it if it's not already there
    if (!content.includes('@/lib/mutations')) {
      content = `import { ${usedMutations.join(', ')} } from "@/lib/mutations";\n` + content;
      changed = true;
    }
  }

  // Also fix AdminDashboard where getApplications is still called
  if (content.includes('const applications = getApplications();')) {
    content = content.replace(/const applications = getApplications\(\);/g, 'const { data: applications } = useSupabase<Application>("applications");');
    changed = true;
  }
  if (content.includes('const revenues = getRevenueEntries();')) {
    content = content.replace(/const revenues = getRevenueEntries\(\);/g, 'const { data: revenues } = useSupabase<RevenueEntry>("revenue");');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
});
