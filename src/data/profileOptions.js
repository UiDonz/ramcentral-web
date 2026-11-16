// The choices offered by the new-account questions (Onboarding.jsx) and
// the Profile page. Majors are stored on users/{uid}.majors as these
// stable `id` slugs (never the display label), because the club stats
// added in Issue #58 use them as Firestore map keys. Rename a `label`
// any time; never change an `id`.
//
// MAJORS is Farmingdale's degree-program list (bachelor's, associate's and
// master's), copied from the school's program page. Minors, certificates and
// microcredentials are left out - this is "what is your major". Programs
// that appear at two levels (Dental Hygiene is both an A.A.S. and a B.S.)
// or in several tracks (Criminal Justice) are one entry, so a club's
// percentages don't split across them. `short` is what recommendations
// print ("65% of members are CPIS majors"); it defaults to the full name.

export const MAX_MAJORS = 2;

export const MAJORS = [
  {
    id: 'aeronautical-science-professional-pilot',
    short: 'Aeronautical Science - Professional Pilot',
    label: 'Aeronautical Science - Professional Pilot'
  },
  { id: 'applied-economics', short: 'Applied Economics', label: 'Applied Economics' },
  { id: 'applied-gerontology', short: 'Applied Gerontology', label: 'Applied Gerontology' },
  { id: 'applied-mathematics', short: 'Applied Mathematics', label: 'Applied Mathematics' },
  { id: 'applied-physics', short: 'Applied Physics', label: 'Applied Physics' },
  { id: 'applied-psychology', short: 'Applied Psychology', label: 'Applied Psychology' },
  {
    id: 'architectural-engineering-technology',
    short: 'Architectural Engineering Technology',
    label: 'Architectural Engineering Technology'
  },
  {
    id: 'artificial-intelligence-management',
    short: 'Artificial Intelligence Management',
    label: 'Artificial Intelligence Management'
  },
  { id: 'aviation-administration', short: 'Aviation Administration', label: 'Aviation Administration' },
  { id: 'bioscience', short: 'Bioscience', label: 'Bioscience' },
  { id: 'business-analytics', short: 'Business Analytics', label: 'Business Analytics' },
  { id: 'business-management', short: 'Business Management', label: 'Business Management' },
  {
    id: 'civil-engineering-technology',
    short: 'Civil Engineering Technology',
    label: 'Civil Engineering Technology'
  },
  {
    id: 'computer-engineering-technology',
    short: 'Computer Engineering Technology',
    label: 'Computer Engineering Technology'
  },
  {
    id: 'computer-programming-and-information-systems',
    short: 'CPIS',
    label: 'Computer Programming and Information Systems'
  },
  { id: 'computer-science', short: 'Computer Science', label: 'Computer Science' },
  {
    id: 'construction-management-master-s',
    short: "Construction Management (Master's)",
    label: "Construction Management (Master's)"
  },
  {
    id: 'construction-management-engineering-technology',
    short: 'Construction Management Engineering Technology',
    label: 'Construction Management Engineering Technology'
  },
  { id: 'criminal-justice', short: 'Criminal Justice', label: 'Criminal Justice' },
  { id: 'cybersecurity', short: 'Cybersecurity', label: 'Cybersecurity' },
  { id: 'dental-hygiene', short: 'Dental Hygiene', label: 'Dental Hygiene' },
  {
    id: 'electrical-engineering-technology',
    short: 'Electrical Engineering Technology',
    label: 'Electrical Engineering Technology'
  },
  {
    id: 'facility-management-technology',
    short: 'Facility Management Technology',
    label: 'Facility Management Technology'
  },
  { id: 'general-horticulture', short: 'General Horticulture', label: 'General Horticulture' },
  {
    id: 'geographic-information-systems',
    short: 'Geographic Information Systems',
    label: 'Geographic Information Systems'
  },
  {
    id: 'global-business-management',
    short: 'Global Business Management',
    label: 'Global Business Management'
  },
  {
    id: 'health-promotion-and-wellness',
    short: 'Health Promotion and Wellness',
    label: 'Health Promotion and Wellness'
  },
  {
    id: 'horticultural-technology-management',
    short: 'Horticultural Technology Management',
    label: 'Horticultural Technology Management'
  },
  { id: 'interaction-design-ixd', short: 'Interaction Design (IxD)', label: 'Interaction Design (IxD)' },
  { id: 'landscape-development', short: 'Landscape Development', label: 'Landscape Development' },
  {
    id: 'liberal-arts-and-sciences',
    short: 'Liberal Arts and Sciences',
    label: 'Liberal Arts and Sciences'
  },
  {
    id: 'manufacturing-engineering-technology',
    short: 'Manufacturing Engineering Technology',
    label: 'Manufacturing Engineering Technology'
  },
  {
    id: 'mechanical-engineering-technology',
    short: 'Mechanical Engineering Technology',
    label: 'Mechanical Engineering Technology'
  },
  {
    id: 'medical-laboratory-science',
    short: 'Medical Laboratory Science',
    label: 'Medical Laboratory Science'
  },
  { id: 'nursing', short: 'Nursing', label: 'Nursing' },
  {
    id: 'nursing-administration-master-s',
    short: "Nursing Administration (Master's)",
    label: "Nursing Administration (Master's)"
  },
  { id: 'nutrition-science', short: 'Nutrition Science', label: 'Nutrition Science' },
  {
    id: 'professional-communications',
    short: 'Professional Communications',
    label: 'Professional Communications'
  },
  {
    id: 'public-administration-and-policy',
    short: 'Public Administration and Policy',
    label: 'Public Administration and Policy'
  },
  {
    id: 'quality-assurance-and-regulatory-affairs-master-s',
    short: "Quality Assurance and Regulatory Affairs (Master's)",
    label: "Quality Assurance and Regulatory Affairs (Master's)"
  },
  {
    id: 'science-technology-society',
    short: 'Science, Technology, & Society',
    label: 'Science, Technology, & Society'
  },
  { id: 'security-systems', short: 'Security Systems', label: 'Security Systems' },
  { id: 'sport-management', short: 'Sport Management', label: 'Sport Management' },

  {
    id: 'visual-communications-art-graphic-design',
    short: 'Visual Communications: Art & Graphic Design',
    label: 'Visual Communications: Art & Graphic Design'
  },
  { id: 'undeclared', short: 'Undeclared', label: 'Undeclared' },
  { id: 'other', short: 'Other', label: 'Other' }
];

