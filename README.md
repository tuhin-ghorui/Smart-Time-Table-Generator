# CampusTime — Condensed PRD
**Smart College Timetable & Faculty Substitution System**

Stack: **React.js** (frontend) · **Express.js** (backend/API) · **MySQL** (database, designed in MySQL Workbench)

---

## 1. What It Is

CampusTime manages college timetables and faculty substitutions. Flow it must support:

> Who is absent? → What classes are affected? → What's uncovered? → Who can substitute? → What needs approval?

**No student accounts exist.** Students are public, unauthenticated viewers only.

---

## 2. User Roles

| Role | Auth? | Key Abilities |
|---|---|---|
| **Public** | No | View timetable (year/section/batch), today/weekly toggle, today's changes, download PDFs |
| **Teacher** | Yes | View own schedule, attendance status, substitute assignments (accept/request review), download PDFs, notifications |
| **Admin/HOD** | Yes | Full control: attendance, substitutions, AI recommendations, approvals, timetable/batch management, publishing, change history |

No role switcher. No student login, ever.

---

## 3. Academic Structure (Dynamic — Not Hard-Coded)

```
Course (e.g., BCA)
 └── Academic Year (FY / SY / TY)
      └── Section (A, B...)
           └── Batch (1, 2, 3... — created per section, not fixed)
```

- Batches are **DB records**, not enums. Admin can create/rename/deactivate/reactivate them per section.
- Deactivated batches stay in history but disappear from active scheduling.
- Lectures apply to a whole **Section**. Practicals apply to a specific **Batch**.

---

## 4. Core Data Entities (MySQL Tables)

```
users (id, name, email, password_hash, role[teacher|admin])
teachers (id, user_id, department, qualifications)
courses (id, name)
academic_years (id, course_id, name)          -- FY/SY/TY
sections (id, academic_year_id, name)
batches (id, section_id, name, is_active)
subjects (id, name, course_id)
rooms (id, name, type[room|lab])
timetable_slots (id, academic_year_id, section_id, batch_id [nullable],
                  subject_id, teacher_id, day, start_time, end_time,
                  room_id, session_type, status)
attendance_records (id, teacher_id, date, status, source, synced_at)
substitution_requests (id, timetable_slot_id, date, status)
substitution_candidates (id, request_id, teacher_id, score, reasons_json)
substitution_assignments (id, request_id, teacher_id, assigned_by, status)
timetable_changes (id, slot_id, change_type, old_value, new_value, published_at)
notifications (id, user_id, type, message, read, created_at)
audit_logs (id, user_id, role, action, entity, old_value, new_value, reason, created_at)
```

Relationships: Course → Section → Batch; Teacher → Slots/Attendance; Slot → SubstitutionRequest → Candidates + Assignment.

---

## 5. Timetable Rules

- **Session types:** Lecture, Practical, Seminar, VET, Internship, Other (configurable).
- **Statuses:** Scheduled, Current, Upcoming, Completed, Changed, Substitute, Room Changed, Cancelled.
- Timetable edits go through **Draft → Conflict Check → Admin Approval → Publish → Public Visible**.
- Public users only ever see **published** data.

---

## 6. Substitution Workflow

1. Teacher marked absent (from attendance system).
2. System finds their affected slots.
3. Uncovered slots become **Substitution Requests**.
4. AI engine filters eligible teachers by:
   - **Must be free at the exact time** (hard rule)
   - **Must be qualified for the subject** (hard rule)
5. Ranks remaining candidates by: daily load, free periods, existing substitution load, consecutive lecture conflicts, weekly workload, lab capability, class/department compatibility.
6. Each candidate shown with a **Suitability Score (X/100)** + plain-language reasons (e.g., "Available ✓, Qualified ✓, Only 1 lecture today").
7. **Admin/HOD manually assigns, overrides, or rejects.** AI never auto-finalizes.
8. Approved assignment updates the published timetable → logged in Change History → notifications sent.

---

## 7. Screens (Minimum Set)

**Public:** Home/Timetable, Weekly View, Today's Updated Timetable, Today's Changes, PDF Download Modal

