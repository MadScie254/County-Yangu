import { DashboardLayout } from "@/components/DashboardLayout";
import { BarChart3, TrendingUp, TrendingDown, Target, Zap, Globe, Map as MapIcon, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { useSupabase } from "@/hooks/useSupabase";
import type { Application, Tender, RevenueEntry, AnomalyAlert, LandRecord, Petition, WelfareProgram, HealthDrugItem, Notification, Department,  } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const revenueData = [
  { month: 'Jan', revenue: 420 },
  { month: 'Feb', revenue: 580 },
  { month: 'Mar', revenue: 710 },
  { month: 'Apr', revenue: 680 },
  { month: 'May', revenue: 850 },
  { month: 'Jun', revenue: 990 },
];

const sectorData = [
   { name: 'Business Permits', value: 45, color: '#059669', dotClass: 'bg-emerald-500' },
   { name: 'Land Rates', value: 30, color: '#2563eb', dotClass: 'bg-blue-500' },
   { name: 'Parking', value: 15, color: '#f59e0b', dotClass: 'bg-amber-500' },
   { name: 'Health Fees', value: 10, color: '#ef4444', dotClass: 'bg-red-500' },
];

export default function ExecutiveAnalytics() {
   const [viewScope, setViewScope] = useState<"regional" | "county">("regional");
   const { data: apps } = useSupabase<Application>("applications");
   const { data: tenders } = useSupabase<Tender>("tenders");
   const { data: revenue } = useSupabase<RevenueEntry>("revenue");
   const { data: anomalies } = useSupabase<AnomalyAlert>("anomalies");
   const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
   const approvedPct = apps.length ? Math.round((apps.filter(a => a.status === "Approved").length / apps.length) * 100 * 10) / 10 : 0;

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center text-emerald-400 shadow-xl">
                <Target className="w-7 h-7" />
             </div>
             <div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight italic uppercase">Governor's Command Center</h2>
                <p className="text-gray-500 italic font-medium leading-none">Real-time cross-departmental executive intelligence dashboard.</p>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <button type="button" onClick={() => setViewScope((currentScope) => (currentScope === "regional" ? "county" : "regional"))} className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-black transition shadow-2xl flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                {viewScope === "regional" ? "Regional View" : "County View"}
             </button>
          </div>
        </div>

        {/* Global KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
           <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Service Efficiency</p>
               <h3 className="text-4xl font-black text-gray-900 leading-none">{approvedPct}%</h3>
              <p className="text-xs font-bold text-emerald-600 mt-2 flex items-center gap-1 leading-none">
                 <TrendingUp className="w-3 h-3" /> +4.2% Since Jan
              </p>
           </div>
           <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Budget Absorption</p>
              <h3 className="text-4xl font-black text-gray-900 leading-none">62.8%</h3>
              <p className="text-xs font-bold text-orange-500 mt-2 flex items-center gap-1 leading-none">
                 <Zap className="w-3 h-3" /> Within Target Zone
              </p>
           </div>
           <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Revenue Variance</p>
               <h3 className="text-4xl font-black text-emerald-600 leading-none">+{formatCurrency(totalRevenue)}</h3>
              <p className="text-xs font-bold text-emerald-600 mt-2 flex items-center gap-1 leading-none italic font-serif">
                 Surplus Projection
              </p>
           </div>
           <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Public Approval</p>
              <h3 className="text-4xl font-black text-gray-900 leading-none">82%</h3>
              <p className="text-xs font-bold text-blue-600 mt-2 flex items-center gap-1 leading-none">
                 <BarChart3 className="w-3 h-3" /> High Satisfaction
              </p>
           </div>
        </div>

        {/* Major Charts Overlay */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-gray-200 shadow-sm p-8 flex flex-col">
              <div className="flex items-center justify-between mb-8">
                 <div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight italic">Consolidated Revenue Trend</h3>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Aggregate across all mobile & bank channels</p>
                 </div>
                 <select aria-label="Revenue time range" className="bg-gray-50 border border-gray-100 text-[10px] font-black rounded-lg px-3 py-1 uppercase focus:outline-none focus:ring-1 focus:ring-gray-900">
                    <option>Last 6 Months</option>
                    <option>Year to Date</option>
                 </select>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis 
                       dataKey="month" 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{fontSize: 10, fontWeight: 'bold', fill: '#9ca3af'}} 
                    />
                    <YAxis 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{fontSize: 10, fontWeight: 'bold', fill: '#9ca3af'}}
                       tickFormatter={(value) => `K${value}M`}
                    />
                    <Tooltip 
                       contentStyle={{backgroundColor: '#111827', borderRadius: '12px', border: 'none', color: '#fff'}}
                       itemStyle={{fontWeight: 'bold', color: '#059669'}}
                    />
                    <Line 
                       type="monotone" 
                       dataKey="revenue" 
                       stroke="#059669" 
                       strokeWidth={4} 
                       dot={{ r: 6, fill: '#059669', strokeWidth: 0 }} 
                       activeDot={{ r: 8, strokeWidth: 0, fill: '#059669' }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
           </div>

           <div className="bg-white rounded-[2.5rem] border border-gray-200 shadow-sm p-8 flex flex-col">
              <h3 className="text-xl font-black text-gray-900 tracking-tight italic mb-8">Collection Breakdown</h3>
              <div className="h-64 w-full mb-8">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sectorData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {sectorData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-4">
                 {sectorData.map((s, i) => (
                    <div key={i} className="flex items-center justify-between group cursor-default">
                       <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${s.dotClass}`}></div>
                          <span className="text-sm font-bold text-gray-700 group-hover:text-gray-900 transition">{s.name}</span>
                       </div>
                       <span className="text-sm font-black text-gray-900">{s.value}%</span>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Priority Focus Areas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="bg-emerald-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden group cursor-pointer shadow-2xl">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition duration-700 pointer-events-none">
                 <MapIcon className="w-56 h-56" />
              </div>
              <div className="relative z-10">
                 <h3 className="text-2xl font-black mb-2 tracking-tight italic uppercase">Geospatial Intelligence</h3>
                 <p className="text-emerald-100/70 mb-8 max-w-sm font-medium">Unlocking land rates revenue through high-fidelity satellite mapping and zoning automation.</p>
                 <div className="flex items-center gap-4">
                    <div>
                       <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Parcel Mapped</p>
                       <p className="text-2xl font-black">100%</p>
                    </div>
                    <div className="w-px h-10 bg-emerald-500/30"></div>
                    <div>
                       <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Rate Compliance</p>
                       <p className="text-2xl font-black">62%</p>
                    </div>
                 </div>
                 <div className="mt-8 flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition">
                    <span className="text-xs font-bold italic">Explore Satellite Zoning Overlays</span>
                    <ChevronRight className="w-4 h-4" />
                 </div>
              </div>
           </div>

           <div className="bg-blue-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden group cursor-pointer shadow-2xl">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition duration-700 pointer-events-none">
                 <Zap className="w-56 h-56" />
              </div>
              <div className="relative z-10">
                 <h3 className="text-2xl font-black mb-2 tracking-tight italic uppercase">Infrastructure Pipeline</h3>
                 <p className="text-blue-100/70 mb-8 max-w-sm font-medium">Tracking multi-billion shilling projects from tender award to physical inspection.</p>
                 <div className="flex items-center gap-4">
                    <div>
                       <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Active CAPEX</p>
                       <p className="text-2xl font-black">KES 1.8B</p>
                    </div>
                    <div className="w-px h-10 bg-blue-500/30"></div>
                    <div>
                       <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">On-Time Rate</p>
                       <p className="text-2xl font-black">78%</p>
                    </div>
                 </div>
                 <div className="mt-8 flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition">
                    <span className="text-xs font-bold italic">View Executive Project Inspectorate</span>
                    <ChevronRight className="w-4 h-4" />
                 </div>
              </div>
           </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
