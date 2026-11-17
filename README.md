# Resolve: Complaint & Feedback Management System

CSC 407 course project for **Afe Babalola University (ABUAD)**. Students and visitors submit complaints, feedback or suggestions. Each one gets a ticket ID and is routed to the right office. Staff log in to assign, investigate, reply and resolve, and students follow the progress the whole way through.

- **Front end:** React 18 + Vite + React Router (`client/`)
- **Back end:** Node.js + Express REST API (`server/`)
- **Database:** PostgreSQL. Online it uses **Neon** (hosted Postgres, connected through Vercel); on your laptop it uses **PGlite**, a full Postgres that runs inside Node, so there is nothing to install
- **Auth:** JWT tokens for students and staff (kept separate), bcrypt-hashed passwords
- **Uploads:** Multer → **Vercel Blob** (private store) online, or `server/data/uploads` locally (images, PDF, Word, text; up to 5 files, 4 MB in total)
- **Hosting:** Vercel (React app on Vercel's CDN, Express API as a Vercel Function). See [Deploying to Vercel](#deploying-to-vercel).

---

## 1. Install Node.js (one time)

1. Go to <https://nodejs.org> and download the **LTS** version for Windows (**20 or newer**).
2. Run the installer and accept the defaults.
3. Open a **new** terminal in VS Code (**Terminal → New Terminal**) and check it worked:

   ```bash
   node --version
   ```

   You should see `v20` or higher (e.g. `v26.x.x`).

## 2. Set up the project (one time)

Open the `CSC 407 Project` folder in VS Code, open a terminal and run:

```bash
npm run setup
```

This installs everything for the root, the server and the client.

**Optional:** add sample complaints so the dashboard isn't empty:

```bash
npm run seed:demo
```

It prints each sample ticket ID with its access code, so you can try them on the Track page, and creates a demo student account (below).

## 3. Run it

```bash
npm run dev
```

This starts both parts together:

| Part | Address |
| --- | --- |
| Website (React) | <http://localhost:5173> |
| API (Express) | <http://localhost:4000/api> |

Open **http://localhost:5173** in your browser. Press `Ctrl + C` in the terminal to stop.

### Staff logins on your laptop (created automatically on first run)

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@resolve.test` | `Admin@123` |
| Hostel officer | `hostel@resolve.test` | `Officer@123` |
| Academic officer | `academics@resolve.test` | `Officer@123` |
| Bursary officer | `bursary@resolve.test` | `Officer@123` |
| ICT officer | `ict@resolve.test` | `Officer@123` |

Staff login is at **/staff/login** (or "Staff portal" in the header). On the live Vercel site the emails are the same, but every staff account starts with the `STAFF_PASSWORD` you choose (see below).

### Student accounts

Students create their own account at **/register** (name, matric number, email, password) and sign in at **/login** with their matric number *or* email. Accounts are optional: anyone can still submit as a guest and track with a ticket ID + access code.

`npm run seed:demo` also creates a demo student: **`student@resolve.test` / `Student@123`** (or matric `DEMO/0001`).

### Other commands

| Command | What it does |
| --- | --- |
| `npm run reset` | Deletes the **local** database and uploaded files to start fresh (never touches Neon) |
| `npm run build` then `npm start` | Production mode: builds the React app and serves the whole site from <http://localhost:4000> |

---

## Deploying to Vercel

The live site needs three things from Vercel: the code (from GitHub), a **Neon** database and a **private Blob** store. All three have free tiers.

### 1. Put the project on GitHub

Use **GitHub Desktop** (easiest): *File → Add local repository* → choose the `CSC 407 Project` folder → *create a repository* if asked → **Publish repository**. You can keep it private.

The `.gitignore` file makes sure `node_modules`, `server/data`, `client/dist` and `server/.env` are **not** uploaded. Don't upload a zip: Vercel needs the actual files.

### 2. Import it into Vercel

1. Sign in at <https://vercel.com> with your GitHub account.
2. **Add New → Project** → pick the repository → **Import**.
3. Leave the settings as they are (`vercel.json` already tells Vercel how to build) and open **Environment Variables**. Add:

   | Name | Value |
   | --- | --- |
   | `JWT_SECRET` | any long random text, at least 16 characters (e.g. mash the keyboard) |
   | `STAFF_PASSWORD` | the first password for all staff accounts (admin and officers) |

4. Click **Deploy**. The first deploy finishes, but the site will say *"Server not configured … No database connected"* until step 3.

### 3. Connect the database and file storage

In the Vercel project, open the **Storage** tab:

1. **Create Database → Neon** (Postgres) → follow the prompts → connect it to the project. This adds `DATABASE_URL` automatically.
2. **Create → Blob** → set access to **Private** → connect it to the project.

Then go to **Deployments → ⋯ on the latest → Redeploy** so the new settings take effect.

### 4. Check it

- Open `https://<your-project>.vercel.app/api/health`. It should say `{"ok":true,"problems":[]}`; otherwise it lists what's missing.
- Open the site, submit a complaint with a photo, then sign in at **/staff/login** as `admin@resolve.test` with your `STAFF_PASSWORD`.

The tables and staff accounts are created automatically on the first visit.

### Optional: sample data on the live site

To fill the live database with the sample complaints and demo student, copy the `DATABASE_URL` value from Vercel (**Settings → Environment Variables**, or Neon's dashboard) into a file `server/.env` on your laptop (see `server/.env.example`):

```
DATABASE_URL=postgres://...
```

then run `npm run seed:demo`. Delete or rename `server/.env` afterwards to go back to the local database.

### Updating the live site

Change the code, then in GitHub Desktop **Commit** and **Push**. Vercel redeploys automatically in about a minute.

---

## Features

**Students / public**
- Landing page with process overview and categories
- Optional student accounts (register with matric number, sign in with matric or email)
- **My complaints** page: every complaint the student has submitted, open/resolved counts, and a notice when an officer is waiting for their reply
- Signed-in students get the form pre-filled from their account
- Submit a complaint, feedback or suggestion: category, subject, details, location, incident date, urgency, file attachments
- Optional anonymous submission (name and matric number are not stored; for signed-in students the complaint still shows in *their* My complaints, but staff never see who sent it)
- Ticket ID + 6-character access code on submission; both are needed to view a ticket, so other people can't read it
- Tracking page: progress timeline, handling office/officer, conversation with the officer, reply with attachments
- Rate the resolution (1–5 stars), confirm and close, or reopen with a reason

**Staff**
- Secure login (JWT, bcrypt)
- Dashboard: open / new today / overdue / average resolution time and rating, open complaints by category
- Filter by status (incl. overdue), "Assigned to me", "Feedback & suggestions", search by ticket/subject/name/matric, pagination
- Export the current list to CSV
- Complaint detail: change status, assign officer, change priority, move/escalate to another department
- Reply to the student, or ask a question (sets status to "Awaiting student"), or add **internal notes** that students never see
- Response target of 5 working days, with overdue flagging
- Full activity log for every ticket

## How a complaint flows

```
New ──assign──▶ In progress ⇄ Awaiting student
                    │
                    ▼
                Resolved ──student confirms──▶ Closed
                    ▲                              │
                    └────────── reopen ◀───────────┘
```

Categories are routed to departments automatically (edit `CATEGORIES` in `server/src/config.js`):

| Category | Department |
| --- | --- |
| Academics | Academic Affairs |
| Hostel & facilities | Hostel Management |
| Fees & finance | Bursary |
| Staff conduct | Registry |
| IT & student portal | ICT Unit |
| General feedback / Other | Complaints Office |

---

## Project structure

```
CSC 407 Project/
├── package.json            root scripts (setup, dev, build, start…)
├── vercel.json             Vercel build settings and routing
├── api/index.js            Vercel Function entry (runs the Express app)
├── server/
│   ├── src/
│   │   ├── app.js           Express app (routes, error handling)
│   │   ├── index.js         local server (npm run dev / npm start)
│   │   ├── config.js        settings, env vars, categories → departments, limits
│   │   ├── db.js            Postgres (Neon) / PGlite connection, schema, default staff accounts
│   │   ├── complaints.js    shared data access (create, views, messages, activity)
│   │   ├── auth.js          JWT sign/verify middleware
│   │   ├── uploads.js       uploads → Vercel Blob or local disk
│   │   ├── seedDemo.js      sample data
│   │   ├── reset.js         wipe database
│   │   └── routes/
│   │       ├── public.js    submit, track, reply, rate, close, reopen
│   │       ├── staff.js     login, stats, list, detail, update, messages, CSV
│   │       ├── students.js  student register, login, my complaints
│   │       └── attachments.js
│   ├── .env.example         optional local settings
│   └── data/               local only: pglite/ database + uploads/
└── client/
    ├── index.html
    ├── vite.config.js       dev proxy /api → :4000
    └── src/
        ├── main.jsx, App.jsx   routing
        ├── api.js, auth.jsx    API calls + staff session
        ├── styles.css          design tokens (colours, Sora font) + all styles
        ├── components/         header, footer, pills, timeline, staff layout
        └── pages/              Landing, Submit, Track, StudentLogin, Register, MyComplaints,
                                Login (staff), Dashboard, Detail
```

## Database tables

| Table | Purpose |
| --- | --- |
| `departments` | Offices that handle complaints |
| `users` | Staff accounts (`admin` or `officer`) |
| `students` | Student accounts (name, matric, email, department, password hash) |
| `complaints` | Tickets: type, category, details, priority, status, submitter, linked student (optional), department, officer, due date, rating |
| `messages` | Conversation per ticket (`student`, `staff`, `system`); `internal = 1` for staff-only notes |
| `attachments` | Uploaded files linked to a ticket or a message |
| `activity` | Audit log of every change |

## API endpoints

Public

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/meta` | Categories, types, priorities |
| POST | `/api/complaints` | Submit (multipart form, `files` field for attachments) |
| GET | `/api/track/:ticket?code=` | View a ticket |
| POST | `/api/track/:ticket/messages` | Student reply |
| POST | `/api/track/:ticket/rating` | Rate 1–5 (resolved tickets only) |
| POST | `/api/track/:ticket/close` | Confirm resolution |
| POST | `/api/track/:ticket/reopen` | Reopen with a reason |
| GET | `/api/attachments/:id?ticket=&code=` | Download an attachment |

Students (send `Authorization: Bearer <token>`)

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/students/register` | `{ name, matric, email, department?, password }` → token |
| POST | `/api/students/login` | `{ identifier (matric or email), password }` → token |
| GET | `/api/me` | Current signed-in student or staff member |
| GET | `/api/students/complaints` | The student's own complaints (with access codes) |

Submitting a complaint with a student token links it to that student's account.

Staff (send `Authorization: Bearer <token>`)

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/auth/login` | Returns a token |
| GET | `/api/staff/me` | Current user |
| GET | `/api/staff/stats` | Dashboard figures |
| GET | `/api/staff/complaints` | List: `status`, `view=mine\|feedback`, `q`, `page`, `pageSize` |
| GET | `/api/staff/complaints/:id` | Full detail incl. internal notes + activity |
| PATCH | `/api/staff/complaints/:id` | Update `status`, `priority`, `assignedTo`, `departmentId` |
| POST | `/api/staff/complaints/:id/messages` | `{ body, internal, awaitStudent }` |
| GET | `/api/staff/export.csv` | CSV of the filtered list |
| GET | `/api/staff/officers`, `/api/staff/departments` | Dropdown data |

---

## Customizing

- **Colours and font:** change the variables at the top of `client/src/styles.css`.
- **Institution name:** `INSTITUTION` at the top of `client/src/components/ui.jsx`.
- **Campus security number:** replace `[PHONE NUMBER]` in `client/src/pages/Submit.jsx`.
- **Response target:** `TARGET_WORKING_DAYS` in `server/src/config.js`.
- **Attachment limit:** `MAX_FILE_MB` / `MAX_TOTAL_MB` in `server/src/config.js` and `MAX_MB` in `client/src/pages/Submit.jsx`. Vercel rejects requests over 4.5 MB, so keep the total under that.

## Not included (ideas for extension)

- Email notifications (the email field is stored; plug in Nodemailer to send updates)
- An admin screen to add/remove staff accounts (currently seeded in `server/src/db.js`)
- Password reset for students (needs email sending)

## Troubleshooting

- **`'npm' is not recognized`**: Node.js isn't installed, or the terminal was open before installing it. Close VS Code completely and reopen it.
- **"Resolve needs Node.js 20 or newer"**: install the current LTS from nodejs.org.
- **`Cannot find package 'pg'` (or `@electric-sql/pglite`)**: run `npm run setup` again after updating the project.
- **Live site says "Server not configured"**: open `/api/health` to see which setting is missing, add it in Vercel, then **Redeploy**.
- **Live site: staff login fails with `Admin@123`**: on Vercel, staff accounts use your `STAFF_PASSWORD` instead. If you change `STAFF_PASSWORD` later, the existing accounts keep the old one (it's only used when the accounts are first created).
- **Uploading a file fails on the live site**: make sure a **Private** Blob store is connected in the Storage tab, then redeploy.
- **Port already in use**: something else is using 4000 or 5173. Close the other terminal running the app, or restart VS Code.
- **"Cannot reach the server"** on the website: the API isn't running. Use `npm run dev` (not just the client).
- **`Error: spawn UNKNOWN`** from Vite: Windows (often Smart App Control or antivirus) blocked `esbuild.exe`. This project already uses the WebAssembly build of esbuild (`overrides` in `client/package.json`) to avoid it. If it reappears, delete `client/node_modules` and run `npm install` in `client` again.
- **Opening http://localhost:4000 shows "This is the Resolve API"**: in development the website is on http://localhost:5173.
