import { DashboardLayout } from "@/components/DashboardLayout";
import { 
  Search, 
  ArrowRight, 
  Building2, 
  MapPin, 
  Car, 
  HardHat, 
  Store, 
  Utensils, 
  Briefcase,
  HeartPulse,
  Coins,
  Scale,
  Users,
  ShieldCheck,
  TrendingUp,
  Globe,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { SERVICE_CATALOG } from "@/lib/serviceCatalog";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";

const SERVICE_ICONS: Record<string, typeof Store> = {
  sbp: Store,
  "land-registry": Building2,
  parking: Car,
  construction: HardHat,
  "kra-bridge": ShieldCheck,
  welfare: Users,
  "health-portal": HeartPulse,
  legal: Scale,
};

const categories = [
  { id: "all", name: "All Services", icon: Globe },
  { id: "business", name: "Business & Licensing", icon: Store },
  { id: "land", name: "Land & Property", icon: MapPin },
  { id: "finance", name: "Revenue & Taxes", icon: Coins },
  { id: "construction", name: "Building & Planning", icon: HardHat },
  { id: "social", name: "Welfare & Health", icon: HeartPulse },
];

export default function ServiceCatalog() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredServices = SERVICE_CATALOG.filter((service) => {
    const matchesCategory = selectedCategory === "all" || service.category === selectedCategory;
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          service.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <DashboardLayout role="citizen">
      <div className="space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Services Marketplace</h2>
            <p className="text-gray-500 mt-1">CountyConnect unified portal for all official county services.</p>
          </div>
          <div className="bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100 hidden lg:flex items-center gap-3">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-800">100% Digital Processing Active</span>
          </div>
        </div>

        {/* Search Bar - Modernized */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative bg-white flex items-center p-2 rounded-xl shadow-sm border border-gray-200">
            <Search className="ml-3 text-gray-400 w-5 h-5 flex-shrink-0" />
            <input
              type="text"
              placeholder="What service do you need today? Type 'Business', 'Land', 'Parking'..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 bg-transparent border-none focus:ring-0 text-gray-900 placeholder-gray-400 font-medium"
            />
            <button type="button" onClick={() => document.getElementById("services-grid")?.scrollIntoView({ behavior: "smooth" })} className="hidden sm:block bg-emerald-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-emerald-700 transition shadow-lg shadow-emerald-200">
              Search
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all border-2 duration-200",
                selectedCategory === category.id
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-md transform scale-105"
                  : "bg-white text-gray-500 border-gray-100 hover:border-emerald-200 hover:text-emerald-600"
              )}
            >
              <category.icon className="w-4 h-4" />
              {category.name}
            </button>
          ))}
        </div>

        {/* Services Grid */}
        <div id="services-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredServices.map((service, idx) => {
            const ServiceIcon = SERVICE_ICONS[service.id] ?? Globe;

            return (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white rounded-2xl border border-gray-100 hover:border-emerald-200 p-6 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 transition-all flex flex-col h-full group relative"
            >
              {service.hot && (
                <span className="absolute top-4 right-4 bg-orange-100 text-orange-700 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-orange-200">
                  Popular
                </span>
              )}
              {service.new && (
                <span className="absolute top-4 right-4 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-blue-200">
                  New
                </span>
              )}
              
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 transform group-hover:rotate-6">
                <ServiceIcon className="w-7 h-7" />
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-3 leading-tight group-hover:text-emerald-700 transition-colors">
                {service.name}
              </h3>
              
              <p className="text-gray-500 text-sm mb-6 flex-grow leading-relaxed">
                {service.desc}
              </p>
              
              <div className="flex items-center justify-between mt-auto pt-6 border-t border-gray-50">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Fee Structure</span>
                  <span className="text-sm font-bold text-gray-700">
                    {service.fee}
                  </span>
                </div>
                <Link
                  to={`/apply/${service.id}`}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-50 text-gray-400 group-hover:bg-emerald-600 group-hover:text-white transition-all transform group-hover:translate-x-1"
                >
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </motion.div>
            );
          })}
        </div>

        {filteredServices.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
              <Search className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No matches found</h3>
            <p className="text-gray-500 max-w-sm mx-auto">We couldn't find any services matching your search criteria. Try using different keywords.</p>
            <button 
              onClick={() => { setSearchQuery(""); setSelectedCategory("all"); }}
              className="mt-6 text-emerald-600 font-bold hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
