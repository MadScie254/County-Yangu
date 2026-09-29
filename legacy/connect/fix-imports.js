import fs from 'fs';
import path from 'path';
import url from 'url';

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

  if (content.includes('@/lib/store')) {
    content = content.replace(/import\s+\{[^}]+\}\s+from\s+["']@\/lib\/store["'];/g, () => {
      return `import { useSupabase } from "@/hooks/useSupabase";\nimport type { Application, Tender, RevenueEntry, AnomalyAlert, LandRecord, Petition, WelfareProgram, HealthDrugItem, Notification, Department, ServiceItem } from "@/lib/types";\nimport { supabase } from "@/lib/supabase";`;
    });
    
    content = content.replace(/const apps = getApplications\(\);/g, 'const { data: apps } = useSupabase<Application>("applications");');
    content = content.replace(/const tenders = getTenders\(\);/g, 'const { data: tenders } = useSupabase<Tender>("tenders");');
    content = content.replace(/const revenue = getRevenueEntries\(\);/g, 'const { data: revenue } = useSupabase<RevenueEntry>("revenue");');
    content = content.replace(/const anomalies = getAnomalies\(\);/g, 'const { data: anomalies } = useSupabase<AnomalyAlert>("anomalies");');
    content = content.replace(/const landRecords = getLandRecords\(\);/g, 'const { data: landRecords } = useSupabase<LandRecord>("land_records");');
    content = content.replace(/const petitions = getPetitions\(\);/g, 'const { data: petitions } = useSupabase<Petition>("petitions");');
    content = content.replace(/const programs = getWelfarePrograms\(\);/g, 'const { data: programs } = useSupabase<WelfareProgram>("welfare");');
    content = content.replace(/const drugs = getHealthDrugs\(\);/g, 'const { data: drugs } = useSupabase<HealthDrugItem>("health_drugs");');
    content = content.replace(/const notifications = getNotifications\(\);/g, 'const { data: notifications } = useSupabase<Notification>("notifications");');
    content = content.replace(/const departments = getDepartments\(\);/g, 'const { data: departments } = useSupabase<Department>("departments");');
    content = content.replace(/const services = getServices\(\);/g, 'const { data: services } = useSupabase<ServiceItem>("services");');

    changed = true;
  }

  if (content.includes('getUnreadCount()')) {
    // specific fix for DashboardLayout.tsx
    content = content.replace(/getUnreadCount\(\)/g, '(notifications?.filter(n => !n.read).length || 0)');
    content = content.replace(/export function DashboardLayout\(\{ children, role \}: DashboardLayoutProps\) \{/, 'export function DashboardLayout({ children, role }: DashboardLayoutProps) {\n  const { data: notifications } = useSupabase<Notification>("notifications");');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
});
