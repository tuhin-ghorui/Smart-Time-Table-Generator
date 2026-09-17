import React, { useEffect, useState } from 'react';
import api from '../../api';
import Layout from '../../components/Layout';
import { Spinner, Empty, StatusPill, timeFmt, fmtDate, Alert } from '../../components/ui';

export default function Approvals() {
  const [changes, setChanges] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () => {
    api.get('/admin/pending-changes')
      .then((res) => setChanges(res.data.changes))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load pending changes.'));
  };
  useEffect(load, []);

  const approve = async (id) => {
    setError('');
    try {
      const res = await api.post(`/admin/timetable/changes/${id}/approve`);
      setNotice(res.data.message);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve.');
    }
  };

  const reject = async (id) => {
    setError('');
    try {
      const res = await api.post(`/admin/timetable/changes/${id}/reject`);
      setNotice(res.data.message);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject.');
    }
  };

  return (
    <Layout active="Pending Approvals">
      <h1 style={{ fontSize: 22 }}>Pending Approvals</h1>
      <p className="muted" style={{ margin: '4px 0 12px' }}>
        Every published change requires admin/HOD approval. Approval makes it instantly visible on the public timetable and logs it in Change History.
      </p>
      <Alert type="error">{error}</Alert>
      <Alert type="success">{notice}</Alert>

      {!changes ? (
        <Spinner />
      ) : !changes.length ? (
        <div className="card"><Empty message="No pending changes awaiting approval." /></div>
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Created</th><th>Session</th><th>Type</th><th>Change</th><th></th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <tr key={c.id}>
                  <td className="small muted">{new Date(c.created_at).toLocaleString()}</td>
                  <td>
                    <strong>{c.subject_name}</strong>
                    <div className="muted small">{c.day} {timeFmt(c.start_time)}–{timeFmt(c.end_time)} · {c.section_name}{c.batch_name ? ` · ${c.batch_name}` : ''} · {c.teacher_name}</div>
                  </td>
                  <td><StatusPill status={c.change_type} /></td>
                  <td className="small">
                    <span className="muted">Old:</span> <code>{String(c.old_value).slice(0, 80)}</code><br />
                    <span className="muted">New:</span> <code>{String(c.new_value).slice(0, 80)}</code>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn emerald sm" onClick={() => approve(c.id)}>Approve & publish</button>
                      <button className="btn sm danger" onClick={() => reject(c.id)}>Reject</button>
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