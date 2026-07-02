import { slugify } from "@/lib/utils";

export type Channel = "web" | "ussd" | "ivr";
export type ProjectStatus =
  | "planned"
  | "procurement"
  | "in_progress"
  | "stalled"
  | "completed";
export type ReportStatus =
  | "received"
  | "under_review"
  | "routed"
  | "resolved";

export type TenderStatus = "open" | "evaluating" | "awarded";

export type Ward = {
  id: string;
  name: string;
  constituency: string;
  subCounty: string;
  adultPopulation: number;
  participationRate: number;
  trustIndex: number;
  openReports: number;
  votesCast: number;
};

export type BudgetCycle = {
  id: string;
  title: string;
  status: "open" | "closed" | "draft";
  startsAt: string;
  endsAt: string;
  totalEnvelope: number;
};

export type ProjectOption = {
  id: string;
  wardId: string;
  title: string;
  sector: string;
  description: string;
  amount: number;
  votes: Record<Channel, number>;
};

export type Project = {
  id: string;
  slug: string;
  wardId: string;
  title: string;
  sector: string;
  status: ProjectStatus;
  budget: number;
  spent: number;
  contractor: string;
  lat: number;
  lng: number;
  startedAt: string;
  expectedAt: string;
  milestones: Array<{
    title: string;
    date: string;
    complete: boolean;
  }>;
  photos: string[];
  linkedReportRefs: string[];
};

export type CitizenReport = {
  reference: string;
  wardId: string;
  category: string;
  status: ReportStatus;
  channel: Channel;
  createdAt: string;
  updatedAt: string;
  projectId?: string;
};

export type BudgetNode = {
  id: string;
  label: string;
  kind: "county" | "sector" | "ward" | "project";
  amount: number;
};

export type Tender = {
  id: string;
  reference: string;
  title: string;
  wardId: string;
  sector: string;
  status: TenderStatus;
  estimatedBudget: number;
  applicantsCount: number;
  contractor: string | null;
  publishedAt: string;
  closesAt: string;
};

export type Contractor = {
  id: string;
  name: string;
  reliabilityScore: number;
  projectsCompleted: number;
  projectsLate: number;
  projectsStalled: number;
  flags: string[];
};

export type BudgetLink = {
  source: string;
  target: string;
  amount: number;
};

