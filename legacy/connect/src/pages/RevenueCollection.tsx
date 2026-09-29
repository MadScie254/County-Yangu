import { useRevenueEntries } from "@/lib/store";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Coins, Smartphone, TrendingUp, AlertCircle, BarChart3, Search, Filter } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { formatCurrency, generatePDFReport } from "@/lib/utils";
import { AdminActionModal } from "@/components/AdminActionModal";

const TARGET_WIDTH_CLASSES: Record<string, string> = {
   "80%": "w-4/5",
   "95%": "w-[95%]",
   "65%": "w-[65%]",
   "40%": "w-2/5",
};

export default function RevenueCollection() {
   const [advancedReconEnabled, setAdvancedReconEnabled] = useState(false);
   const [isModalOpen, setIsModalOpen] = useState(false);
   const [treasuryMessage, setTreasuryMessage] = useState("");
   const { data: revenueEntries } = useRevenueEntries();

   const recentEntries = revenueEntries.slice(0, 10);
   const totalMpesa = revenueEntries.reduce((sum, entry) => sum + entry.amount, 0);

   const confirmTreasuryPush = () => {
      setTreasuryMessage("Revenue batch queued for IFMIS treasury sync and audit log export.");
      setIsModalOpen(false);
   };

   const handleExportArrears = () => {
      // Mock data for the export
      const data = [
        ["LND-0012", "John Doe", "Nairobi CBD", "KES 45,000", "90 Days"],
        ["LND-0015", "Jane Smith", "Westlands", "KES 120,000", "120 Days"],
        ["MKT-004", "Kamau Traders", "City Market", "KES 15,000", "45 Days"],
      ];
      generatePDFReport("Target List - Uncollected Rates Arrears", ["Asset ID", "Owner", "Zone", "Amount Due", "Aging"], data, "Rates-Arrears-Report");
   };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight tracking-tight px-0.5">Unified Revenue Engine</h2>
            <p className="text-gray-500 italic mt-0.5">Real-time M-PESA reconciliation for parking, market fees, and levies.</p>
          </div>
          <div className="flex items-center gap-3">
             <button type="button" onClick={() => setAdvancedReconEnabled((current) => !current)} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-100 flex items-center gap-2">
                <Filter className="w-4 h-4" />
                {advancedReconEnabled ? "Recon Enabled" : "Advanced Recon"}
             </button>
          </div>
        </div>

        {/* Live Stream Ticker */}
        <div className="bg-gray-900 text-emerald-400 py-3 px-6 rounded-2xl flex items-center gap-4 overflow-hidden shadow-2xl">
           <div className="flex-shrink-0 flex items-center gap-2 font-bold text-xs uppercase tracking-widest border-r border-emerald-400/30 pr-4">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
              Live Feed
           </div>
            <div className="flex gap-12 animate-marquee whitespace-nowrap font-mono text-sm">
              {recentEntries.map((entry, idx) => (
                <span key={idx}>[{entry.time}] {entry.user}: {formatCurrency(entry.amount)} {entry.reconciled ? "RECONCILED" : "PENDING"} (ref: {entry.ref})</span>
              ))}
            </div>
        </div>

        {/* Revenue KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
             <div className="flex items-center justify-between mb-6">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Smartphone className="w-6 h-6" /></div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">MOBILE MONEY FIRST</span>
             </div>
             <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">M-PESA Daily Flow</p>
             <h3 className="text-3xl font-black text-gray-900 mb-2">{formatCurrency(totalMpesa)}</h3>
             <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
                <TrendingUp className="w-3 h-3" /> +18.2% (MTD)
             </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
             <div className="flex items-center justify-between mb-6">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><BarChart3 className="w-6 h-6" /></div>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">TOTAL REVENUE</span>
             </div>
             <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">FY Performance</p>
             <h3 className="text-3xl font-black text-gray-900 mb-2">KES 4.2B</h3>
             <div className="flex items-center gap-2 text-xs font-bold text-blue-600">
                <TrendingUp className="w-3 h-3" /> 82% of Projection
             </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
             <div className="flex items-center justify-between mb-6">
                <div className="p-3 bg-red-50 text-red-600 rounded-2xl"><AlertCircle className="w-6 h-6" /></div>
                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">UNCOLLECTED</span>
             </div>
             <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Rates Arrears</p>
             <h3 className="text-3xl font-black text-red-600 mb-2">KES 120M</h3>
             <div onClick={handleExportArrears} className="flex items-center gap-2 text-xs font-bold text-red-600 underline cursor-pointer">
                Export Target List
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {/* Parking & Markets Breakdown */}
           <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-100">
                 <h3 className="text-lg font-black text-gray-900 tracking-tight italic">Stream-wise Performance</h3>
              </div>
              <div className="p-8">
                 <div className="space-y-6">
                    {[
                       { stream: "Daily Parking (On-street)", value: "KES 2.4M", target: "80%", color: "bg-emerald-500" },
                       { stream: "Market Stall Levies", value: "KES 420K", target: "95%", color: "bg-blue-500" },
                       { stream: "Health Services (Cashless)", value: "KES 1.1M", target: "65%", color: "bg-orange-500" },
                       { stream: "Outdoor Advertising", value: "KES 820K", target: "40%", color: "bg-red-500" },
                    ].map((s, i) => (
                       <div key={i} className="space-y-2">
                          <div className="flex items-center justify-between text-sm font-bold">
                             <span className="text-gray-700">{s.stream}</span>
                             <span className="text-gray-900">{s.value}</span>
                          </div>
                          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden flex">
                             <div className={`${s.color} ${TARGET_WIDTH_CLASSES[s.target] ?? "w-full"} h-full rounded-full transition-all duration-1000`}></div>
                          </div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">{s.target} of Daily Goal</p>
                       </div>
                    ))}
                 </div>
              </div>
           </div>

           {/* M-PESA Reconciliation Window */}
           <div className="bg-emerald-950 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
              <div className="p-8 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-black font-black">M</div>
                   <div>
                      <h3 className="text-white font-black tracking-tight">M-PESA C2B RECON</h3>
                      <p className="text-[10px] text-emerald-400 font-bold uppercase">Paybill: 123456</p>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-emerald-400 font-mono text-lg font-black">99.9%</p>
                   <p className="text-[10px] text-gray-500 font-bold">MATCH RATE</p>
                </div>
              </div>
              <div className="p-8 flex-1">
                  <div className="space-y-4">
                    {revenueEntries.slice(0, 5).map((entry, idx) => (
                       <div key={idx} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition group cursor-default">
                          <div className="flex items-center gap-4">
                             <p className="text-emerald-400 font-mono text-sm">{entry.time}</p>
                             <div>
                                <p className="text-sm font-bold text-white group-hover:text-emerald-400 transition">{entry.stream}</p>
                                <p className="text-[10px] text-gray-500 font-mono italic">{entry.ref}</p>
                             </div>
                          </div>
                          <p className="text-sm font-black text-emerald-400">{formatCurrency(entry.amount)}</p>
                       </div>
                    ))}
                  </div>
              </div>
              <div className="p-8 pt-0 mt-4">
                 <button type="button" onClick={() => setIsModalOpen(true)} className="w-full py-4 bg-emerald-500 text-black font-black rounded-2xl hover:bg-emerald-400 transition shadow-xl shadow-emerald-500/20 uppercase tracking-widest text-sm italic">
                    Push To Treasury IFMIS
                 </button>
                 {treasuryMessage && <p className="mt-4 text-xs font-bold text-emerald-300 text-center">{treasuryMessage}</p>}
              </div>
           </div>
        </div>

        <AdminActionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Confirm Treasury Push"
          description="You are about to push the reconciled revenue batch to the national IFMIS treasury system."
        >
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-500">Batch Total:</span>
                <span className="text-sm font-bold text-gray-900">{formatCurrency(totalMpesa)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Transactions:</span>
                <span className="text-sm font-bold text-gray-900">{revenueEntries.length}</span>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmTreasuryPush}
                className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors"
              >
                Confirm Push
              </button>
            </div>
          </div>
        </AdminActionModal>
      </div>
    </DashboardLayout>
  );
}
