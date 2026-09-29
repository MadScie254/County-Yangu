export type CountyTier = "metro" | "growth" | "access";

export interface CountyProfile {
  slug: string;
  name: string;
  region: string;
  tier: CountyTier;
  launchNote: string;
}

export interface CountyPackages {
  starter: number;
  standard: number;
  enterprise: number;
}

const COUNTY_STORAGE_KEY = "countyconnect:selected-county";

export const COUNTY_PROFILES: CountyProfile[] = [
  { slug: "nairobi-city", name: "Nairobi City County", region: "Central", tier: "metro", launchNote: "Highest-volume revenue and verification workloads." },
  { slug: "mombasa", name: "Mombasa County", region: "Coast", tier: "metro", launchNote: "Port, tourism, and licensing-heavy operations." },
  { slug: "kisumu", name: "Kisumu County", region: "Nyanza", tier: "metro", launchNote: "High citizen traffic and lake-region revenue flows." },
  { slug: "nakuru", name: "Nakuru County", region: "Rift Valley", tier: "metro", launchNote: "Fast-growing urban services and land activity." },
  { slug: "kiambu", name: "Kiambu County", region: "Central", tier: "metro", launchNote: "Dense commuter economy with strong business permit demand." },
  { slug: "uasin-gishu", name: "Uasin Gishu County", region: "Rift Valley", tier: "metro", launchNote: "Commercial hub with large enterprise onboarding demand." },
  { slug: "machakos", name: "Machakos County", region: "Eastern", tier: "metro", launchNote: "Large service footprint near the capital corridor." },
  { slug: "kakamega", name: "Kakamega County", region: "Western", tier: "growth", launchNote: "Strong SME and market levies opportunity." },
  { slug: "meru", name: "Meru County", region: "Eastern", tier: "growth", launchNote: "Mixed agriculture and trade services." },
  { slug: "nyeri", name: "Nyeri County", region: "Central", tier: "growth", launchNote: "Structured revenue base and administrative efficiency focus." },
  { slug: "kisii", name: "Kisii County", region: "Nyanza", tier: "growth", launchNote: "Business permit and market collections at scale." },
  { slug: "bungoma", name: "Bungoma County", region: "Western", tier: "growth", launchNote: "Cross-border trade and licensing growth." },
  { slug: "kajiado", name: "Kajiado County", region: "Rift Valley", tier: "growth", launchNote: "Land, rates, and peri-urban development demand." },
  { slug: "kericho", name: "Kericho County", region: "Rift Valley", tier: "growth", launchNote: "Agri-value-chain revenue and permit automation." },
  { slug: "busia", name: "Busia County", region: "Western", tier: "growth", launchNote: "Border trade, inspections, and compliance flow." },
  { slug: "homa-bay", name: "Homa Bay County", region: "Nyanza", tier: "growth", launchNote: "High-value citizen service digitization." },
  { slug: "migori", name: "Migori County", region: "Nyanza", tier: "growth", launchNote: "Trade and verification opportunities across wards." },
  { slug: "embu", name: "Embu County", region: "Eastern", tier: "growth", launchNote: "Lean county rollout with strong governance optics." },
  { slug: "muranga", name: "Murang'a County", region: "Central", tier: "growth", launchNote: "Commuter economy with permit and rates collection upside." },
  { slug: "laikipia", name: "Laikipia County", region: "Rift Valley", tier: "growth", launchNote: "Land administration and tourism-linked workflows." },
  { slug: "bomet", name: "Bomet County", region: "Rift Valley", tier: "growth", launchNote: "Growing revenue base with focused rollout scope." },
  { slug: "narok", name: "Narok County", region: "Rift Valley", tier: "growth", launchNote: "Tourism, trade, and land records digitization." },
  { slug: "kilifi", name: "Kilifi County", region: "Coast", tier: "growth", launchNote: "Tourism and coastal market fee modernization." },
  { slug: "nyamira", name: "Nyamira County", region: "Nyanza", tier: "growth", launchNote: "Compact deployment with measurable service gains." },
  { slug: "tharaka-nithi", name: "Tharaka-Nithi County", region: "Eastern", tier: "access", launchNote: "Focused rollout for smaller county operations." },
  { slug: "taita-taveta", name: "Taita Taveta County", region: "Coast", tier: "access", launchNote: "Land and conservation-linked permit workflows." },
  { slug: "kwale", name: "Kwale County", region: "Coast", tier: "access", launchNote: "Tourism and land administration starter package." },
  { slug: "lamu", name: "Lamu County", region: "Coast", tier: "access", launchNote: "Heritage and local revenue digitization." },
  { slug: "tana-river", name: "Tana River County", region: "Coast", tier: "access", launchNote: "Low-friction rollout for essential public services." },
  { slug: "garissa", name: "Garissa County", region: "North Eastern", tier: "access", launchNote: "Resident verification and revenue capture support." },
  { slug: "wajir", name: "Wajir County", region: "North Eastern", tier: "access", launchNote: "Remote service access and agent network fit." },
  { slug: "mandera", name: "Mandera County", region: "North Eastern", tier: "access", launchNote: "Border-adjacent service and compliance digitization." },
  { slug: "marsabit", name: "Marsabit County", region: "Northern", tier: "access", launchNote: "Distributed county service delivery with offline support." },
  { slug: "isiolo", name: "Isiolo County", region: "Eastern", tier: "access", launchNote: "Transport corridor and licensing workflows." },
  { slug: "kitui", name: "Kitui County", region: "Eastern", tier: "access", launchNote: "Revenue recovery and citizen access package." },
  { slug: "makueni", name: "Makueni County", region: "Eastern", tier: "access", launchNote: "Lean rollout with strong digital service fit." },
  { slug: "nyandarua", name: "Nyandarua County", region: "Central", tier: "access", launchNote: "Smaller county admin and payment digitization." },
  { slug: "kirinyaga", name: "Kirinyaga County", region: "Central", tier: "access", launchNote: "Agricultural licensing and land services." },
  { slug: "elgeyo-marakwet", name: "Elgeyo-Marakwet County", region: "Rift Valley", tier: "access", launchNote: "Focused public service digitization." },
  { slug: "nandi", name: "Nandi County", region: "Rift Valley", tier: "access", launchNote: "Revenue collections and citizen service lift." },
  { slug: "baringo", name: "Baringo County", region: "Rift Valley", tier: "access", launchNote: "Remote workflows and offline-first coverage." },
  { slug: "turkana", name: "Turkana County", region: "Rift Valley", tier: "access", launchNote: "Dispersed service delivery and audit visibility." },
  { slug: "west-pokot", name: "West Pokot County", region: "Rift Valley", tier: "access", launchNote: "Frontier county rollout with agent-first support." },
  { slug: "samburu", name: "Samburu County", region: "Rift Valley", tier: "access", launchNote: "Remote county with strong offline resilience need." },
  { slug: "trans-nzoia", name: "Trans Nzoia County", region: "Rift Valley", tier: "access", launchNote: "Agricultural and market fee automation." },
  { slug: "vihiga", name: "Vihiga County", region: "Western", tier: "access", launchNote: "Compact county deployment with quick wins." },
  { slug: "siaya", name: "Siaya County", region: "Nyanza", tier: "access", launchNote: "Citizen-facing service and revenue recovery support." },
];

const COUNTY_PRICING: Record<CountyTier, CountyPackages> = {
  metro: { starter: 4500000, standard: 9000000, enterprise: 12000000 },
  growth: { starter: 2500000, standard: 5000000, enterprise: 8500000 },
  access: { starter: 1800000, standard: 3500000, enterprise: 6500000 },
};



export function getCountyBySlug(slug: string) {
  return COUNTY_PROFILES.find((county) => county.slug === slug);
}

export function getCountyPackages(county: CountyProfile) {
  return COUNTY_PRICING[county.tier];
}

export function getDefaultCounty() {
  return COUNTY_PROFILES[0];
}

export function getSelectedCountySlug() {
  if (typeof window === "undefined") {
    return getDefaultCounty().slug;
  }

  return window.localStorage.getItem(COUNTY_STORAGE_KEY) ?? getDefaultCounty().slug;
}

export function getSelectedCounty() {
  return getCountyBySlug(getSelectedCountySlug()) ?? getDefaultCounty();
}

export function setSelectedCounty(slug: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(COUNTY_STORAGE_KEY, slug);
}
