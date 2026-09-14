import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  History,
  LayoutDashboard,
  ListChecks,
  School,
  Search,
  ShieldCheck,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  getAdminOverview,
  getBatches,
  getPublicOptions,
  getPublicTimetable,
  getSubstitutionRequests,
  getTeacherDashboard,
  getTodaysChanges
} from "./api";

const fallback = {
  options: {
    courses: [{ id: 1, name: "BCA" }],
    academicYears: [{ id: 1, courseId: 1, name: "SY" }],
    sections: [{ id: 1, academicYearId: 1, name: "A" }],
    batches: [
      { id: 1, sectionId: 1, name: "Batch 1", isActive: true },
      { id: 2, sectionId: 1, name: "Batch 2", isActive: true }
    ]
  },
  slots: [
    {
      id: 1,
      day: "Monday",
      startTime: "09:00",
      endTime: "10:00",
      subject: "Database Management",
      teacher: "Prof. Meera Shah",
      room: "A-204",
      section: "SY-A",
      batch: null,
      sessionType: "Lecture",
      status: "Scheduled"
    },
    {
      id: 2,
      day: "Monday",
      startTime: "10:00",
      endTime: "12:00",
      subject: "Web Development Lab",
      teacher: "Prof. Arjun Sen",
      room: "Lab-2",
      section: "SY-A",
      batch: "Batch 1",
      sessionType: "Practical",
      status: "Substitute"
    },
    {
      id: 3,
      day: "Tuesday",
      startTime: "11:00",
      endTime: "12:00",
      subject: "Software Engineering",
      teacher: "Prof. Nisha Rao",
      room: "B-105",
      section: "SY-A",
      batch: null,
      sessionType: "Lecture",
      status: "Changed"
    }
  ],
  changes: [
    {
      id: 1,
      time: "10:00 - 12:00",
      title: "Web Development Lab",
      detail: "Prof. Kavita Nair assigned as substitute in Lab-2.",
      status: "Substitute"
    },
    {
      id: 2,
      time: "11:00 - 12:00",
      title: "Software Engineering",
      detail: "Room changed from B-104 to B-105.",
      status: "Room Changed"
    }
  ],
  teacher: {
    name: "Prof. Kavita Nair",
    attendance: "Present",
    notifications: 3,
    schedule: [
      { id: 1, time: "09:00 - 10:00", subject: "Python", className: "FY-A", room: "A-101", status: "Scheduled" },
      { id: 2, time: "10:00 - 12:00", subject: "Web Development Lab", className: "SY-A Batch 1", room: "Lab-2", status: "Substitute" }
    ],
    substitutions: [
      { id: 1, subject: "Web Development Lab", className: "SY-A Batch 1", time: "Today, 10:00 - 12:00", status: "Awaiting Acceptance" }
    ]
  },
  admin: {
    metrics: {
      totalTeachers: 18,
      classesToday: 36,
      present: 16,
      absent: 2,
      affectedClasses: 5,
      uncoveredClasses: 2,
      substitutesAssigned: 3,
      pendingApproval: 2
    }
  },
  requests: [
    {
      id: 1,
      className: "SY-A Batch 1",
      subject: "Web Development Lab",
      absentTeacher: "Prof. Arjun Sen",
      date: "2026-09-14",
      time: "10:00 - 12:00",
      status: "Pending Approval",
      candidates: [
        { id: 4, name: "Prof. Kavita Nair", score: 91, reasons: ["Available", "Qualified", "No consecutive conflict"] },
        { id: 5, name: "Prof. Ritesh Das", score: 78, reasons: ["Available", "Qualified", "Higher workload today"] }
      ]
    }
  ],
  batches: [
    { id: 1, course: "BCA", year: "SY", section: "A", name: "Batch 1", isActive: true },
    { id: 2, course: "BCA", year: "SY", section: "A", name: "Batch 2", isActive: true },
    { id: 3, course: "BCA", year: "SY", section: "A", name: "Batch 3", isActive: false }
  ]
};

const views = [
  { id: "public", label: "Public", icon: School },
  { id: "teacher", label: "Teacher", icon: BookOpen },
  { id: "admin", label: "Admin", icon: ShieldCheck }
];

function useApiData(loader, fallbackData) {
  const [data, setData] = useState(fallbackData);
  const [state, setState] = useState("loading");

  useEffect(() => {
    let active = true;

    loader()
      .then((payload) => {
        if (active) {
          setData(payload);
          setState("live");
        }
      })
      .catch(() => {
        if (active) {
          setData(fallbackData);
          setState("fallback");
        }
      });

    return () => {
      active = false;
    };
  }, [loader, fallbackData]);

  return { data, state };
}

function StatusBadge({ status }) {
  const key = status.toLowerCase().replace(/\s+/g, "-");
  return <span className={`status status-${key}`}>{status}</span>;
}

