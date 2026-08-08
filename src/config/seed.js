// ============================================================
// NYSC PAYMENT DISBURSEMENT PLATFORM
// Synthetic Data Generator & Database Seeder
// Sprint 2 — Generates 1,050 realistic corps member records
// ============================================================

require('dotenv').config();
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// ── Database Connection ───────────────────────────────────────
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// ============================================================
// SOURCE DATA — Real Nigerian names, states, banks, LGAs
// ============================================================

const firstNames = [
  'Chukwuemeka', 'Adaeze', 'Babatunde', 'Ngozi', 'Oluwaseun',
  'Amina', 'Chidinma', 'Emeka', 'Fatima', 'Godwin',
  'Halima', 'Ibrahim', 'Josephine', 'Kelechi', 'Lateef',
  'Maryam', 'Nnamdi', 'Obiageli', 'Precious', 'Quadri',
  'Rachael', 'Samuel', 'Titilayo', 'Uche', 'Victoria',
  'Wasiu', 'Xolani', 'Yetunde', 'Zainab', 'Adunola',
  'Blessing', 'Chinedu', 'Damilola', 'Esther', 'Femi',
  'Grace', 'Henry', 'Ifeoma', 'James', 'Kemi',
  'Lukman', 'Mary', 'Nkechi', 'Oluwatobi', 'Peace',
  'Rasheed', 'Stella', 'Tochukwu', 'Usman', 'Vivian',
  'Wisdom', 'Yusuf', 'Abiodun', 'Chiamaka', 'Dauda',
  'Ekene', 'Folake', 'Gbenga', 'Helen', 'Ifeanyi',
  'Juliet', 'Kingsley', 'Latifat', 'Michael', 'Nneka',
  'Olumide', 'Patricia', 'Qasim', 'Ruth', 'Sunday',
];

const lastNames = [
  'Okonkwo', 'Adeleke', 'Musa', 'Obi', 'Adeyemi',
  'Ibrahim', 'Chukwu', 'Bello', 'Eze', 'Lawal',
  'Nwosu', 'Abubakar', 'Igwe', 'Salami', 'Okeke',
  'Aliyu', 'Uchenna', 'Babangida', 'Anyanwu', 'Suleiman',
  'Okafor', 'Danjuma', 'Obiora', 'Garba', 'Nwachukwu',
  'Makinde', 'Chidebe', 'Umar', 'Ogbuagu', 'Yusuf',
  'Onyekwere', 'Adamu', 'Nwofor', 'Hassan', 'Oduya',
  'Shehu', 'Uzoma', 'Lawan', 'Nzeka', 'Abdullahi',
  'Onyia', 'Danladi', 'Mbah', 'Wada', 'Ogbonna',
  'Tanko', 'Ejike', 'Idris', 'Amadi', 'Yakubu',
];

const nigerianStates = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi',
  'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta',
  'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT',
  'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano',
  'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
  'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun',
  'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba',
  'Yobe', 'Zamfara',
];

const lgasByState = {
  'Lagos': ['Ikeja', 'Lagos Island', 'Surulere', 'Oshodi-Isolo', 'Alimosho', 'Kosofe'],
  'Kano': ['Kano Municipal', 'Fagge', 'Gwale', 'Dala', 'Nasarawa', 'Tarauni'],
  'Rivers': ['Port Harcourt', 'Obio-Akpor', 'Eleme', 'Oyigbo', 'Ikwerre', 'Emohua'],
  'Oyo': ['Ibadan North', 'Ibadan South', 'Ogbomoso', 'Oyo East', 'Egbeda', 'Akinyele'],
  'Kaduna': ['Kaduna North', 'Kaduna South', 'Chikun', 'Igabi', 'Zaria', 'Sabon Gari'],
  'Anambra': ['Awka South', 'Onitsha North', 'Nnewi North', 'Ogbaru', 'Ekwusigo', 'Idemili'],
  'FCT': ['Abuja Municipal', 'Gwagwalada', 'Kuje', 'Bwari', 'Kwali', 'Abaji'],
  'Enugu': ['Enugu North', 'Enugu South', 'Udi', 'Igbo-Eze North', 'Nkanu West', 'Oji River'],
  'Delta': ['Warri South', 'Uvwie', 'Sapele', 'Ethiope East', 'Okpe', 'Oshimili South'],
  'Imo': ['Owerri Municipal', 'Owerri North', 'Mbaitoli', 'Orlu', 'Okigwe', 'Ohaji'],
};

