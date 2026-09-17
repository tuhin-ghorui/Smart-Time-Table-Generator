import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import Layout from '../../components/Layout';
import { Metric, Spinner, Empty, StatusPill, timeFmt, todayStr, Alert } from '../../components/ui';

export default function TeacherDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/teacher/dashboard')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load.'));
  }, []);

  return (
    <Layout active="Dashboard">
      <h1 style={{ fontSize: 22 }}>Dashboard</h1>
      <p className="muted" style={{ margin: '4px 0 12px' }}>
        Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {data?.today || '—'} schedule below.
      </p>
      <Alert type="error">{error}</Alert>

      {!data ? (
        <Spinner />
      ) : (
        <>
          <div className="metrics">
            <Metric label="Classes Today" value={data.slots_today} tone="ok" />
            <Metric label="Hours Today" value={data.hours_today} />
            <Metric label="Pending Subs" value={data.pending_subs} tone={data.pending_subs ? 'warn' : ''} />
            <Metric label="Active Subs" value={data.active_subs} tone="ok" />
            <Metric label="Unread Notifications" value={data.unread} tone={data.unread ? 'warn' : ''} />
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