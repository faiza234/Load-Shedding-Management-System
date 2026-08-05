// db/seed.js
// -----------------------------------------------------------------------------
// Populates the MySQL database with realistic-looking sample data for
// Bangladesh: all 64 districts, authority users, citizens, complaints,
// outage schedules, authority actions, monthly analysis, high risk zones,
// and daily frequency (for charts).
//
// IMPORTANT: run database/schema.sql first (it creates the database and all
// tables). This script only INSERTs data into tables that must already exist.
//
// Run with:  npm run seed
// Safe to re-run: it truncates existing rows first (via TRUNCATE, so
// AUTO_INCREMENT ids restart from 1 too), then reloads everything.
// -----------------------------------------------------------------------------
const bcrypt = require("bcryptjs");
const pool = require("./pool");

// ---------------------------------------------------------------------------
// 1. All 64 districts of Bangladesh, grouped by division.
//    area_name = district name (per project convention).
//    region_type is a simple classification used alongside `division`.
// ---------------------------------------------------------------------------
const DISTRICTS = [
  // Dhaka Division
  { area_name: "Dhaka",        division: "Dhaka",       region_type: "Urban",      zip_code: "1000" },
  { area_name: "Faridpur",     division: "Dhaka",       region_type: "Semi-Urban", zip_code: "7800" },
  { area_name: "Gazipur",      division: "Dhaka",       region_type: "Urban",      zip_code: "1700" },
  { area_name: "Gopalganj",    division: "Dhaka",       region_type: "Rural",      zip_code: "8100" },
  { area_name: "Kishoreganj",  division: "Dhaka",       region_type: "Semi-Urban", zip_code: "2300" },
  { area_name: "Madaripur",    division: "Dhaka",       region_type: "Rural",      zip_code: "7900" },
  { area_name: "Manikganj",    division: "Dhaka",       region_type: "Semi-Urban", zip_code: "1800" },
  { area_name: "Munshiganj",   division: "Dhaka",       region_type: "Semi-Urban", zip_code: "1500" },
  { area_name: "Narayanganj",  division: "Dhaka",       region_type: "Urban",      zip_code: "1400" },
  { area_name: "Narsingdi",    division: "Dhaka",       region_type: "Semi-Urban", zip_code: "1600" },
  { area_name: "Rajbari",      division: "Dhaka",       region_type: "Rural",      zip_code: "7700" },
  { area_name: "Shariatpur",   division: "Dhaka",       region_type: "Rural",      zip_code: "8000" },
  { area_name: "Tangail",      division: "Dhaka",       region_type: "Semi-Urban", zip_code: "1900" },

  // Chattogram Division
  { area_name: "Bandarban",     division: "Chattogram", region_type: "Rural",      zip_code: "4600" },
  { area_name: "Brahmanbaria",  division: "Chattogram", region_type: "Semi-Urban", zip_code: "3400" },
  { area_name: "Chandpur",      division: "Chattogram", region_type: "Semi-Urban", zip_code: "3600" },
  { area_name: "Chattogram",    division: "Chattogram", region_type: "Urban",      zip_code: "4000" },
  { area_name: "Cumilla",       division: "Chattogram", region_type: "Urban",      zip_code: "3500" },
  { area_name: "Cox's Bazar",   division: "Chattogram", region_type: "Urban",      zip_code: "4700" },
  { area_name: "Feni",          division: "Chattogram", region_type: "Semi-Urban", zip_code: "3900" },
  { area_name: "Khagrachhari",  division: "Chattogram", region_type: "Rural",      zip_code: "4400" },
  { area_name: "Lakshmipur",    division: "Chattogram", region_type: "Semi-Urban", zip_code: "3700" },
  { area_name: "Noakhali",      division: "Chattogram", region_type: "Semi-Urban", zip_code: "3800" },
  { area_name: "Rangamati",     division: "Chattogram", region_type: "Rural",      zip_code: "4500" },

  // Rajshahi Division
  { area_name: "Bogura",          division: "Rajshahi", region_type: "Semi-Urban", zip_code: "5800" },
  { area_name: "Joypurhat",       division: "Rajshahi", region_type: "Rural",      zip_code: "5900" },
  { area_name: "Naogaon",         division: "Rajshahi", region_type: "Semi-Urban", zip_code: "6500" },
  { area_name: "Natore",          division: "Rajshahi", region_type: "Semi-Urban", zip_code: "6400" },
  { area_name: "Chapainawabganj", division: "Rajshahi", region_type: "Rural",      zip_code: "6300" },
  { area_name: "Pabna",           division: "Rajshahi", region_type: "Semi-Urban", zip_code: "6600" },
  { area_name: "Rajshahi",        division: "Rajshahi", region_type: "Urban",      zip_code: "6000" },
  { area_name: "Sirajganj",       division: "Rajshahi", region_type: "Semi-Urban", zip_code: "6700" },

  // Khulna Division
  { area_name: "Bagerhat",   division: "Khulna", region_type: "Semi-Urban", zip_code: "9300" },
  { area_name: "Chuadanga",  division: "Khulna", region_type: "Rural",      zip_code: "7200" },
  { area_name: "Jashore",    division: "Khulna", region_type: "Urban",      zip_code: "7400" },
  { area_name: "Jhenaidah",  division: "Khulna", region_type: "Semi-Urban", zip_code: "7300" },
  { area_name: "Khulna",     division: "Khulna", region_type: "Urban",      zip_code: "9000" },
  { area_name: "Kushtia",    division: "Khulna", region_type: "Semi-Urban", zip_code: "7000" },
  { area_name: "Magura",     division: "Khulna", region_type: "Rural",      zip_code: "7600" },
  { area_name: "Meherpur",   division: "Khulna", region_type: "Rural",      zip_code: "7100" },
  { area_name: "Narail",     division: "Khulna", region_type: "Rural",      zip_code: "7500" },
  { area_name: "Satkhira",   division: "Khulna", region_type: "Semi-Urban", zip_code: "9400" },

  // Barishal Division
  { area_name: "Barguna",    division: "Barishal", region_type: "Rural",      zip_code: "8700" },
  { area_name: "Barishal",   division: "Barishal", region_type: "Urban",      zip_code: "8200" },
  { area_name: "Bhola",      division: "Barishal", region_type: "Rural",      zip_code: "8300" },
  { area_name: "Jhalokati",  division: "Barishal", region_type: "Rural",      zip_code: "8400" },
  { area_name: "Patuakhali", division: "Barishal", region_type: "Semi-Urban", zip_code: "8600" },
  { area_name: "Pirojpur",   division: "Barishal", region_type: "Rural",      zip_code: "8500" },

  // Sylhet Division
  { area_name: "Habiganj",     division: "Sylhet", region_type: "Semi-Urban", zip_code: "3300" },
  { area_name: "Moulvibazar",  division: "Sylhet", region_type: "Semi-Urban", zip_code: "3200" },
  { area_name: "Sunamganj",    division: "Sylhet", region_type: "Rural",      zip_code: "3000" },
  { area_name: "Sylhet",       division: "Sylhet", region_type: "Urban",      zip_code: "3100" },

  // Rangpur Division
  { area_name: "Dinajpur",     division: "Rangpur", region_type: "Semi-Urban", zip_code: "5200" },
  { area_name: "Gaibandha",    division: "Rangpur", region_type: "Rural",      zip_code: "5700" },
  { area_name: "Kurigram",     division: "Rangpur", region_type: "Rural",      zip_code: "5600" },
  { area_name: "Lalmonirhat",  division: "Rangpur", region_type: "Rural",      zip_code: "5500" },
  { area_name: "Nilphamari",   division: "Rangpur", region_type: "Rural",      zip_code: "5300" },
  { area_name: "Panchagarh",   division: "Rangpur", region_type: "Rural",      zip_code: "5000" },
  { area_name: "Rangpur",      division: "Rangpur", region_type: "Urban",      zip_code: "5400" },
  { area_name: "Thakurgaon",   division: "Rangpur", region_type: "Rural",      zip_code: "5100" },

  // Mymensingh Division
  { area_name: "Jamalpur",    division: "Mymensingh", region_type: "Semi-Urban", zip_code: "2000" },
  { area_name: "Mymensingh",  division: "Mymensingh", region_type: "Urban",      zip_code: "2200" },
  { area_name: "Netrokona",   division: "Mymensingh", region_type: "Rural",      zip_code: "2400" },
  { area_name: "Sherpur",     division: "Mymensingh", region_type: "Rural",      zip_code: "2100" },
];