const wardRows: Array<{
  name: string;
  constituency: string;
  subCounty: string;
  adultPopulation: number;
}> = [
  { name: "Cheptais", constituency: "Mt. Elgon", subCounty: "Cheptais", adultPopulation: 18486 },
  { name: "Chesikaki", constituency: "Mt. Elgon", subCounty: "Mt. Elgon", adultPopulation: 15451 },
  { name: "Chepyuk", constituency: "Mt. Elgon", subCounty: "Mt. Elgon", adultPopulation: 16337 },
  { name: "Kapkateny", constituency: "Mt. Elgon", subCounty: "Mt. Elgon", adultPopulation: 18409 },
  { name: "Kaptama", constituency: "Mt. Elgon", subCounty: "Mt. Elgon", adultPopulation: 21547 },
  { name: "Elgon", constituency: "Mt. Elgon", subCounty: "Mt. Elgon", adultPopulation: 20460 },
  { name: "Namwela", constituency: "Sirisia", subCounty: "Bungoma West", adultPopulation: 17693 },
  { name: "Malakisi/South Kulisiru", constituency: "Sirisia", subCounty: "Bungoma West", adultPopulation: 22518 },
  { name: "Lwandanyi", constituency: "Sirisia", subCounty: "Bungoma West", adultPopulation: 25558 },
  { name: "Kabuchai/Chwele", constituency: "Kabuchai", subCounty: "Kabuchai", adultPopulation: 23024 },
  { name: "West Nalondo", constituency: "Kabuchai", subCounty: "Kabuchai", adultPopulation: 21274 },
  { name: "Bwake/Luuya", constituency: "Kabuchai", subCounty: "Kabuchai", adultPopulation: 21923 },
  { name: "Mukuyuni", constituency: "Kabuchai", subCounty: "Kabuchai", adultPopulation: 24394 },
  { name: "South Bukusu", constituency: "Kabuchai", subCounty: "Kabuchai", adultPopulation: 14856 },
  { name: "Bumula", constituency: "Bumula", subCounty: "Bumula", adultPopulation: 20499 },
  { name: "Khasoko", constituency: "Bumula", subCounty: "Bumula", adultPopulation: 9012 },
  { name: "Kabula", constituency: "Bumula", subCounty: "Bumula", adultPopulation: 13328 },
  { name: "Kimaeti", constituency: "Bumula", subCounty: "Bumula", adultPopulation: 23463 },
  { name: "West Bukusu", constituency: "Bumula", subCounty: "Bumula", adultPopulation: 12844 },
  { name: "Siboti", constituency: "Bumula", subCounty: "Bumula", adultPopulation: 20874 },
  { name: "Bukembe West", constituency: "Kanduyi", subCounty: "Bungoma South", adultPopulation: 13042 },
  { name: "Bukembe East", constituency: "Kanduyi", subCounty: "Bungoma South", adultPopulation: 17177 },
  { name: "Township", constituency: "Kanduyi", subCounty: "Bungoma South", adultPopulation: 12212 },
  { name: "Khalaba", constituency: "Kanduyi", subCounty: "Bungoma South", adultPopulation: 15732 },
  { name: "Musikoma", constituency: "Kanduyi", subCounty: "Bungoma South", adultPopulation: 24358 },
  { name: "East Sang'alo", constituency: "Kanduyi", subCounty: "Bungoma South", adultPopulation: 20733 },
  { name: "Tuuti", constituency: "Kanduyi", subCounty: "Bungoma South", adultPopulation: 10521 },
  { name: "Marakaru", constituency: "Kanduyi", subCounty: "Bungoma South", adultPopulation: 12455 },
  { name: "West Sang'alo", constituency: "Kanduyi", subCounty: "Bungoma South", adultPopulation: 21270 },
  { name: "Mihuu", constituency: "Webuye East", subCounty: "Bungoma East", adultPopulation: 24278 },
  { name: "Ndivisi", constituency: "Webuye East", subCounty: "Bungoma East", adultPopulation: 25551 },
  { name: "Maraka", constituency: "Webuye East", subCounty: "Bungoma East", adultPopulation: 15040 },
  { name: "Sitikho", constituency: "Webuye West", subCounty: "Webuye West", adultPopulation: 24125 },
  { name: "Matulo", constituency: "Webuye West", subCounty: "Webuye West", adultPopulation: 28527 },
  { name: "Bokoli", constituency: "Webuye West", subCounty: "Webuye West", adultPopulation: 30333 },
  { name: "Kibingei", constituency: "Kimilili", subCounty: "Kimilili-Bungoma", adultPopulation: 22127 },
  { name: "Kimilili", constituency: "Kimilili", subCounty: "Kimilili-Bungoma", adultPopulation: 23288 },
  { name: "Maeni", constituency: "Kimilili", subCounty: "Kimilili-Bungoma", adultPopulation: 15546 },
  { name: "Kamukuywa", constituency: "Kimilili", subCounty: "Kimilili-Bungoma", adultPopulation: 24329 },
  { name: "Mbakalo", constituency: "Tongaren", subCounty: "Bungoma North", adultPopulation: 20695 },
  { name: "Naitiri/Kabuyefwe", constituency: "Tongaren", subCounty: "Bungoma North", adultPopulation: 24416 },
  { name: "Milima", constituency: "Tongaren", subCounty: "Bungoma North", adultPopulation: 21417 },
  { name: "Ndalu/Tabani", constituency: "Tongaren", subCounty: "Bungoma North", adultPopulation: 13580 },
  { name: "Tongaren", constituency: "Tongaren", subCounty: "Tongaren", adultPopulation: 21773 },
  { name: "Soysambu/Mitua", constituency: "Tongaren", subCounty: "Tongaren", adultPopulation: 18506 },
];

