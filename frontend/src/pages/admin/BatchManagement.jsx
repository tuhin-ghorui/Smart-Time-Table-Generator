import React, { useEffect, useState } from 'react';
import api from '../../api';
import Layout from '../../components/Layout';
import { Spinner, Empty, Alert, StatusPill } from '../../components/ui';

export default function BatchManagement() {
  const [lookup, setLookup] = useState(null);
  const [batches, setBatches] = useState(null);
  const [sectionId, setSectionId] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    api.get('/admin/lookup').then((res) => setLookup(res.data)).catch((err) => setError(err.response?.data?.error || 'Failed to load.'));
  }, []);

  const section = lookup?.sections?.find((s) => String(s.id) === String(sectionId));

  useEffect(() => {
    if (!lookup?.sections?.length) return;
    setSectionId(String(lookup.sections[0].id));
  }, [lookup]);

  const load = (sid) => {
    if (!sid) return;
    setBatches(null);
    api.get('/admin/batches', { params: { section_id: sid } })
      .then((res) => setBatches(res.data.batches))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load batches.'));
  };
  useEffect(() => load(sectionId), [sectionId, lookup]);

  const create = async () => {
    setError('');
    setNotice('');
    try {
      const res = await api.post('/admin/batches', { section_id: sectionId, name });
      setNotice(res.data.message);
      setName('');
      load(sectionId);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create batch.');
    }
  };

  const update = async (batch, patch) => {
    setError('');
    setNotice('');
    try {
      const res = await api.patch(`/admin/batches/${batch.id}`, patch);
      setNotice(res.data.message);
      load(sectionId);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update batch.');
    }
  };

  if (!lookup) return <Layout active="Batch Management"><Spinner /></Layout>;

  return (
    <Layout active="Batch Management">
      <h1 style={{ fontSize: 22 }}>Batch Management</h1>
      <p className="muted" style={{ margin: '4px 0 12px' }}>
        Batches are fully database-driven per section — no code changes needed. Deactivated batches stay in history but vanish from active scheduling.
      </p>

      <div className="toolbar">
        <div className="field">
          <label className="field-label">Section</label>
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            {lookup.sections.map((s) => {
              const y = lookup.years.find((yy) => yy.id === s.academic_year_id);
              const c = lookup.courses.find((cc) => cc.id === y?.course_id);
              return <option key={s.id} value={s.id}>{c?.name} {y?.name} {s.name}</option>;
            })}
          </select>
        </div>
        <div className="field">
          <label className="field-label">New batch name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Batch 4" style={{ width: 140 }} />
        </div>
        <button className="btn primary" style={{ alignSelf: 'flex-end' }} onClick={create}>Create batch</button>
      </div>

      <Alert type="error">{error}</Alert>
      <Alert type="success">{notice}</Alert>

      {!batches ? (
        <Spinner />
      ) : !batches.length ? (
        <div className="card"><Empty message="No batches in this section yet." /></div>
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Batch</th><th>Status</th><th>Actions</th><th>Rename</th></tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td><strong>{b.name}</strong></td>
                  <td><StatusPill status={b.is_active ? 'ACTIVE' : 'INACTIVE'} /></td>
                  <td>
                    {b.is_active ? (
                      <button className="btn sm" onClick={() => update(b, { is_active: 0 })}>Deactivate</button>
                    ) : (
                      <button className="btn emerald sm" onClick={() => update(b, { is_active: 1 })}>Reactivate</button>
                    )}
                  </td>
                  <td>
                    <RenameBatch batch={b} onRename={(nn) => update(b, { name: nn })} onError={setError} />
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

function RenameBatch({ batch, onRename, onError }) {
  const [value, setValue] = useState(batch.name);
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return <button className="btn sm" onClick={() => setEditing(true)}>Rename</button>;
  }
  return (
    <span style={{ display: 'inline-flex', gap: 6 }}>
      <input value={value} onChange={(e) => setValue(e.target.value)} style={{ width: 90 }} />
      <button
        className="btn sm primary"
        onClick={() => {
          if (!value.trim()) return onError('Name cannot be empty.');
          onRename(value.trim());
          setEditing(false);
        }}
      >
        Save
      </button>
    </span>
  );
}