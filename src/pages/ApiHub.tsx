import { DashboardLayout } from "@/components/DashboardLayout";
import { Database, Zap, ShieldCheck, Activity, Terminal, Key, Search, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

export default function ApiHub() {
   const [apiKey, setApiKey] = useState("sk_live_51P2u...9xJ31l");
   const [copyMessage, setCopyMessage] = useState("");

   const handleCopy = async (text: string, label: string) => {
      await navigator.clipboard.writeText(text);
      setCopyMessage(`${label} copied to clipboard.`);
   };

   const regenerateKey = () => {
      const nextKey = `sk_live_${Math.random().toString(36).slice(2, 8)}...${Math.random().toString(36).slice(2, 7)}`;
      setApiKey(nextKey);
      setCopyMessage("Production API key regenerated for the current county session.");
   };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">County Interoperability Hub</h2>
            <p className="text-gray-500 italic">Central middleware connecting eCitizen, KRA, NTSA, and National ID databases.</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest leading-none">Service Mesh Active</span>
             </div>
          </div>
        </div>

        {/* API Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
           <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Requests (24h)</p>
              <h3 className="text-3xl font-black text-gray-900">420.2K</h3>
              <div className="w-full bg-gray-100 h-1 mt-4 rounded-full overflow-hidden">
                 <div className="bg-emerald-500 h-full w-[80%]"></div>
              </div>
           </div>
           <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Success Rate</p>
              <h3 className="text-3xl font-black text-emerald-600">99.98%</h3>
              <p className="text-[10px] text-gray-400 font-bold mt-2">AVG LATENCY: 42ms</p>
           </div>
           <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Active Integrations</p>
              <h3 className="text-3xl font-black text-gray-900">14</h3>
              <p className="text-[10px] text-emerald-600 font-bold mt-2 italic flex items-center gap-1">
                 <ShieldCheck className="w-3 h-3" /> Secure Gateways
              </p>
           </div>
           <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Partner API Billing</p>
              <h3 className="text-3xl font-black text-blue-600">KES 2.4M</h3>
              <p className="text-[10px] text-gray-400 font-bold mt-2 underline cursor-pointer">View Monetization Log</p>
           </div>
        </div>

        {/* Integration Hub */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                 <h3 className="font-bold text-gray-900 flex items-center gap-2 italic">
                   <Database className="w-5 h-5 text-emerald-600" />
                   Managed Data Bridges
                 </h3>
                 <div className="relative">
                    <Search className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Search bridges..." className="pl-8 pr-4 py-1 border border-gray-200 rounded-full text-[10px] uppercase font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                 </div>
              </div>
              <div className="p-0">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-100">
                          <th className="px-8 py-3">Endpoint</th>
                          <th className="px-8 py-3 text-center">Status</th>
                          <th className="px-8 py-3">Load</th>
                          <th className="px-8 py-3"></th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                       {[
                          { name: "KRA iTax Real-time Validator", url: "kra-itax-v2", status: "Healthy", load: "Mid", icon: "🇮" },
                          { name: "eCitizen Single Sign-On", url: "ecitizen-auth", status: "Healthy", load: "High", icon: "🇪" },
                          { name: "NTSA Vehicle Registry", url: "ntsa-vms", status: "Latency Warning", load: "Low", icon: "🇳" },
                          { name: "IFMIS G-Payment Gateway", url: "ifmis-pay", status: "Healthy", load: "Extreme", icon: "🇮" },
                          { name: "Huduma Biometric ID Bridge", url: "huduma-bio", status: "Healthy", load: "Mid", icon: "🇭" },
                       ].map((api, i) => (
                          <tr key={i} className="hover:bg-emerald-50/30 transition group">
                             <td className="px-8 py-5">
                                <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 group-hover:bg-emerald-600 group-hover:text-white transition">
                                      {api.icon}
                                   </div>
                                   <div>
                                      <p className="text-sm font-bold text-gray-900 leading-none mb-1">{api.name}</p>
                                      <p className="text-[10px] font-mono text-gray-400">/api/v1/bridge/{api.url}</p>
                                   </div>
                                </div>
                             </td>
                             <td className="px-8 py-5 text-center">
                                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${
                                   api.status === 'Healthy' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                }`}>
                                   {api.status}
                                </span>
                             </td>
                             <td className="px-8 py-5">
                                <div className="w-20 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                   <div className={`h-full ${api.load === 'Extreme' ? 'bg-red-500 w-full' : api.load === 'High' ? 'bg-orange-500 w-3/4' : 'bg-emerald-500 w-1/4'}`}></div>
                                </div>
                             </td>
                             <td className="px-8 py-5 text-right">
                                <button type="button" onClick={() => handleCopy(`/api/v1/bridge/${api.url}`, api.name)} className="p-2 hover:bg-white rounded-lg text-gray-400 hover:text-emerald-600 transition shadow-none hover:shadow-sm" aria-label={`Copy ${api.name} endpoint`}>
                                   <ArrowRight className="w-4 h-4" />
                                </button>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>

           {/* API Security & Keys */}
           <div className="space-y-6">
              <div className="bg-gray-900 rounded-3xl p-8 text-white relative overflow-hidden flex flex-col shadow-2xl">
                 <div className="absolute top-0 right-0 p-8 text-white/5 pointer-events-none">
                    <Terminal className="w-48 h-48" />
                 </div>
                 <div className="relative z-10 flex-1">
                    <div className="flex items-center gap-2 mb-6">
                       <Key className="w-5 h-5 text-emerald-400" />
                       <h3 className="text-lg font-black tracking-tight italic uppercase">Authorization Moat</h3>
                    </div>
                    <div className="p-4 bg-white/5 border border-white/10 rounded-2xl mb-6">
                       <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Production API Key</p>
                       <div className="flex items-center justify-between">
                          <p className="font-mono text-xs text-emerald-400 truncate pr-4">{apiKey}</p>
                          <button type="button" onClick={() => handleCopy(apiKey, "Production API key")} className="text-[10px] font-bold text-white/50 hover:text-white uppercase transition">Copy</button>
                       </div>
                    </div>
                    <p className="text-xs text-gray-400 font-medium leading-relaxed mb-8">
                       Authorized partner banks and intermediaries access verified license data through this gateway. 
                       <span className="text-emerald-400"> Monetize every verification call.</span>
                    </p>
                    <button type="button" onClick={regenerateKey} className="w-full py-4 bg-emerald-500 text-black font-black rounded-2xl hover:bg-emerald-400 transition transform active:scale-95 shadow-xl shadow-emerald-500/20 uppercase tracking-[0.2em] text-xs">
                       Regenerate Credentials
                    </button>
                    {copyMessage && <p className="mt-4 text-xs text-emerald-300">{copyMessage}</p>}
                 </div>
              </div>

              <button type="button" onClick={() => { window.location.href = "mailto:developers@countyconnect.go.ke?subject=CountyConnect%20API%20Documentation"; }} className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm relative overflow-hidden flex items-center justify-between cursor-pointer group text-left">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-600"></div>
                  <div>
                     <h4 className="font-black text-gray-900 italic mb-1 uppercase tracking-tighter">Developer Documentation</h4>
                     <p className="text-xs text-gray-500 font-medium leading-tight">Explore the CountyConnect interoperability standards and SDKs.</p>
                  </div>
                  <div className="w-10 h-10 rounded-full border border-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-emerald-600 group-hover:text-white transition transform group-hover:rotate-45">
                     <ArrowRight className="w-5 h-5" />
                  </div>
              </button>
           </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