export const wards: Ward[] = wardRows.map((ward, index) => {
  const participationRate = 32 + ((index * 7) % 39);
  const trustIndex = 48 + ((index * 11) % 44);
  const votesCast = Math.round(ward.adultPopulation * (participationRate / 100) * 0.38);
  const openReports = 3 + ((index * 5) % 18);

  return {
    id: slugify(ward.name),
    ...ward,
    participationRate,
    trustIndex,
    votesCast,
    openReports,
  };
});

export const currentCycle: BudgetCycle = {
  id: "fy-2026-public-participation",
  title: "FY 2026/27 ward development vote",
  status: "open",
  startsAt: "2026-06-24T06:00:00+03:00",
  endsAt: "2026-07-15T18:00:00+03:00",
  totalEnvelope: 612_000_000,
};

export const projectOptions: ProjectOption[] = [
  {
    id: "kimilili-market-water",
    wardId: "kimilili",
    title: "Kimilili market water point",
    sector: "Water",
    description: "Solar-pumped borehole and two storage tanks beside the produce market.",
    amount: 6_800_000,
    votes: { web: 724, ussd: 1190, ivr: 404 },
  },
  {
    id: "chwele-drainage",
    wardId: "kabuchai-chwele",
    title: "Chwele market drainage repair",
    sector: "Roads",
    description: "Covered drains and culverts around the matatu and boda boda stage.",
    amount: 9_400_000,
    votes: { web: 512, ussd: 1428, ivr: 355 },
  },
  {
    id: "sirisia-classroom",
    wardId: "lwandanyi",
    title: "Lwandanyi ECDE classroom block",
    sector: "Education",
    description: "Two classrooms, rainwater harvesting, and child-safe latrines.",
    amount: 11_700_000,
    votes: { web: 414, ussd: 988, ivr: 602 },
  },
  {
    id: "naitiri-dispensary-power",
    wardId: "naitiri-kabuyefwe",
    title: "Naitiri dispensary solar backup",
    sector: "Health",
    description: "Solar backup for vaccine cold chain and night-time maternity service.",
    amount: 7_250_000,
    votes: { web: 306, ussd: 1320, ivr: 712 },
  },
];

