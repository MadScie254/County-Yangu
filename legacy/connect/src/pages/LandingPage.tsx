import { useState } from "react";
import { ArrowRight, CheckCircle2, ShieldCheck, Building2, FileText, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  COUNTY_PROFILES,
  getCountyBySlug,
  getCountyPackages,
  getDefaultCounty,
  getSelectedCountySlug,
  setSelectedCounty,
} from "@/lib/counties";
import { formatCurrency } from "@/lib/utils";

export default function LandingPage() {
  const [selectedCountySlug, setSelectedCountySlug] = useState(getSelectedCountySlug());
  const selectedCounty = getCountyBySlug(selectedCountySlug) ?? getDefaultCounty();
  const selectedCountyPackages = getCountyPackages(selectedCounty);

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight text-gray-900">
                County Connect
              </span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-gray-600 hover:text-gray-900">Features</a>
              <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900">Pricing</a>
              <a href="#services" className="text-sm font-medium text-gray-600 hover:text-gray-900">Services</a>
              <a href="#about" className="text-sm font-medium text-gray-600 hover:text-gray-900">About</a>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/login?role=citizen"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 hidden sm:block"
              >
                Citizen Login
              </Link>
              <Link
                to="/login?role=admin"
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-full text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm hover:shadow-md"
              >
                Admin Portal
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 mb-6 border border-emerald-100">
                Digitizing Government Services
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 mb-6 leading-tight">
                Modern Governance for <br className="hidden sm:block" />
                <span className="text-emerald-600">Forward-Thinking Counties</span>
              </h1>
              <p className="text-lg sm:text-xl text-gray-600 mb-8 leading-relaxed">
                A unified platform for permit applications, payments, and service delivery. 
                Transparent, efficient, and accessible for every citizen.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/login?role=citizen"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-full text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-lg hover:shadow-emerald-500/30"
                >
                  Access Services
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
                <Link
                  to="/login?role=admin"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 border border-gray-200 text-base font-medium rounded-full text-gray-700 bg-white hover:bg-gray-50 transition-all"
                >
                  Government Login
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
        
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute top-20 right-10 w-72 h-72 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why County Connect?</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              We bridge the gap between citizens and county governments with a secure, transparent, and efficient digital platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: FileText,
                title: "Digital Permits",
                desc: "Apply for business licenses, land rates, and construction permits online. No more queues.",
              },
              {
                icon: CheckCircle2,
                title: "Instant Verification",
                desc: "Real-time status tracking and automated verification for faster approvals.",
              },
              {
                icon: Building2,
                title: "Transparency",
                desc: "Clear audit trails for payments and applications, reducing fraud and increasing trust.",
              },
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -5 }}
                className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-6">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-emerald-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            {[
              { label: "Counties Onboarded", value: "12" },
              { label: "Active Citizens", value: "1.2M+" },
              { label: "Permits Issued", value: "450K" },
              { label: "Revenue Processed", value: "KES 2.5B" },
            ].map((stat, idx) => (
              <div key={idx}>
                <div className="text-4xl font-bold mb-2">{stat.value}</div>
                <div className="text-emerald-200 text-sm font-medium uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* County Pricing Section */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 items-start">
            <div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 mb-5 border border-blue-100">
                County-specific pricing
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Pricing that matches each county's scale and rollout reality.
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl leading-relaxed">
                Choose a county to preview the launch package, then compare every county side by side.
                The pricing table is built for procurement conversations, white-label rollouts, and county-by-county procurement cycles.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-4 sm:items-center">
                <label className="flex-1">
                  <span className="block text-sm font-medium text-gray-700 mb-2">Preview county</span>
                  <select
                    value={selectedCountySlug}
                    onChange={(e) => {
                      setSelectedCountySlug(e.target.value);
                      setSelectedCounty(e.target.value);
                    }}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    {COUNTY_PROFILES.map((county) => (
                      <option key={county.slug} value={county.slug}>
                        {county.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 shadow-sm sm:min-w-64">
                  <p className="font-semibold uppercase tracking-[0.2em] text-[10px] text-emerald-700 mb-1">Selected county</p>
                  <p className="text-lg font-bold leading-tight">{selectedCounty.name}</p>
                  <p className="text-emerald-700 mt-1">{selectedCounty.region} region · {selectedCounty.tier} tier</p>
                </div>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="rounded-[2rem] border border-gray-200 bg-gray-950 text-white p-8 shadow-2xl shadow-gray-900/10"
            >
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-gray-400">Featured county package</p>
              <h3 className="mt-3 text-2xl font-black tracking-tight">{selectedCounty.name}</h3>
              <p className="mt-2 text-sm text-gray-300 leading-relaxed">{selectedCounty.launchNote}</p>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: "Starter", value: formatCurrency(selectedCountyPackages.starter) },
                  { label: "Standard", value: formatCurrency(selectedCountyPackages.standard) },
                  { label: "Enterprise", value: formatCurrency(selectedCountyPackages.enterprise) },
                ].map((price) => (
                  <div key={price.label} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">{price.label}</p>
                    <p className="mt-2 text-lg font-black">{price.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-4 text-sm text-gray-300 leading-relaxed">
                Every county login is anchored to the selected county profile so the portal, support desk, and pricing all stay aligned.
              </div>
            </motion.div>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {COUNTY_PROFILES.map((county, idx) => {
              const pricing = getCountyPackages(county);
              const isActive = county.slug === selectedCounty.slug;

              return (
                <motion.article
                  key={county.slug}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: idx * 0.01 }}
                  className={`rounded-3xl border p-6 shadow-sm transition-all ${
                    isActive
                      ? "border-emerald-200 bg-emerald-50 shadow-emerald-100"
                      : "border-gray-200 bg-white hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-400">{county.region}</p>
                      <h3 className="mt-2 text-xl font-bold text-gray-900">{county.name}</h3>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
                      isActive ? "bg-emerald-600 text-white" : "bg-gray-900 text-white"
                    }`}>
                      {county.tier}
                    </span>
                  </div>

                  <p className="mt-4 text-sm text-gray-600 leading-relaxed">{county.launchNote}</p>

                  <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: "Starter", value: pricing.starter },
                      { label: "Standard", value: pricing.standard },
                      { label: "Enterprise", value: pricing.enterprise },
                    ].map((price) => (
                      <div key={price.label} className="rounded-2xl bg-gray-50 px-3 py-3 border border-gray-100">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">{price.label}</p>
                        <p className="mt-1 text-sm font-black text-gray-900">{formatCurrency(price.value)}</p>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCountySlug(county.slug);
                      setSelectedCounty(county.slug);
                    }}
                    className="mt-5 inline-flex items-center justify-center rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:border-emerald-300 hover:text-emerald-700"
                  >
                    Compare this county
                  </button>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Empowering Counties, Serving Citizens</h2>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                County Connect is built to solve the unique challenges of devolved governance. 
                We provide a unified digital infrastructure that eliminates paperwork, 
                reduces leakages, and ensures every shilling of revenue is accounted for.
              </p>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Our platform integrates seamlessly with national systems like KRA and Lands Registry, 
                creating a single source of truth for all government services.
              </p>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Secure & Compliant</h4>
                    <p className="text-sm text-gray-500">Bank-grade security standards</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Citizen-Centric</h4>
                    <p className="text-sm text-gray-500">Designed for ease of use</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-100 to-blue-100 rounded-3xl transform rotate-3"></div>
              <img 
                src="https://picsum.photos/seed/gov/800/600" 
                alt="Government officials using digital tablets" 
                className="relative rounded-3xl shadow-xl border border-gray-100"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
            <p className="text-gray-600">Common questions about using County Connect.</p>
          </div>
          
          <div className="space-y-4">
            {[
              { q: "How do I register for an account?", a: "You can register using your National ID number and phone number. Click 'Citizen Login' to get started." },
              { q: "Is my payment information secure?", a: "Yes, all payments are processed through secure channels including M-Pesa and bank integrations with end-to-end encryption." },
              { q: "Can I track my application status?", a: "Absolutely. Once you submit an application, you can track its progress in real-time from your dashboard." },
              { q: "Which counties are currently supported?", a: "We are currently live in 12 counties including Nairobi, Mombasa, Kisumu, and Nakuru, with more joining soon." },
            ].map((faq, idx) => (
              <div key={idx} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-gray-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-500" />
            <span className="font-bold text-white text-lg">County Connect</span>
          </div>
          <div className="text-sm">
            &copy; {new Date().getFullYear()} County Connect SaaS. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
