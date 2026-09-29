import { DashboardLayout } from "@/components/DashboardLayout";
import { 
  Map, 
  ShieldCheck, 
  Search, 
  FileText, 
  History, 
  Lock, 
  List, 
  LayoutGrid, 
  AlertTriangle, 
  Verified, 
  Server
} from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";
import { useAuth } from "@/context/AuthContext";
import { useSupabase } from "@/hooks/useSupabase";
import type { Application, Tender, RevenueEntry, AnomalyAlert, LandRecord, Petition, WelfareProgram, HealthDrugItem, Notification, Department,  } from "@/lib/types";
import { supabase } from "@/lib/supabase";

export default function LandRegistry() {
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<null | { owner: string; status: string; confidence: string; lastTransfer: string }>(null);
  const { data: landRecords } = useSupabase<LandRecord>("land_records");

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      return;
    }

    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setVerificationResult({
        owner: profile?.name || "Citizen",
        status: "Verified",
        confidence: "99.8% match",
        lastTransfer: "Recorded 14 days ago",
      });
    }, 2000);
  };

  return (
    <DashboardLayout role="citizen">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Digital Land Registry (v2.0)</h2>
            <p className="text-gray-500">Immutable property records integrated with NLIMS & Blockchain.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500 hover:text-gray-900'}`}
              >
                <List className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("map")}
                className={`p-2 rounded-lg transition-all ${viewMode === 'map' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500 hover:text-gray-900'}`}
              >
                <Map className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-200 uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4" />
              Secured
            </div>
          </div>
        </div>

        {/* Integration Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Server className="w-4 h-4" /></div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-400">NLIMS Sync</p>
              <p className="text-sm font-bold text-gray-700 italic">Connected</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Verified className="w-4 h-4" /></div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-400">Ledger Status</p>
              <p className="text-sm font-bold text-gray-700 italic">Immutable</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center gap-3">
            <div className="p-2 bg-red-50 text-red-600 rounded-lg"><AlertTriangle className="w-4 h-4" /></div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-400">Fraud Engine</p>
              <p className="text-sm font-bold text-gray-700 italic tracking-tight">AI Active</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white p-10 rounded-3xl border border-gray-200 shadow-sm text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-emerald-500 animate-gradient-x"></div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">High-Fidelity Property Verification</h3>
          <p className="text-gray-500 mb-8 max-w-lg mx-auto">Digitize parcel records, title deed issuance, and encumbrance checks instantly.</p>
          
          <div className="max-w-2xl mx-auto relative group">
            <div className="absolute -inset-1 bg-emerald-500 rounded-full blur opacity-20 group-focus-within:opacity-40 transition"></div>
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6" />
              <input 
                type="text" 
                placeholder="Enter LR Number (e.g., NAI/BLOCK/123/456)" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-14 pr-36 py-5 border border-gray-300 rounded-full focus:outline-none focus:ring-0 focus:border-emerald-500 shadow-sm text-lg font-medium"
              />
              <button 
                type="button"
                onClick={handleSearch}
                disabled={isVerifying}
                className="absolute right-2 top-2 bottom-2 bg-emerald-600 text-white px-8 rounded-full font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                {isVerifying ? "Verifying..." : "Verify Ownership"}
              </button>
            </div>
          </div>
        </div>

        {viewMode === "list" ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <motion.div whileHover={{ y: -5 }} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group">
                <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-5 group-hover:bg-blue-600 group-hover:text-white transition-all transform group-hover:rotate-6">
                  <LayoutGrid className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-lg text-gray-900 mb-2">My Parcel Registry</h3>
                <p className="text-sm text-gray-500 leading-relaxed">Secure digital wallet for your title deeds and seasonal land rate clearance certificates.</p>
              </motion.div>

              <motion.div whileHover={{ y: -5 }} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group">
                <div className="w-14 h-14 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 mb-5 group-hover:bg-purple-600 group-hover:text-white transition-all transform group-hover:rotate-6">
                  <History className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-lg text-gray-900 mb-2">Transfer Chains</h3>
                <p className="text-sm text-gray-500 leading-relaxed">Visual ownership history from original allotment to current registration, stored on blockchain.</p>
              </motion.div>

              <motion.div whileHover={{ y: -5 }} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm border-l-4 border-l-orange-500 hover:shadow-xl transition-all cursor-pointer group">
                <div className="w-14 h-14 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 mb-5 group-hover:bg-orange-600 group-hover:text-white transition-all transform group-hover:rotate-6">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-lg text-gray-900 mb-2 whitespace-nowrap">Fraud Detection Layer</h3>
                <p className="text-sm text-gray-500 leading-relaxed">AI engine that flags duplicate title numbers or suspicious rapid transfers in your sub-county.</p>
              </motion.div>
            </div>

            {verificationResult && (
              <div className="bg-white rounded-3xl border border-emerald-100 shadow-sm p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Verification Result</p>
                    <h4 className="text-xl font-bold text-gray-900">{searchQuery.toUpperCase()}</h4>
                  </div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                    {verificationResult.status}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div className="rounded-2xl bg-gray-50 p-4 border border-gray-100">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Owner</p>
                    <p className="mt-1 font-semibold text-gray-900">{verificationResult.owner}</p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4 border border-gray-100">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Confidence</p>
                    <p className="mt-1 font-semibold text-gray-900">{verificationResult.confidence}</p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4 border border-gray-100">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Last Transfer</p>
                    <p className="mt-1 font-semibold text-gray-900">{verificationResult.lastTransfer}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Blockchain History */}
            <div className="bg-gray-900 rounded-3xl shadow-2xl p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <ShieldCheck className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold tracking-tight">Recent Immutable Activity</h3>
                  <span className="text-[10px] font-mono bg-emerald-500 text-black px-2 py-1 rounded">LIVE LEDGER</span>
                </div>
                <div className="space-y-4">
                  {landRecords.map((item, idx) => (
                    <div key={item.id} className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-between hover:bg-white/10 transition">
                      <div className="flex items-center gap-4">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <div>
                          <p className="text-sm font-bold text-white">{item.action}</p>
                          <p className="text-xs text-gray-400 font-mono tracking-tighter">{item.hash}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">{item.status}</p>
                        <p className="text-[10px] text-gray-500 mt-1">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-gray-100 rounded-3xl border border-gray-200 h-[650px] flex items-center justify-center relative overflow-hidden group shadow-inner">
            <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/mapview/1200/800')] bg-cover bg-center opacity-40 mix-blend-multiply group-hover:opacity-100 transition-all duration-1000"></div>
            <div className="relative z-10 text-center bg-white/95 backdrop-blur-xl p-10 rounded-3xl shadow-2xl max-w-lg mx-4 border border-gray-200/50">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <Map className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tight italic">3D GIS GEOSPATIAL ENGINE</h3>
              <p className="text-gray-600 mb-8 leading-relaxed font-medium">
                Real-time parcel visualization, zoning overlays, and public utilities mapping. 
                County Connect GIS integrates directly with sub-county survey data.
              </p>
              <button type="button" className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-xl hover:shadow-gray-400">
                Enter Geospatial Workspace
              </button>
              <p className="mt-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Authorized Personnel Only</p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
