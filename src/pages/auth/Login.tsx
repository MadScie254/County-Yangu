import { ShieldCheck, Mail, Lock, ArrowRight, Loader2, Building2, AlertCircle } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState, type FormEvent } from "react";
import {
  COUNTY_PROFILES,
  getCountyBySlug,
  getDefaultCounty,
  getSelectedCountySlug,
  setSelectedCounty,
} from "@/lib/counties";

import { supabase } from "@/lib/supabase";
import { syncProfileCounty } from "@/lib/mutations";
import { useToast } from "@/context/ToastContext";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { showToast } = useToast();
  const [role, setRole] = useState<"citizen" | "admin">(
    searchParams.get("role") === "admin" ? "admin" : "citizen",
  );
  const [countySlug, setCountySlug] = useState(getSelectedCountySlug());
  const selectedCounty = getCountyBySlug(countySlug) ?? getDefaultCounty();

  useEffect(() => {
    const requestedRole = searchParams.get("role");
    if (requestedRole === "admin" || requestedRole === "citizen") {
      setRole(requestedRole);
    }
  }, [searchParams]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    setSelectedCounty(selectedCounty.slug);
    
    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      // Perform actual login with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user?.id) {
        await syncProfileCounty(data.user.id, selectedCounty.slug);
      }

      showToast({
        type: "success",
        title: "Welcome back",
        message: `Signed in to ${selectedCounty.name}.`,
      });

      if (role === "admin") {
        navigate(`/admin`);
      } else {
        navigate(`/dashboard`);
      }
    } catch (err: any) {
      const message = err.message || "Failed to sign in. Please check your credentials.";
      setErrorMessage(message);
      showToast({ type: "error", title: "Sign in failed", message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleProviderLogin = (provider: "google" | "ecitizen") => {
    setSelectedCounty(selectedCounty.slug);
    showToast({
      type: "info",
      title: "Coming soon",
      message: `${provider === "google" ? "Google" : "eCitizen"} sign-in will be available in a future release.`,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Link to="/" className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white hover:bg-emerald-700 transition-colors">
            <ShieldCheck className="w-7 h-7" />
          </Link>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in to County Connect
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Or{" "}
          <Link to="/register" className="font-medium text-emerald-600 hover:text-emerald-500">
            create a new account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200">
          <div className="flex justify-center mb-6">
            <div className="bg-gray-100 p-1 rounded-lg flex">
              <button
                type="button"
                onClick={() => setRole("citizen")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  role === "citizen"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Citizen
              </button>
              <button
                type="button"
                onClick={() => setRole("admin")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  role === "admin"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Government
              </button>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <label htmlFor="county" className="block text-sm font-medium text-emerald-900 mb-2">
              Select county login
            </label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-600" />
              <select
                id="county"
                name="county"
                value={countySlug}
                onChange={(e) => setCountySlug(e.target.value)}
                className="w-full rounded-xl border border-emerald-200 bg-white py-3 pl-10 pr-4 text-sm font-medium text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                {COUNTY_PROFILES.map((county) => (
                  <option key={county.slug} value={county.slug}>
                    {county.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-emerald-800">
              This selects the county portal, county-specific support desk, and the pricing profile tied to your session.
            </p>
          </div>

          <div className="mb-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">Current county</p>
            <p className="mt-1 text-lg font-bold text-gray-900">{selectedCounty.name}</p>
            <p className="text-sm text-gray-500">{selectedCounty.region} region · {selectedCounty.tier} tier</p>
          </div>

          <form className="space-y-6" onSubmit={handleLogin}>
            {errorMessage && (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>{errorMessage}</p>
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="focus:ring-emerald-500 focus:border-emerald-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="focus:ring-emerald-500 focus:border-emerald-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a href="mailto:support@countyconnect.go.ke?subject=Password%20Reset" className="font-medium text-emerald-600 hover:text-emerald-500">
                  Forgot your password?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div>
                <button
                  type="button"
                  onClick={(e) => {
                    handleProviderLogin("google");
                  }}
                  className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <span className="sr-only">Sign in with Google</span>
                  <svg className="w-5 h-5" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
                  </svg>
                </button>
              </div>
              <div>
                <button
                  type="button"
                  onClick={(e) => {
                    handleProviderLogin("ecitizen");
                  }}
                  className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <span className="sr-only">Sign in with eCitizen</span>
                  <ShieldCheck className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
