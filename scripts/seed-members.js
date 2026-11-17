// One-time helper: fills the imported Farmingdale clubs with fake students so the club pages, member counts,
// recommendations and role screens have something to show. Run locally, not in the browser.
// Needs FIREBASE_SERVICE_ACCOUNT_JSON (the whole service account JSON), same as seed-events.js.
//   Preview only:       node scripts/seed-members.js
//   Write to Firestore: node scripts/seed-members.js --write
//   Remove them again:  node scripts/seed-members.js --delete --write
// Safety rules:
//   - Only touches clubs with imported: true that have NO members yet (clubs you made by hand are left alone).
//   - Every fake student has seeded: true and a uid starting "seed-user-"; their sign-in accounts are DISABLED,
//     so nobody can log in as them. --delete removes only those.
//   - Each club gets the four officers (President, Vice President, Treasurer, Secretary) plus enough members that popular clubs are much bigger than small ones (14-70 people).
// Do not commit this file.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { MAJORS, INTERESTS } from '../src/data/profileOptions.js';

const SELFTEST = !!process.env.SEED_SELFTEST;
const WRITE = process.argv.includes('--write');
const DELETE = process.argv.includes('--delete');
const POOL_SIZE = 320;
// Sprint 7 requires a roster of at least 10 students on top of the four officers, so no club gets fewer than 14 people.
// Bigger, better-known clubs get a lot more (see SIZE_TIERS below).
const MIN_MEMBERS = 10;

let db;
let auth;
if (!SELFTEST) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
  db = getFirestore();
  auth = getAuth();
}

// Small deterministic random generator so a preview and the real run pick the same people.
let seed = 20261116;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const FIRST = ['Aaliyah', 'Aiden', 'Amir', 'Ana', 'Andre', 'Angela', 'Anthony', 'Ariana', 'Ashley', 'Ayesha', 'Brandon', 'Brianna', 'Caleb', 'Camila', 'Carlos', 'Chloe', 'Christian', 'Daniel', 'Danielle', 'David', 'Destiny', 'Diego', 'Elena', 'Elijah', 'Emily', 'Ethan', 'Fatima', 'Gabriel', 'Gianna', 'Hannah', 'Hassan', 'Isabella', 'Jacob', 'Jasmine', 'Jayden', 'Jessica', 'Jordan', 'Joseph', 'Julia', 'Kevin', 'Kayla', 'Layla', 'Liam', 'Lucas', 'Maria', 'Marcus', 'Maya', 'Mia', 'Michael', 'Mohammed', 'Nadia', 'Nathan', 'Nicole', 'Noah', 'Olivia', 'Omar', 'Priya', 'Rafael', 'Rachel', 'Ryan', 'Samantha', 'Sofia', 'Tyler', 'Valeria', 'Victoria', 'Zachary', 'Zoe'];
const LAST = ['Ahmed', 'Alvarez', 'Anderson', 'Bailey', 'Brown', 'Castillo', 'Chen', 'Clark', 'Cohen', 'Cruz', 'Davis', 'Diaz', 'Evans', 'Farooq', 'Flores', 'Garcia', 'Gomez', 'Gonzalez', 'Gupta', 'Hall', 'Hernandez', 'Hughes', 'Hussain', 'Jackson', 'Johnson', 'Kaur', 'Khan', 'Kim', 'Lee', 'Lopez', 'Martinez', 'Miller', 'Morales', 'Murphy', 'Nguyen', 'Ortiz', 'Patel', 'Perez', 'Ramirez', 'Reyes', 'Rivera', 'Robinson', 'Rossi', 'Russo', 'Sanchez', 'Santos', 'Shah', 'Singh', 'Smith', 'Taylor', 'Thomas', 'Torres', 'Walker', 'White', 'Williams', 'Wilson', 'Wright', 'Young'];

// Pick majors that fit a club's category when we can, so "65% of members are CPIS majors" style stats look real.
const CATEGORY_MAJOR_HINTS = {
  'Tech & Engineering': ['computer', 'engineering', 'cyber', 'software', 'information', 'electrical', 'mechanical'],
  'Academic & Professional': ['business', 'biology', 'bioscience', 'psychology', 'criminal', 'health', 'aviation', 'accounting'],
  'Arts & Media': ['art', 'design', 'media', 'communication', 'visual', 'photography'],
  'Health & Wellness': ['health', 'dental', 'nursing', 'bioscience', 'psychology'],
  'Cultural & Identity': [],
  'Recreation & Hobbies': [],
  Faith: [],
  'Greek Life': [],
  'Service & Advocacy': [],
  'Student Government': ['business', 'political', 'communication']
};

// Real students have picked a program, so leave out the 'undeclared' / 'other' choices.
const majorIds = MAJORS.map((m) => m.id).filter((id) => id !== 'undeclared' && id !== 'other');
const interestIds = INTERESTS.map((i) => i.id);