export const projects: Project[] = [
  {
    id: "p-001",
    slug: "kimilili-market-water-point",
    wardId: "kimilili",
    title: "Kimilili market water point",
    sector: "Water",
    status: "in_progress",
    budget: 6_800_000,
    spent: 3_950_000,
    contractor: "Chebukwabi Works Cooperative",
    lat: 0.783,
    lng: 34.72,
    startedAt: "2026-05-06",
    expectedAt: "2026-08-28",
    milestones: [
      { title: "Site marked with market committee", date: "2026-05-08", complete: true },
      { title: "Borehole drilling complete", date: "2026-06-18", complete: true },
      { title: "Tank stand and solar pump installation", date: "2026-07-25", complete: false },
    ],
    photos: ["water point trench", "borehole rig", "tank foundation"],
    linkedReportRefs: ["CY-2607-KML-184"],
  },
  {
    id: "p-002",
    slug: "chwele-market-drainage",
    wardId: "kabuchai-chwele",
    title: "Chwele market drainage repair",
    sector: "Roads",
    status: "procurement",
    budget: 9_400_000,
    spent: 840_000,
    contractor: "Tender evaluation in progress",
    lat: 0.603,
    lng: 34.56,
    startedAt: "2026-06-01",
    expectedAt: "2026-10-15",
    milestones: [
      { title: "Resident walk-through completed", date: "2026-06-05", complete: true },
      { title: "Tender advertised", date: "2026-06-19", complete: true },
      { title: "Contract award published", date: "2026-07-10", complete: false },
    ],
    photos: ["blocked drain", "market edge", "culvert survey"],
    linkedReportRefs: [],
  },
  {
    id: "p-003",
    slug: "lwandanyi-ecde-classrooms",
    wardId: "lwandanyi",
    title: "Lwandanyi ECDE classroom block",
    sector: "Education",
    status: "stalled",
    budget: 11_700_000,
    spent: 5_680_000,
    contractor: "Nabuyole Builders Ltd",
    lat: 0.69,
    lng: 34.39,
    startedAt: "2026-03-12",
    expectedAt: "2026-09-30",
    milestones: [
      { title: "Foundation inspected", date: "2026-04-02", complete: true },
      { title: "Walling to lintel level", date: "2026-05-17", complete: true },
      { title: "Roofing materials delivered", date: "2026-06-12", complete: false },
    ],
    photos: ["unfinished classroom", "stored bricks", "community inspection"],
    linkedReportRefs: ["CY-2606-LWD-022", "CY-2607-LWD-019"],
  },
  {
    id: "p-004",
    slug: "naitiri-dispensary-solar-backup",
    wardId: "naitiri-kabuyefwe",
    title: "Naitiri dispensary solar backup",
    sector: "Health",
    status: "completed",
    budget: 7_250_000,
    spent: 7_090_000,
    contractor: "Elgon Sun Systems",
    lat: 0.83,
    lng: 34.78,
    startedAt: "2026-02-20",
    expectedAt: "2026-06-20",
    milestones: [
      { title: "Energy audit", date: "2026-03-01", complete: true },
      { title: "Battery room secured", date: "2026-04-17", complete: true },
      { title: "Cold-chain backup commissioned", date: "2026-06-12", complete: true },
    ],
    photos: ["solar panels", "battery cabinet", "maternity light"],
    linkedReportRefs: [],
  },
  {
    id: "p-005",
    slug: "mbakalo-footbridge-repair",
    wardId: "mbakalo",
    title: "Mbakalo footbridge repair",
    sector: "Roads",
    status: "planned",
    budget: 4_900_000,
    spent: 0,
    contractor: "Not awarded",
    lat: 0.77,
    lng: 34.68,
    startedAt: "2026-07-20",
    expectedAt: "2026-11-15",
    milestones: [
      { title: "Design published", date: "2026-07-04", complete: true },
      { title: "Community safety review", date: "2026-07-18", complete: false },
      { title: "Works begin", date: "2026-08-03", complete: false },
    ],
    photos: ["washed crossing", "river approach", "community sketch"],
    linkedReportRefs: ["CY-2607-MBK-041"],
  },
  {
    id: "p-006",
    slug: "musikoma-youth-polytechnic-tools",
    wardId: "musikoma",
    title: "Musikoma youth polytechnic tools",
    sector: "Jobs",
    status: "completed",
    budget: 3_600_000,
    spent: 3_580_000,
    contractor: "Bungoma Technical Supplies",
    lat: 0.58,
    lng: 34.55,
    startedAt: "2026-01-16",
    expectedAt: "2026-05-28",
    milestones: [
      { title: "Tool inventory agreed", date: "2026-02-03", complete: true },
      { title: "Delivery and tagging", date: "2026-04-12", complete: true },
      { title: "Trainer handover", date: "2026-05-20", complete: true },
    ],
    photos: ["welding kits", "trainer handover", "tagged tools"],
    linkedReportRefs: [],
  },
];

export const reports: CitizenReport[] = [
  {
    reference: "CY-2607-KML-184",
    wardId: "kimilili",
    category: "Water",
    status: "routed",
    channel: "ussd",
    createdAt: "2026-07-01T08:45:00+03:00",
    updatedAt: "2026-07-01T13:10:00+03:00",
    projectId: "p-001",
  },
  {
    reference: "CY-2606-LWD-022",
    wardId: "lwandanyi",
    category: "Education",
    status: "under_review",
    channel: "web",
    createdAt: "2026-06-27T15:12:00+03:00",
    updatedAt: "2026-07-01T09:04:00+03:00",
    projectId: "p-003",
  },
  {
    reference: "CY-2607-LWD-019",
    wardId: "lwandanyi",
    category: "Education",
    status: "received",
    channel: "ivr",
    createdAt: "2026-07-02T07:38:00+03:00",
    updatedAt: "2026-07-02T07:38:00+03:00",
    projectId: "p-003",
  },
  {
    reference: "CY-2607-MBK-041",
    wardId: "mbakalo",
    category: "Roads",
    status: "resolved",
    channel: "ussd",
    createdAt: "2026-06-29T19:21:00+03:00",
    updatedAt: "2026-07-01T16:30:00+03:00",
    projectId: "p-005",
  },
];