// Simple seeded pseudo-random generator so re-running gives the same "random"
// data (nice for demos/screenshots). Not cryptographic - just for sample data.
let seed = 42;
function rand() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function round1(n) { return Math.round(n * 10) / 10; }

const FIRST_NAMES = [
  "Abdul", "Rafiqul", "Mohammad", "Kamal", "Jamal", "Nasrin", "Fatima", "Ayesha",
  "Rahim", "Karim", "Shirin", "Nusrat", "Habibur", "Salma", "Rezaul", "Delwar",
  "Shahidul", "Mahmuda", "Anwar", "Ruma", "Sultana", "Iqbal", "Momtaz", "Selina",
  "Zahid", "Farida", "Anisur", "Tania", "Mizanur", "Rina",
];
const LAST_NAMES = [
  "Islam", "Rahman", "Hossain", "Ahmed", "Chowdhury", "Akter", "Uddin", "Begum",
  "Khan", "Sarker", "Mia", "Talukder", "Molla", "Sheikh", "Bhuiyan", "Miah",
];
function randomName() { return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`; }
function randomPhone() { return `01${pick(["3","5","6","7","8","9"])}${String(randInt(10000000, 99999999))}`; }
function randomEmail(name, i) {
  return `${name.toLowerCase().replace(/[^a-z]+/g, ".")}${i}@mail.com`;
}

const COMPLAINT_TEMPLATES = [
  "Load shedding lasted much longer than the scheduled time.",
  "No electricity since morning, area appears to have an unscheduled outage.",
  "Frequent voltage fluctuation before the power goes out.",
  "Power cut happened outside the announced schedule.",
  "Transformer near our road seems to be sparking during outages.",
  "Outage is affecting a small business relying on refrigeration.",
  "Repeated short outages several times within the same evening.",
  "Scheduled restoration time was missed by more than an hour.",
  "Street lighting also goes out along with the main supply.",
  "Water pump station loses power, affecting the local water supply.",
];
const ACTION_TYPES = [
  "Schedule Adjustment", "Site Inspection", "Transformer Maintenance",
  "Complaint Review", "Feeder Load Balancing", "Emergency Repair Dispatch",
  "Public Notice Issued", "Substation Audit",
];
const OUTAGE_REASONS = [
  "Scheduled load management", "Grid supply shortfall", "Routine maintenance",
  "High demand during peak hours", "Feeder line repair", "Weather related fault",
];

function today() { return new Date(); }
function fmtDate(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }

async function run() {
  console.log("Connecting to MySQL and seeding database... this may take a few seconds.");
  const conn = await pool.getConnection();

  try {
    // --- Wipe existing data (respecting FK order via disabled checks) -----
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of [
      "daily_frequency", "high_risk_zone", "monthly_analysis",
      "authority_action", "complaint", "outage_schedule",
      "citizen", "authority_user_area", "authority_user", "area",
    ]) {
      await conn.query(`TRUNCATE TABLE ${table}`);
    }
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");

    await conn.beginTransaction();

    // --- Areas -------------------------------------------------------------
    for (const d of DISTRICTS) {
      await conn.execute(
        "INSERT INTO area (area_name, division, region_type, zip_code) VALUES (?, ?, ?, ?)",
        [d.area_name, d.division, d.region_type, d.zip_code]
      );
    }
    const [areas] = await conn.query("SELECT * FROM area");
    console.log(`  + ${areas.length} areas (districts)`);

    // --- Authority users -----------------------------------------------------
    // One system admin + one field officer per division (8 divisions -> 8 officers)
    const divisions = [...new Set(DISTRICTS.map(d => d.division))];
    const defaultHash = bcrypt.hashSync("password123", 8);

    const users = [{
      user_name: "admin",
      password_hash: defaultHash,
      contact_email: "admin@lsms.gov.bd",
      role: "admin",
      division: null,
    }];
    divisions.forEach((div) => {
      users.push({
        user_name: `officer.${div.toLowerCase()}`,
        password_hash: defaultHash,
        contact_email: `officer.${div.toLowerCase()}@lsms.gov.bd`,
        role: "officer",
        division: div,
      });
    });
    for (const u of users) {
      await conn.execute(
        "INSERT INTO authority_user (user_name, password_hash, contact_email, role) VALUES (?, ?, ?, ?)",
        [u.user_name, u.password_hash, u.contact_email, u.role]
      );
    }
    const [authorityUsers] = await conn.query("SELECT * FROM authority_user");
    console.log(`  + ${authorityUsers.length} authority users (default password: password123)`);

    // --- Authority user area assignments (normalized M:N relationship) --------
    for (const u of authorityUsers) {
      if (u.role === "admin") {
        // Admin manages all areas
        for (const area of areas) {
          await conn.execute(
            "INSERT INTO authority_user_area (user_id, area_id) VALUES (?, ?)",
            [u.user_id, area.area_id]
          );
        }
      } else {
        // Officer manages all areas in their division
        const targetDiv = u.user_name.replace("officer.", "");
        const divAreas = areas.filter(a => a.division.toLowerCase() === targetDiv.toLowerCase());
        for (const area of divAreas) {
          await conn.execute(
            "INSERT INTO authority_user_area (user_id, area_id) VALUES (?, ?)",
            [u.user_id, area.area_id]
          );
        }
      }
    }
    const [userAreaRows] = await conn.query("SELECT * FROM authority_user_area");
    console.log(`  + ${userAreaRows.length} authority_user_area assignments logged`);

    // --- Citizens (5-8 per area) ---------------------------------------------
    let counter = 1;
    for (const area of areas) {
      const n = randInt(5, 8);
      for (let i = 0; i < n; i++) {
        const name = randomName();
        await conn.execute(
          "INSERT INTO citizen (full_name, phone, email, area_id) VALUES (?, ?, ?, ?)",
          [name, randomPhone(), randomEmail(name, counter), area.area_id]
        );
        counter++;
      }
    }
    const [citizens] = await conn.query("SELECT * FROM citizen");
    console.log(`  + ${citizens.length} citizens`);

    // --- Outage schedules: past 14 days + next 14 days, per area ------------
    const base = today();
    for (const area of areas) {
      const manager = pick(authorityUsers.filter(u => u.role !== "admin")) || authorityUsers[0];
      for (let d = -14; d <= 14; d++) {
        if (rand() < 0.35) continue; // not every area has an outage every single day
        const date = addDays(base, d);
        const startHour = pick([6, 9, 12, 14, 17, 19]);
        const durationHours = round1(1 + rand() * 2.5);
        const endHour = (startHour + Math.ceil(durationHours)) % 24;
        await conn.execute(
          `INSERT INTO outage_schedule (area_id, schedule_date, start_time, end_time, duration_hours, reason, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            area.area_id,
            fmtDate(date),
            `${String(startHour).padStart(2, "0")}:00`,
            `${String(endHour).padStart(2, "0")}:00`,
            durationHours,
            pick(OUTAGE_REASONS),
            manager.user_id,
          ]
        );
      }
    }
    const [schedules] = await conn.query("SELECT * FROM outage_schedule");
    console.log(`  + ${schedules.length} outage schedules`);

    // --- Complaints (tied to citizens, optionally linked to a schedule) ----
    const statuses = ["open", "in_review", "resolved", "rejected"];
    for (const area of areas) {
      const areaCitizens = citizens.filter(c => c.area_id === area.area_id);
      const areaSchedules = schedules.filter(s => s.area_id === area.area_id);
      const complaintCount = randInt(1, 5);
      for (let i = 0; i < complaintCount; i++) {
        const citizen = pick(areaCitizens);
        const schedule = rand() < 0.6 && areaSchedules.length ? pick(areaSchedules) : null;
        const status = pick(statuses);
        const resolutionNote =
          status === "resolved" ? "Issue addressed by local maintenance team." :
          status === "rejected" ? "Determined to be within planned schedule tolerance." : null;
        await conn.execute(
          `INSERT INTO complaint (citizen_id, area_id, schedule_id, reported_at, description, status, resolution_note)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            citizen.citizen_id,
            area.area_id,
            schedule ? schedule.schedule_id : null,
            fmtDate(addDays(today(), -randInt(0, 20))) + ` ${String(randInt(7, 21)).padStart(2, "0")}:${pick(["00", "15", "30", "45"])}:00`,
            pick(COMPLAINT_TEMPLATES),
            status,
            resolutionNote,
          ]
        );
      }
    }
    const [complaints] = await conn.query("SELECT * FROM complaint");
    console.log(`  + ${complaints.length} complaints`);

    // --- Authority actions -----------------------------------------------------
    for (const area of areas) {
      const areaComplaints = complaints.filter(c => c.area_id === area.area_id);
      const actionCount = randInt(0, 3);
      for (let i = 0; i < actionCount; i++) {
        const actor = pick(authorityUsers);
        const linkedComplaint = areaComplaints.length && rand() < 0.6 ? pick(areaComplaints) : null;
        await conn.execute(
          `INSERT INTO authority_action (user_id, area_id, complaint_id, action_time, action_type, notes)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            actor.user_id,
            area.area_id,
            linkedComplaint ? linkedComplaint.complaint_id : null,
            fmtDate(addDays(today(), -randInt(0, 25))) + ` ${String(randInt(8, 18)).padStart(2, "0")}:00:00`,
            pick(ACTION_TYPES),
            linkedComplaint
              ? `Action taken for complaint #${linkedComplaint.complaint_id}: ${linkedComplaint.description.slice(0, 50)}...`
              : "Logged as part of routine grid monitoring.",
          ]
        );
      }
    }
    console.log(`  + authority actions logged`);

    // --- Monthly analysis: last 6 months per area ---------------------------
    const months = [];
    { const d = today(); for (let i = 5; i >= 0; i--) { const m = new Date(d.getFullYear(), d.getMonth() - i, 1); months.push({ month: m.getMonth() + 1, year: m.getFullYear() }); } }

    for (const area of areas) {
      // rural areas tend to have somewhat higher outage percentages
      const baseline = area.region_type === "Rural" ? 18 : area.region_type === "Semi-Urban" ? 12 : 7;
      let prevPct = baseline + rand() * 6;
      for (const { month, year } of months) {
        const drift = (rand() - 0.5) * 5;
        const pct = Math.max(2, round1(prevPct + drift));
        const status = drift < -1 ? "improved" : drift > 1 ? "worsened" : "stable";
        await conn.execute(
          `INSERT INTO monthly_analysis (area_id, month, year, outage_percentage, avg_daily_hours, total_outages, improvement_status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [area.area_id, month, year, pct, round1((pct / 100) * 24), randInt(10, 60), status]
        );
        prevPct = pct;
      }
    }
    console.log(`  + monthly analysis rows for the last 6 months`);

    // --- High risk zones: flag current-month areas with high outage % ------
    const currentMonth = months[months.length - 1];
    const [currentAnalyses] = await conn.execute(
      "SELECT * FROM monthly_analysis WHERE month = ? AND year = ? ORDER BY outage_percentage DESC",
      [currentMonth.month, currentMonth.year]
    );
    for (const rowData of currentAnalyses) {
      let level = null;
      if (rowData.outage_percentage >= 22) level = "Critical";
      else if (rowData.outage_percentage >= 16) level = "High";
      else if (rowData.outage_percentage >= 11) level = "Medium";
      if (!level) continue; // only flag areas above the "Low" threshold
      await conn.execute(
        `INSERT INTO high_risk_zone (area_id, month, year, risk_level, flagged_reason, flagged_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          rowData.area_id,
          currentMonth.month,
          currentMonth.year,
          level,
          `Outage rate at ${rowData.outage_percentage}% of monitored hours this month.`,
          fmtDate(today()),
        ]
      );
    }
    const [risks] = await conn.query("SELECT * FROM high_risk_zone");
    console.log(`  + ${risks.length} high risk zone flags for the current month`);

    // --- Daily frequency: last 30 days per area -------------------------------
    // NOTE: avg_outage_duration is recalculated by the trg_daily_frequency_avg
    // trigger on insert, but we still send a value for clarity.
    for (const area of areas) {
      const baseline = area.region_type === "Rural" ? 4 : area.region_type === "Semi-Urban" ? 3 : 2;
      for (let d = 29; d >= 0; d--) {
        const date = fmtDate(addDays(today(), -d));
        const count = Math.max(0, Math.round(baseline + (rand() - 0.5) * 3));
        const totalHours = round1(count * (1 + rand() * 1.5));
        await conn.execute(
          `INSERT INTO daily_frequency (area_id, date, outage_count, total_outage_hours, avg_outage_duration)
           VALUES (?, ?, ?, ?, ?)`,
          [area.area_id, date, count, totalHours, count > 0 ? round1(totalHours / count) : 0]
        );
      }
    }
    console.log(`  + daily frequency rows for the last 30 days`);

    await conn.commit();
    console.log("\nSeeding complete.");
    console.log("Login with user_name: admin  password: password123");
  } catch (err) {
    await conn.rollback();
    console.error("\nSeeding failed, changes rolled back:", err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

run();
