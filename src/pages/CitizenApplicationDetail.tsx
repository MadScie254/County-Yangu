import { useParams, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useApplicationById } from "@/lib/store";
import { FileText, ArrowLeft, Clock, CheckCircle2, XCircle, FileClock } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function CitizenApplicationDetail() {
  const { id } = useParams();
  const { data: application, isLoading } = useApplicationById(id || "");

  if (isLoading) return <DashboardLayout role="citizen"><div className="p-8">Loading...</div></DashboardLayout>;
  if (!application) return <DashboardLayout role="citizen"><div className="p-8">Application not found.</div></DashboardLayout>;

  const StatusIcon = {
    "Approved": CheckCircle2,
    "Pending Review": Clock,
    "Pending Payment": FileClock,
    "Rejected": XCircle,
    "Changes Requested": FileText,
  }[application.status] || FileText;

  const statusColors = {
    "Approved": "text-emerald-600 bg-emerald-50",
    "Pending Review": "text-blue-600 bg-blue-50",
    "Pending Payment": "text-yellow-600 bg-yellow-50",
    "Rejected": "text-red-600 bg-red-50",
    "Changes Requested": "text-orange-600 bg-orange-50",
  }[application.status] || "text-gray-600 bg-gray-50";

  return (
    <DashboardLayout role="citizen">
      <div className="max-w-4xl mx-auto">
        <Link to="/dashboard" className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{application.service}</h1>
              <p className="text-sm text-gray-500 mt-1">Ref: {application.id.toUpperCase().split('-')[0]}</p>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${statusColors}`}>
              <StatusIcon className="w-4 h-4" />
              {application.status}
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Application Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                <div>
                  <p className="text-sm text-gray-500">Applicant</p>
                  <p className="font-medium text-gray-900">{application.applicant}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Submitted On</p>
                  <p className="font-medium text-gray-900">{formatDate(application.date)}</p>
                </div>
                {application.businessName && (
                  <div>
                    <p className="text-sm text-gray-500">Business Name</p>
                    <p className="font-medium text-gray-900">{application.businessName}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="font-medium text-gray-900">{application.subCounty}, {application.ward}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fee Amount</p>
                  <p className="font-medium text-gray-900">{formatCurrency(application.amount)}</p>
                </div>
              </div>
            </div>

            {application.documents && Object.keys(application.documents).length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Documents</h3>
                <div className="flex flex-col gap-3">
                  {Object.entries(application.documents).map(([key, url]) => url ? (
                    <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      </div>
                      {/* Assuming url is a path, you would need to generate a signed URL. For now, it's just a placeholder or public link. */}
                      <span className="text-xs text-gray-500">Uploaded</span>
                    </div>
                  ) : null)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
