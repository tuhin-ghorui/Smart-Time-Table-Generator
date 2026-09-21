import React, { useEffect, useState } from 'react';
import api from '../../api';
import Layout from '../../components/Layout';
import { Spinner, Empty, Alert, StatusPill, todayStr } from '../../components/ui';

export default function Attendance() {
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = (d) => {
    setData(null);
    setError('');
    api
      .get('/admin/attendance', { params: { date: d } })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load attendance.'));
  };
  useEffect(() => load(date), [date]);

  return (
    <Layout active="Faculty Attendance">
      <h1 style={{ fontSize: 22 }}>Faculty Attendance</h1>
      <p className="muted" style={{ margin: '4px 0 12px' }}>
        Attendance is self-reported by teachers on their dashboard. This view is read-only. Absent / Leave marks automatically create substitution requests.
        {data?.unmarked ? <strong> {data.unmarked} teacher(s) have not marked yet.</strong> : null}
      </p>
      <div className="toolbar">
        <div className="field">
          <label className="field-label">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <Alert type="error">{error}</Alert>

      {!data ? (
        <Spinner />
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Teacher</th><th>Department</th><th>Classes Today</th><th>Status</th><th>Reason / Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.teachers.map((t) => (
                <tr key={t.teacher_id}>
                  <td><strong>{t.name}</strong></td>
                  <td className="muted">{t.department}</td>
                  <td>{t.classes_today}</td>
                  <td>{t.status ? <StatusPill status={t.status} /> : <span className="muted small">Unmarked</span>}</td>
                  <td className="small muted">
                    {t.reason || (t.synced_at ? `Updated ${String(t.synced_at).slice(0, 16).replace('T', ' ')}` : '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}