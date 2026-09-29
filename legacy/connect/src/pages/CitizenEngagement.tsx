import { usePetitions, votePetition } from "@/lib/store";
import { DashboardLayout } from "@/components/DashboardLayout";
import { MessageSquare, ThumbsUp, Send, Users, FileWarning, HelpCircle } from "lucide-react";
import { useState } from "react";
import { AdminActionModal } from "@/components/AdminActionModal";

export default function CitizenEngagement() {
  const [statusMessage, setStatusMessage] = useState("");
  const { data: petitions } = usePetitions();
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [isGrievanceModalOpen, setIsGrievanceModalOpen] = useState(false);

  const handleVote = async (id: number) => {
    await votePetition(id);
    setStatusMessage("Your signature has been securely recorded on the county ledger.");
  };

  const confirmPublicInput = () => {
    setIsInputModalOpen(false);
    window.location.href = "mailto:participation@countyconnect.go.ke?subject=Public%20Participation%20Input";
    setStatusMessage("Opening your mail app to submit public input.");
  };

  const confirmGrievance = () => {
    setIsGrievanceModalOpen(false);
    window.location.href = "mailto:grievances@countyconnect.go.ke?subject=County%20Grievance";
    setStatusMessage("Opening your mail app to lodge a grievance.");
  };

  return (
    <DashboardLayout role="citizen">
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Citizen Engagement Hub</h2>
          <p className="text-gray-500">Public participation, grievances, and petitions portal.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Active Petitions */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                Active Public Participation
              </h3>
              <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">3 OPEN</span>
            </div>
            <div className="p-6 flex-1 space-y-6">
              {petitions.map((p, i) => (
                <div key={p.id} className="group cursor-pointer" onClick={() => handleVote(p.id)}>
                  <h4 className="font-bold text-gray-900 group-hover:text-emerald-600 transition-colors mb-1">{p.title}</h4>
                  <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                    <span>{p.deadline}</span>
                    <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {p.supporters.toLocaleString()} citizens signed</span>
                  </div>
                  <div className="mt-3 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(100, (p.supporters / p.totalNeeded) * 100)}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 pt-0">
               <button type="button" onClick={() => setIsInputModalOpen(true)} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition flex items-center justify-center gap-2">
                 Submit Input <Send className="w-4 h-4" />
               </button>
            </div>
          </div>

          {/* Grievance Tracker */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <FileWarning className="w-5 h-5 text-red-500" />
                Grievance & Complaint Portal
              </h3>
            </div>
            <div className="p-8 flex-1 flex flex-col items-center justify-center text-center space-y-4">
              <div className="p-4 bg-red-50 text-red-500 rounded-full">
                <MessageSquare className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">Voice Your Concern</h4>
                <p className="text-gray-500 text-sm max-w-xs mx-auto">
                  Report service delivery failures, corruption, or infrastructure issues directly to the Governor's office.
                </p>
              </div>
              <button type="button" onClick={() => setIsGrievanceModalOpen(true)} className="px-8 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition shadow-lg shadow-red-100">
                Lodge Grievance
              </button>
              {statusMessage && <p className="text-xs font-medium text-emerald-700">{statusMessage}</p>}
            </div>
            <div className="p-6 border-t border-gray-50 bg-gray-50/50">
               <div className="flex items-center justify-between text-xs">
                 <span className="text-gray-500 font-bold uppercase tracking-widest italic flex items-center gap-1">
                   <HelpCircle className="w-3 h-3" /> Standard Resolution Time:
                 </span>
                 <span className="text-gray-900 font-bold">48 Hours</span>
               </div>
            </div>
          </div>
        </div>

        {/* Feedback Section */}
        <div className="bg-emerald-50 rounded-3xl p-8 border border-emerald-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 text-emerald-100">
             <MessageSquare className="w-24 h-24" />
          </div>
          <div className="relative z-10 lg:w-2/3">
             <h3 className="text-2xl font-bold text-emerald-900 mb-3 tracking-tight italic">Direct-to-Governor Hotline</h3>
             <p className="text-emerald-800/80 mb-6 font-medium">
               This portal ensures your constitutional right to public participation. Accountability is our priority. 
               All submissions are cryptographically signed and tracked.
             </p>
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                   <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Response Rate</p>
                   <p className="text-xl font-black text-emerald-900">92%</p>
                </div>
                <div>
                   <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Avg Resolution</p>
                   <p className="text-xl font-black text-emerald-900">3.5 Days</p>
                </div>
                <div>
                   <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Verified Users</p>
                   <p className="text-xl font-black text-emerald-900">120K+</p>
                </div>
             </div>
          </div>
        </div>

        <AdminActionModal
          isOpen={isInputModalOpen}
          onClose={() => setIsInputModalOpen(false)}
          title="Submit Public Input"
          description="You are about to launch your default email client to submit public participation feedback to the county office."
        >
          <div className="flex justify-end gap-3">
            <button onClick={() => setIsInputModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              Cancel
            </button>
            <button onClick={confirmPublicInput} className="px-4 py-2 text-sm font-medium bg-gray-900 text-white hover:bg-black rounded-lg transition-colors flex items-center gap-2">
              Launch Email Client <Send className="w-4 h-4" />
            </button>
          </div>
        </AdminActionModal>

        <AdminActionModal
          isOpen={isGrievanceModalOpen}
          onClose={() => setIsGrievanceModalOpen(false)}
          title="Lodge Grievance"
          description="Grievances are tracked centrally. Would you like to proceed to write your grievance using your default email client?"
        >
          <div className="flex justify-end gap-3">
            <button onClick={() => setIsGrievanceModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              Cancel
            </button>
            <button onClick={confirmGrievance} className="px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2">
              Lodge Grievance <FileWarning className="w-4 h-4" />
            </button>
          </div>
        </AdminActionModal>
      </div>
    </DashboardLayout>
  );
}