// `keywords` are matched (case-insensitive) against a club's category and
// name by services/recommendations.js, because club categories are free
// text ("Gaming", "Cultural / Dance", ...) rather than a fixed list.
export const INTERESTS = [
  { id: 'gaming', label: 'Gaming & Esports', keywords: ['gaming', 'game', 'esports', 'e-sports'] },
  {
    id: 'technology',
    label: 'Technology & Coding',
    keywords: ['tech', 'coding', 'computer', 'cyber', 'robotics', 'software']
  },
  {
    id: 'sports',
    label: 'Sports & Fitness',
    keywords: ['sport', 'fitness', 'athletic', 'recreation', 'wellness']
  },
  {
    id: 'arts',
    label: 'Arts, Music & Theater',
    keywords: ['art', 'music', 'theater', 'theatre', 'dance', 'film', 'design']
  },
  {
    id: 'cultural',
    label: 'Cultural & Identity',
    keywords: ['cultur', 'heritage', 'identity', 'international', 'language']
  },
  {
    id: 'academic',
    label: 'Academic & Honor Societies',
    keywords: ['academic', 'honor', 'study', 'science', 'research']
  },
  {
    id: 'service',
    label: 'Service & Volunteering',
    keywords: ['service', 'volunteer', 'community', 'charity']
  },
  {
    id: 'career',
    label: 'Career & Business',
    keywords: ['career', 'business', 'entrepreneur', 'professional', 'finance']
  },
  {
    id: 'media',
    label: 'Media & Publications',
    keywords: ['media', 'news', 'journal', 'radio', 'publication', 'podcast']
  },
  {
    id: 'faith',
    label: 'Faith & Spirituality',
    keywords: ['faith', 'religio', 'spiritual', 'christian', 'muslim', 'jewish']
  },
  { id: 'social', label: 'Social & Hobbies', keywords: ['social', 'hobby', 'club', 'anime', 'board'] }
];

export function majorById(id) {
  return MAJORS.find((m) => m.id === id) || null;
}

export function majorShort(id) {
  const m = majorById(id);
  return m ? m.short : id;
}

export function interestById(id) {
  return INTERESTS.find((i) => i.id === id) || null;
}