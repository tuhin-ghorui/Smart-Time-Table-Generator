import React from 'react';
import { Link } from 'react-router-dom';

export default function PublicLayout({ children, active }) {
  return (
    <div className="main" style={{ flex: 1 }}>
      <header className="topbar">
        <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0, padding: 0, border: 'none' }}>
          <div className="brand-mark">CT</div>
          <div>
            <div className="brand-name">CampusTime</div>
            <div className="brand-sub" style={{ display: 'none' }}>Public Timetable</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="role-pill public">Public Viewer</span>
          <Link to="/login" className="btn sm">Sign in</Link>
        </div>
      </header>
      <div className="content">{children}</div>
    </div>
  );
}