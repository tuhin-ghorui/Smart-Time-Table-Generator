# CampusTime — Smart College Timetable & Faculty Substitution System

Full-stack app to manage college timetables and faculty substitutions.

- **Frontend:** React (Vite) — folder `frontend/`
- **Backend:** Express REST API — folder `backend/`
- **Database:** MySQL 8 — schema in `backend/database/schema.sql`

```
project/
├── backend/    API :5000   (Express + MySQL, JWT auth, AI recommendations, PDF export)
└── frontend/   SPA :5173   (React, Vite dev server proxies /api to :5000)
```

---

## 1. Prerequisites

| Tool | Version | Check with |
|------|---------|------------|
| Node.js | 18 or newer | `node -v` |
| npm | included with Node | `npm -v` |
| MySQL | 8.x (running) | `mysql --version` or the MySQL80 service is `Running` |

MySQL can be set up either by command line or by importing `backend/database/schema.sql` in MySQL Workbench.

---

## 2. Clone

```bash
git clone <your-repo-url> campus-time
cd campus-time
```

You now have two folders: `backend/` and `frontend/`.

---

## 3. Backend setup (in `backend/`)

### 3a. Install dependencies

```bash
cd backend
npm install
```

### 3b. Configure environment

```bash
# Windows PowerShell
Copy-Item .env.example .env

# macOS / Linux
cp .env.example .env
```

Edit the `.env` file and set your real MySQL credentials:

```env
PORT=5000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password   # <-- put YOUR MySQL password here
DB_NAME=campustime

JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES_IN=7d
```

> `.env` is git-ignored — it will never be committed and each clone sets its own.

### 3c. Create the database (pick ONE method)

**Option A — automatic (recommended):**

```bash
npm run db:schema
```

**Option B — MySQL Workbench:** open `backend/database/schema.sql` and click the lightning bolt / "Execute" icon.

### 3d. Seed demo data

```bash
npm run seed
# or, to wipe everything first and reseed:
npm run seed:reset
```

This creates the BCA structure (FY/SY/TY, sections A/B, 3 batches each, 8 teachers), a weekly timetable (~108 slots), and open substitution requests.

### 3e. Start the API

```bash
npm start
# development with auto-restart:
npm run dev
```

The API runs at **http://localhost:5000**. Health check: `GET http://localhost:5000/api/health` → `{"ok":true,...}`.

---

## 4. Frontend setup (in a second terminal)

```bash
# from project root
cd frontend
npm install
npm run dev
```

The app runs at **http://localhost:5173**. The Vite dev server proxies `/api` to the backend, so no extra config is needed.

---

## 5. Demo logins

| Role | Email | Password |
|------|-------|----------|
| Admin / HOD | `admin@campustime.test` | `admin123` |
| Teacher | `teacher1@campustime.test` | `teacher123` |

(Teachers 1–8 exist: `teacher1@campustime.test` … `teacher8@campustime.test`, all use `teacher123`.)

---

## 6. Quick reference — every command

```bash
# Backend
cd backend && npm install          # install deps
cp .env.example .env               # configure DB credentials
npm run db:schema                  # create DB + tables (or import schema.sql in Workbench)
npm run seed                       # load demo data
npm run seed:reset                 # wipe + reseed
npm start                          # run API on :5000
npm run dev                        # run API with auto-restart

# Frontend
cd frontend && npm install
npm run dev                        # run SPA on :5173
npm run build                      # production build (outputs to dist/)
```

Open **http://localhost:5173** in your browser.

---

## 7. Main API endpoints

| Method | Endpoint | Access | Purpose |
|--------|----------|--------|---------|
| POST | `/api/auth/login` | Public | Get JWT token |
| GET | `/api/auth/me` | Auth | Current user profile |
| GET | `/api/public/structure` | Public | Courses → years → sections → batches |
| GET | `/api/public/timetable` | Public | Published timetable (today/weekly) |
| GET | `/api/public/changes` | Public | Today's published changes |
| GET | `/api/public/pdf/daily` , `/pdf/weekly` | Public | PDF downloads |
| GET | `/api/teacher/dashboard`, `/schedule`, `/assignments` | Teacher | Teacher features |
| GET | `/api/admin/dashboard`, `/attendance`, `/requests`, `/history` | Admin | Admin features |
| POST | `/api/admin/attendance` | Admin | Mark present/absent/leave |
| POST | `/api/admin/attendance/generate-requests` | Admin | Absences → uncovered classes |
| GET | `/api/admin/requests/:id` | Admin | AI-ranked substitution candidates |
| POST | `/api/admin/assignments` | Admin | Assign / override / reject |
| POST | `/api/admin/timetable/slots` | Admin | Create/edit slot (with conflict check) |
| POST | `/api/admin/batches` | Admin | Create batch |

---

## 8. Troubleshooting

**`Access denied for user 'root'@'localhost'`**
Your `.env` password is wrong or empty. Update `DB_PASSWORD` and re-run `npm run db:schema`.

**`ER_ACCESS_DENIED_ERROR` / connection refused**
MySQL isn't running. Start it (Windows: Services → `MySQL80` → Start), or check `DB_HOST`/`DB_PORT` point to your instance.

**`Invalid database` / `Unknown database 'campustime'`**
You skipped the schema step. Run `npm run db:schema` (creates the database).

**Port 5000 already in use**
Edit `PORT` in `backend/.env` and the Vite proxy target in `frontend/vite.config.js`.

**`npm run seed` says "Database already has data"**
That's expected if you seeded before. Use `npm run seed:reset` to start fresh.

**Frontend loads but API calls fail**
Both terminals must be running. The frontend proxies `/api` to `http://localhost:5000` — make sure the backend is up.

---

## 9. Non-negotiables enforced by the design

- No student accounts — public users only view published data.
- Only published changes reach the public timetable.
- AI substitutes are hard-filtered on **availability at the exact time** and **qualification**; AI only recommends, never assigns.
- Every substitution needs an **admin/HOD assignment**; the teacher then accepts.
- All timetable edits pass a **conflict check** before publish; approvals are required.
- Every meaningful admin action is written to the **audit log / change history**.
- Batches are fully **database-driven** — create, rename, deactivate, reactivate per section with zero code changes.