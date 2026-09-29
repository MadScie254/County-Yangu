import { useWelfarePrograms } from "@/lib/store";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Users, Search, CheckCircle2, Clock, Filter, FileText } from "lucide-react";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

export default function AdminWelfare() {
  const { data: programs } = useWelfarePrograms();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredPrograms = programs.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Welfare Programs Admin</h1>
            <p className="text-sm text-gray-500">Manage beneficiaries, verify eligibility, and disburse funds.</p>
          </div>
          <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition">
            + New Program
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Total Beneficiaries</h3>
            <p className="text-3xl font-bold text-gray-900">12,450</p>
            <p className="text-xs text-emerald-600 mt-2 font-medium">+15% this quarter</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Funds Disbursed</h3>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(45000000)}</p>
            <p className="text-xs text-emerald-600 mt-2 font-medium">YTD 2026</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Pending Verifications</h3>
            <p className="text-3xl font-bold text-gray-900">452</p>
            <p className="text-xs text-orange-600 mt-2 font-medium">Requires biometric sync</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative w-full sm:w-96">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search programs..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition w-full sm:w-auto">
              <Filter className="w-4 h-4" />
              Filter
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <th className="px-6 py-3">Program Name</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Enrolled</th>
                  <th className="px-6 py-3">Launch Date</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPrograms.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                          <Users className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        p.status === 'Enrolled' || p.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}>
                        {p.status === 'Active' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      1,200
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {p.date}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-emerald-600 hover:text-emerald-900 font-medium text-sm inline-flex items-center gap-1">
                        <FileText className="w-4 h-4" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
