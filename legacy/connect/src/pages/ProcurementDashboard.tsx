import { useTenders } from "@/lib/store";
import { DashboardLayout } from "@/components/DashboardLayout";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { Search, Filter, AlertTriangle, CheckCircle2, Building2, FileText, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";
const awardDistribution = [
  { name: "Mega Corp Ltd", value: 12 },
  { name: "BuildWell Inc", value: 8 },
  { name: "TechSol Kenya", value: 5 },
  { name: "Others", value: 15 },
];

const COLORS = ['#059669', '#3b82f6', '#f59e0b', '#9ca3af'];
const COLOR_CLASSES = ['bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-gray-400'];

export default function ProcurementDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const { data: allTenders } = useTenders();

  const filteredTenders = allTenders.filter((tender) => {
    const matchesSearch = [tender.id, tender.title, tender.entity].join(" ").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !openOnly || tender.status === "Open";

    return matchesSearch && matchesStatus;
  });

  const activeTenders = allTenders.filter(t => t.status === "Open").length;
  const totalValue = allTenders.reduce((acc, t) => acc + t.value, 0);

  const handleSearch = () => {
    const nextSearch = window.prompt("Search tenders, entities, or IDs", searchTerm) ?? searchTerm;
    setSearchTerm(nextSearch);
  };

  const handleFilter = () => {
    setOpenOnly((current) => !current);
  };

  const handleInvestigationDetails = () => {
    setSearchTerm("Mega Corp Ltd");
    setOpenOnly(false);
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Procurement Transparency Platform</h2>
          <p className="text-gray-500">Monitor tenders, awards, and supplier performance.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">Active Tenders</h3>
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{activeTenders}</div>
            <p className="text-xs text-gray-500 mt-1">Across 47 counties</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">Total Value</h3>
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalValue)}</div>
            <p className="text-xs text-gray-500 mt-1">This financial year</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">Flagged Anomalies</h3>
              <div className="p-2 bg-red-50 rounded-lg text-red-600">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">3</div>
            <p className="text-xs text-red-600 mt-1">Requires investigation</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">Verified Suppliers</h3>
              <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">1,890</div>
            <p className="text-xs text-emerald-600 mt-1">+120 this month</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Tenders List */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Recent Tenders</h3>
              <div className="flex gap-2">
                <button type="button" onClick={handleSearch} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500" aria-label="Search tenders"><Search className="w-4 h-4" /></button>
                <button type="button" onClick={handleFilter} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500" aria-label="Toggle open tenders filter"><Filter className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 font-medium">
                  <tr>
                    <th className="px-6 py-3">Tender ID</th>
                    <th className="px-6 py-3">Title</th>
                    <th className="px-6 py-3">Entity</th>
                    <th className="px-6 py-3">Value</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTenders.map((tender) => (
                    <tr key={tender.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{tender.id}</td>
                      <td className="px-6 py-4 text-gray-600">{tender.title}</td>
                      <td className="px-6 py-4 text-gray-600">{tender.entity}</td>
                      <td className="px-6 py-4 text-gray-600 font-mono">{formatCurrency(tender.value)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          tender.status === 'Awarded' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          tender.status === 'Open' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                          tender.status === 'Evaluated' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          'bg-gray-50 text-gray-700 border-gray-100'
                        }`}>
                          {tender.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Anomalies / Analytics */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">Award Concentration</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={awardDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {awardDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-4">
                {awardDistribution.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${COLOR_CLASSES[index % COLOR_CLASSES.length]}`}></div>
                      <span className="text-gray-600">{item.name}</span>
                    </div>
                    <span className="font-medium text-gray-900">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-900 text-sm">Potential Anomaly Detected</h4>
                  <p className="text-red-700 text-xs mt-1">
                    "Mega Corp Ltd" has won 90% of road maintenance tenders in County X over the last 6 months.
                  </p>
                  <button type="button" onClick={handleInvestigationDetails} className="mt-2 text-xs font-medium text-red-800 hover:underline">View Investigation Details</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