**Teacher:** Dashboard, My Schedule, Substitute Assignments, Notifications

**Admin/HOD:** Overview Dashboard, Faculty Attendance, Substitution Management, Recommendation & Approval, Timetable Editor, Batch Management, Change History, Notifications

---

## 8. Admin Dashboard — Key Metrics

Total Teachers · Classes Today · Present · Absent · Affected Classes · Uncovered Classes · Substitutes Assigned · Pending Approval

Compact metric cards, not oversized tiles.

---

## 9. PDFs

- **Daily PDF** — reflects live published changes (substitutions, room changes, cancellations).
- **Weekly PDF** — standard published schedule.
- Both selectable by Course/Section/Batch; practicals must show Batch + Lab + Teacher.
- Generate server-side in Express (e.g., using a PDF library) and serve as a download.

---

## 10. Design System (Quick Reference)

- **Primary:** Indigo `#4F46E5` · **Background:** `#F8FAFC` · **Cards:** `#FFFFFF`
- **Text:** Primary `#0F172A`, Secondary `#64748B`
- **Status colors:** Emerald = success/completed, Amber = changed, Red = cancelled (sparingly), Indigo accent = current/substitute
- **Font:** Inter (system sans fallback); monospace optional for times
- Style: clean SaaS look (Linear/Notion/Stripe quality bar) — thin borders, subtle shadows, dense but readable, no gradients/neon/glassmorphism.
- Never rely on color alone for status — always label text too (e.g., "CANCELLED").

---

## 11. Non-Negotiable Business Rules

1. No student authentication, ever.
2. Only **published** changes are publicly visible.
3. Substitute must be available at the exact time — no exceptions.
4. Substitute must be qualified/eligible for the subject.
5. AI recommends only; it never finalizes.
6. Admin/HOD approval is mandatory for every assignment.
7. Batches are fully dynamic (DB-driven, not hard-coded).
8. Lectures = section-wide; Practicals = batch-specific.
9. All timetable edits pass conflict validation before publishing.
10. Every meaningful admin action is recorded in Audit Log / Change History.

---

## 12. Security

- All authorization enforced **server-side** in Express (never trust frontend role checks).
- Public API routes expose only published, non-sensitive data.
- Protect: attendance data, faculty personal info, admin/timetable-editing endpoints, audit logs.
- Use JWT or session-based auth for Teacher/Admin; role middleware on every protected route.

---

## 13. Build Order (Phased)

1. **Foundation** — auth (Teacher/Admin), course/section/batch/subject/room models, timetable model, public timetable view.
2. **Teacher features** — dashboard, schedule, attendance display, substitute view, notifications.
3. **Admin operations** — dashboard, attendance table, absence → affected/uncovered class detection.
4. **AI assistance** — eligibility filtering, ranking, suitability scoring with explanations, conflict detection.
5. **Timetable admin** — visual editor, batch CRUD, draft/publish flow, conflict checks, change history.
6. **PDFs & polish** — daily/weekly PDF export, notifications, responsive design, accessibility pass.

---

## 14. MVP Checklist

- [ ] Public can browse timetable (Year → Section → Batch, Today/Weekly) with no login
- [ ] Public sees today's changes and can download PDFs
- [ ] Teacher can log in, see schedule + attendance + substitute assignments
- [ ] Admin can log in, see attendance, absences auto-generate uncovered classes
- [ ] AI generates ranked, explainable substitute recommendations
- [ ] Admin can assign/override/reject — action logged in Change History
- [ ] Published changes instantly reflect on public timetable
- [ ] Admin can manage dynamic batches without any code changes
- [ ] Basic responsive layout (desktop/tablet/mobile) and accessible status labels

---

## 15. Definition of Done

No student accounts anywhere · dynamic batches work without code edits · lectures (section) vs practicals (batch) both scheduled correctly · AI enforces availability + qualification and never auto-assigns · Admin approval mandatory · conflicts checked before publish · published changes are public instantly · PDFs match published state · change history is real (no fake "students notified" events) · server-side authorization enforced everywhere.