import {
  LayoutDashboard,
  FileText,
  CreditCard,
  Settings,
  LogOut,
  Bell,
  Search,
  Menu,
  X,
  User,
  Building2,
  Briefcase,
  ShieldCheck,
  HeartPulse,
  Users,
  MessageSquare,
  BarChart3,
  Globe,
  Database,
  Coins,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { getSelectedCounty } from "@/lib/counties";
import { logout } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import { useMyNotifications } from "@/lib/store";

interface DashboardLayoutProps {
  children: ReactNode;
  role: "citizen" | "admin";
}

export function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const { user, profile } = useAuth();
  const { data: notifications } = useMyNotifications(user?.id);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const selectedCounty = getSelectedCounty();

  const citizenLinks = [
    { name: "Main Modules", type: "header" },
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Services Catalog", href: "/applications/new", icon: Grid },
    { name: "My Applications", href: "/applications", icon: FileText },
    
    { name: "Specialized Portals", type: "header" },
    { name: "Land Registry", href: "/land-registry", icon: Building2 },
    { name: "Tax Compliance (KRA)", href: "/tax-compliance", icon: Coins },
    { name: "Social Welfare", href: "/social-welfare", icon: HeartPulse },
    { name: "Citizen Participation", href: "/engagement", icon: MessageSquare },
    
    { name: "Account", type: "header" },
    { name: "Payments", href: "/payments", icon: CreditCard },
    { name: "Profile", href: "/profile", icon: User },
  ];

  const adminLinks = [
    { name: "Administration", type: "header" },
    { name: "Executive Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Analytics (BI)", href: "/admin/analytics", icon: BarChart3 },
    { name: "Applications Queue", href: "/admin/applications", icon: FileText },
    
    { name: "Verticals", type: "header" },
    { name: "Procurement (Tenders)", href: "/admin/procurement", icon: Briefcase },
    { name: "Revenue Collection", href: "/admin/revenue", icon: Coins },
    { name: "Social Welfare Mgt", href: "/admin/welfare", icon: Users },
    { name: "Health Management", href: "/admin/health", icon: HeartPulse },
    
    { name: "System", type: "header" },
    { name: "Interoperability Platform", href: "/admin/api-hub", icon: Database },
    { name: "General Services", href: "/admin/services", icon: Briefcase },
    { name: "Departments", href: "/admin/departments", icon: Building2 },
    { name: "Settings", href: "/admin/settings", icon: Settings },
  ];

  const links = role === "admin" ? adminLinks : citizenLinks;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200 sticky top-0 z-20">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-emerald-700">
          <ShieldCheck className="w-6 h-6" />
          <span>County Connect</span>
        </Link>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-md hover:bg-gray-100"
          aria-label={sidebarOpen ? "Close menu" : "Open menu"}
          title={sidebarOpen ? "Close menu" : "Open menu"}
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <AnimatePresence>
          {(sidebarOpen || (typeof window !== 'undefined' && window.innerWidth >= 1024)) && (
            <motion.aside
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              className={cn(
                "fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 shadow-lg lg:shadow-none overflow-y-auto",
                !sidebarOpen && "hidden lg:block"
              )}
            >
              <div className="flex flex-col h-full">
                <Link to="/" className="flex items-center gap-2 px-6 h-16 border-b border-gray-200 flex-shrink-0 hover:bg-gray-50 transition-colors">
                  <ShieldCheck className="w-6 h-6 text-emerald-600" />
                  <span className="font-bold text-lg tracking-tight text-gray-900">
                    County Connect
                  </span>
                </Link>

                <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                  <div className="mb-6 px-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      {role === "admin" ? "Administration" : "Citizen Portal"}
                    </p>
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 border border-gray-100">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="Profile" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs uppercase">
                          {role === "admin" ? "AD" : profile?.name?.slice(0, 2) || "U"}
                        </div>
                      )}
                      <div className="overflow-hidden">
                        <p className="text-sm font-medium truncate">
                            {role === "admin" ? "Admin User" : profile?.name || "Citizen"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                            {role === "admin" ? `admin@${selectedCounty.slug}.go.ke` : user?.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  <nav className="space-y-1">
                    {links.map((link, idx) => {
                      if (link.type === "header") {
                        return (
                          <p key={idx} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-6 mb-2 px-3">
                            {link.name}
                          </p>
                        );
                      }
                      
                      const isActive = location.pathname === link.href;
                      const Icon = link.icon;

                      return (
                        <Link
                          key={link.name}
                          to={link.href}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                            isActive
                              ? "bg-emerald-50 text-emerald-700 shadow-sm"
                              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          )}
                        >
                          {Icon && (
                            <Icon
                              className={cn(
                                "w-5 h-5",
                                isActive ? "text-emerald-600" : "text-gray-400"
                              )}
                            />
                          )}
                          {link.name}
                        </Link>
                      );
                    })}
                  </nav>
                </div>

                <div className="mt-auto p-4 border-t border-gray-200">
                  <Link
                    to="/"
                    onClick={() => logout()}
                    className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    Sign Out
                  </Link>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 w-full">
          <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold text-gray-900 hidden sm:block">
                {role === "admin" ? selectedCounty.name : `${selectedCounty.name} Service Portal`}
              </h1>
              <span className="hidden lg:inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                {selectedCounty.region} region
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative hidden sm:block">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search services, tenders..."
                  className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 w-64"
                />
              </div>
              <Link to="/notifications" className="relative p-2 text-gray-400 hover:text-gray-500" aria-label="Notifications">
                <Bell className="w-5 h-5" />
                {(notifications?.filter(n => !n.read).length || 0) > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                )}
              </Link>
            </div>
          </header>
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

const Grid = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </svg>
);
