import { useMyApplications } from "@/lib/store";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ArrowUpRight, Clock, FileCheck, AlertCircle, Plus, Building2, Globe, Car, HardHat, Coins, HeartPulse, MessageSquare, Store } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getSelectedCounty } from "@/lib/counties";
import { useAuth } from "@/context/AuthContext";

const services = [
  { name: "Business Licensing", icon: Store, desc: "Apply for or renew Single Business Permits", link: "/apply/sbp" },
  { name: "Land Registry", icon: Globe, desc: "Search parcels and verify ownership chains", link: "/land-registry" },
  { name: "Tax Compliance", icon: Coins, desc: "Automate SME taxes with KRA Integration", link: "/tax-compliance" },
  { name: "Social Welfare", icon: HeartPulse, desc: "Verify status and manage benefit wallets", link: "/social-welfare" },
  { name: "Public Engagement", icon: MessageSquare, desc: "Participate in budget and grievance polls", link: "/engagement" },
  { name: "Parking", icon: Car, desc: "Daily and seasonal parking payments", link: "/apply/parking" },
];

export default function CitizenDashboard() {
  const selectedCounty = getSelectedCounty();
  const { user, profile } = useAuth();
  const { data: allApplications, loading, error } = useMyApplications(user?.id);
  
  const recentApplications = allApplications.slice(0, 3);
  
  const inProgressCount = allApplications.filter((app) => app.status === "Pending Review").length;
  const approvedCount = allApplications.filter((app) => app.status === "Approved").length;
  const pendingActionsCount = allApplications.filter((app) => app.status === "Changes Requested").length;

  return (
    <DashboardLayout role="citizen">
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Welcome back, {profile?.name ? profile.name.split(' ')[0] : 'Citizen'}!</h2>
            <p className="text-gray-500">Here's what's happening with your applications in {selectedCounty.name}.</p>
          </div>
          <Link
            to="/applications/new"
            className="inline-flex items-center justify-center px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Application
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">Active Applications</h3>
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{inProgressCount}</div>
            <p className="text-xs text-gray-500 mt-1">In progress</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">Approved</h3>
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <FileCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{approvedCount}</div>
            <p className="text-xs text-gray-500 mt-1">Total approved permits</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">Pending Actions</h3>
              <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{pendingActionsCount}</div>
            <p className="text-xs text-gray-500 mt-1">Requires your attention</p>
          </div>
        </div>

        {/* Recent Applications */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Recent Activity</h3>
            <Link to="/applications/new" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center">
              Browse Services <ArrowUpRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading your applications...</div>
          ) : error ? (
            <div className="p-12 text-center text-red-600">Could not load applications. Please refresh and try again.</div>
          ) : recentApplications.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500 mb-4">You have not submitted any applications yet.</p>
              <Link to="/applications/new" className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" /> Start your first application
              </Link>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="px-6 py-3">Application ID</th>
                  <th className="px-6 py-3">Service</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{app.id}</td>
                    <td className="px-6 py-4 text-gray-600">{app.service}</td>
                    <td className="px-6 py-4 text-gray-600">{formatDate(app.date)}</td>
                    <td className="px-6 py-4 text-gray-600 font-mono">{formatCurrency(app.amount)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        app.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        app.status === 'Pending Review' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        app.status === 'Changes Requested' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        'bg-red-50 text-red-700 border-red-100'
                      }`}>
                        {app.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link to="/applications" className="text-gray-400 hover:text-gray-600 font-medium">Details</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>

        {/* Quick Services */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">Popular Services</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {services.map((service) => (
              <Link
                key={service.name}
                to={service.link}
                className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group"
              >
                <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 mb-3 group-hover:scale-110 transition-transform duration-200">
                  <service.icon className="w-6 h-6" />
                </div>
                <h4 className="font-medium text-gray-900 mb-1">{service.name}</h4>
                <p className="text-xs text-gray-500 line-clamp-2">{service.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
