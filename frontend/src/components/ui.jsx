import React from 'react';

export function Spinner({ label }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <div className="spinner" />
      {label ? <p className="muted small">{label}</p> : null}
    </div>
  );
}

export function Empty({ message = 'Nothing here yet.' }) {
  return <div className="empty">{message}</div>;
}

export function Alert({ type = 'info', children }) {
  if (!children) return null;
  return <div className={`alert ${type}`}>{children}</div>;
}

export function statusPill(status) {
  const s = String(status || '').toUpperCase();
  let cls = 'slate';
  if (s === 'SUBSTITUTE' || s === 'SUBSTITUTED' || s === 'CURRENT' || s === 'OPEN') cls = 'indigo';
  else if (s === 'CANCELLED' || s === 'REJECTED' || s === 'DECLINED' || s === 'CANCEL') cls = 'red';
  else if (s === 'CHANGED' || s === 'ROOM CHANGED' || s === 'RESCHEDULED' || s === 'PENDING') cls = 'amber';
  else if (s === 'COMPLETED' || s === 'ACCEPTED' || s === 'APPROVED' || s === 'FILLED' || s === 'PRESENT') cls = 'emerald';
  return cls;
}

export function StatusPill({ status }) {
  let label = (status || '—').toString();
  if (label === 'EMPTY') label = '—';
  return (
    <span className={`pill ${statusPill(status)}`}>
      <span className="dot" />
      {label}
    </span>
  );
}

export function Metric({ label, value, hint, tone }) {
  return (
    <div className="metric">
      <div className="m-label">{label}</div>
      <div className={`m-value ${tone || ''}`}>{value == null ? '—' : value}</div>
      {hint ? <div className="m-hint">{hint}</div> : null}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

export function timeFmt(t) {
  return String(t || '').slice(0, 5);
}

export function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = String(d).slice(0, 10).split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${names[Number(m) - 1]} ${y}`;
}

export function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}