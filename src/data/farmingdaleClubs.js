// Every club currently listed on Farmingdale's student-organization page,
// copied by hand (62 entries). This is the "All Farmingdale clubs" tab on
// the Clubs page (components/CampusDirectory.jsx) - it exists so students
// can see EVERY club on campus, including ones that haven't been set up on
// NewRamCentral yet.
//
// - `category` is our own grouping (the school's list has none).
// - `stars` is the asterisk(s) printed after some names on the school's
// list; kept as-is because we don't know what they mean yet.
// - A directory club counts as "on NewRamCentral" when an active club in
// Firestore has the same name once punctuation/case are ignored
// (see normalizeClubName) - so when someone creates "Gaming Club" it
// switches over automatically, with no list edit needed.
// Update this list when the school's list changes.
export const FARMINGDALE_CLUBS = [
 { name: 'Afghan Student Association', abbr: '', stars: '', category: 'Cultural & Identity' },
 { name: 'Afro-Caribbean Club', abbr: 'ACC', stars: '', category: 'Cultural & Identity' },
 {
 name: 'Alpha Eta Rho (AHP) Professional Aviation Org',
 abbr: '',
 stars: '',
 category: 'Academic & Professional'
 },
 {
 name: 'American Association of Airport Executives',
 abbr: 'AAAE',
 stars: '',
 category: 'Academic & Professional'
 },
 { name: 'American Sign Language Club', abbr: 'ASL', stars: '', category: 'Cultural & Identity' },
 {
 name: 'American Society of Civil Engineering',
 abbr: 'ASCE',
 stars: '',
 category: 'Tech & Engineering'
 },
 {
 name: 'Architectural Construction Technology',
 abbr: 'ACT',
 stars: '',
 category: 'Academic & Professional'
 },
 { name: 'Art & Design Club', abbr: '', stars: '', category: 'Arts & Media' },
 { name: 'Artificial Intelligence Club', abbr: '', stars: '', category: 'Tech & Engineering' },
 { name: 'Backstage Theatre Company', abbr: 'BSTC', stars: '', category: 'Arts & Media' },
 { name: 'Bangladeshi Student Association', abbr: '', stars: '*', category: 'Cultural & Identity' },
 { name: 'Biology Club', abbr: '', stars: '', category: 'Academic & Professional' },
 { name: 'Black Student Union', abbr: '', stars: '**', category: 'Cultural & Identity' },
 { name: 'Book Club', abbr: '', stars: '', category: 'Recreation & Hobbies' },
 { name: 'Business Society', abbr: '', stars: '', category: 'Academic & Professional' },
 { name: "Cooks n' Crooks", abbr: '', stars: '', category: 'Recreation & Hobbies' },
 { name: 'Criminal Justice Club', abbr: 'CRJ', stars: '', category: 'Academic & Professional' },
 { name: 'Crochet Club', abbr: '', stars: '', category: 'Recreation & Hobbies' },
 { name: 'Cru Club', abbr: 'Cru', stars: '', category: 'Faith' },
 { name: 'Cultural Italian American Org', abbr: 'CIAO', stars: '', category: 'Cultural & Identity' },
 { name: 'Cybersecurity Club', abbr: '', stars: '', category: 'Tech & Engineering' },
 { name: 'Dale News', abbr: '', stars: '', category: 'Arts & Media' },
 { name: 'Disability Coalition Club', abbr: '', stars: '', category: 'Service & Advocacy' },
 { name: 'Farmingdale Bhangra', abbr: '', stars: '', category: 'Cultural & Identity' },
 { name: 'Farmingdale Fusion (South Indian Dance)', abbr: '', stars: '', category: 'Cultural & Identity' },
 { name: 'Farmingdale Pride', abbr: '', stars: '', category: 'Cultural & Identity' },
 {
 name: 'Farmingdale Undergraduate Research Association',
 abbr: 'FURA',
 stars: '',
 category: 'Academic & Professional'
 },
 { name: 'FSC Hellenic Society', abbr: '', stars: '', category: 'Cultural & Identity' },
 { name: 'FSC IEEE Student Branch', abbr: '', stars: '', category: 'Tech & Engineering' },
 { name: 'FSC Music Club', abbr: '', stars: '', category: 'Arts & Media' },
 { name: 'FSC NAACP Chapter', abbr: '', stars: '', category: 'Service & Advocacy' },
 { name: 'Gaming Club', abbr: '', stars: '', category: 'Recreation & Hobbies' },
 { name: 'Google Development Student Chapter', abbr: 'GDSC', stars: '', category: 'Tech & Engineering' },
 { name: 'Greek Council', abbr: '', stars: '', category: 'Greek Life' },
 { name: 'Horticulture Club', abbr: '', stars: '', category: 'Academic & Professional' },
 { name: 'International Student Organization', abbr: '', stars: '', category: 'Cultural & Identity' },
 { name: 'Latin American Student Organization', abbr: 'LASO', stars: '', category: 'Cultural & Identity' },
 { name: 'Medical Laboratory Science Club', abbr: '', stars: '', category: 'Academic & Professional' },
 { name: 'Muslim Student Association', abbr: 'MSA', stars: '', category: 'Faith' },
 { name: 'NAMI on Campus', abbr: '', stars: '', category: 'Health & Wellness' },
 { name: 'National Society of Black Engineers', abbr: 'NSBE', stars: '', category: 'Tech & Engineering' },
 { name: 'Nepalese Student Association', abbr: '', stars: '', category: 'Cultural & Identity' },
 { name: 'Pakistani Student Association', abbr: 'PSA', stars: '', category: 'Cultural & Identity' },
 { name: 'Panhellenic Association(Sorority Leadership)', abbr: '', stars: '', category: 'Greek Life' },
 {
 name: 'Pre-Health Professions Club (Pre-Health)',
 abbr: '',
 stars: '',
 category: 'Academic & Professional'
 },
 { name: 'Pre-Law Society', abbr: '', stars: '*', category: 'Academic & Professional' },
 { name: 'Pre-Physical Therapy Club', abbr: '', stars: '', category: 'Academic & Professional' },
 {
 name: 'Pre-Physician Assistant Club (Pre-PA)',
 abbr: '',
 stars: '',
 category: 'Academic & Professional'
 },
 { name: 'Psychology Club', abbr: '', stars: '', category: 'Academic & Professional' },
 { name: 'Ram Nation Radio', abbr: '', stars: '', category: 'Arts & Media' },
 {
 name: 'Society of Hispanic Professional Engineers',
 abbr: 'SHPE',
 stars: '',
 category: 'Tech & Engineering'
 },
 { name: 'South Asian Student Association', abbr: 'SASA', stars: '', category: 'Cultural & Identity' },
 { name: 'Sport Management Club', abbr: '', stars: '', category: 'Academic & Professional' },
 {
 name: 'Student American Dental Hygienists Association',
 abbr: '',
 stars: '',
 category: 'Health & Wellness'
 },
 { name: 'Student Government Association Inc.', abbr: 'SGA', stars: '', category: 'Student Government' },
 { name: 'Student Veterans of America', abbr: 'SVA', stars: '', category: 'Service & Advocacy' },
 { name: 'Stylus (Fashion Club)', abbr: '', stars: '*', category: 'Arts & Media' },
 { name: 'Supporting Women in Computing', abbr: 'SWiC', stars: '', category: 'Tech & Engineering' },
 { name: 'The Stampede', abbr: '', stars: '**', category: 'Arts & Media' },
 { name: 'Through the Lens: Photography Club', abbr: '', stars: '**', category: 'Arts & Media' },
 { name: 'Women in Business', abbr: '', stars: '', category: 'Academic & Professional' },
 { name: "Women's Health and Wellness", abbr: '', stars: '*', category: 'Health & Wellness' }
];
export const DIRECTORY_CATEGORIES = [...new Set(FARMINGDALE_CLUBS.map((c) => c.category))].sort();
// "Gaming Club" / "gaming club!" / "Gaming Club" -> "gamingclub"
export function normalizeClubName(name) {
 return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
