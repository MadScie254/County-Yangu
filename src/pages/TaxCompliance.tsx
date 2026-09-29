import { addRevenueEntry } from "@/lib/store";
import { DashboardLayout } from "@/components/DashboardLayout";
import { 
  Calculator, 
  Clock, 
  ShieldCheck, 
  TrendingUp, 
  Coins, 
  FileText, 
  CheckCircle2, 
  Smartphone,
  Info,
  BarChart2,
  Loader2
} from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";
import { useSupabase } from "@/hooks/useSupabase";
import type { Application, Tender, RevenueEntry, AnomalyAlert, LandRecord, Petition, WelfareProgram, HealthDrugItem, Notification, Department,  } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export default function TaxCompliance() {
  const { profile } = useAuth();
  const [revenue, setRevenue] = useState("0");
  const [expenses, setExpenses] = useState("0");
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number || "");
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [isPaying, setIsPaying] = useState(false);

  const taxableIncome = Math.max(0, parseFloat(revenue || "0") - parseFloat(expenses || "0"));
  const estimatedTax = taxableIncome * 0.15; // Mock 15% rate

   const handlePay = async () => {
      if (estimatedTax <= 0) {
        setActionMessage("No tax due.");
        return;
      }
      if (!phoneNumber || phoneNumber.length < 9) {
        setActionMessage("Please enter a valid M-PESA phone number.");
        return;
      }
      
      setIsPaying(true);
      setActionMessage("Initiating M-PESA payment...");
      
      try {
        const { data, error } = await supabase.functions.invoke("mpesa-stk-push", {
           body: {
             phone: phoneNumber.startsWith("0") ? `254${phoneNumber.substring(1)}` : phoneNumber,
             amount: estimatedTax,
             accountReference: `SME-TAX-${Date.now().toString().slice(-4)}`
           }
        });
        
        if (error) throw error;
        
        // Log to revenue table for ledger tracking
        addRevenueEntry({
          ref: `TX${Date.now().toString().slice(-6)}`,
          amount: estimatedTax,
          user: profile?.name || "Citizen",
          stream: "SME Tax Payment",
          time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          reconciled: false,
        });
        
        setActionMessage(`Success! M-PESA prompt sent to ${phoneNumber}. Please complete the payment on your phone.`);
      } catch (err: any) {
        console.error(err);
        setActionMessage(`Payment failed: ${err.message || "Could not reach M-PESA gateway."}`);
      } finally {
        setIsPaying(false);
      }
   };

   const handleConfigureBridge = () => {
      setActionMessage("Opening the tax bridge support workflow for county configuration.");
   };

   const handleToggleRecords = () => {
      setShowAllRecords((current) => !current);
   };

  return (
    <DashboardLayout role="citizen">
      <div className="space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">KRA Tax Bridge for SMEs</h2>
            <p className="text-gray-500">Automate your iTax filings, track deadlines, and pay via M-PESA.</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 text-xs font-bold uppercase tracking-widest leading-none">
            <ShieldCheck className="w-4 h-4" />
            KRA Intermediary Active
          </div>
        </div>

        {/* Integration Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Compliance Status</p>
             <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h3 className="text-xl font-bold text-gray-900 leading-none">Fully Compliant</h3>
             </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Next iTax Deadline</p>
             <div className="flex items-center gap-2 text-red-600">
                <Clock className="w-5 h-5" />
                <h3 className="text-xl font-bold leading-none">May 20, 2026</h3>
             </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Unpaid Liability</p>
             <div className="flex items-center gap-1 text-gray-900">
                <span className="text-sm font-bold text-gray-400">KES</span>
                <h3 className="text-xl font-bold leading-none">1,240.00</h3>
             </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Last Payment Ref</p>
             <div className="flex items-center gap-1 text-emerald-600">
                <Smartphone className="w-5 h-5" />
                <h3 className="text-xl font-bold font-mono leading-none italic">RK29X0...</h3>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Tax Calculator & P&L Summary */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-200 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500"></div>
               <div className="flex items-center gap-2 mb-8">
                  <Calculator className="w-6 h-6 text-emerald-600" />
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight italic">Simplified SME P&L Summary</h3>
               </div>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                 <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Monthly Revenue (Gross)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">KES</span>
                        <input 
                          type="number" 
                                       title="Monthly revenue"
                                       placeholder="0"
                          value={revenue} 
                          onChange={(e) => setRevenue(e.target.value)}
                          className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-lg font-bold"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Monthly Expenses (EBITDA)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">KES</span>
                        <input 
                          type="number" 
                                       title="Monthly expenses"
                                       placeholder="0"
                          value={expenses} 
                          onChange={(e) => setExpenses(e.target.value)}
                          className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 text-lg font-bold"
                        />
                      </div>
                    </div>
                 </div>

                 <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-sm font-bold text-gray-500">Taxable Net Income:</span>
                       <span className="text-lg font-black text-gray-900">KES {taxableIncome.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                       <span className="text-sm font-bold text-gray-500 italic">Effective Rate:</span>
                       <span className="text-lg font-black text-emerald-600">15.0%</span>
                    </div>
                    <div className="flex items-center justify-between mb-4">
                       <span className="text-sm font-black text-gray-900 uppercase">Estimated Tax Due:</span>
                       <span className="text-2xl font-black text-blue-600 underline">KES {estimatedTax.toLocaleString()}</span>
                    </div>
                    
                    <div className="mb-4">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">M-PESA Phone Number</label>
                      <input 
                        type="tel" 
                        placeholder="07XX XXX XXX"
                        value={phoneNumber} 
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm font-bold"
                      />
                    </div>
                    
                    <button type="button" onClick={handlePay} disabled={isPaying} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-200">
                       {isPaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                       {isPaying ? "Processing..." : "Pay via M-PESA Push"}
                    </button>
                    <p className="mt-3 text-[10px] text-center text-gray-400 font-bold uppercase tracking-widest italic">Direct reconciliation with KRA Ledger</p>
                    {actionMessage && <p className={`mt-3 text-xs font-bold ${actionMessage.includes('failed') ? 'text-red-600' : 'text-emerald-600'}`}>{actionMessage}</p>}
                 </div>
               </div>
            </div>

            <div className="bg-blue-900 rounded-3xl p-8 text-white relative overflow-hidden group shadow-xl">
               <div className="absolute top-0 right-0 p-8 text-white/5 pointer-events-none group-hover:scale-110 transition duration-700">
                  <BarChart2 className="w-48 h-48" />
               </div>
               <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h3 className="text-2xl font-black mb-1 tracking-tighter italic uppercase">Automated KRA Reporting</h3>
                    <p className="text-blue-100/70 text-sm font-medium">Connect your sales ledger and let CountyConnect build your iTax returns.</p>
                  </div>
                  <button type="button" onClick={handleConfigureBridge} className="px-8 py-3 bg-white text-blue-900 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-emerald-400 hover:text-black transition transform active:scale-95 shadow-xl">
                    Configure Bridge
                  </button>
               </div>
               {actionMessage && <p className="relative z-10 mt-4 text-xs font-bold text-blue-100/80">{actionMessage}</p>}
            </div>
          </div>

          {/* Compliance Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
               <div className="p-6 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                     <FileText className="w-5 h-5 text-emerald-600" />
                     Submission History
                  </h3>
               </div>
               <div className="divide-y divide-gray-100">
                  {[
                    { month: "April 2026", status: "Filed", date: "May 02, 2026", amount: "KES 5,200" },
                    { month: "March 2026", status: "Filed", date: "April 02, 2026", amount: "KES 4,800" },
                    { month: "February 2026", status: "Filed", date: "March 02, 2026", amount: "KES 6,100" },
                  ].map((h, i) => (
                    <div key={i} className="p-4 hover:bg-gray-50 transition cursor-pointer flex items-center justify-between">
                       <div>
                          <p className="text-xs font-bold text-gray-900">{h.month}</p>
                          <p className="text-[10px] text-emerald-600 font-bold uppercase">{h.status}</p>
                       </div>
                       <div className="text-right">
                          <p className="text-xs font-bold text-gray-500">{h.amount}</p>
                          <p className="text-[10px] text-gray-400 italic">{h.date}</p>
                       </div>
                    </div>
                  ))}
               </div>
               <div className="p-4 bg-gray-50 border-t border-gray-100">
                           <button type="button" onClick={handleToggleRecords} className="w-full text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-900 transition">{showAllRecords ? "Show Recent Only" : "View All Records"}</button>
               </div>
                      {showAllRecords && (
                         <div className="px-4 pb-4 text-xs text-gray-500">
                            Archived records are now expanded for audit review and export.
                         </div>
                      )}
            </div>

            <div className="bg-white rounded-3xl border border-gray-200 p-6 flex flex-col items-center text-center shadow-sm">
               <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                  <Info className="w-6 h-6" />
               </div>
               <h4 className="font-bold text-gray-900 mb-2 italic">authorized Intermediary</h4>
               <p className="text-xs text-gray-500 font-medium leading-relaxed">
                 CountyConnect is an authorized intermediary for KRA iTax services under the County SME Support Act 2024.
               </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
