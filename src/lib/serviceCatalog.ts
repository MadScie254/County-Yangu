export type ServiceType = "citizen" | "business";

export interface ServiceDefinition {
  id: string;
  name: string;
  category: string;
  desc: string;
  fee: string;
  amount: number;
  type: ServiceType;
  hot?: boolean;
  new?: boolean;
}

export const SERVICE_CATALOG: ServiceDefinition[] = [
  {
    id: "sbp",
    name: "Single Business Permit (SBP)",
    category: "business",
    desc: "End-to-end application, renewal, and compliance tracking for businesses.",
    fee: "From KES 5,000",
    amount: 15000,
    type: "business",
    hot: true,
  },
  {
    id: "land-registry",
    name: "Digital Land Registry",
    category: "land",
    desc: "Verify parcel records, title deeds, and transfer history on immutable ledger.",
    fee: "KES 500 per search",
    amount: 500,
    type: "citizen",
  },
  {
    id: "parking",
    name: "Daily/Seasonal Parking",
    category: "finance",
    desc: "Instant parking fee payment with real-time enforcement verification.",
    fee: "KES 200 / day",
    amount: 200,
    type: "citizen",
  },
  {
    id: "construction",
    name: "Architectural Approvals",
    category: "construction",
    desc: "Submit building plans for county approval and track progress.",
    fee: "0.1% of estimated cost",
    amount: 25000,
    type: "business",
  },
  {
    id: "kra-bridge",
    name: "KRA Tax Bridge",
    category: "finance",
    desc: "Lightweight SME dashboard for iTax filings and liability management.",
    fee: "Free for SMEs",
    amount: 0,
    type: "business",
    new: true,
  },
  {
    id: "welfare",
    name: "Social Welfare Benefits",
    category: "social",
    desc: "Register as a beneficiary for county welfare programs and manage disbursements.",
    fee: "Free",
    amount: 0,
    type: "citizen",
  },
  {
    id: "health-portal",
    name: "Health Facility Portal",
    category: "social",
    desc: "Book appointments and access medical records from county Level 2/3 facilities.",
    fee: "Subsidized",
    amount: 300,
    type: "citizen",
  },
  {
    id: "legal",
    name: "Legal Services / Petitions",
    category: "all",
    desc: "Submit public participation input or file a formal complaint/grievance.",
    fee: "Free",
    amount: 0,
    type: "citizen",
  },
];

export function getServiceById(serviceId?: string) {
  return SERVICE_CATALOG.find((service) => service.id === serviceId) ?? SERVICE_CATALOG[0];
}
