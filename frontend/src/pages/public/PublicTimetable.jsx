import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import PublicLayout from '../../components/PublicLayout';
import StructureSelector from '../../components/StructureSelector';
import PdfButton from '../../components/PdfButton';
import SlotRow from '../../components/SlotRow';
import { Spinner, Empty, StatusPill, fmtDate, todayStr, Alert } from '../../components/ui';

export default function PublicTimetable() {
  const navigate = useNavigate();
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
          view: 'today',
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
  }, [sel?.yearId, sel?.sectionId, sel?.batchId]);

  const slots = data?.slots || [];
  const meta = data?.meta || {};

  const goWeekly = () => {
    const params = new URLSearchParams();
    if (sel?.courseId) params.set('course', sel.courseId);
    if (sel?.yearId) params.set('year', sel.yearId);
    if (sel?.sectionId) params.set('section', sel.sectionId);
    if (sel?.batchId) params.set('batch', sel.batchId);
    navigate(`/timetable/week?${params.toString()}`);
  };

  return (
    <PublicLayout>
      <h1 style={{ fontSize: 22 }}>College Timetable</h1>
      <p className="muted" style={{ margin: '4px 0 4px' }}>
        Browse published schedules by course, year, section and batch. Practical sessions are batch-specific and shown with their lab.
      </p>

      <StructureSelector onChange={setSel} />

      <div className="toolbar">
        <button className="btn sm" onClick={goWeekly} disabled={!sel?.sectionId}>
          Weekly timetable →
        </button>
        <PdfButton kind="daily" params={{ academic_year_id: sel?.yearId, section_id: sel?.sectionId, batch_id: sel?.batchId }} label="Daily PDF" />
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
                  Today · {fmtDate(data.date)} · {dayName()}
                </span>
              </span>
            </div>
          </div>

          {slots.length ? slots.map((slot) => <SlotRow slot={slot} key={slot.id} />) : <Empty message="No classes scheduled today." />}
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
