import React from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Section({ title, children }) {
  return (
    <>
      <div className="nav-group">{title}</div>
      {children}
    </>
  );
}

export default function Layout({ children, active }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';
  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">CT</div>
          <div>
            <div className="brand-name">CampusTime</div>
            <div className="brand-sub">Timetable & Substitution</div>
          </div>
        </div>

        {isTeacher && (
          <Section title="Teacher">
            <NavLink to="/teacher/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="ico">▦</span> Dashboard
            </NavLink>
            <NavLink to="/teacher/schedule" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="ico">🗓</span> My Schedule
            </NavLink>
            <NavLink to="/teacher/assignments" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="ico">⇄</span> Substitute Assignments
            </NavLink>
            <NavLink to="/teacher/notifications" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="ico">🔔</span> Notifications
            </NavLink>
          </Section>
        )}

        {isAdmin && (
          <>
            <Section title="Admin">
              <NavLink to="/admin/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span className="ico">▦</span> Overview
              </NavLink>
              <NavLink to="/admin/attendance" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span className="ico">✓</span> Faculty Attendance
              </NavLink>
              <NavLink to="/admin/substitutions" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span className="ico">⇄</span> Substitutions
              </NavLink>
              <NavLink to="/admin/timetable" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span className="ico">🗓</span> Timetable Editor
              </NavLink>
              <NavLink to="/admin/batches" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span className="ico">♺</span> Batch Management
              </NavLink>
              <NavLink to="/admin/approvals" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span className="ico">◎</span> Pending Approvals
              </NavLink>
              <NavLink to="/admin/history" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span className="ico">↺</span> Change History
              </NavLink>
              <NavLink to="/admin/notifications" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span className="ico">🔔</span> Notifications
              </NavLink>
            </Section>
          </>
        )}

        <Section title="Portals">
          <Link to="/" className="nav-link">
            <span className="ico">🌐</span> Public Timetable
          </Link>
        </Section>

        <Section title="Session">
          <span className="nav-link" onClick={handleLogout} style={{ cursor: 'pointer' }}>
            <span className="ico">⏻</span> Sign out
          </span>
        </Section>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="crumb">
            <strong>CampusTime</strong>
            {active ? <> / <span style={{ color: 'var(--text-2)' }}>{active}</span></> : null}
          </div>
          <div className="user-chip">
            <span className="avatar">{initials}</span>
            <span>{user?.name}</span>
            <span className="role-pill">{isAdmin ? 'Admin / HOD' : 'Teacher'}</span>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}