export const channels: Array<{ id: Channel; label: string; value: number }> = [
  { id: "web", label: "Web", value: 18 },
  { id: "ussd", label: "USSD", value: 54 },
  { id: "ivr", label: "IVR", value: 28 },
];

export const budgetNodes: BudgetNode[] = [
  { id: "county", label: "Bungoma County envelope", kind: "county", amount: 612_000_000 },
  { id: "water", label: "Water", kind: "sector", amount: 148_000_000 },
  { id: "roads", label: "Roads", kind: "sector", amount: 182_000_000 },
  { id: "education", label: "Education", kind: "sector", amount: 164_000_000 },
  { id: "health", label: "Health", kind: "sector", amount: 118_000_000 },
  { id: "kimilili-ward", label: "Kimilili", kind: "ward", amount: 18_400_000 },
  { id: "kabuchai-ward", label: "Kabuchai/Chwele", kind: "ward", amount: 22_900_000 },
  { id: "lwandanyi-ward", label: "Lwandanyi", kind: "ward", amount: 24_600_000 },
  { id: "naitiri-ward", label: "Naitiri/Kabuyefwe", kind: "ward", amount: 20_200_000 },
  { id: "project-water", label: "Market water point", kind: "project", amount: 6_800_000 },
  { id: "project-drain", label: "Market drainage", kind: "project", amount: 9_400_000 },
  { id: "project-classroom", label: "ECDE classrooms", kind: "project", amount: 11_700_000 },
  { id: "project-solar", label: "Dispensary solar", kind: "project", amount: 7_250_000 },
];

export const budgetLinks: BudgetLink[] = [
  { source: "county", target: "water", amount: 148_000_000 },
  { source: "county", target: "roads", amount: 182_000_000 },
  { source: "county", target: "education", amount: 164_000_000 },
  { source: "county", target: "health", amount: 118_000_000 },
  { source: "water", target: "kimilili-ward", amount: 18_400_000 },
  { source: "roads", target: "kabuchai-ward", amount: 22_900_000 },
  { source: "education", target: "lwandanyi-ward", amount: 24_600_000 },
  { source: "health", target: "naitiri-ward", amount: 20_200_000 },
  { source: "kimilili-ward", target: "project-water", amount: 6_800_000 },
  { source: "kabuchai-ward", target: "project-drain", amount: 9_400_000 },
  { source: "lwandanyi-ward", target: "project-classroom", amount: 11_700_000 },
  { source: "naitiri-ward", target: "project-solar", amount: 7_250_000 },
];

export const reportTrends = [
  { month: "Feb", Water: 24, Roads: 31, Education: 18, Health: 14 },
  { month: "Mar", Water: 28, Roads: 43, Education: 21, Health: 16 },
  { month: "Apr", Water: 38, Roads: 39, Education: 29, Health: 19 },
  { month: "May", Water: 44, Roads: 52, Education: 33, Health: 24 },
  { month: "Jun", Water: 51, Roads: 61, Education: 39, Health: 31 },
  { month: "Jul", Water: 58, Roads: 66, Education: 43, Health: 36 },
];

export const statusFunnel = [
  { status: "Received", count: 408 },
  { status: "Under review", count: 302 },
  { status: "Routed", count: 214 },
  { status: "Resolved", count: 176 },
];

export const dataSources = [
  {
    label: "Official Bungoma political units",
    url: "https://www.bungoma.go.ke/political-units/",
  },
  {
    label: "Bungoma ward list and adult population sample frame",
    url: "https://countytrak.infotrakresearch.com/bungoma-county/",
  },
  {
    label: "Kenya ward boundary GeoJSON/shapefile starting point",
    url: "https://data.humdata.org/dataset/administrative-wards-in-kenya-1450",
  },
];

