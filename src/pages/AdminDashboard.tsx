import { useApplications, useRevenueEntries, useTenders } from "@/lib/store";
import { DashboardLayout } from "@/components/DashboardLayout";
import { 
  Users, 
  FileText, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  Building2, 
  Briefcase, 
  Coins, 
  CheckCircle2, 
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  Zap
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
} from "recharts";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { getSelectedCounty } from "@/lib/counties";
import { formatCurrency, cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const revenueData = [
  { name: "Mon", amount: 2.1 },
  { name: "Tue", amount: 3.4 },
  { name: "Wed", amount: 2.8 },
  { name: "Thu", amount: 4.1 },
  { name: "Fri", amount: 5.2 },
  { name: "Sat", amount: 1.8 },
  { name: "Sun", amount: 1.2 },
];

export default function AdminDashboard() {
  const selectedCounty = getSelectedCounty();
  
  const { data: applications } = useApplications();
  const { data: tenders } = useTenders();
  const { data: revenues } = useRevenueEntries();

  const pendingApprovals = applications.filter(a => a.status === "Pending Review").length;
  const activeTenders = tenders.filter(t => t.status === "Open" || t.status === "Evaluated").length;
  const totalRevenue = revenues.reduce((acc, r) => acc + r.amount, 0);

  const urgentQueue = applications.filter(a => a.status === "Pending Review").slice(0, 5);

  return (
    <DashboardLayout role="admin">
      <ErrorBoundary>
        <div className="space-y-8 pb-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
               <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-200">
                  <Zap className="w-6 h-6" />
               </div>
               <div>
                 <h2 className="text-3xl font-black text-gray-900 tracking-tight italic uppercase">{selectedCounty.name}</h2>
                  <p className="text-gray-500 font-medium leading-none">Command Center Dashboard (Executive Access)</p>
               </div>
            </div>
            <div className="flex gap-2">
              <Link to="/admin/analytics" className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-black transition flex items-center gap-2">
                 BI Reports
              </Link>
            </div>
          </div>

          {/* Global Executive KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Revenue", value: formatCurrency(totalRevenue), change: "+12.5%", trending: "up", icon: Coins, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Pending Approvals", value: pendingApprovals.toString(), change: "+3", trending: "up", icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Active Tenders", value: activeTenders.toString(), change: "0", trending: "up", icon: Briefcase, color: "text-orange-600", bg: "bg-orange-50" },
              { label: "Compliance Rate", value: "94.2%", change: "+0.5%", trending: "up", icon: ShieldCheck, color: "text-purple-600", bg: "bg-purple-50" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={cn("p-3 rounded-2xl transition duration-500 group-hover:scale-110", stat.bg, stat.color)}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <div className={cn("flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full", 
                    stat.trending === 'up' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  )}>
                    {stat.trending === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {stat.change}
                  </div>
                </div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                <h3 className="text-2xl font-black text-gray-900 leading-tight">{stat.value}</h3>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Revenue Analytics */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-200 shadow-sm flex flex-col h-full">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-gray-900 tracking-tight italic">Consolidated Revenue (7D)</h3>
                <select aria-label="Revenue time range" className="bg-gray-50 border border-gray-100 text-[10px] font-black rounded-lg px-2 py-1 uppercase italic focus:outline-none focus:ring-0">
                  <option>Week Stream</option>
                </select>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData}>
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fontWeight: 'bold', fill: '#9ca3af'}} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fontWeight: 'bold', fill: '#9ca3af'}}
                    />
                    <Tooltip 
                      cursor={{fill: '#f9fafb'}}
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    />
                    <Bar dataKey="amount" fill="#059669" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                 <div>
                    <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest">Revenue Moat Status</p>
                    <p className="text-sm font-black text-emerald-900 italic">Target: KES 30M / month remains on track.</p>
                 </div>
                 <Link to="/admin/revenue" className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition">
                    <ChevronRight className="w-4 h-4" />
                 </Link>
              </div>
            </div>

            {/* Quick Actions & Verticals */}
            <div className="grid grid-cols-2 gap-4">
              <Link to="/admin/procurement" className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 transition cursor-pointer group flex flex-col justify-between">
                 <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-orange-600 group-hover:text-white transition transform group-hover:rotate-6">
                    <Briefcase className="w-6 h-6" />
                 </div>
                 <div>
                    <h4 className="font-black text-gray-900 italic text-sm uppercase">Procurement</h4>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{activeTenders} Active Tenders</p>
                 </div>
              </Link>
              <Link to="/admin/revenue" className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 transition cursor-pointer group flex flex-col justify-between">
                 <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white transition transform group-hover:rotate-6">
                    <Coins className="w-6 h-6" />
                 </div>
                 <div>
                    <h4 className="font-black text-gray-900 italic text-sm uppercase">Revenue</h4>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Live Reconciliation</p>
                 </div>
              </Link>
              <Link to="/admin/health" className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 transition cursor-pointer group flex flex-col justify-between">
                 <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-red-600 group-hover:text-white transition transform group-hover:rotate-6">
                    <Building2 className="w-6 h-6" />
                 </div>
                 <div>
                    <h4 className="font-black text-gray-900 italic text-sm uppercase">Public Health</h4>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Facility Sync Active</p>
                 </div>
              </Link>
              <Link to="/admin/api-hub" className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 transition cursor-pointer group flex flex-col justify-between">
                 <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition transform group-hover:rotate-6">
                    <ShieldCheck className="w-6 h-6" />
                 </div>
                 <div>
                    <h4 className="font-black text-gray-900 italic text-sm uppercase">Interoperability</h4>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">KRA / eCitizen Hub</p>
                 </div>
              </Link>
            </div>
          </div>

          {/* Dynamic Applications Queue Table */}
          <div className="bg-white rounded-[2.5rem] border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-black text-gray-900 tracking-tight italic">Urgent Applications Queue</h3>
              <Link to="/admin/applications" className="text-[10px] font-black text-gray-400 hover:text-emerald-600 uppercase tracking-widest decoration-dotted underline">Full List</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-100">
                    <th className="px-8 py-4">Applicant</th>
                    <th className="px-8 py-4">Service Required</th>
                    <th className="px-8 py-4">Revenue Impact</th>
                    <th className="px-8 py-4">SLA Status</th>
                    <th className="px-8 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {urgentQueue.map((app) => (
                    <tr key={app.id} className="hover:bg-emerald-50/30 transition group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                           <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold", 
                              app.type === 'business' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                           )}>
                              {app.applicant.charAt(0)}
                           </div>
                           <p className="text-sm font-bold text-gray-900">{app.applicant}</p>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                         <p className="text-xs font-bold text-gray-500 uppercase">{app.service}</p>
                      </td>
                      <td className="px-8 py-5">
                         <p className="text-sm font-black text-gray-900">{formatCurrency(app.amount)}</p>
                      </td>
                      <td className="px-8 py-5">
                         <StatusBadge status={app.status} size="sm" />
                      </td>
                      <td className="px-8 py-5 text-right">
                          <Link to={`/admin/applications/${app.id}`} aria-label="Open application details" className="inline-flex px-4 py-1.5 bg-gray-50 text-gray-400 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition shadow-none hover:shadow-lg hover:shadow-emerald-200">
                            <span className="sr-only">Open application details</span>
                            <ArrowUpRight className="w-4 h-4" />
                          </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    </DashboardLayout>
  );
}
