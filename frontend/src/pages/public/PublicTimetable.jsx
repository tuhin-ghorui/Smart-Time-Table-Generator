import React, { useEffect, useState } from 'react';
import api from '../../api';
import PublicLayout from '../../components/PublicLayout';
import StructureSelector from '../../components/StructureSelector';
import PdfButton from '../../components/PdfButton';
import { Spinner, Empty, StatusPill, timeFmt, fmtDate, todayStr, Alert } from '../../components/ui';

export default function PublicTimetable() {
  const [view, setView] = useState('today');
  const [sel, setSel] = useState(null);
  const [data, setData] = useState(null);
  const [changes, setChanges] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sel?.sectionId) return;
    setLoading(true);
    setError('');
    const today = todayStr();
    Promise.all([
      api.get('/public/timetable', {
        params: {
          academic_year_id: sel.yearId,
          section_id: sel.sectionId,
          batch_id: sel.batchId || undefined,
          view,
          date: today,
        },
      }),
      api.get('/public/changes', { params: { date: today } }),
    ])
      .then(([td, ch]) => {
        setData(td.data);
        setChanges(ch.data.changes);
      })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load timetable.'))
      .finally(() => setLoading(false));
  }, [sel?.yearId, sel?.sectionId, sel?.batchId, view]);

  const slots = data?.slots || [];
  const meta = data?.meta || {};

  const renderSlot = (slot) => (
    <div className="slot-row" key={slot.id}>
      <div className="slot-time">
        {timeFmt(slot.start_time)}
        <br />
        <span className="muted" style={{ fontWeight: 400 }}>{timeFmt(slot.end_time)}</span>
      </div>
      <div className="slot-main">
        <div className="slot-subject">{slot.subject_name}</div>
        <div className="slot-meta">
          {slot.teacher_name} · {slot.room_name}{slot.room_type === 'lab' ? ' (Lab)' : ''}
          {slot.batch_name ? ` · ${slot.batch_name}` : ''}
        </div>
      </div>
      <div className="slot-side">
        <span className={`slot-tag ${String(slot.session_type).toLowerCase().includes('pract') ? 'lab' : ''}`}>
          {slot.session_type}
        </span>
        <StatusPill status={slot.status} />
      </div>
    </div>
  );

  return (
    <PublicLayout>
      <h1 style={{ fontSize: 22 }}>College Timetable</h1>
      <p className="muted" style={{ margin: '4px 0 4px' }}>
        Browse published schedules by course, year, section and batch. Practical sessions are batch-specific and shown with their lab.
      </p>

      <StructureSelector onChange={setSel} />

      <div className="toolbar">
        <div className="seg">
          <button className={view === 'today' ? 'active' : ''} onClick={() => setView('today')}>Today</button>
          <button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>Weekly</button>
        </div>
        <PdfButton kind="daily" params={{ academic_year_id: sel?.yearId, section_id: sel?.sectionId, batch_id: sel?.batchId }} label="Daily PDF" />
        <PdfButton kind="weekly" params={{ academic_year_id: sel?.yearId, section_id: sel?.sectionId, batch_id: sel?.batchId }} label="Weekly PDF" />
      </div>

      <Alert type="error">{error}</Alert>

      {!sel?.sectionId ? (
        <div className="card">
          <Empty message="Select a course, year and section above to view the timetable." />
        </div>
      ) : loading ? (
        <Spinner label="Loading timetable…" />
      ) : data ? (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">
              <span>
                {meta.course_name} · {meta.year_name} · Section {meta.section_name}
                {meta.batch_name ? ` · ${meta.batch_name}` : ''}
                <span className="muted small" style={{ marginLeft: 8 }}>
                  {view === 'today' ? `Today · ${fmtDate(data.date)} · ${dayName()}` : 'Weekly view'}
                </span>
              </span>
            </div>
          </div>

          {view === 'today' ? (
            slots.length ? slots.map(renderSlot) : <Empty message="No classes scheduled today." />
          ) : (
            (Array.isArray(slots) ? slots : []).map((day) => (
              <div className="grid-day" key={day.date}>
                <h4>{day.day} · {fmtDate(day.date)}</h4>
                {day.slots.length ? day.slots.map(renderSlot) : <Empty message="No classes." />}
              </div>
            ))
          )}
        </>
      ) : null}

      <div className="card" style={{ marginTop: 26 }}>
        <div className="card-title">
          <span>Today's Changes</span>
          <span className="muted small">{changes ? fmtDate(todayStr()) : ''}</span>
        </div>
        {!changes ? <Spinner /> : changes.length === 0 ? (
          <Empty message="No timetable changes published today." />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Time</th><th>Subject</th><th>Section</th><th>Change</th><th>Detail</th><th>Published</th></tr>
              </thead>
              <tbody>
                {changes.map((c) => (
                  <tr key={c.id}>
                    <td className="mono">{c.slot.time}</td>
                    <td>{c.slot.subject_name}</td>
                    <td>{c.slot.section_name}</td>
                    <td><StatusPill status={c.change_type === 'room_changed' ? 'ROOM CHANGED' : c.change_type === 'cancelled' ? 'CANCELLED' : 'SUBSTITUTE'} /></td>
                    <td className="small">
                      <span className="muted">{c.description}</span>
                    </td>
                    <td className="small muted">{fmtDate(String(c.published_at).slice(0, 10))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PublicLayout>
  );

  function dayName() {
    return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(data.date + 'T00:00:00').getDay()];
  }
}