export const tenders: Tender[] = [
  {
    id: "t-001",
    reference: "BGM/T/001/2026",
    title: "Construction of Lwandanyi ECDE block",
    wardId: "lwandanyi",
    sector: "Education",
    status: "awarded",
    estimatedBudget: 11500000,
    applicantsCount: 4,
    contractor: "Nabuyole Builders Ltd",
    publishedAt: "2026-02-10",
    closesAt: "2026-03-01",
  },
  {
    id: "t-002",
    reference: "BGM/T/002/2026",
    title: "Renovation of Ndalu Health Center maternity wing",
    wardId: "ndalu-tabani",
    sector: "Health",
    status: "awarded",
    estimatedBudget: 8500000,
    applicantsCount: 6,
    contractor: "Nabuyole Builders Ltd",
    publishedAt: "2026-03-15",
    closesAt: "2026-04-05",
  },
  {
    id: "t-003",
    reference: "BGM/T/003/2026",
    title: "Fencing of Tongaren market",
    wardId: "tongaren",
    sector: "Trade",
    status: "awarded",
    estimatedBudget: 4200000,
    applicantsCount: 3,
    contractor: "Nabuyole Builders Ltd",
    publishedAt: "2026-04-20",
    closesAt: "2026-05-10",
  },
  {
    id: "t-004",
    reference: "BGM/T/004/2026",
    title: "Chwele market drainage repair",
    wardId: "kabuchai-chwele",
    sector: "Roads",
    status: "evaluating",
    estimatedBudget: 9400000,
    applicantsCount: 7,
    contractor: null,
    publishedAt: "2026-06-01",
    closesAt: "2026-06-21",
  },
  {
    id: "t-005",
    reference: "BGM/T/005/2026",
    title: "Mbakalo footbridge repair",
    wardId: "mbakalo",
    sector: "Roads",
    status: "open",
    estimatedBudget: 4900000,
    applicantsCount: 2,
    contractor: null,
    publishedAt: "2026-07-01",
    closesAt: "2026-07-22",
  },
  {
    id: "t-006",
    reference: "BGM/T/006/2026",
    title: "Kimilili market water point solar system",
    wardId: "kimilili",
    sector: "Water",
    status: "awarded",
    estimatedBudget: 6800000,
    applicantsCount: 5,
    contractor: "Chebukwabi Works Cooperative",
    publishedAt: "2026-04-10",
    closesAt: "2026-05-02",
  }
];

export const contractors: Contractor[] = [
  {
    id: "c-001",
    name: "Nabuyole Builders Ltd",
    reliabilityScore: 42,
    projectsCompleted: 4,
    projectsLate: 3,
    projectsStalled: 1,
    flags: ["Excessive active tenders (3)", "History of delayed milestones"],
  },
  {
    id: "c-002",
    name: "Chebukwabi Works Cooperative",
    reliabilityScore: 88,
    projectsCompleted: 12,
    projectsLate: 1,
    projectsStalled: 0,
    flags: [],
  },
  {
    id: "c-003",
    name: "Elgon Sun Systems",
    reliabilityScore: 95,
    projectsCompleted: 8,
    projectsLate: 0,
    projectsStalled: 0,
    flags: [],
  },
  {
    id: "c-004",
    name: "Bungoma Technical Supplies",
    reliabilityScore: 76,
    projectsCompleted: 5,
    projectsLate: 1,
    projectsStalled: 0,
    flags: [],
  }
];

export function getWard(id: string) {
  return wards.find((ward) => ward.id === id);
}

export function getProjectBySlug(slug: string) {
  return projects.find((project) => project.slug === slug);
}

export function getReport(reference: string) {
  return reports.find(
    (report) => report.reference.toLowerCase() === reference.toLowerCase(),
  );
}

export function getContractor(name: string) {
  return contractors.find((c) => c.name === name);
}

export function projectStatusLabel(status: ProjectStatus) {
  return status.replace(/_/g, " ");
}

export function getVoteTotals(option: ProjectOption) {
  return option.votes.web + option.votes.ussd + option.votes.ivr;
}

export const countyTotals = {
  votesCast: wards.reduce((sum, ward) => sum + ward.votesCast, 0),
  reportsFiled: 1264,
  milestonesHit: projects.reduce(
    (sum, project) =>
      sum + project.milestones.filter((milestone) => milestone.complete).length,
    0,
  ),
  projectBudget: projects.reduce((sum, project) => sum + project.budget, 0),
  projectSpent: projects.reduce((sum, project) => sum + project.spent, 0),
};
