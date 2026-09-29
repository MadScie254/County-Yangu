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

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  const replacePatterns = [
    { from: /const applications = getApplications\(\);/g, to: 'const { data: applications } = useSupabase<Application>("applications");' },
    { from: /const revenues = getRevenueEntries\(\);/g, to: 'const { data: revenues } = useSupabase<RevenueEntry>("revenue");' },
    { from: /const \[applications, setApplications\] = useState<Application\[\]>\(\[\]\);/g, to: 'const { data: applications } = useSupabase<Application>("applications");' },
    // others if any
  ];

  replacePatterns.forEach(pattern => {
    if (pattern.from.test(content)) {
      content = content.replace(pattern.from, pattern.to);
      changed = true;
    }
  });

  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
});
