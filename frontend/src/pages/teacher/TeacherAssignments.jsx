import React, { useEffect, useState } from 'react';
import api from '../../api';
import Layout from '../../components/Layout';
import { Spinner, Empty, StatusPill, timeFmt, fmtDate, Alert } from '../../components/ui';

export default function TeacherAssignments() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    api
      .get('/teacher/assignments')
      .then((res) => setItems(res.data.assignments))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load assignments.'));
  };
  useEffect(load, []);

  const respond = async (id, action) => {
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      const res = await api.post(`/teacher/assignments/${id}/respond`, {
        action,
        reason: action === 'review' ? 'Requested review' : action === 'decline' ? 'Teacher declined' : null,
      });
      setNotice(res.data.message);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Layout active="Substitute Assignments">
      <h1 style={{ fontSize: 22 }}>Substitute Assignments</h1>
      <p className="muted" style={{ margin: '4px 0 12px' }}>
        Classes assigned to you as a substitute. Accept, decline, or request admin review.
      </p>
      <Alert type="error">{error}</Alert>
      <Alert type="success">{notice}</Alert>

      {!items ? (
        <Spinner />
      ) : !items.length ? (
        <div className="card"><Empty message="No substitute assignments yet." /></div>
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th><th>Time</th><th>Subject</th><th>Original teacher</th>
                <th>Section / Batch</th><th>Room</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td>{fmtDate(a.date)}</td>
                  <td className="mono">{timeFmt(a.start_time)}–{timeFmt(a.end_time)}</td>
                  <td>{a.subject_name}</td>
                  <td>{a.original_teacher_name}</td>
                  <td>{a.section_name}{a.batch_name ? ` · ${a.batch_name}` : ''}</td>
                  <td>{a.room_name}</td>
                  <td><StatusPill status={a.assignment_status} /></td>
                  <td>
                    {a.assignment_status === 'pending' || a.assignment_status === 'review' ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn emerald sm" disabled={busyId === a.id} onClick={() => respond(a.id, 'accept')}>
                          Accept
                        </button>
                        <button className="btn sm" disabled={busyId === a.id} onClick={() => respond(a.id, 'decline')}>
                          Decline
                        </button>
                        <button className="btn sm" disabled={busyId === a.id} onClick={() => respond(a.id, 'review')}>
                          Request review
                        </button>
                      </div>
                    ) : (
                      <span className="muted small">{a.assignment_status === 'accepted' ? 'All set' : 'Closed'}</span>
                    )}
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