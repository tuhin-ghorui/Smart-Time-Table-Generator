import React, { useEffect, useState } from 'react';
import api from '../../api';
import Layout from '../../components/Layout';
import { Spinner, Empty, StatusPill, timeFmt, Alert } from '../../components/ui';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TYPES = ['Lecture', 'Practical', 'Seminar', 'VET', 'Internship', 'Other'];

const emptyForm = {
  id: null,
  academic_year_id: '',
  section_id: '',
  batch_id: '',
  subject_id: '',
  teacher_id: '',
  day: 'Monday',
  start_time: '09:00',
  end_time: '10:00',
  room_id: '',
  session_type: 'Lecture',
  status: 'Scheduled',
  is_published: true,
  override: false,
};

export default function TimetableEditor() {
  const [lookup, setLookup] = useState(null);
  const [sectionId, setSectionId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [slots, setSlots] = useState(null);
  const [modal, setModal] = useState(null); // form or null
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get('/admin/lookup')
      .then((res) => setLookup(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load lookup.'));
  }, []);

  const autoSelect = () => {
    if (!lookup) return;
    const course = lookup.years[0];
    if (!course) return;
    setSectionId(String(lookup.sections[0]?.id || ''));
  };

  useEffect(autoSelect, [lookup]);

  useEffect(() => {
    if (!sectionId) return;
    setSlots(null);
    api
      .get('/admin/timetable', { params: { section_id: sectionId, batch_id: batchId || undefined } })
      .then((res) => setSlots(res.data.slots))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load timetable.'));
  }, [sectionId, batchId]);

  const section = lookup?.sections?.find((s) => String(s.id) === String(sectionId));
  const year = lookup?.years?.find((y) => y.id === section?.academic_year_id);
  const batches = lookup?.batches?.filter((b) => b.section_id === section?.id);

  const openCreate = () => {
    setError('');
    setNotice('');
    setModal({
      ...emptyForm,
      academic_year_id: section?.academic_year_id || '',
      section_id: sectionId,
      batch_id: batchId || '',
    });
  };

  const openEdit = (slot) => {
    setError('');
    setNotice('');
    setModal({
      id: slot.id,
      academic_year_id: slot.academic_year_id,
      section_id: slot.section_id,
      batch_id: slot.batch_id || '',
      subject_id: slot.subject_id,
      teacher_id: slot.teacher_id,
      day: slot.day,
      start_time: String(slot.start_time).slice(0, 5),
      end_time: String(slot.end_time).slice(0, 5),
      room_id: slot.room_id,
      session_type: slot.session_type,
      status: slot.status,
      is_published: !!slot.is_published,
      override: false,
    });
  };

  const save = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api.post('/admin/timetable/slots', modal);
      setNotice(res.data.message);
      setModal(null);
      if (sectionId) {
        api.get('/admin/timetable', { params: { section_id: sectionId, batch_id: batchId || undefined } })
          .then((r) => setSlots(r.data.slots));
      }
    } catch (err) {
      const conflicts = err.response?.data?.conflicts;
      setError(
        conflicts?.length
          ? 'Conflict detected:\n' + conflicts.map((c) => `• ${c.label}`).join('\n') + '\nUse "Override" to force-save.'
          : err.response?.data?.error || 'Failed to save slot.'
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (slot) => {
    if (!window.confirm(`Cancel this class (${slot.subject_name} ${timeFmt(slot.start_time)})? It stays in history.`)) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.delete(`/admin/timetable/slots/${slot.id}`);
      setNotice(res.data.message);
      setSlots((prev) => prev.filter((s) => s.id !== slot.id));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed.');
    } finally {
      setBusy(false);
    }
  };

  const groupedByDay = () => {
    const map = {};
    DAYS.forEach((d) => (map[d] = []));
    (slots || []).forEach((s) => map[s.day]?.push(s));
    return map;
  };

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
          {s.teacher_name} · {s.room_name}{s.batch_name ? ` · ${s.batch_name}` : ' · Full section'} · {s.session_type}
        </div>
      </div>
      <div className="slot-side">
        <StatusPill status={s.status} />
        <button className="btn sm" onClick={() => openEdit(s)}>Edit</button>
        <button className="btn sm danger" disabled={busy} onClick={() => remove(s)}>Cancel</button>
      </div>
    </div>
  );

  const formRow = (label, node) => (
    <div className="field" style={{ marginBottom: 12 }}>
      <label className="field-label">{label}</label>
      {node}
    </div>
  );

  if (!lookup) return <Layout active="Timetable Editor"><Spinner /></Layout>;

  return (
    <Layout active="Timetable Editor">
      <h1 style={{ fontSize: 22 }}>Timetable Editor</h1>
      <p className="muted" style={{ margin: '4px 0 12px' }}>
        Draft → conflict check → admin approval → publish. Public viewers only see published slots.
      </p>

      <div className="toolbar">
        <div className="field">
          <label className="field-label">Section</label>
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">Select section</option>
            {lookup.sections.map((s) => {
              const y = lookup.years.find((yy) => yy.id === s.academic_year_id);
              const c = lookup.courses.find((cc) => cc.id === y?.course_id);
              return (
                <option key={s.id} value={s.id}>
                  {c?.name} {y?.name} {s.name}
                </option>
              );
            })}
          </select>
        </div>
        {section && (
          <div className="field">
            <label className="field-label">Batch</label>
            <select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">Lectures (whole section)</option>
              {batches?.map((b) => (
                <option key={b.id} value={b.id} disabled={!b.is_active}>
                  {b.name}{b.is_active ? '' : ' (inactive)'}
                </option>
              ))}
            </select>
          </div>
        )}
        <button className="btn primary" disabled={!section} style={{ alignSelf: 'flex-end' }} onClick={openCreate}>
          + New session slot
        </button>
      </div>

      <Alert type="error">{error}</Alert>
      <Alert type="success">{notice}</Alert>

      {!section ? (
        <div className="card"><Empty message="Select a section to start editing." /></div>
      ) : !slots ? (
        <Spinner />
      ) : (
        Object.entries(groupedByDay()).map(([day, list]) => (
          <div className="grid-day" key={day}>
            <h4>{day}</h4>
            {list.length ? list.map(renderSlot) : <div className="card"><Empty message={`No sessions on ${day}.`} /></div>}
          </div>
        ))
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top">
              <h3>{modal.id ? 'Edit session' : 'New session'}</h3>
              <button className="modal-close" onClick={() => setModal(null)}>×</button>
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {formRow('Day', (
                  <select value={modal.day} onChange={(e) => setModal({ ...modal, day: e.target.value })}>
                    {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                ))}
                {formRow('Session type', (
                  <select value={modal.session_type} onChange={(e) => setModal({ ...modal, session_type: e.target.value })}>
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                ))}
                {formRow('Start time', <input type="time" value={modal.start_time} onChange={(e) => setModal({ ...modal, start_time: e.target.value })} />)}
                {formRow('End time', <input type="time" value={modal.end_time} onChange={(e) => setModal({ ...modal, end_time: e.target.value })} />)}
                {formRow('Subject', (
                  <select value={modal.subject_id} onChange={(e) => setModal({ ...modal, subject_id: e.target.value })}>
                    <option value="">Select subject</option>
                    {lookup.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                ))}
                {formRow('Teacher', (
                  <select value={modal.teacher_id} onChange={(e) => setModal({ ...modal, teacher_id: e.target.value })}>
                    <option value="">Select teacher</option>
                    {lookup.teachers.map((t) => <option key={t.user_id} value={t.teacher_id}>{t.name}</option>)}
                  </select>
                ))}
                {formRow('Room', (
                  <select value={modal.room_id} onChange={(e) => setModal({ ...modal, room_id: e.target.value })}>
                    <option value="">Select room</option>
                    {lookup.rooms.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.type})</option>)}
                  </select>
                ))}
                {formRow('Batch', (
                  <select value={modal.batch_id} onChange={(e) => setModal({ ...modal, batch_id: e.target.value })}>
                    <option value="">Whole section (lecture)</option>
                    {batches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                ))}
                {formRow('Status', (
                  <select value={modal.status} onChange={(e) => setModal({ ...modal, status: e.target.value })}>
                    {['Scheduled', 'Current', 'Upcoming', 'Changed', 'Substitute', 'Room Changed', 'Cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ))}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 12 }}>
                <input type="checkbox" checked={modal.is_published} onChange={(e) => setModal({ ...modal, is_published: e.target.checked })} />
                Publish immediately (visible to public)
              </label>
              <div className="toolbar" style={{ justifyContent: 'flex-end', margin: 0 }}>
                <button className="btn" onClick={() => setModal(null)}>Cancel</button>
                <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}