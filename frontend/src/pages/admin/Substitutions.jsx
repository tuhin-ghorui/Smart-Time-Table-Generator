import React, { useEffect, useState } from 'react';
import api from '../../api';
import Layout from '../../components/Layout';
import { Spinner, Empty, StatusPill, timeFmt, fmtDate, todayStr, Alert } from '../../components/ui';

export default function Substitutions() {
  const [date, setDate] = useState(todayStr());
  const [requests, setRequests] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState(null); // { request, candidates, assignment }
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState('');

  const load = (d) => {
    setRequests(null);
    api
      .get('/admin/requests', { params: { date: d } })
      .then((res) => setRequests(res.data.requests))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load requests.'));
    api
      .get('/admin/attendance', { params: { date: d } })
      .then((res) => {
        const counts = (res.data.teachers || []).reduce(
          (acc, t) => {
            if (t.status === 'present') acc.present += 1;
            else if (t.status === 'absent' || t.status === 'leave') acc.absent += 1;
            else acc.unmarked += 1;
            return acc;
          },
          { present: 0, absent: 0, unmarked: 0 }
        );
        setAttendance({ ...counts, total: res.data.teachers?.length || 0 });
      })
      .catch(() => setAttendance(null));
  };
  useEffect(() => load(date), [date]);
  useEffect(() => { setError(''); setNotice(''); }, [date]);

  const openDetail = async (id) => {
    setLoadingDetail(true);
    setError('');
    try {
      const res = await api.get(`/admin/requests/${id}`);
      setDetail(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load request.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const act = async (requestId, teacherId, action) => {
    setBusy(`${action}:${teacherId}`);
    setError('');
    setNotice('');
    try {
      const res = await api.post('/admin/assignments', { request_id: requestId, teacher_id: teacherId, action });
      setNotice(res.data.message);
      load(date);
      if (detail?.request?.request_id === requestId) openDetail(requestId);
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed.');
    } finally {
      setBusy('');
    }
  };

  return (
    <Layout active="Substitutions">
      <h1 style={{ fontSize: 22 }}>Substitution Management</h1>
      <p className="muted" style={{ margin: '4px 0 12px' }}>
        Uncovered classes become substitution requests. Pick a present teacher to cover — you decide.
      </p>
      <div className="toolbar">
        <div className="field">
          <label className="field-label">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {attendance && (
        <div className="card" style={{ marginBottom: 12, padding: '10px 14px' }}>
          <strong>Faculty status · {fmtDate(date)}: </strong>
          <span className="pill emerald"><span className="dot" />Present {attendance.present}</span>{' '}
          <span className="pill red"><span className="dot" />Absent {attendance.absent}</span>{' '}
          <span className="pill slate"><span className="dot" />Unmarked {attendance.unmarked}</span>{' '}
          <span className="muted small">— only teachers marked Present are eligible as substitutes.</span>
        </div>
      )}

      <Alert type="error">{error}</Alert>
      <Alert type="success">{notice}</Alert>

      {!requests ? (
        <Spinner />
      ) : !requests.length ? (
        <div className="card"><Empty message="No substitution requests for this date. Mark an absence and generate uncovered classes first." /></div>
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Time</th><th>Subject</th><th>Teacher (absent)</th><th>Year · Section / Batch</th>
                <th>Room</th><th>Type</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.request_id}>
                  <td className="mono">{timeFmt(r.start_time)}–{timeFmt(r.end_time)}</td>
                  <td>{r.subject_name}</td>
                  <td>{r.teacher_name}</td>
                  <td>{r.year_name}{r.year_name ? ' · ' : ''}{r.section_name}{r.batch_name ? ` · ${r.batch_name}` : ' (full section)'}</td>
                  <td>{r.room_name}</td>
                  <td>{r.session_type}</td>
                  <td><StatusPill status={r.request_status} /></td>
                  <td>
                    <button className="btn sm primary" onClick={() => openDetail(r.request_id)}>
                      Assign
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <div>
                <h3>Substitution Request #{detail.request.request_id}</h3>
                <p className="muted small">
                  {detail.request.subject_name} · {fmtDate(detail.request.date)} · {detail.request.year_name}
                  {detail.request.year_name ? ' · ' : ''}{detail.request.section_name}
                  {detail.request.batch_name ? ` · ${detail.request.batch_name}` : ''} ·{' '}
                  {timeFmt(detail.request.start_time)}–{timeFmt(detail.request.end_time)} · {detail.request.room_name}
                </p>
                <p className="muted small">Original teacher: {detail.request.teacher_name}</p>
              </div>
              <button className="modal-close" onClick={() => setDetail(null)}>×</button>
            </div>

            {loadingDetail ? (
              <Spinner />
            ) : (
              <>
                {detail.assignment ? (
                  <Alert type={detail.assignment.status === 'accepted' ? 'success' : 'info'}>
                    <strong>Assignment:</strong> {detail.assignment.assigned_teacher_name} — status{' '}
                    {String(detail.assignment.status).toUpperCase()} (by {detail.assignment.status === 'pending' ? 'pending teacher response' : 'admin'})
                  </Alert>
                ) : null}

                <h4 style={{ margin: '18px 0 6px', fontSize: 13 }}>Present teachers</h4>
                <p className="muted small" style={{ margin: '0 0 8px' }}>
                  Teachers marked Present for {fmtDate(detail.request.date)} who are free and qualified for this slot. Absent, leave and unmarked teachers are excluded.
                </p>
                {!detail.candidates?.length ? (
                  <Empty message="No present, available teacher found for this slot." />
                ) : (
                  [...detail.candidates]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((c) => (
                      <div key={c.teacher_id} className="card" style={{ padding: '12px 14px', marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                          <div>
                            <strong>{c.name}</strong>
                            <span className="muted small" style={{ marginLeft: 8 }}>{c.department}</span>
                          </div>
                          <button
                            className="btn primary sm"
                            disabled={busy === `assign:${c.teacher_id}` || busy === `override:${c.teacher_id}`}
                            onClick={() => act(detail.request.request_id, c.teacher_id, detail.request.request_status === 'filled' ? 'override' : 'assign')}
                          >
                            {detail.request.request_status === 'filled' ? 'Override' : 'Assign'}
                          </button>
                        </div>
                      </div>
                    ))
                )}

                {detail.request.request_status === 'open' && (
                  <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn danger" disabled={!!busy} onClick={() => act(detail.request.request_id, 0, 'reject')}>
                      Reject request (cancel class)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}