# Load Shedding Management System (Bangladesh)

A full working project for tracking district-level power outages ("load
shedding") across Bangladesh: outage schedules, citizen complaints, high-risk
zone flags, and monthly trend analysis — with a public site for citizens and
a login-protected dashboard for authority staff, backed by a **MySQL**
database.

This version is built around the database layer specifically, so it works as
a DBMS course project: a standalone `schema.sql` you can present/hand in,
proper constraints and relationships, a view, a stored procedure, a trigger,
and a set of example queries — plus a working full-stack app on top of it.

---

## 1. What's inside

```
load-shedding-management-system/
├── database/
│   ├── schema.sql        <- THE MAIN DELIVERABLE: creates the DB + all 10 tables,
│   │                         constraints, 2 views, 1 stored procedure, 1 trigger
│   └── queries.sql       <- example SELECT/JOIN/subquery/view/procedure queries
│                             to run and show for your report/presentation
├── backend/               <- the server (Node.js + Express + MySQL)
│   ├── db/
│   │   ├── pool.js            <- MySQL connection settings
│   │   └── seed.js            <- fills the tables with sample Bangladesh data
│   ├── middleware/auth.js     <- login/token checking
│   ├── routes/                 <- one file per group of API endpoints
│   ├── server.js               <- starts everything
│   └── package.json
└── frontend/               <- the website (plain HTML/CSS/JS, no build step)
    ├── index.html              <- public landing page
    ├── login.html              <- authority login
    ├── complaint.html          <- public "file a complaint" form
    ├── dashboard.html          <- the authority dashboard (after login)
    ├── css/style.css
    └── js/
```

The backend serves the frontend too, so you only ever run **one** server and
open **one** URL: `http://localhost:3000`.

## 2. Install the one-time tools

You need two things installed:

**A. MySQL Server** (8.0 or newer)
- Easiest option: install **MySQL Workbench**, which bundles the server —
  https://dev.mysql.com/downloads/workbench/
- Alternative: **XAMPP** (bundles MySQL as "MariaDB") if you already use it
  for other coursework.
- During setup you'll set a **root password** — remember it, you'll need it
  below. (If you use XAMPP's default MySQL, the root password is usually
  blank.)

**B. Node.js** (version 18 or newer) — this runs the backend server.
- https://nodejs.org — download the "LTS" installer, click through with
  defaults.
- Check it worked: open a terminal and run `node -v`. You should see
  something like `v20.11.0`.

## 3. Create the database

This is the main step for the DBMS side of the project. Open
`database/schema.sql` and run it against your MySQL server. Two ways to do
that:

**Option A — MySQL Workbench (recommended, visual):**
1. Open MySQL Workbench, connect to your local server (root + your password).
2. File → Open SQL Script... → select `database/schema.sql`.
3. Cbutton to run the whole script.
4. In the left side bar, refresh "Schemas" — you should now see
   `load_shedding_db` with 10 tables, 2 views, and a stored procedure inside.

**Option B — command line:**
```
mysql -u root -p < database/schema.sql
```
(enter your root password when prompted)

Either way, this script:
- Creates the `load_shedding_db` database (dropping it first if it already
  existed, so it's always safe to re-run for a clean slate).
- Creates all 10 tables from the ER diagram (including the normalized
  `authority_user_area` junction table), with primary keys, foreign keys,
  and `ON DELETE` rules.
- Creates 2 views (`v_high_risk_current`, `v_area_complaint_summary`), 1
  stored procedure (`sp_area_report`), and 1 trigger
  (`trg_daily_frequency_avg`) — see `database/queries.sql` for how to use
  each one directly in Workbench.

## 4. Point the backend at your database

Open `backend/db/pool.js`. Near the top you'll see:

```js
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "lsms_user",
  password: process.env.DB_PASSWORD || "lsms_password",
  database: process.env.DB_NAME || "load_shedding_db",
  ...
```

You have two options:

- **Quickest:** create the `lsms_user` account exactly as the defaults
  expect, by running this in Workbench or the `mysql` CLI:
  ```sql
  CREATE USER 'lsms_user'@'localhost' IDENTIFIED BY 'lsms_password';
  GRANT ALL PRIVILEGES ON load_shedding_db.* TO 'lsms_user'@'localhost';
  FLUSH PRIVILEGES;
  ```
- **Or:** just edit the `user`/`password` values in `pool.js` directly to
  your own MySQL root username/password. (Fine for a local class project;
  for anything shared publicly, prefer a dedicated non-root user like above.)

## 5. Install dependencies and load sample data

```
cd load-shedding-management-system/backend
npm install
npm run seed
```

`npm install` downloads the small libraries the server needs (Express, the
MySQL driver, etc.). `npm run seed` connects to `load_shedding_db` and fills
it with realistic sample data: all 64 districts, ~400 citizens, ~1,200
outage schedules, ~220 complaints, 6 months of trend analysis, auto-flagged
high-risk zones, and 30 days of daily frequency data.

You should see output ending in `Seeding complete.` You can re-run
`npm run seed` any time — it truncates and reloads all tables (except the
schema itself, which stays as defined in `schema.sql`).

## 6. Run it

Still inside `backend`:

```
npm start
```

You'll see:

```
Load Shedding Management System running:
  -> http://localhost:3000
```

Open that link in your browser. Leave the terminal window open — closing it
stops the server. To stop it on purpose, press `Ctrl + C`.

## 7. Logging in

The public site lets anyone file a complaint at `complaint.html` with no
login. The authority dashboard needs an account. Seeded demo accounts:

| Username             | Password    | Role    |
|-----------------------|-------------|---------|
| `admin`               | password123 | admin   |
| `officer.dhaka`       | password123 | officer |
| `officer.chattogram`  | password123 | officer |
| ...one `officer.<division>` account per division | password123 | officer |

## 8. What you can already do from the dashboard

- **Overview** – live counts (open complaints, high-risk zones, upcoming
  schedules) and two charts.
- **Areas (Districts)** — add, rename, or delete a district; change its
  `division`, `region_type` (Urban/Semi-Urban/Rural), or zip code right from
  the browser — no SQL required. Every other screen (citizens, complaints,
  schedules, analysis) automatically follows whatever areas exist in this
  table.
- **Complaints** — filter by area/status, open one, change its status
  (open → in review → resolved/rejected) and add a resolution note.
- **Outage Schedules** — add/edit/delete planned outage windows per district.
- **High Risk Zones** — auto-flagged districts for the current month (reads
  from the `v_high_risk_current` view — see thresholds in `db/seed.js`).
- **Monthly Analysis** — a 6-month trend chart + table per district.
- **Authority Actions** — a simple log of actions officers take (inspections,
  maintenance, etc.).

## 9. Changing the data later

You have three ways to edit the district (`area`) data, from easiest to most
advanced:

1. **Through the website (recommended).** Log in, go to "Areas (Districts)",
   click **Edit** on any row, change the fields, save.
2. **Through the seed file.** Open `backend/db/seed.js`, find the
   `DISTRICTS` array near the top, edit the values, save, then run
   `npm run seed` again. Fastest way to fix many districts at once, but it
   **wipes and regenerates all data**, not just areas.
3. **Directly in MySQL Workbench.** Right-click the `area` table →
   "Select Rows" → edit cells like a spreadsheet → click Apply. This changes
   only what you touch, without regenerating anything else.

Reminder of the convention used throughout the project:
- `area_name` stores the **district name** (e.g. "Chattogram", "Rangpur").
- `division` + `region_type` together are used for classification/filtering.

## 10. The database objects, for your report

All defined in `database/schema.sql`, demonstrated with runnable examples in
`database/queries.sql`:

- **9 tables**: `area`, `citizen`, `complaint`, `outage_schedule`,
  `authority_user`, `authority_action`, `monthly_analysis`,
  `high_risk_zone`, `daily_frequency` — matching the ER diagram, with PK/FK
  constraints, `UNIQUE` and `CHECK` constraints, and `ON DELETE
  CASCADE`/`SET NULL` rules matched to each relationship's meaning.
- **2 views**: `v_high_risk_current` (current month's flagged districts,
  joined with area details) and `v_area_complaint_summary` (per-district
  complaint counts by status) — both used directly by the running app, not
  just for show.
- **1 stored procedure**: `sp_area_report(p_area_id)` — returns a district's
  profile, latest monthly analysis, current risk flag, and open
  complaint/upcoming schedule counts in one call. Used by the app at
  `GET /api/areas/:id/report`.
- **1 trigger**: `trg_daily_frequency_avg` — recalculates
  `avg_outage_duration` from `total_outage_hours / outage_count` before every
  insert into `daily_frequency`, so that derived value can never drift out of
  sync with its inputs.

## 11. How the pieces talk to each other

- The **frontend** (plain HTML/CSS/JS in `frontend/`) never talks to MySQL
  directly. It calls the **backend API** (`/api/...` routes) using
  `fetch()`, defined in `frontend/js/api.js`.
- The **backend** (`backend/server.js` + `backend/routes/*.js`) receives
  those calls, runs SQL against MySQL through a connection pool
  (`backend/db/pool.js`, using the `mysql2` driver), and sends JSON back.
- Login uses a signed token (JWT). After logging in, the browser stores the
  token and sends it with every request that needs authority permissions
  (creating/editing/deleting). Reading public data (area list, filing a
  complaint) doesn't require login.

## 12. Common problems

- **"npm: command not found"** → Node.js isn't installed or your terminal
  needs restarting after installing it.
- **`Error: connect ECONNREFUSED 127.0.0.1:3306`** → MySQL server isn't
  running. Start it (in Workbench, or via your OS's Services app / XAMPP
  control panel), then try again.
- **`Access denied for user 'lsms_user'@'localhost'`** → you haven't created
  that MySQL user yet, or the password in `backend/db/pool.js` doesn't match
  what you set. See step 4.
- **`Unknown database 'load_shedding_db'`** → you haven't run
  `database/schema.sql` yet, or ran it against a different MySQL server than
  the one `pool.js` is pointing at. See step 3.
- **"Error: listen EADDRINUSE :::3000"** → something is already using port
  3000. Either stop that program, or run
  `PORT=4000 npm start` (Mac/Linux) / `set PORT=4000 && npm start` (Windows)
  and open `http://localhost:4000` instead.
- **Dashboard shows no data** → make sure you ran `npm run seed` at least
  once before `npm start`.
- **Changes to `area` disappear** → you probably ran `npm run seed` again,
  which truncates and regenerates everything. Edit districts through the
  website or MySQL Workbench instead if you don't want that.

---

Built to match the ER diagram / relational schema you provided: `Area`,
`Citizen`, `Complaint`, `Outage_Schedule`, `Authority_User`,
`Authority_Action`, `Monthly_Analysis`, `High_Risk_Zone`, and
`Daily_Frequency`, with the relationships between them (managed_by, files,
resides_in, targeted, analyzed_in, flagged_as, and so on) implemented as
foreign keys in MySQL.