function Header({ activeView, setActiveView }) {
  return (
    <header className="app-header">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          CT
        </div>
        <div>
          <p className="eyebrow">CampusTime</p>
          <h1>Smart timetable and substitution control</h1>
        </div>
      </div>
      <nav className="view-tabs" aria-label="Primary views">
        {views.map(({ id, label, icon: Icon }) => (
          <button
            className={activeView === id ? "tab active" : "tab"}
            key={id}
            onClick={() => setActiveView(id)}
            type="button"
          >
            <Icon size={17} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}

function PublicView() {
  const optionsResult = useApiData(getPublicOptions, fallback.options);
  const timetableResult = useApiData(() => getPublicTimetable({ view: "week" }), { slots: fallback.slots });
  const changesResult = useApiData(getTodaysChanges, { changes: fallback.changes });

  const academicYears = optionsResult.data.academicYears ?? [];
  const sections = optionsResult.data.sections ?? [];
  const batches = optionsResult.data.batches ?? [];
  const slots = timetableResult.data.slots ?? fallback.slots;
  const changes = changesResult.data.changes ?? fallback.changes;

  return (
    <main className="page-grid" id="main-content">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Public timetable</p>
          <h2>Published schedules only, with today&apos;s updates clearly labeled.</h2>
          <p>
            Students can browse without logging in. Practical sessions show the batch, while lectures stay section-wide.
          </p>
        </div>
        <div className="hero-actions">
          <button className="button primary" type="button">
            <CalendarDays size={18} aria-hidden="true" />
            Weekly
          </button>
          <button className="button secondary" type="button">
            <Clock3 size={18} aria-hidden="true" />
            Today
          </button>
        </div>
      </section>

      <section className="toolbar" aria-label="Timetable filters">
        <label>
          Academic year
          <select defaultValue={academicYears[0]?.id ?? ""}>
            {academicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Section
          <select defaultValue={sections[0]?.id ?? ""}>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Batch
          <select defaultValue="all">
            <option value="all">All batches</option>
            {batches
              .filter((batch) => batch.isActive)
              .map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
          </select>
        </label>
        <button className="button secondary" type="button">
          <Search size={18} aria-hidden="true" />
          Apply
        </button>
        <button className="button ghost" type="button">
          <Download size={18} aria-hidden="true" />
          PDF
        </button>
      </section>

      <section className="content-section">
        <SectionHeading title="Weekly Timetable" subtitle={`Data source: ${timetableResult.state}`} />
        <TimetableTable slots={slots} />
      </section>

      <aside className="side-panel">
        <SectionHeading title="Today's Changes" subtitle={`Data source: ${changesResult.state}`} />
        <div className="change-list">
          {changes.map((change) => (
            <article className="change-item" key={change.id}>
              <div className="change-time">{change.time}</div>
              <h3>{change.title}</h3>
              <p>{change.detail}</p>
              <StatusBadge status={change.status} />
            </article>
          ))}
        </div>
      </aside>
    </main>
  );
}

function TeacherView() {
  const { data, state } = useApiData(getTeacherDashboard, fallback.teacher);

  return (
    <main className="page-grid" id="main-content">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Teacher dashboard</p>
          <h2>{data.name}</h2>
          <p>Today&apos;s schedule, attendance status, substitution assignments, and notifications in one place.</p>
        </div>
        <div className="metric-strip">
          <MiniMetric label="Attendance" value={data.attendance} />
          <MiniMetric label="Notifications" value={data.notifications} />
          <MiniMetric label="Source" value={state} />
        </div>
      </section>

      <section className="content-section">
        <SectionHeading title="My Schedule" subtitle="Only confirmed or assigned classes are shown here." />
        <div className="schedule-list">
          {data.schedule.map((slot) => (
            <article className="schedule-row" key={slot.id}>
              <Clock3 size={18} aria-hidden="true" />
              <div>
                <strong>{slot.time}</strong>
                <span>{slot.subject}</span>
              </div>
              <div>
                <strong>{slot.className}</strong>
                <span>{slot.room}</span>
              </div>
              <StatusBadge status={slot.status} />
            </article>
          ))}
        </div>
      </section>

      <aside className="side-panel">
        <SectionHeading title="Substitute Assignments" subtitle="Teachers can accept or request review." />
        {data.substitutions.map((assignment) => (
          <article className="assignment-card" key={assignment.id}>
            <h3>{assignment.subject}</h3>
            <p>{assignment.className}</p>
            <span>{assignment.time}</span>
            <StatusBadge status={assignment.status} />
            <div className="button-row">
              <button className="button primary" type="button">
                Accept
              </button>
              <button className="button secondary" type="button">
                Review
              </button>
            </div>
          </article>
        ))}
      </aside>
    </main>
  );
}

function AdminView() {
  const overview = useApiData(getAdminOverview, fallback.admin);
  const requests = useApiData(getSubstitutionRequests, { requests: fallback.requests });
  const batches = useApiData(getBatches, { batches: fallback.batches });

  const metrics = overview.data.metrics ?? fallback.admin.metrics;

  return (
    <main className="admin-layout" id="main-content">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Admin / HOD control</p>
          <h2>Absence handling, recommendations, approvals, and published changes.</h2>
          <p>AI suggests qualified and available faculty only. Final assignment stays with Admin or HOD approval.</p>
        </div>
        <button className="button primary" type="button">
          <ClipboardCheck size={18} aria-hidden="true" />
          Run conflict check
        </button>
      </section>

      <section className="metric-grid" aria-label="Admin dashboard metrics">
        {Object.entries(metrics).map(([key, value]) => (
          <MetricCard key={key} label={formatLabel(key)} value={value} />
        ))}
      </section>

      <section className="admin-columns">
        <div className="content-section">
          <SectionHeading title="Substitution Queue" subtitle={`Data source: ${requests.state}`} />
          <div className="request-list">
            {(requests.data.requests ?? fallback.requests).map((request) => (
              <article className="request-card" key={request.id}>
                <div className="request-topline">
                  <div>
                    <h3>{request.subject}</h3>
                    <p>
                      {request.className} - {request.time}
                    </p>
                  </div>
                  <StatusBadge status={request.status} />
                </div>
                <p className="muted">Absent: {request.absentTeacher}</p>
                <div className="candidate-list">
                  {request.candidates.map((candidate) => (
                    <div className="candidate" key={candidate.id}>
                      <div>
                        <strong>{candidate.name}</strong>
                        <span>{candidate.reasons.join(" - ")}</span>
                      </div>
                      <span className="score">{candidate.score}/100</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="side-panel">
          <SectionHeading title="Dynamic Batches" subtitle={`Data source: ${batches.state}`} />
          <div className="batch-list">
            {(batches.data.batches ?? fallback.batches).map((batch) => (
              <article className="batch-row" key={batch.id}>
                <div>
                  <strong>
                    {batch.course} {batch.year}-{batch.section}
                  </strong>
                  <span>{batch.name}</span>
                </div>
                <StatusBadge status={batch.isActive ? "Active" : "Inactive"} />
              </article>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}

function SectionHeading({ title, subtitle }) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function TimetableTable({ slots }) {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const groupedSlots = useMemo(
    () =>
      days.map((day) => ({
        day,
        slots: slots.filter((slot) => slot.day === day)
      })),
    [slots]
  );

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Day</th>
            <th>Time</th>
            <th>Subject</th>
            <th>Class</th>
            <th>Teacher</th>
            <th>Room</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {groupedSlots.map(({ day, slots: daySlots }) =>
            daySlots.length ? (
              daySlots.map((slot, index) => (
                <tr key={slot.id}>
                  {index === 0 ? <th rowSpan={daySlots.length}>{day}</th> : null}
                  <td>
                    {slot.startTime} - {slot.endTime}
                  </td>
                  <td>
                    <strong>{slot.subject}</strong>
                    <span>{slot.sessionType}</span>
                  </td>
                  <td>
                    {slot.section}
                    {slot.batch ? ` - ${slot.batch}` : ""}
                  </td>
                  <td>{slot.teacher}</td>
                  <td>{slot.room}</td>
                  <td>
                    <StatusBadge status={slot.status} />
                  </td>
                </tr>
              ))
            ) : (
              <tr key={day}>
                <th>{day}</th>
                <td colSpan="6" className="empty-cell">
                  No published classes
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <article className="metric-card">
      <LayoutDashboard size={18} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatLabel(key) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

export default function App() {
  const [activeView, setActiveView] = useState("public");

  return (
    <div className="app-shell">
      <Header activeView={activeView} setActiveView={setActiveView} />
      {activeView === "public" ? <PublicView /> : null}
      {activeView === "teacher" ? <TeacherView /> : null}
      {activeView === "admin" ? <AdminView /> : null}
      <footer className="app-footer">
        <span>
          <CheckCircle2 size={16} aria-hidden="true" />
          Public data is published-only
        </span>
        <span>
          <History size={16} aria-hidden="true" />
          Admin actions will be audit logged
        </span>
        <span>
          <Bell size={16} aria-hidden="true" />
          Notifications queued for role users
        </span>
        <span>
          <ListChecks size={16} aria-hidden="true" />
          Dynamic batches remain database-driven
        </span>
        <span>
          <Users size={16} aria-hidden="true" />
          No student login
        </span>
      </footer>
    </div>
  );
}
