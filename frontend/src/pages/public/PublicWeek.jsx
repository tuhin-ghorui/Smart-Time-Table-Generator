import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import PublicLayout from '../../components/PublicLayout';
import StructureSelector from '../../components/StructureSelector';
import PdfButton from '../../components/PdfButton';
import SlotRow from '../../components/SlotRow';
import { Spinner, Empty, fmtDate, todayStr, Alert } from '../../components/ui';

export default function PublicWeek() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [sel, setSel] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const initial = {
    courseId: searchParams.get('course') || undefined,
    yearId: searchParams.get('year') || undefined,
    sectionId: searchParams.get('section') || undefined,
    batchId: searchParams.get('batch') || undefined,
  };

  const onSelect = (s) => {
    setSel(s);
    setSearchParams(
      {
        course: s.courseId,
        year: s.yearId,
        section: s.sectionId,
        ...(s.batchId ? { batch: s.batchId } : {}),
      },
      { replace: true }
    );
  };

  useEffect(() => {
    if (!sel?.sectionId) return;
    setLoading(true);
    setError('');
    api
      .get('/public/timetable', {
        params: {
          academic_year_id: sel.yearId,
          section_id: sel.sectionId,
          batch_id: sel.batchId || undefined,
          view: 'week',
          date: todayStr(),
        },
      })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load timetable.'))
      .finally(() => setLoading(false));
  }, [sel?.yearId, sel?.sectionId, sel?.batchId]);

  const meta = data?.meta || {};
  const days = Array.isArray(data?.slots) ? data.slots : [];

  return (
    <PublicLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22 }}>Weekly Timetable</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Full week schedule for the selected course, year, section and batch.
          </p>
        </div>
        <button className="btn sm" onClick={() => navigate('/')}>← Today's view</button>
      </div>

      <StructureSelector onChange={onSelect} initial={initial} />

      <div className="toolbar">
        <PdfButton
          kind="weekly"
          params={{ academic_year_id: sel?.yearId, section_id: sel?.sectionId, batch_id: sel?.batchId }}
          label="Weekly PDF"
        />
      </div>

      <Alert type="error">{error}</Alert>

      {!sel?.sectionId ? (
        <div className="card">
          <Empty message="Select a course, year and section above to view the weekly timetable." />
        </div>
      ) : loading ? (
        <Spinner label="Loading weekly timetable…" />
      ) : data ? (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">
              <span>
                {meta.course_name} · {meta.year_name} · Section {meta.section_name}
                {meta.batch_name ? ` · ${meta.batch_name}` : ''}
                <span className="muted small" style={{ marginLeft: 8 }}>Weekly view · week of {fmtDate(data.date)}</span>
              </span>
            </div>
          </div>

          {days.length ? (
            days.map((day) => (
              <div className="grid-day" key={day.date}>
                <h4>{day.day} · {fmtDate(day.date)}</h4>
                {day.slots.length ? day.slots.map((slot) => <SlotRow slot={slot} key={slot.id} />) : <Empty message="No classes." />}
              </div>
            ))
          ) : (
            <Empty message="No classes scheduled this week." />
          )}
        </>
      ) : null}
    </PublicLayout>
  );
}