const defaultLGAs = ['Central LGA', 'North LGA', 'South LGA', 'East LGA', 'West LGA'];

const ppas = [
  'Government Secondary School', 'General Hospital',
  'Local Government Secretariat', 'Federal Medical Centre',
  'Ministry of Education', 'State Universal Basic Education Board',
  'Rural Electrification Agency', 'Agricultural Development Programme',
  'Primary Health Care Centre', 'Community Development Committee',
  'State Broadcasting Corporation', 'Ministry of Agriculture',
  'Federal Government College', 'State Ministry of Health',
  'National Population Commission', 'Independent National Electoral Commission',
  'Water Corporation', 'Road Safety Corps',
];

const banks = [
  { name: 'Access Bank', code: '044' },
  { name: 'Zenith Bank', code: '057' },
  { name: 'GTBank', code: '058' },
  { name: 'First Bank of Nigeria', code: '011' },
  { name: 'UBA', code: '033' },
  { name: 'Fidelity Bank', code: '070' },
  { name: 'Union Bank', code: '032' },
  { name: 'Sterling Bank', code: '232' },
  { name: 'Wema Bank', code: '035' },
  { name: 'Polaris Bank', code: '076' },
  { name: 'Keystone Bank', code: '082' },
  { name: 'Ecobank', code: '050' },
  { name: 'Stanbic IBTC', code: '221' },
  { name: 'FCMB', code: '214' },
  { name: 'Heritage Bank', code: '030' },
];

