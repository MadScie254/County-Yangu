import { updateDrugStock, useHealthDrugs } from "@/lib/store";
import { DashboardLayout } from "@/components/DashboardLayout";
import { HeartPulse, FlaskConical, Stethoscope, ClipboardList, Package, TrendingUp, Search } from "lucide-react";
import { useState } from "react";
import { AdminActionModal } from "@/components/AdminActionModal";

export default function PublicHealth() {
   const [restockMessage, setRestockMessage] = useState("");
   const [dispatchMessage, setDispatchMessage] = useState("");
   const { data: healthDrugs } = useHealthDrugs();
   const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
   const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);

   const confirmRestockAll = async () => {
      await Promise.all(
         healthDrugs
            .filter((drug) => drug.level === "critical")
            .map((drug) => updateDrugStock(drug.id, "Restocked (100 units)", "high"))
      );
      setRestockMessage("Critical stock-out facilities have been queued for immediate replenishment.");
      setIsRestockModalOpen(false);
   };

   const confirmDispatchReports = () => {
      setDispatchMessage("MOH 105 reports dispatched to the county health office and archived locally.");
      setIsDispatchModalOpen(false);
   };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight tracking-tight">Public Health Management (v3.0)</h2>
            <p className="text-gray-500 italic">Level 2/3 facility digitization & MOH105 reporting automation.</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-xs font-bold text-emerald-800">42 Facilities Live</span>
             </div>
          </div>
        </div>

        {/* Global KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition duration-500 cursor-default">
                <Stethoscope className="w-12 h-12" />
             </div>
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Total Patients Today</p>
             <h3 className="text-4xl font-black text-gray-900">4,281</h3>
             <p className="text-xs font-bold text-emerald-600 mt-2 flex items-center gap-1">
               <TrendingUp className="w-3 h-3" /> +12% vs Yesterday
             </p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition duration-500 cursor-default">
                <Package className="w-12 h-12" />
             </div>
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Critical Stock Outs</p>
             <h3 className="text-4xl font-black text-red-600">{healthDrugs.filter(d => d.level === "critical").length}</h3>
             <p className="text-xs font-bold text-gray-400 mt-2">Facilities Reporting</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition duration-500 cursor-default">
                <FlaskConical className="w-12 h-12" />
             </div>
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Lab Revenue</p>
             <h3 className="text-4xl font-black text-gray-900">KES 820K</h3>
             <p className="text-xs font-bold text-emerald-600 mt-2">Real-time Verified</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition duration-500 cursor-default">
                <ClipboardList className="w-12 h-12" />
             </div>
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">MOH105 Compliance</p>
             <h3 className="text-4xl font-black text-gray-900">98.5%</h3>
             <p className="text-xs font-bold text-blue-600 mt-2 font-mono italic underline cursor-pointer">Auto-Generate Report</p>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {/* Drug Inventory Tracker */}
           <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 flex items-center gap-2 italic">
                  <Package className="w-5 h-5 text-blue-600" />
                  Drug Stock Control Bridge
                </h3>
                        <button type="button" onClick={() => setIsRestockModalOpen(true)} className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline">Restock All</button>
              </div>
              <div className="p-6">
                 <div className="space-y-4">
                   {healthDrugs.slice(0, 4).map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 border border-gray-50 rounded-xl hover:bg-gray-50 transition">
                         <div>
                            <p className="text-sm font-bold text-gray-900">{item.name}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase">{item.facility}</p>
                         </div>
                         <div className="text-right">
                            <p className={`text-sm font-black ${item.level === 'critical' ? 'text-red-500' : 'text-emerald-500'}`}>{item.stock}</p>
                            <p className="text-[10px] text-gray-400 italic">Real-time sync</p>
                         </div>
                      </div>
                   ))}
                 </div>
                 {restockMessage && <p className="mt-4 text-xs font-bold text-emerald-600">{restockMessage}</p>}
              </div>
           </div>

           {/* MOH 105 Reporting Automation */}
           <div className="bg-emerald-900 rounded-3xl shadow-xl p-8 text-white relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-8 text-white/5 pointer-events-none">
                 <ClipboardList className="w-64 h-64" />
              </div>
              <div className="relative z-10">
                 <h3 className="text-2xl font-black mb-4 tracking-tighter italic">MOH 105 AUTO-GEN</h3>
                 <p className="text-emerald-100/70 mb-8 max-w-sm font-medium leading-relaxed">
                   CountyConnect automatically aggregates patient registration, drug stock tracking, and clinical outcomes into standard MOH 105 formats. 
                   Eliminate 90+ hours of monthly manual reporting.
                 </p>
                 <div className="bg-white/5 border border-white/20 p-6 rounded-2xl backdrop-blur-sm">
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em] mb-4">Pending Approvals</p>
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                       <span className="text-sm font-bold">April 2026 Facility Summary</span>
                       <span className="text-xs bg-emerald-500 text-black px-2 py-0.5 rounded font-bold">READY</span>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-sm font-bold">Drug Leakage Audit Log</span>
                       <span className="text-xs bg-red-400 text-black px-2 py-0.5 rounded font-bold italic">FLAGGED</span>
                    </div>
                 </div>
              </div>
              <button type="button" onClick={() => setIsDispatchModalOpen(true)} className="relative z-10 mt-8 py-4 bg-emerald-500 text-black font-black rounded-2xl hover:bg-emerald-400 transition transform active:scale-95 shadow-xl shadow-emerald-500/20 uppercase tracking-widest text-sm">
                 Dispatch Reports to MOH
              </button>
              {dispatchMessage && <p className="relative z-10 mt-4 text-xs font-bold text-emerald-200">{dispatchMessage}</p>}
           </div>
        </div>

        <AdminActionModal
          isOpen={isRestockModalOpen}
          onClose={() => setIsRestockModalOpen(false)}
          title="Confirm Fleet Dispatch"
          description="You are about to authorize the deployment of medical supplies to all Level 2 and Level 3 facilities currently reporting critical stock-outs."
        >
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setIsRestockModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              Cancel
            </button>
            <button onClick={confirmRestockAll} className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-2">
              Authorize Dispatch <Package className="w-4 h-4" />
            </button>
          </div>
        </AdminActionModal>

        <AdminActionModal
          isOpen={isDispatchModalOpen}
          onClose={() => setIsDispatchModalOpen(false)}
          title="Dispatch MOH 105 Reports"
          description="This action will finalize the current reporting period and securely transmit the aggregated MOH 105 reports to the national Ministry of Health database."
        >
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setIsDispatchModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              Cancel
            </button>
            <button onClick={confirmDispatchReports} className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-2">
              Transmit Reports <ClipboardList className="w-4 h-4" />
            </button>
          </div>
        </AdminActionModal>

      </div>
    </DashboardLayout>
  );
}
