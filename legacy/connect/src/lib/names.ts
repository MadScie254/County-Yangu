// Realistic Kenyan names database — all unique, spanning major ethnic groups

export const KENYAN_CITIZEN_NAMES = [
  { first: "Wambui", last: "Kamau", id: "23456789" },
  { first: "Hassan", last: "Abdi", id: "34567890" },
  { first: "Otieno", last: "Ochieng'", id: "45678901" },
  { first: "Amina", last: "Mwangi", id: "56789012" },
  { first: "Kipchoge", last: "Rotich", id: "67890123" },
  { first: "Njeri", last: "Ndungu", id: "78901234" },
  { first: "Omondi", last: "Atieno", id: "89012345" },
  { first: "Fatima", last: "Mohamed", id: "90123456" },
  { first: "Muthoni", last: "Karanja", id: "10234567" },
  { first: "Baraka", last: "Juma", id: "11234567" },
  { first: "Chebet", last: "Kosgei", id: "12345670" },
  { first: "Nyambura", last: "Wainaina", id: "13245678" },
  { first: "Achieng'", last: "Owino", id: "14235678" },
  { first: "Kiptoo", last: "Sang", id: "15234678" },
  { first: "Zawadi", last: "Bakari", id: "16234578" },
  { first: "Mumbi", last: "Githinji", id: "17234568" },
  { first: "Odhiambo", last: "Nyong'o", id: "18234567" },
  { first: "Halima", last: "Sheikh", id: "19234567" },
  { first: "Wanjiku", last: "Macharia", id: "20234567" },
  { first: "Kiplagat", last: "Bett", id: "21234567" },
  { first: "Asha", last: "Abdalla", id: "22345678" },
  { first: "Njoroge", last: "Kimani", id: "23345678" },
  { first: "Apiyo", last: "Odongo", id: "24345678" },
  { first: "Mercy", last: "Cherono", id: "25345678" },
  { first: "Rashid", last: "Omar", id: "26345678" },
  { first: "Nyokabi", last: "Muturi", id: "27345678" },
  { first: "Awuor", last: "Okello", id: "28345678" },
  { first: "Kipruto", last: "Langat", id: "29345678" },
  { first: "Zainab", last: "Hussein", id: "30345678" },
  { first: "Gathoni", last: "Njenga", id: "31345678" },
  { first: "Akinyi", last: "Miguna", id: "32345678" },
  { first: "Korir", last: "Cheruiyot", id: "33345678" },
  { first: "Mwende", last: "Mutua", id: "34345678" },
  { first: "Jibril", last: "Yusuf", id: "35345678" },
  { first: "Wairimu", last: "Kinyanjui", id: "36345678" },
  { first: "Oginga", last: "Odera", id: "37345678" },
  { first: "Rehema", last: "Salim", id: "38345678" },
  { first: "Mukami", last: "Ndirangu", id: "39345678" },
  { first: "Kemboi", last: "Kibet", id: "40345678" },
  { first: "Nafula", last: "Wekesa", id: "41345678" },
  { first: "Thuo", last: "Mwangi", id: "42345678" },
  { first: "Adhiambo", last: "Oloo", id: "43345678" },
  { first: "Chelangat", last: "Maritim", id: "44345678" },
  { first: "Nduta", last: "Wahome", id: "45345678" },
  { first: "Abdikadir", last: "Haji", id: "46345678" },
  { first: "Wangeci", last: "Kibaki", id: "47345678" },
  { first: "Ouma", last: "Anyango", id: "48345678" },
  { first: "Jeptoo", last: "Kipkemoi", id: "49345678" },
  { first: "Kariuki", last: "Mugo", id: "50345678" },
  { first: "Saida", last: "Athman", id: "51345678" },
];

export const KENYAN_COMPANIES = [
  "Savannah Infrastructure Ltd",
  "Coastal Medical Supplies Co.",
  "Highland ICT Solutions",
  "Rift Valley Agri-Ventures",
  "Lake Basin Construction Ltd",
  "Nairobi Metro Logistics",
  "Tsavo Engineering Works",
  "Mara Holdings Group",
  "Pwani Fisheries Co-op",
  "Mt. Kenya Water Services",
  "Nyanza Fresh Produce Ltd",
  "Tana Delta Farms",
  "Amboseli Security Solutions",
  "Equator Pharma Ltd",
  "Kericho Tea Industries",
  "Lamu Heritage Traders",
  "Uasin Gishu Grain Mills",
  "Eldoret Express Logistics",
  "Mombasa Port Services Ltd",
  "Kisumu Bay Enterprises",
  "Nanyuki Ranch Supplies",
  "Malindi Marine Ltd",
  "Thika Industrial Works",
  "Kakamega Forest Products",
  "Nakuru Flower Exports",
  "Machakos Solar Solutions",
  "Nyeri Dairy Co-operative",
  "Bungoma Steel Fabricators",
  "Garissa Livestock Trading",
  "Kitui Sand Harvesting Ltd",
];

export const DEPARTMENT_HEADS = [
  { name: "Mercy Wanjiku Kariuki", title: "Director" },
  { name: "Daniel Kiprono Cheruiyot", title: "Chief Officer" },
  { name: "Allan Omondi Muthama", title: "County Executive" },
  { name: "Aisha Mohamed Bakari", title: "Chief Officer" },
  { name: "Peter Mwangi Ndegwa", title: "Director" },
  { name: "Grace Akinyi Odhiambo", title: "Deputy Director" },
  { name: "James Kiplagat Ruto", title: "Chief Officer" },
  { name: "Amina Hassan Noor", title: "Director" },
  { name: "Samuel Njoroge Kamau", title: "County Executive" },
  { name: "Rose Chebet Kosgei", title: "Deputy Director" },
  { name: "Bernard Otieno Owino", title: "Chief Officer" },
  { name: "Fatuma Abdalla Sheikh", title: "Director" },
  { name: "Charles Gathoni Muturi", title: "County Executive" },
  { name: "Esther Nyambura Wainaina", title: "Chief Officer" },
  { name: "Philip Baraka Juma", title: "Director" },
];

export function getRandomCitizen(index: number) {
  return KENYAN_CITIZEN_NAMES[index % KENYAN_CITIZEN_NAMES.length];
}

export function getRandomCompany(index: number) {
  return KENYAN_COMPANIES[index % KENYAN_COMPANIES.length];
}

export function getRandomHead(index: number) {
  return DEPARTMENT_HEADS[index % DEPARTMENT_HEADS.length];
}

export function generatePhone(): string {
  const prefixes = ["0712", "0722", "0733", "0700", "0710", "0742", "0758", "0769"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const rest = String(Math.floor(Math.random() * 900000) + 100000);
  return `${prefix} ${rest.slice(0, 3)} ${rest.slice(3)}`;
}

export function generateEmail(first: string, last: string): string {
  return `${first.toLowerCase().replace(/'/g, "")}.${last.toLowerCase().replace(/'/g, "")}@mail.co.ke`;
}
