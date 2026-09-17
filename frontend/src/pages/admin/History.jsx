import React, { useEffect, useState } from 'react';
import api from '../../api';
import Layout from '../../components/Layout';
import { Spinner, Empty, StatusPill, timeFmt, fmtDate, Alert } from '../../components/ui';

export default function History() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('changes');

  useEffect(() => {
    api.get('/admin/history')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load history.'));
  }, []);

  return (
    <Layout active="Change History">
      <h1 style={{ fontSize: 22 }}>Change History</h1>
      <p className="muted" style={{ margin: '4px 0 12px' }}>
        Every approved timetable change and every meaningful admin action, in full.
      </p>
      <Alert type="error">{error}</Alert>

      <div className="toolbar">
        <div className="seg">
          <button className={tab === 'changes' ? 'active' : ''} onClick={() => setTab('changes')}>Published changes</button>
          <button className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}>Audit log</button>
        </div>
      </div>

      {!data ? (
        <Spinner />
      ) : tab === 'changes' ? (
        data.published.length ? (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Published</th><th>Type</th><th>Session</th><th>Old</th><th>New</th><th>Approved by</th></tr>
              </thead>
              <tbody>
                {data.published.map((c) => (
                  <tr key={c.id}>
                    <td className="small muted">{fmtDate(String(c.published_at).slice(0, 10))} {new Date(c.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td><StatusPill status={c.change_type} /></td>
                    <td>
                      <strong>{c.subject_name}</strong>
                      <div className="muted small">{c.day} {timeFmt(c.start_time)} · {c.section_name}{c.batch_name ? ` · ${c.batch_name}` : ''} · {c.room_name}</div>
                    </td>
                    <td className="small">{String(c.old_value).slice(0, 70)}</td>
                    <td className="small">{String(c.new_value).slice(0, 70)}</td>
                    <td className="small muted">{c.approved_by_name || 'admin'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card"><Empty message="No published changes yet." /></div>
        )
      ) : data.audit.length ? (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Old</th><th>New</th><th>Reason</th></tr>
            </thead>
            <tbody>
              {data.audit.map((a) => (
                <tr key={a.id}>
                  <td className="small muted">{new Date(a.created_at).toLocaleString()}</td>
                  <td>{a.actor || <em className="muted">system</em>}</td>
                  <td><code>{a.action}</code></td>
                  <td className="small">{a.entity || '—'}</td>
                  <td className="small" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.old_value || '—'}</td>
                  <td className="small" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.new_value || '—'}</td>
                  <td className="small muted">{a.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card"><Empty message="No audit entries yet." /></div>
      )}
    </Layout>
  );
}