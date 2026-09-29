import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const CitizenDashboard = lazy(() => import("@/pages/CitizenDashboard"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const ServiceCatalog = lazy(() => import("@/pages/ServiceCatalog"));
const ApplicationForm = lazy(() => import("@/pages/ApplicationForm"));
const ApplicationReview = lazy(() => import("@/pages/ApplicationReview"));
const ApplicationsList = lazy(() => import("@/pages/ApplicationsList"));
const AdminServices = lazy(() => import("@/pages/AdminServices"));
const AdminDepartments = lazy(() => import("@/pages/AdminDepartments"));
const AdminSettings = lazy(() => import("@/pages/AdminSettings"));
const ProcurementDashboard = lazy(() => import("@/pages/ProcurementDashboard"));
const TaxCompliance = lazy(() => import("@/pages/TaxCompliance"));
const LandRegistry = lazy(() => import("@/pages/LandRegistry"));
const Login = lazy(() => import("@/pages/auth/Login"));
const Register = lazy(() => import("@/pages/auth/Register"));
const UserProfile = lazy(() => import("@/pages/UserProfile"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const SocialWelfare = lazy(() => import("@/pages/SocialWelfare"));
const CitizenEngagement = lazy(() => import("@/pages/CitizenEngagement"));
const RevenueCollection = lazy(() => import("@/pages/RevenueCollection"));
const ApiHub = lazy(() => import("@/pages/ApiHub"));
const ExecutiveAnalytics = lazy(() => import("@/pages/ExecutiveAnalytics"));
const PublicHealth = lazy(() => import("@/pages/PublicHealth"));
const AdminWelfare = lazy(() => import("@/pages/AdminWelfare"));
const CitizenApplicationDetail = lazy(() => import("@/pages/CitizenApplicationDetail"));
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LiveAlerts } from "@/components/LiveAlerts";
import { ConfigBanner } from "@/components/ConfigBanner";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ConfigBanner />
        <BrowserRouter>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              {/* Citizen Routes */}
              <Route path="/dashboard" element={<ProtectedRoute role="citizen"><CitizenDashboard /></ProtectedRoute>} />
              <Route path="/applications/new" element={<ProtectedRoute role="citizen"><ServiceCatalog /></ProtectedRoute>} />
              <Route path="/apply/:serviceId" element={<ProtectedRoute role="citizen"><ApplicationForm /></ProtectedRoute>} />
              <Route path="/applications/:id" element={<ProtectedRoute role="citizen"><CitizenApplicationDetail /></ProtectedRoute>} />
              <Route path="/tax-compliance" element={<ProtectedRoute role="citizen"><TaxCompliance /></ProtectedRoute>} />
              <Route path="/land-registry" element={<ProtectedRoute role="citizen"><LandRegistry /></ProtectedRoute>} />
              <Route path="/social-welfare" element={<ProtectedRoute role="citizen"><SocialWelfare /></ProtectedRoute>} />
              <Route path="/engagement" element={<ProtectedRoute role="citizen"><CitizenEngagement /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute role="citizen"><UserProfile /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute role="citizen"><Notifications /></ProtectedRoute>} />

              {/* Admin Routes */}
              <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/analytics" element={<ProtectedRoute role="admin"><ExecutiveAnalytics /></ProtectedRoute>} />
              <Route path="/admin/applications" element={<ProtectedRoute role="admin"><ApplicationsList /></ProtectedRoute>} />
              <Route path="/admin/applications/:id" element={<ProtectedRoute role="admin"><ApplicationReview /></ProtectedRoute>} />
              <Route path="/admin/services" element={<ProtectedRoute role="admin"><AdminServices /></ProtectedRoute>} />
              <Route path="/admin/departments" element={<ProtectedRoute role="admin"><AdminDepartments /></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute role="admin"><AdminSettings /></ProtectedRoute>} />
              <Route path="/admin/procurement" element={<ProtectedRoute role="admin"><ProcurementDashboard /></ProtectedRoute>} />
              <Route path="/admin/revenue" element={<ProtectedRoute role="admin"><RevenueCollection /></ProtectedRoute>} />
              <Route path="/admin/welfare" element={<ProtectedRoute role="admin"><AdminWelfare /></ProtectedRoute>} />
              <Route path="/admin/health" element={<ProtectedRoute role="admin"><PublicHealth /></ProtectedRoute>} />
              <Route path="/admin/api-hub" element={<ProtectedRoute role="admin"><ApiHub /></ProtectedRoute>} />

              {/* Redirects/Fallbacks */}
              <Route path="/applications" element={<Navigate to="/dashboard" />} />
              <Route path="/payments" element={<Navigate to="/dashboard" />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <LiveAlerts />
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