const INTEREST_PHRASE = {
  gaming: 'gaming',
  technology: 'coding',
  sports: 'sports',
  arts: 'the arts',
  cultural: 'cultural events',
  academic: 'study groups',
  service: 'volunteering',
  career: 'career events',
  media: 'media',
  faith: 'faith',
  social: 'hobbies'
};
// [min, max] total people (officers included) by how popular a club tends to be on a commuter-heavy campus.
const SIZE_TIERS = {
  huge: [45, 70],
  large: [30, 44],
  medium: [20, 29],
  normal: [14, 19]
};
const TIER_BY_NAME = {
  huge: ['Student Government Association Inc.', 'Gaming Club', 'International Student Organization', 'Black Student Union', 'Muslim Student Association', 'Business Society', 'Greek Council', 'Cybersecurity Club', 'Artificial Intelligence Club', 'Psychology Club', 'Latin American Student Organization', 'Google Development Student Chapter'],
  large: ['Pre-Health Professions Club (Pre-Health)', 'Biology Club', 'Ram Nation Radio', 'South Asian Student Association', 'Art & Design Club', 'FSC Music Club', 'Criminal Justice Club', 'Women in Business', 'FSC IEEE Student Branch', 'National Society of Black Engineers', 'Society of Hispanic Professional Engineers', 'Student Veterans of America', 'Dale News', 'Farmingdale Pride', 'Book Club', 'Pre-Law Society', 'Cru Club', 'Panhellenic Association(Sorority Leadership)'],
  medium: ['Afro-Caribbean Club', 'Pakistani Student Association', 'Bangladeshi Student Association', 'Backstage Theatre Company', 'Farmingdale Bhangra', 'Sport Management Club', 'Through the Lens: Photography Club', 'Stylus (Fashion Club)', 'The Stampede', 'American Society of Civil Engineering', 'Supporting Women in Computing', 'Pre-Physical Therapy Club', 'Pre-Physician Assistant Club (Pre-PA)', 'NAMI on Campus', 'Horticulture Club', 'American Sign Language Club', 'FSC NAACP Chapter', 'Disability Coalition Club']
};
function sizeFor(club) {
  const tier = Object.keys(TIER_BY_NAME).find((t) => TIER_BY_NAME[t].includes(club.name)) || 'normal';
  const [lo, hi] = SIZE_TIERS[tier];
  return Math.max(4 + MIN_MEMBERS, lo + Math.floor(rand() * (hi - lo + 1)));
}
const YEARS = ['freshman', 'sophomore', 'junior', 'senior'];
const OPENERS = ["I'm a", "Currently a", "Proud", "Just a"];
const CLOSERS = [
  'Always up for meeting new people on campus.',
  'Looking to get more involved at Farmingdale this year.',
  'Come say hi at the next meeting!',
  'Trying to balance classes, clubs and sleep.',
  'Happy to help new members get started.'
];
// A short, natural bio built from the student's own major and interests.
function makeBio(majorList, interestList) {
  const major = MAJORS.find((m) => m.id === majorList[0]);
  const label = (major?.short || major?.label).replace(/ - .*/, '');
  const nice = interestList.map((id) => INTEREST_PHRASE[id] || id);
  // Master's programs get 'graduate student' instead of a class year.
  const year = majorList[0].includes('master') ? 'graduate student' : pick(YEARS);
  const likes = nice.length > 2 ? `${nice.slice(0, -1).join(', ')}, and ${nice[nice.length - 1]}` : nice.join(' and ');
  return `${pick(OPENERS)} ${year} studying ${label}. I'm into ${likes}. ${pick(CLOSERS)}`;
}

// 1) The pool of fake students, shared across clubs (a student can be in several clubs).
function buildPool() {
  const pool = [];
  for (let i = 1; i <= POOL_SIZE; i++) {
    const first = pick(FIRST);
    const last = pick(LAST);
    const nMajors = rand() < 0.2 ? 2 : 1; // the app allows at most 2 majors
    const majors = shuffle(majorIds).slice(0, nMajors);
    const interests = shuffle(interestIds).slice(0, 2 + Math.floor(rand() * 2));
    pool.push({
      uid: `seed-user-${String(i).padStart(3, '0')}`,
      name: `${first} ${last}`,
      email: `seed+${String(i).padStart(3, '0')}@example.test`,
      ramId: `R${String(Math.floor(rand() * 100000000)).padStart(8, '0')}`,
      majors,
      interests,
      bio: makeBio(majors, interests)
    });
  }
  return pool;
}

