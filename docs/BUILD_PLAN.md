# CampusTime Build Plan

This project should be built in thin, demonstrable slices so each college-review milestone has something visible.

## Step 1: Foundation

- React + Vite client
- Express API
- MySQL schema and seed files
- Mock API data that matches the schema
- Public, Teacher, and Admin UI shells

## Step 2: Real Auth and Database

- Connect Express routes to MySQL
- Add login for Teacher/Admin
- Add role middleware on every protected route
- Keep public routes unauthenticated and published-only

## Step 3: Public Timetable

- Course, year, section, and batch filtering
- Today/weekly toggle
- Published changes panel
- PDF download endpoints

## Step 4: Admin Operations

- Attendance entry/import
- Absence detection
- Affected/uncovered classes
- Batch CRUD
- Timetable draft, conflict check, approval, and publish flow

## Step 5: AI-Assisted Substitution

- Hard filters: exact-time availability and subject qualification
- Ranking: daily load, weekly load, substitution load, lab capability, class/department fit
- Explainable score cards
- Manual admin approval only

## Step 6: Polish

- Server-side PDF generation
- Notifications
- Audit log views
- Responsive and accessibility pass
