import React, { useEffect, useState } from 'react';
import api from '../../api';
import Layout from '../../components/Layout';
import { Spinner, Empty, StatusPill, timeFmt, fmtDate, todayStr, Alert } from '../../components/ui';

export default function TeacherSchedule() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    api
      .get('/teacher/schedule', { params: { view: 'today', date: todayStr() } })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load schedule.'));
  }, []);

  const renderSlot = (s) => (
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
      <div className="slot-side"><StatusPill status={s.status} /></div>
    </div>
  );

  return (
    <Layout active="My Schedule">
      <h1 style={{ fontSize: 22 }}>My Schedule</h1>
      <p className="muted" style={{ margin: '4px 0 12px' }}>Today · {fmtDate(todayStr())}</p>
      <Alert type="error">{error}</Alert>

      {!data ? (
        <Spinner />
      ) : (
        <div className="card">
          {!data.slots?.length ? <Empty message="You have no classes today." /> : data.slots.map(renderSlot)}
        </div>
      )}
    </Layout>
  );
}
