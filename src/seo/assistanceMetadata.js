// src/seo/assistanceMetadata.js
// Per-route SEO copy for /assistance/[slug] pages. One entry per indexable
// assistance type (29 total — "Other" is intentionally not indexable).
//
// Title and description are the only fields that vary per route. Canonical
// URL, OG, and Twitter tags are derived from the slug at render time.
//
// Edit this file directly to refine wording. The slug keys must match the
// `url_slug` column in the Supabase `assistance` table.

const ASSISTANCE_SEO = {
  // Group 1 — top-level needs
  rent: {
    title: "Free Rent Assistance in Houston | Community Resources Guide",
    description:
      "Find emergency rent help, deposit assistance, and eviction prevention from local nonprofits across the Greater Houston Area. Search by zip code for hours and eligibility.",
  },
  utilities: {
    title: "Free Utility Assistance in Houston | Community Resources Guide",
    description:
      "Find help paying electric, gas, and water bills from local nonprofits across the Greater Houston Area. Search by zip code for eligibility and contact info.",
  },
  food: {
    title: "Free Food Assistance in Houston | Community Resources Guide",
    description:
      "Find food pantries, hot meals, and grocery assistance across the Greater Houston Area. Search by zip code for hours, locations, and eligibility requirements.",
  },
  clothing: {
    title: "Free Clothing Assistance in Houston | Community Resources Guide",
    description:
      "Find free clothing closets, school uniforms, and work attire from local nonprofits across the Greater Houston Area. Search by zip code for hours and eligibility.",
  },

  // Group 2 — Homeless / Housing
  "homeless-shelters": {
    title: "Homeless Shelters in Houston | Community Resources Guide",
    description:
      "Find emergency shelters and overnight beds for individuals and families experiencing homelessness across the Greater Houston Area. Search by zip code for intake info.",
  },
  "homeless-day-centers": {
    title: "Homeless Day Centers in Houston | Community Resources Guide",
    description:
      "Find day centers offering showers, meals, and case management for people experiencing homelessness across the Greater Houston Area. Search by zip code.",
  },
  "homeless-other": {
    title: "Homeless Services in Houston | Community Resources Guide",
    description:
      "Find outreach, case management, and supportive services for people experiencing homelessness across the Greater Houston Area. Search by zip code.",
  },
  housing: {
    title: "Free Housing Assistance in Houston | Community Resources Guide",
    description:
      "Find affordable housing, rental assistance, and supportive housing programs across the Greater Houston Area. Search by zip code for eligibility and contact info.",
  },

  // Group 3 — Medical
  "medical-primary-care": {
    title: "Free Primary Medical Care in Houston | Community Resources Guide",
    description:
      "Find low-cost and free clinics offering primary medical care across the Greater Houston Area. Search by zip code for hours, services, and eligibility.",
  },
  "dental-vision": {
    title: "Free Dental and Vision Care in Houston | Community Resources Guide",
    description:
      "Find low-cost and free dental and vision care from clinics across the Greater Houston Area. Search by zip code for hours, services, and eligibility.",
  },
  "behavioral-health": {
    title: "Free Behavioral Health Care in Houston | Community Resources Guide",
    description:
      "Find free and low-cost mental health and behavioral health services across the Greater Houston Area. Search by zip code for counseling, therapy, and crisis support.",
  },
  "addiction-recovery": {
    title: "Free Addiction Recovery in Houston | Community Resources Guide",
    description:
      "Find substance use treatment, recovery support, and detox programs across the Greater Houston Area. Search by zip code for intake and eligibility info.",
  },
  "medical-enrollment": {
    title: "Free Medical Enrollment Help in Houston | Community Resources Guide",
    description:
      "Find help enrolling in Medicaid, Medicare, CHIP, and the Marketplace from local organizations across the Greater Houston Area. Search by zip code.",
  },
  "medical-bills": {
    title: "Medical Bill Assistance in Houston | Community Resources Guide",
    description:
      "Find help paying medical bills, prescriptions, and copays from local nonprofits across the Greater Houston Area. Search by zip code for eligibility.",
  },
  "medical-housing": {
    title: "Medical Housing Assistance in Houston | Community Resources Guide",
    description:
      "Find housing for patients receiving medical care in the Greater Houston Area, including Ronald McDonald House and other support housing. Search by zip code.",
  },

  // Group 4 — Domestic abuse / Family
  "domestic-abuse-shelters": {
    title: "Domestic Violence Shelters in Houston | Community Resources Guide",
    description:
      "Find emergency shelters for survivors of domestic violence and abuse across the Greater Houston Area. Search by zip code for 24/7 hotlines and intake info.",
  },
  "domestic-abuse-other": {
    title: "Domestic Violence Services in Houston | Community Resources Guide",
    description:
      "Find counseling, legal advocacy, and support services for survivors of domestic violence across the Greater Houston Area. Search by zip code.",
  },
  "education-children": {
    title:
      "Free Education Programs for Children in Houston | Community Resources Guide",
    description:
      "Find free tutoring, after-school programs, scholarships, and education support for children across the Greater Houston Area. Search by zip code.",
  },
  "mother-and-child": {
    title: "Mother and Child Services in Houston | Community Resources Guide",
    description:
      "Find prenatal care, parenting classes, baby supplies, and family support across the Greater Houston Area. Search by zip code for hours and eligibility.",
  },

  // Group 5 — Adult education / Jobs / Legal
  "education-adults": {
    title: "Free Adult Education in Houston | Community Resources Guide",
    description:
      "Find GED prep, ESL classes, workforce training, and adult education programs across the Greater Houston Area. Search by zip code for hours and eligibility.",
  },
  jobs: {
    title: "Free Job Assistance in Houston | Community Resources Guide",
    description:
      "Find job training, resume help, and employment placement from local nonprofits across the Greater Houston Area. Search by zip code for hours and eligibility.",
  },
  transportation: {
    title:
      "Free Transportation Assistance in Houston | Community Resources Guide",
    description:
      "Find bus passes, gas vouchers, and medical transportation from local nonprofits across the Greater Houston Area. Search by zip code for eligibility.",
  },
  legal: {
    title: "Free Legal Aid in Houston | Community Resources Guide",
    description:
      "Find free legal help with housing, family, immigration, and consumer issues across the Greater Houston Area. Search by zip code for clinics and intake info.",
  },
  immigration: {
    title: "Free Immigration Services in Houston | Community Resources Guide",
    description:
      "Find low-cost immigration legal help, citizenship classes, and DACA assistance across the Greater Houston Area. Search by zip code for eligibility.",
  },
  veterans: {
    title: "Veterans Services in Houston | Community Resources Guide",
    description:
      "Find benefits, housing, employment, and mental health support for veterans across the Greater Houston Area. Search by zip code for hours and contact info.",
  },

  // Group 6 — Specialty
  seniors: {
    title: "Senior Services in Houston | Community Resources Guide",
    description:
      "Find meals, medical care, transportation, and social programs for seniors across the Greater Houston Area. Search by zip code for hours and eligibility.",
  },
  handyman: {
    title: "Free Home Repair Services in Houston | Community Resources Guide",
    description:
      "Find home repair, weatherization, and accessibility modifications from local nonprofits across the Greater Houston Area. Search by zip code for eligibility.",
  },
  animals: {
    title: "Animal Welfare Services in Houston | Community Resources Guide",
    description:
      "Find low-cost veterinary care, pet food assistance, and adoption support across the Greater Houston Area. Search by zip code for hours and eligibility.",
  },
  christmas: {
    title:
      "Christmas Assistance Programs in Houston | Community Resources Guide",
    description:
      "Find Christmas toy drives, holiday meals, and family support programs across the Greater Houston Area. Search by zip code for sign-up info and eligibility.",
  },
};

// Generic fallback for unknown slugs. Keeps the page indexable but doesn't
// promise topic-specific content. The route still 200s and renders the
// working app shell.
const FALLBACK_SEO = {
  title: "Houston Community Resources | Search Free Help by Zip Code",
  description:
    "Free directory of community resources from 526 Houston-area organizations. Search by zip code for food, rent, utilities, medical, legal, and job assistance.",
};

export function getAssistanceSeo(slug) {
  return ASSISTANCE_SEO[slug] || FALLBACK_SEO;
}

export { ASSISTANCE_SEO, FALLBACK_SEO };
