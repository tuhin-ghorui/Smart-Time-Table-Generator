import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import Layout from '../../components/Layout';
import { Metric, Spinner, Empty, StatusPill, timeFmt, todayStr, Alert } from '../../components/ui';

const ATT_STATUSES = ['present', 'absent'];

export default function TeacherDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    api
      .get('/teacher/dashboard')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load.'));
  };
  useEffect(load, []);

  const markAttendance = async (status) => {
    setSaving(true);
    setError('');
    try {
      await api.post('/teacher/attendance', { date: todayStr(), status });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update attendance.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout active="Dashboard">
      <h1 style={{ fontSize: 22 }}>Dashboard</h1>
      <p className="muted" style={{ margin: '4px 0 12px' }}>
        Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {data?.today || '—'} schedule below.
      </p>
      <Alert type="error">{error}</Alert>

      {data && data.attendance_status === 'unmarked' && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-top">
              <div>
                <h3>Attendance Check-in · {todayStr()}</h3>
                <p className="muted small">Are you present for the day? Your HOD sees this on the admin dashboard.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button className="btn primary" disabled={saving} style={{ flex: 1, justifyContent: 'center' }} onClick={() => markAttendance('present')}>
                Present
              </button>
              <button className="btn danger" disabled={saving} style={{ flex: 1, justifyContent: 'center' }} onClick={() => markAttendance('absent')}>
                Absent
              </button>
            </div>
            <p className="muted small" style={{ marginTop: 10 }}>
              You can only mark once — your status cannot be changed later today.
            </p>
          </div>
        </div>
      )}

      {!data ? (
        <Spinner />
      ) : (
        <>
          <div className="metrics">
            <Metric label="Classes Today" value={data.slots_today} tone="ok" />
            <Metric label="Hours Today" value={data.hours_today} />
            <Metric label="Pending Subs" value={data.pending_subs} tone={data.pending_subs ? 'warn' : ''} />
            <Metric label="Active Subs" value={data.active_subs} tone="ok" />
          </div>

          <div className="card">
            <div className="card-title">
              <span>My Attendance · {todayStr()}</span>
              <>
                {data.attendance_status !== 'unmarked' ? (
                  <StatusPill status={data.attendance_status} />
                ) : (
                  <span className="pill slate"><span className="dot" />UNMARKED</span>
                )}
              </>
            </div>
            <p className="muted small" style={{ margin: '0 0 10px' }}>
              Mark your status for today. This is what your HOD sees on the admin dashboard. Once marked, it stays for the day.
            </p>
            <div className="seg">
              {ATT_STATUSES.map((s) => (
                <button
                  key={s}
                  className={data.attendance_status === s ? 'active' : ''}
                  disabled={saving || data.attendance_status !== 'unmarked'}
                  onClick={() => markAttendance(s)}
                >
                  {s[0].toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <span>Today's Classes</span>
              <Link to="/teacher/schedule" className="btn sm">Full schedule →</Link>
            </div>
            {!data.today_slots?.length ? (
              <Empty message="No classes scheduled today." />
            ) : (
              data.today_slots.map((s) => (
                <div className="slot-row" key={s.id}>
                  <div className="slot-time">
                    {timeFmt(s.start_time)}
                    <br />
                    <span className="muted" style={{ fontWeight: 400 }}>{timeFmt(s.end_time)}</span>
                  </div>
                  <div className="slot-main">
                    <div className="slot-subject">{s.subject_name}</div>
                    <div className="slot-meta">
                      {s.section_name} · {s.year_name} · {s.batch_name || 'Full section'} · {s.room_name}
                    </div>
                  </div>
                  <div className="slot-side">
                    <StatusPill status={s.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </Layout>
  );
}