const batches = [
  '2024A', '2024B', '2024C',
  '2025A', '2025B', '2025C',
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

// Pick a random item from an array
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Generate a random integer between min and max (inclusive)
const randInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

// Generate a Nigerian phone number
const genPhone = () => {
  const prefixes = ['0803', '0806', '0810', '0813', '0816',
                    '0703', '0706', '0803', '0905', '0901'];
  return `${pick(prefixes)}${randInt(1000000, 9999999)}`;
};

// Generate a valid-looking 10-digit account number
const genAccountNumber = () =>
  `${randInt(1000000000, 9999999999)}`;

// Generate an NYSC state code in format: ST/YYB/NNNN
// e.g. LA/24A/1234
const genStateCode = (stateAbbr, batch, serial) => {
  const year = batch.substring(2, 4);
  const batchLetter = batch.slice(-1);
  const serial4 = String(serial).padStart(4, '0');
  return `${stateAbbr}/${year}${batchLetter}/${serial4}`;
};

// State abbreviations
const stateAbbreviations = {
  'Abia': 'AB', 'Adamawa': 'AD', 'Akwa Ibom': 'AK',
  'Anambra': 'AN', 'Bauchi': 'BA', 'Bayelsa': 'BY',
  'Benue': 'BE', 'Borno': 'BO', 'Cross River': 'CR',
  'Delta': 'DE', 'Ebonyi': 'EB', 'Edo': 'ED',
  'Ekiti': 'EK', 'Enugu': 'EN', 'FCT': 'FC',
  'Gombe': 'GO', 'Imo': 'IM', 'Jigawa': 'JI',
  'Kaduna': 'KD', 'Kano': 'KN', 'Katsina': 'KT',
  'Kebbi': 'KB', 'Kogi': 'KO', 'Kwara': 'KW',
  'Lagos': 'LA', 'Nasarawa': 'NA', 'Niger': 'NI',
  'Ogun': 'OG', 'Ondo': 'ON', 'Osun': 'OS',
  'Oyo': 'OY', 'Plateau': 'PL', 'Rivers': 'RI',
  'Sokoto': 'SO', 'Taraba': 'TA', 'Yobe': 'YO',
  'Zamfara': 'ZA',
};

// Generate a random email from a name
const genEmail = (firstName, lastName, serial) =>
  `${firstName.toLowerCase()}.${lastName.toLowerCase()}${serial}@gmail.com`;

// ============================================================
// GENERATE CORPS MEMBER RECORDS
// 900 valid | 75 invalid bank | 50 missing bank | 25 duplicates
// ============================================================
const generateCorpsMembers = () => {
  const members = [];
  let serial = 1;

  // ── 900 VALID RECORDS ──────────────────────────────────────
  for (let i = 0; i < 900; i++) {
    const firstName = pick(firstNames);
    const lastName = pick(lastNames);
    const state = pick(nigerianStates);
    const stateAbbr = stateAbbreviations[state] || 'XX';
    const batch = pick(batches);
    const bank = pick(banks);
    const lgas = lgasByState[state] || defaultLGAs;

    members.push({
      id: uuidv4(),
      state_code: genStateCode(stateAbbr, batch, serial),
      full_name: `${firstName} ${lastName}`,
      email: genEmail(firstName, lastName, serial),
      phone_number: genPhone(),
      deployment_state: state,
      deployment_lga: pick(lgas),
      ppa_name: pick(ppas),
      batch,
      bank_name: bank.name,
      bank_code: bank.code,
      account_number: genAccountNumber(),
      account_name: `${firstName} ${lastName}`.toUpperCase(),
      account_validated: false,
      is_active: true,
      category: 'valid', // tracking label (not stored in DB)
    });
    serial++;
  }

  // ── 75 INVALID BANK DETAIL RECORDS ────────────────────────
  // These have wrong account numbers or bank codes
  // Tests: bank validation rejection logic
  for (let i = 0; i < 75; i++) {
    const firstName = pick(firstNames);
    const lastName = pick(lastNames);
    const state = pick(nigerianStates);
    const stateAbbr = stateAbbreviations[state] || 'XX';
    const batch = pick(batches);
    const lgas = lgasByState[state] || defaultLGAs;

    members.push({
      id: uuidv4(),
      state_code: genStateCode(stateAbbr, batch, serial),
      full_name: `${firstName} ${lastName}`,
      email: genEmail(firstName, lastName, serial),
      phone_number: genPhone(),
      deployment_state: state,
      deployment_lga: pick(lgas),
      ppa_name: pick(ppas),
      batch,
      bank_name: 'Invalid Bank',
      bank_code: '000',           // non-existent bank code
      account_number: '123',      // too short — invalid format
      account_name: null,
      account_validated: false,
      is_active: true,
      category: 'invalid_bank',
    });
    serial++;
  }

  // ── 50 MISSING BANK DETAIL RECORDS ────────────────────────
  // These have no bank info at all
  // Tests: eligibility gating (cannot be paid without bank details)
  for (let i = 0; i < 50; i++) {
    const firstName = pick(firstNames);
    const lastName = pick(lastNames);
    const state = pick(nigerianStates);
    const stateAbbr = stateAbbreviations[state] || 'XX';
    const batch = pick(batches);
    const lgas = lgasByState[state] || defaultLGAs;

    members.push({
      id: uuidv4(),
      state_code: genStateCode(stateAbbr, batch, serial),
      full_name: `${firstName} ${lastName}`,
      email: genEmail(firstName, lastName, serial),
      phone_number: genPhone(),
      deployment_state: state,
      deployment_lga: pick(lgas),
      ppa_name: pick(ppas),
      batch,
      bank_name: null,
      bank_code: null,
      account_number: null,
      account_name: null,
      account_validated: false,
      is_active: true,
      category: 'missing_bank',
    });
    serial++;
  }

  // ── 25 DUPLICATE-PRONE RECORDS ────────────────────────────
  // These share names and details with existing records
  // Tests: duplicate detection engine
  for (let i = 0; i < 25; i++) {
    const base = members[randInt(0, 50)]; // copy from valid records
    const state = pick(nigerianStates);
    const stateAbbr = stateAbbreviations[state] || 'XX';
    const batch = pick(batches);
    const bank = pick(banks);

    members.push({
      id: uuidv4(),
      state_code: genStateCode(stateAbbr, batch, serial), // unique code
      full_name: base.full_name,      // same name as existing member
      email: genEmail(
        base.full_name.split(' ')[0],
        base.full_name.split(' ')[1],
        serial + 9000
      ),
      phone_number: base.phone_number, // same phone
      deployment_state: state,
      deployment_lga: pick(lgasByState[state] || defaultLGAs),
      ppa_name: pick(ppas),
      batch,
      bank_name: bank.name,
      bank_code: bank.code,
      account_number: base.account_number, // same account number
      account_name: base.account_name,
      account_validated: false,
      is_active: true,
      category: 'duplicate_prone',
    });
    serial++;
  }

  return members;
};

// ============================================================
// SEED FUNCTIONS
// ============================================================

// Seed admin users
const seedUsers = async (client) => {
  console.log('\n📋 Seeding system users...');

  const password = await bcrypt.hash('Admin@2024', 10);

  const systemUsers = [
    {
      id: uuidv4(),
      full_name: 'System Administrator',
      email: 'admin@nysc-payment.gov.ng',
      password_hash: password,
      role: 'admin',
      state: null,
    },
    {
      id: uuidv4(),
      full_name: 'Lagos Finance Officer',
      email: 'finance.lagos@nysc-payment.gov.ng',
      password_hash: password,
      role: 'finance_officer',
      state: 'Lagos',
    },
    {
      id: uuidv4(),
      full_name: 'Lagos State Coordinator',
      email: 'coordinator.lagos@nysc-payment.gov.ng',
      password_hash: password,
      role: 'state_coordinator',
      state: 'Lagos',
    },
    {
      id: uuidv4(),
      full_name: 'Kano Finance Officer',
      email: 'finance.kano@nysc-payment.gov.ng',
      password_hash: password,
      role: 'finance_officer',
      state: 'Kano',
    },
    {
      id: uuidv4(),
      full_name: 'Rivers State Coordinator',
      email: 'coordinator.rivers@nysc-payment.gov.ng',
      password_hash: password,
      role: 'state_coordinator',
      state: 'Rivers',
    },
  ];

  for (const user of systemUsers) {
    await client.query(
      `INSERT INTO users
        (id, full_name, email, password_hash, role, state)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO NOTHING`,
      [user.id, user.full_name, user.email,
       user.password_hash, user.role, user.state]
    );
  }

  console.log(`   ✅ ${systemUsers.length} system users seeded`);
  console.log('   📧 Login email: admin@nysc-payment.gov.ng');
  console.log('   🔑 Password: Admin@2024');
  return systemUsers;
};

// Seed corps members
const seedCorpsMembers = async (client, members) => {
  console.log('\n👥 Seeding corps members...');

  let valid = 0, invalidBank = 0, missingBank = 0, duplicate = 0;

  for (const m of members) {
    try {
      await client.query(
        `INSERT INTO corps_members (
          id, state_code, full_name, email, phone_number,
          deployment_state, deployment_lga, ppa_name, batch,
          bank_name, bank_code, account_number, account_name,
          account_validated, is_active
         ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,
          $10,$11,$12,$13,$14,$15
         ) ON CONFLICT DO NOTHING`,
        [
          m.id, m.state_code, m.full_name, m.email, m.phone_number,
          m.deployment_state, m.deployment_lga, m.ppa_name, m.batch,
          m.bank_name, m.bank_code, m.account_number, m.account_name,
          m.account_validated, m.is_active,
        ]
      );

      if (m.category === 'valid') valid++;
      else if (m.category === 'invalid_bank') invalidBank++;
      else if (m.category === 'missing_bank') missingBank++;
      else if (m.category === 'duplicate_prone') duplicate++;

    } catch (err) {
      // silently skip genuine duplicates
    }
  }

  console.log(`   ✅ Valid records inserted:          ${valid}`);
  console.log(`   ⚠️  Invalid bank records inserted:  ${invalidBank}`);
  console.log(`   ❌ Missing bank records inserted:   ${missingBank}`);
  console.log(`   🔍 Duplicate-prone records:         ${duplicate}`);
};

// Seed clearances for valid members (current month)
const seedClearances = async (client, members, users) => {
  console.log('\n📝 Seeding monthly clearances...');

  const coordinator = users.find(u => u.role === 'state_coordinator');
  const currentMonth = new Date();
  currentMonth.setDate(1); // first day of current month
  const monthStr = currentMonth.toISOString().split('T')[0];

  // Only create clearances for valid members
  const validMembers = members.filter(m => m.category === 'valid');

  // 80% approved, 15% pending, 5% rejected
  let approved = 0, pending = 0, rejected = 0;

  for (const member of validMembers) {
    const rand = Math.random();
    let status, attendanceConfirmed, cdsConfirmed;

    if (rand < 0.80) {
      status = 'approved';
      attendanceConfirmed = true;
      cdsConfirmed = true;
      approved++;
    } else if (rand < 0.95) {
      status = 'pending';
      attendanceConfirmed = false;
      cdsConfirmed = false;
      pending++;
    } else {
      status = 'rejected';
      attendanceConfirmed = false;
      cdsConfirmed = false;
      rejected++;
    }

    await client.query(
      `INSERT INTO clearances (
        id, corps_member_id, clearance_month,
        attendance_confirmed, cds_confirmed,
        status, approved_by, approved_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (corps_member_id, clearance_month) DO NOTHING`,
      [
        uuidv4(),
        member.id,
        monthStr,
        attendanceConfirmed,
        cdsConfirmed,
        status,
        status === 'approved' ? coordinator?.id : null,
        status === 'approved' ? new Date() : null,
      ]
    );
  }

  console.log(`   ✅ Approved clearances:  ${approved}`);
  console.log(`   ⏳ Pending clearances:   ${pending}`);
  console.log(`   ❌ Rejected clearances:  ${rejected}`);
};

// ============================================================
// MAIN SEED FUNCTION
// ============================================================
const seed = async () => {
  console.log('================================================');
  console.log('  NYSC Payment Platform — Database Seeder');
  console.log('================================================');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Generate all corps member data
    console.log('\n🔄 Generating synthetic corps member records...');
    const members = generateCorpsMembers();
    console.log(`   Generated ${members.length} total records`);

    // Seed in order (users first — clearances reference them)
    const users = await seedUsers(client);
    await seedCorpsMembers(client, members);
    await seedClearances(client, members, users);

    await client.query('COMMIT');

    // Final summary
    console.log('\n================================================');
    console.log('  ✅ DATABASE SEEDING COMPLETE');
    console.log('================================================');
    console.log('\n📊 Final Database Summary:');

    const memberCount = await pool.query(
      'SELECT COUNT(*) FROM corps_members'
    );
    const clearanceCount = await pool.query(
      'SELECT COUNT(*) FROM clearances'
    );
    const userCount = await pool.query(
      'SELECT COUNT(*) FROM users'
    );

    console.log(`   Corps Members: ${memberCount.rows[0].count}`);
    console.log(`   Clearances:    ${clearanceCount.rows[0].count}`);
    console.log(`   System Users:  ${userCount.rows[0].count}`);
    console.log('================================================\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Seeding failed:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

// Run the seeder
seed().catch(err => {
  console.error('Fatal seeding error:', err.message);
  process.exit(1);
});