function membersFor(club, pool) {
  const hints = CATEGORY_MAJOR_HINTS[club.category] || [];
  const fits = hints.length ? pool.filter((u) => u.majors.some((m) => hints.some((h) => m.includes(h)))) : [];
  // Mostly students who fit the club's field, topped up with anyone.
  const ordered = [...shuffle(fits), ...shuffle(pool)];
  const chosen = [];
  const seen = new Set();
  for (const u of ordered) {
    if (!seen.has(u.uid)) {
      seen.add(u.uid);
      chosen.push(u);
    }
  }
  const total = sizeFor(club);
  const roles = ['president', 'vice_president', 'treasurer', 'secretary'];
  return chosen.slice(0, total).map((u, i) => ({ user: u, role: roles[i] || 'member' }));
}

function counters(rows) {
  const majorCounts = {};
  let majorSampleSize = 0;
  for (const { user } of rows) {
    if (user.majors.length) majorSampleSize += 1;
    user.majors.forEach((m) => {
      majorCounts[m] = (majorCounts[m] || 0) + 1;
    });
  }
  return { memberCount: rows.length, majorCounts, majorSampleSize };
}

async function main() {
  const pool = buildPool();

  let clubs;
  if (SELFTEST) {
    clubs = [
      { id: 'a', name: 'Cybersecurity Club', category: 'Tech & Engineering' },
      { id: 'b', name: 'Book Club', category: 'Recreation & Hobbies' }
    ];
  } else {
    const snap = await db.collection('clubs').where('imported', '==', true).get();
    clubs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => c.status === 'active');
  }

  if (DELETE) return remove(clubs);

  const plan = [];
  for (const club of clubs) {
    if (!SELFTEST) {
      const existing = await db.collection('clubs').doc(club.id).collection('members').limit(1).get();
      if (!existing.empty) continue; // never touch a club that already has real members
    }
    plan.push({ club, rows: membersFor(club, pool) });
  }

  console.log(`${clubs.length} imported active clubs, ${plan.length} without members.`);
  const sample = plan.slice(0, 3);
  for (const p of sample) {
    console.log(`\n${p.club.name} (${p.club.category}) -> ${p.rows.length} members`);
    p.rows.slice(0, 6).forEach((r) => console.log(`   ${r.role.padEnd(15)} ${r.user.name}`));
  }
  if (plan[0]) console.log('\nSample profile:', JSON.stringify(plan[0].rows[0].user, null, 2));
  const usedUids = new Set(plan.flatMap((p) => p.rows.map((r) => r.user.uid)));
  console.log(`\nWould create ${usedUids.size} fake students (disabled sign-ins) and ${plan.reduce((n, p) => n + p.rows.length, 0)} memberships.`);
  if (!WRITE || SELFTEST) {
    console.log('Preview only. Run again with --write to save.');
    return;
  }

  // Fake students: disabled Auth accounts + users/{uid} docs.
  const writer = db.bulkWriter();
  for (const uid of usedUids) {
    const u = pool.find((p) => p.uid === uid);
    try {
      await auth.createUser({ uid, email: u.email, displayName: u.name, disabled: true });
    } catch (e) {
      if (e.code !== 'auth/uid-already-exists' && e.code !== 'auth/email-already-exists') throw e;
    }
    writer.set(db.collection('users').doc(uid), {
      uid,
      name: u.name,
      ramId: u.ramId,
      email: u.email,
      role: 'student',
      bio: u.bio,
      majors: u.majors,
      interests: u.interests,
      onboardingComplete: true,
      seeded: true,
      createdAt: Timestamp.now()
    });
  }
  for (const { club, rows } of plan) {
    for (const { user, role } of rows) {
      writer.set(db.collection('clubs').doc(club.id).collection('members').doc(user.uid), {
        uid: user.uid,
        role,
        status: 'approved',
        joinedAt: Timestamp.now(),
        seeded: true
      });
    }
    writer.update(db.collection('clubs').doc(club.id), { ...counters(rows), seededMembers: true });
  }
  await writer.close();
  console.log('Done.');
}

async function remove(clubs) {
  console.log(`Removing seeded members from ${clubs.length} clubs...`);
  if (!WRITE) {
    console.log('Preview only. Add --write to really delete.');
    return;
  }
  const writer = db.bulkWriter();
  for (const club of clubs) {
    if (!club.seededMembers) continue;
    const members = await db.collection('clubs').doc(club.id).collection('members').get();
    members.docs.filter((d) => d.data().seeded).forEach((d) => writer.delete(d.ref));
    // These clubs had no members before seeding, so counters go back to zero.
    writer.update(db.collection('clubs').doc(club.id), {
      memberCount: 0,
      majorCounts: {},
      majorSampleSize: 0,
      seededMembers: false
    });
  }
  const users = await db.collection('users').where('seeded', '==', true).get();
  users.docs.forEach((d) => writer.delete(d.ref));
  await writer.close();
  for (const d of users.docs) {
    try {
      await auth.deleteUser(d.id);
    } catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
    }
  }
  console.log('Removed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
