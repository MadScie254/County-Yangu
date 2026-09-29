import { KENYAN_CITIZEN_NAMES, generateEmail, generatePhone } from "./names";

export interface CitizenProfile {
  fullName: string;
  firstName: string;
  lastName: string;
  initials: string;
  email: string;
  phone: string;
  idNumber: string;
  address: string;
  county: string;
  ward: string;
}

const defaultCitizen = KENYAN_CITIZEN_NAMES[0];

export const CURRENT_CITIZEN: CitizenProfile = {
  fullName: `${defaultCitizen.first} ${defaultCitizen.last}`,
  firstName: defaultCitizen.first,
  lastName: defaultCitizen.last,
  initials: `${defaultCitizen.first[0]}${defaultCitizen.last[0]}`,
  email: generateEmail(defaultCitizen.first, defaultCitizen.last),
  phone: generatePhone(),
  idNumber: defaultCitizen.id,
  address: "P.O. Box 12345, Nairobi",
  county: "Nairobi City County",
  ward: "Kilimani",
};
