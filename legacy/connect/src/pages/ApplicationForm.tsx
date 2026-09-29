import { addApplication, addRevenueEntry } from "@/lib/store";
import { MpesaModal } from "@/components/MpesaModal";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { CheckCircle2, ChevronRight, Upload, CreditCard, AlertCircle } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { motion } from "motion/react";
import { useAuth } from "@/context/AuthContext";
import { uploadFileToBucket } from "@/lib/mutations";
import { getServiceById } from "@/lib/serviceCatalog";
import { useToast } from "@/context/ToastContext";
import { getSelectedCounty } from "@/lib/counties";

const steps = [
  { id: 1, name: "Business Details" },
  { id: 2, name: "Location" },
  { id: 3, name: "Documents" },
  { id: 4, name: "Review" },
  { id: 5, name: "Payment" },
];


export default function ApplicationForm() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const selectedCounty = getSelectedCounty();
  const service = useMemo(() => getServiceById(serviceId), [serviceId]);
  const isBusinessService = service.type === "business";
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"mpesa" | "card">("mpesa");
  const [isMpesaModalOpen, setIsMpesaModalOpen] = useState(false);
  
  // Form State
  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("");
  const [subCounty, setSubCounty] = useState("");
  const [ward, setWard] = useState("");
  const [createdAppId, setCreatedAppId] = useState<string | null>(null);

  // File Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [businessCert, setBusinessCert] = useState<File | null>(null);
  const [kraPinCert, setKraPinCert] = useState<File | null>(null);

  const handleNext = () => {
    if (currentStep === 1 && isBusinessService && !businessName.trim()) {
      setSubmitError("Please enter a business name before continuing.");
      return;
    }

    setSubmitError("");

    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      setSubmitError("You must be signed in to submit an application.");
      return;
    }

    setIsSubmitting(true);
    setIsUploading(true);
    setSubmitError("");

    try {
      let businessCertPath = "";
      let kraPinCertPath = "";

      if (businessCert) {
        const res = await uploadFileToBucket(businessCert, "applications-documents");
        businessCertPath = res.path;
      }
      if (kraPinCert) {
        const res = await uploadFileToBucket(kraPinCert, "applications-documents");
        kraPinCertPath = res.path;
      }

      const appResult = await addApplication({
        userId: user.id,
        applicant: profile?.name || "Citizen",
        applicantId: profile?.national_id || "",
        applicantEmail: user.email || "",
        applicantPhone: profile?.phone_number || "",
        service: service.name,
        amount: service.amount,
        businessName: isBusinessService ? businessName : undefined,
        ward,
        subCounty,
        address: address || profile?.address || "",
        type: service.type,
        status: service.amount > 0 ? "Pending Payment" : "Pending Review",
        county_slug: selectedCounty.slug,
        documents: {
          businessCert: businessCertPath || undefined,
          kraPinCert: kraPinCertPath || undefined,
        },
      });

      if (service.amount > 0 && paymentMethod === "mpesa") {
        setCreatedAppId(appResult.id);
        setIsMpesaModalOpen(true);
      } else {
        showToast({
          type: "success",
          title: "Application submitted",
          message: `Your ${service.name} application for ${selectedCounty.name} is now pending review.`,
        });
        navigate("/dashboard");
      }
    } catch (error) {
      console.error(error);
      setSubmitError("Something went wrong while submitting your application. Please try again.");
      showToast({
        type: "error",
        title: "Submission failed",
        message: "We could not save your application. Check your connection and try again.",
      });
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const handleMpesaSuccess = () => {
    showToast({
      type: "success",
      title: "Payment Initiated",
      message: `Your M-Pesa prompt has been sent. The application will be reviewed once payment is confirmed.`,
    });
    navigate("/dashboard");
  };

  return (
    <DashboardLayout role="citizen">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link to="/applications/new" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
            ← Back to services
          </Link>
          <h2 className="text-2xl font-bold text-gray-900 mt-2">New Application</h2>
          <p className="text-gray-500">{service.name} · {selectedCounty.name}</p>
        </div>

        {submitError && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{submitError}</p>
          </div>
        )}

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 -z-10"></div>
            <div 
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-emerald-600 -z-10 transition-all duration-300"
              style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
            ></div>
            {steps.map((step) => (
              <div key={step.id} className="flex flex-col items-center bg-gray-50 px-2">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors",
                    currentStep >= step.id
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "bg-white border-gray-300 text-gray-500"
                  )}
                >
                  {currentStep > step.id ? <CheckCircle2 className="w-5 h-5" /> : step.id}
                </div>
                <span className={cn(
                  "text-xs mt-2 font-medium hidden sm:block",
                  currentStep >= step.id ? "text-emerald-600" : "text-gray-500"
                )}>
                  {step.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {currentStep === 1 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">{isBusinessService ? "Business Details" : "Applicant Details"}</h3>
                <div className="grid grid-cols-1 gap-6">
                  {isBusinessService && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                        <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="e.g. Acme Traders Ltd" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
                        <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="e.g. BN-123456" />
                      </div>
                    </>
                  )}
                  {!isBusinessService && (
                    <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                      Applying as <span className="font-semibold text-gray-900">{profile?.name || "Citizen"}</span>
                      {profile?.national_id ? ` · ID ${profile.national_id}` : ""}
                    </div>
                  )}
                  {isBusinessService && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Business Activity</label>
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
                      <option>Select activity...</option>
                      <option>Retail Shop</option>
                      <option>Restaurant</option>
                      <option>Consultancy</option>
                      <option>Transport</option>
                    </select>
                  </div>
                  )}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Location Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sub-County</label>
                    <input type="text" value={subCounty} onChange={e => setSubCounty(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="e.g. Central" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ward</label>
                    <input type="text" value={ward} onChange={e => setWard(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="e.g. Market Ward" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Physical Address / Plot No.</label>
                    <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="e.g. Plot 209/123, Moi Avenue" />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Required Documents</h3>
                <div className="space-y-4">
                  <label className="block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer relative">
                    <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => setBusinessCert(e.target.files?.[0] || null)} />
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-900">Upload Business Registration Certificate</p>
                    <p className="text-xs text-gray-500">{businessCert ? businessCert.name : "PDF or JPG up to 5MB"}</p>
                  </label>
                  <label className="block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer relative">
                    <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => setKraPinCert(e.target.files?.[0] || null)} />
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-900">Upload KRA PIN Certificate</p>
                    <p className="text-xs text-gray-500">{kraPinCert ? kraPinCert.name : "PDF or JPG up to 5MB"}</p>
                  </label>
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Review Application</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span className="text-gray-500 text-sm">Service</span>
                    <span className="font-medium text-gray-900 text-sm">{service.name}</span>
                  </div>
                  {isBusinessService && (
                    <div className="flex justify-between border-b border-gray-200 pb-2">
                      <span className="text-gray-500 text-sm">Business Name</span>
                      <span className="font-medium text-gray-900 text-sm">{businessName || "N/A"}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span className="text-gray-500 text-sm">Location</span>
                    <span className="font-medium text-gray-900 text-sm">{subCounty}, {ward}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-gray-900 font-semibold">Total Fee</span>
                    <span className="font-bold text-emerald-600">{formatCurrency(service.amount)}</span>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-blue-50 text-blue-700 rounded-lg text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>By submitting this application, you declare that the information provided is true and correct to the best of your knowledge.</p>
                </div>
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Payment</h3>
                <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
                  <p className="text-gray-500 mb-2">Amount Due</p>
                  <p className="text-3xl font-bold text-gray-900 mb-8">{formatCurrency(service.amount)}</p>
                  
                  <div className="space-y-4">
                    <button type="button" onClick={() => setPaymentMethod("mpesa")} className="w-full flex items-center justify-between px-4 py-3 border border-emerald-500 bg-emerald-50 text-emerald-700 rounded-lg font-medium">
                      <span className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        M-Pesa
                      </span>
                      <span className={`w-4 h-4 rounded-full border-2 ${paymentMethod === "mpesa" ? "border-emerald-600 bg-emerald-600" : "border-gray-300"}`}></span>
                    </button>
                    <button type="button" onClick={() => setPaymentMethod("card")} className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors">
                      <span className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        Credit/Debit Card
                      </span>
                      <span className={`w-4 h-4 rounded-full border-2 ${paymentMethod === "card" ? "border-emerald-600 bg-emerald-600" : "border-gray-300"}`}></span>
                    </button>
                  </div>

                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2 text-left">{paymentMethod === "mpesa" ? "M-Pesa Phone Number" : "Card Billing Contact"}</label>
                    <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="07XX XXX XXX" />
                  </div>
                </div>
              </div>
            )}
          </motion.div>

          {/* Navigation Buttons */}
          <div className="mt-8 flex justify-between pt-6 border-t border-gray-100">
            <button
              onClick={handleBack}
              disabled={currentStep === 1 || isSubmitting}
              className="px-6 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={isSubmitting || isUploading}
              className="inline-flex items-center px-6 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>Uploading Documents...</>
              ) : isSubmitting ? (
                <>Processing...</>
              ) : currentStep === steps.length ? (
                <>{service.amount > 0 ? "Pay & Submit" : "Submit Application"}</>
              ) : (
                <>
                  Next Step <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      <MpesaModal 
        isOpen={isMpesaModalOpen} 
        onClose={() => setIsMpesaModalOpen(false)} 
        amount={service.amount} 
        reference={`${service.id.toString().toUpperCase()}-${Date.now().toString().slice(-6)}`}
        description={service.name}
        applicationId={createdAppId || ""}
        onSuccess={handleMpesaSuccess} 
      />
    </DashboardLayout>
  );
}
