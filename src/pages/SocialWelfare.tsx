import { useWelfarePrograms } from "@/lib/store";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Users, Heart, Wallet, CheckCircle2, Clock, MapPin, Search } from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";

export default function SocialWelfare() {
  const [statusMessage, setStatusMessage] = useState("");
  const [showOffices, setShowOffices] = useState(false);
  const { data: programs } = useWelfarePrograms();

  const handleEligibilityCheck = () => {
    setStatusMessage("Eligibility pre-check started. Your household profile is being matched.");
  };

  const handleScheduleSync = () => {
    setStatusMessage("Biometric sync scheduled for your nearest welfare office.");
  };

  const handleViewOffices = () => {
    setShowOffices((current) => !current);
  };

  return (
    <DashboardLayout role="citizen">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Social Welfare Portal</h2>
            <p className="text-gray-500">Beneficiary management and disbursement portal for vulnerable households.</p>
          </div>
          <button type="button" onClick={handleEligibilityCheck} className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-100 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Check Eligibility
          </button>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div whileHover={{ y: -5 }} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-xl"><Heart className="w-6 h-6" /></div>
            <div>
              <h3 className="font-bold text-gray-900">Health Coverage</h3>
              <p className="text-sm text-gray-500">NHIF subsidy status: <span className="text-emerald-600 font-bold">Active</span></p>
            </div>
          </motion.div>
          <motion.div whileHover={{ y: -5 }} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Wallet className="w-6 h-6" /></div>
            <div>
              <h3 className="font-bold text-gray-900">Digital Wallet</h3>
              <p className="text-sm text-gray-500">Balance: <span className="font-mono font-bold">KES 3,500.00</span></p>
            </div>
          </motion.div>
          <motion.div whileHover={{ y: -5 }} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><MapPin className="w-6 h-6" /></div>
            <div>
              <h3 className="font-bold text-gray-900">Food Distribution</h3>
              <p className="text-sm text-gray-500">Next pick-up: <span className="font-bold">May 20, 2026</span></p>
            </div>
          </motion.div>
        </div>

        {/* Benefits Table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 leading-none">Beneficiary Programs Register</h3>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search programs..." className="pl-9 pr-4 py-1.5 text-xs border border-gray-200 rounded-full focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <th className="px-6 py-3">Program Name</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Last Disbursement</th>
                  <th className="px-6 py-3">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {programs.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-bold text-gray-900">{p.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                        p.status === 'Enrolled' || p.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-50 text-gray-500 border-gray-100'
                      }`}>
                        {p.status === 'Active' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-medium">{p.date}</td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-gray-400 italic">{p.method}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Biometric Placeholder */}
        <div className="bg-emerald-900 rounded-3xl p-10 text-white flex flex-col md:flex-row items-center gap-8">
          <div className="w-32 h-32 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/50 relative">
             <div className="absolute inset-0 animate-ping rounded-full bg-emerald-500/10"></div>
             <Users className="w-12 h-12 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-2xl font-bold mb-2 tracking-tight">Biometric Verification Required</h3>
            <p className="text-emerald-100/70 max-w-lg mb-6">
              To prevent leakages, all disbursements now require biometric sync at your local Sub-County Social Welfare office. 
              Integrated with Huduma Namba system.
            </p>
            <div className="flex gap-4">
              <button type="button" onClick={handleScheduleSync} className="px-6 py-2 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition">Schedule Sync</button>
              <button type="button" onClick={handleViewOffices} className="px-6 py-2 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition">{showOffices ? "Hide Offices" : "View Offices"}</button>
            </div>
            {statusMessage && <p className="mt-4 text-xs font-bold text-emerald-200">{statusMessage}</p>}
            {showOffices && (
              <div className="mt-4 rounded-2xl bg-white/10 border border-white/10 p-4 text-xs text-emerald-100">
                <p className="font-bold uppercase tracking-widest mb-2">Nearest offices</p>
                <p>Westlands Sub-County Office, City Hall Welfare Desk, and Kasarani Satellite Office are available for biometric sync.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
