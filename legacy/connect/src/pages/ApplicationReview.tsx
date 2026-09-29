import { useApplicationById, updateApplicationStatus } from "@/lib/store";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useParams, useNavigate } from "react-router-dom";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FileText, 
  User, 
  Building2,
  Download,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/context/ToastContext";

const DOCUMENT_LABELS: Record<string, string> = {
  businessCert: "Business Registration Certificate",
  kraPinCert: "KRA PIN Certificate",
  identityCard: "Identity Document",
};

export default function ApplicationReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: applicationData, loading } = useApplicationById(id || "");
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);

  const documents = useMemo(() => {
    if (!applicationData?.documents) return [];

    return Object.entries(applicationData.documents)
      .filter(([, path]) => Boolean(path))
      .map(([key, path]) => ({
        key,
        label: DOCUMENT_LABELS[key] ?? key,
        path: path as string,
      }));
  }, [applicationData?.documents]);

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="p-12 text-center text-gray-500 flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading application...
        </div>
      </DashboardLayout>
    );
  }

  if (!applicationData) {
    return (
      <DashboardLayout role="admin">
        <div className="p-12 text-center text-gray-500">Application not found.</div>
      </DashboardLayout>
    );
  }

  const handleAction = async (newStatus: "Approved" | "Rejected" | "Changes Requested") => {
    setIsProcessing(true);

    try {
      await updateApplicationStatus(applicationData.id, newStatus, applicationData.userId);
      showToast({
        type: newStatus === "Approved" ? "success" : newStatus === "Rejected" ? "error" : "warning",
        title: `Application ${newStatus.toLowerCase()}`,
        message: `${applicationData.id} has been updated. The applicant will be notified.`,
      });
      navigate("/admin/applications");
    } catch (error) {
      console.error(error);
      showToast({
        type: "error",
        title: "Action failed",
        message: "Could not update the application status. Please try again.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async (path: string, label: string) => {
    setDownloadingPath(path);

    try {
      const { data, error } = await supabase.storage
        .from("applications-documents")
        .createSignedUrl(path, 3600);

      if (error || !data?.signedUrl) {
        throw error ?? new Error("Could not create download link");
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error(error);
      showToast({
        type: "error",
        title: "Download failed",
        message: `Could not open ${label}. The file may have been moved or deleted.`,
      });
    } finally {
      setDownloadingPath(null);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button 
            type="button"
            onClick={() => navigate("/admin/applications")}
            aria-label="Back to applications list"
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-gray-500" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">Application #{applicationData.id}</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                applicationData.status === "Approved" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                applicationData.status === "Rejected" ? "bg-red-50 text-red-700 border-red-100" :
                applicationData.status === "Changes Requested" ? "bg-amber-50 text-amber-700 border-amber-100" :
                "bg-blue-50 text-blue-700 border-blue-100"
              }`}>
                {applicationData.status}
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-1">Submitted on {formatDate(applicationData.date)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-500" />
                <h3 className="font-semibold text-gray-900">Applicant Information</h3>
              </div>
              <div className="p-6 grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Full Name</p>
                  <p className="font-medium text-gray-900">{applicationData.applicant}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">ID Number</p>
                  <p className="font-medium text-gray-900">{applicationData.applicantId}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Phone</p>
                  <p className="font-medium text-gray-900">{applicationData.applicantPhone}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Email</p>
                  <p className="font-medium text-gray-900">{applicationData.applicantEmail}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-500" />
                <h3 className="font-semibold text-gray-900">{applicationData.type === "business" ? "Business Details" : "Service Details"}</h3>
              </div>
              <div className="p-6 grid grid-cols-2 gap-6">
                {applicationData.businessName && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Business Name</p>
                    <p className="font-medium text-gray-900">{applicationData.businessName}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Service Type</p>
                  <p className="font-medium text-gray-900">{applicationData.service}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Location</p>
                  <p className="font-medium text-gray-900">{applicationData.ward}, {applicationData.subCounty}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Physical Address</p>
                  <p className="font-medium text-gray-900">{applicationData.address || "N/A"}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <h3 className="font-semibold text-gray-900">Submitted Documents</h3>
              </div>
              <div className="p-6 space-y-3">
                {documents.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">No documents were uploaded with this application.</p>
                ) : (
                  documents.map((doc) => (
                    <div key={doc.key} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-50 rounded text-red-600">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{doc.label}</p>
                          <p className="text-xs text-gray-500 font-mono truncate max-w-xs">{doc.path}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDownload(doc.path, doc.label)}
                        disabled={downloadingPath === doc.path}
                        className="p-2 text-gray-400 hover:text-emerald-600 transition-colors disabled:opacity-50"
                        aria-label={`Download ${doc.label}`}
                      >
                        {downloadingPath === doc.path ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Download className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gray-500" />
                <h3 className="font-semibold text-gray-900">Payment Status</h3>
              </div>
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-500 text-sm">Amount Due</span>
                  <span className="font-bold text-xl text-gray-900">{formatCurrency(applicationData.amount)}</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Method</span>
                    <span className="font-medium text-gray-900">M-Pesa</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                      Recorded
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-gray-500" />
                <h3 className="font-semibold text-gray-900">Actions</h3>
              </div>
              <div className="p-6 space-y-3">
                <button
                  type="button"
                  onClick={() => handleAction("Approved")}
                  disabled={isProcessing || applicationData.status === "Approved"}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Approve Application
                </button>
                <button
                  type="button"
                  onClick={() => handleAction("Rejected")}
                  disabled={isProcessing || applicationData.status === "Rejected"}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircle className="w-4 h-4" />
                  Reject Application
                </button>
                <button
                  type="button"
                  onClick={() => handleAction("Changes Requested")}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <AlertCircle className="w-4 h-4" />
                  Request Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
