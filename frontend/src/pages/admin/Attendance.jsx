import React, { useEffect, useState } from 'react';
import api from '../../api';
import Layout from '../../components/Layout';
import { Spinner, Empty, Alert, StatusPill, todayStr, fmtDate } from '../../components/ui';

const STATUS_OPTIONS = ['present', 'absent', 'leave'];

export default function Attendance() {
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({});

  const load = (d) => {
    setData(null);
    setError('');
    api
      .get('/admin/attendance', { params: { date: d } })
      .then((res) => {
        setData(res.data);
        const map = {};
        res.data.teachers.forEach((t) => {
          map[t.teacher_id] = t.status || '';
        });
        setDraft(map);
      })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load attendance.'));
  };
  useEffect(() => load(date), [date]);

  const save = async (teacherId, status) => {
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const res = await api.post('/admin/attendance', { date, teacher_id: teacherId, status });
      setNotice(res.data.message);
      setDraft((m) => ({ ...m, [teacherId]: status }));
      load(date);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const res = await api.post(`/admin/attendance/generate-requests?date=${date}`);
      const was = data?.teachers || [];
      const absent = was.filter((t) => ['absent', 'leave'].includes(t.status));
      setNotice(`${res.data.created} uncovered class(es) became substitution requests for ${fmtDate(date)}.` + (absent.length ? ' Affected teachers: ' + absent.map((t) => t.name).join(', ') + '.' : ''));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout active="Faculty Attendance">
      <h1 style={{ fontSize: 22 }}>Faculty Attendance</h1>
      <div className="toolbar">
        <div className="field">
          <label className="field-label">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button className="btn primary" disabled={busy} onClick={generate}>
          Generate uncovered classes
        </button>
      </div>
      <Alert type="error">{error}</Alert>
      <Alert type="success">{notice}</Alert>

      {!data ? (
        <Spinner />
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Teacher</th><th>Department</th><th>Classes Today</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {data.teachers.map((t) => (
                <tr key={t.teacher_id}>
                  <td><strong>{t.name}</strong></td>
                  <td className="muted">{t.department}</td>
                  <td>{t.classes_today}</td>
                  <td>{t.status ? <StatusPill status={t.status} /> : <span className="muted small">Unmarked</span>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {STATUS_OPTIONS.map((s) => (
                        <button
                          key={s}
                          className={`btn sm ${draft[t.teacher_id] === s ? 'primary' : ''}`}
                          disabled={busy}
                          onClick={() => save(t.teacher_id, s)}
                        >
                          {s[0].toUpperCase() + s.slice(1)}
                        </button>
                      ))}
                    </div>
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