import React, { useEffect, useState } from 'react';
import api from '../api';

export default function StructureSelector({ onChange, initial }) {
  const [data, setData] = useState(null);
  const [courseId, setCourseId] = useState('');
  const [yearId, setYearId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [batchId, setBatchId] = useState('');

  useEffect(() => {
    api.get('/public/structure').then((res) => {
      setData(res.data.courses);
      if (initial?.courseId) {
        setCourseId(String(initial.courseId));
        if (initial.yearId) setYearId(String(initial.yearId));
        if (initial.sectionId) setSectionId(String(initial.sectionId));
        if (initial.batchId) setBatchId(String(initial.batchId));
      }
    });
  }, []);

  useEffect(() => {
    if (data && initial?.courseId && !courseId) {
      setCourseId(String(initial.courseId));
      setYearId(String(initial.yearId || ''));
      setSectionId(String(initial.sectionId || ''));
      setBatchId(String(initial.batchId || ''));
    }
  }, [data]);

  const course = data?.find((c) => String(c.id) === String(courseId));
  const year = course?.years?.find((y) => String(y.id) === String(yearId));
  const section = year?.sections?.find((s) => String(s.id) === String(sectionId));

  useEffect(() => {
    if (!courseId) return;
    if (!yearId && course?.years?.length) {
      setYearId(String(course.years[0].id));
      return;
    }
    if (!sectionId && year?.sections?.length) {
      setSectionId(String(year.sections[0].id));
      return;
    }
    if (sectionId && onChange) {
      onChange({
        courseId,
        yearId,
        sectionId,
        batchId,
        course: course?.name,
        year: year?.name,
        section: section?.name,
        batch: section?.batches?.find((b) => String(b.id) === String(batchId))?.batch_name || null,
      });
    }
  }, [courseId, yearId, sectionId, batchId, data]);

  const select = (label, value, options, onSet, placeholder) => (
    <div className="field">
      <label className="field-label">{label}</label>
      <select
        value={value || ''}
        onChange={(e) => onSet(e.target.value)}
        style={{ minWidth: 130 }}
      >
        <option value="">{placeholder || `Select ${label}`}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name || o.year_name || o.section_name || o.batch_name || '—'}
          </option>
        ))}
      </select>
    </div>
  );

  if (!data) return <div className="spinner" />;

  const batches = section?.batches || [];
  const activeBatches = batches.filter((b) => b.is_active);

  return (
    <div className="toolbar">
      {select('Course', courseId, data, setCourseId, 'Select course')}
      {courseId ? select('Year', yearId, course?.years || [], setYearId) : null}
      {yearId ? select('Section', sectionId, year?.sections || [], setSectionId) : null}
      {sectionId ? (
        <div className="field">
          <label className="field-label">Batch</label>
          <select value={batchId || ''} onChange={(e) => setBatchId(e.target.value)} style={{ minWidth: 130 }}>
            <option value="">All (lectures)</option>
            {activeBatches.map((b) => (
              <option key={b.id} value={b.id}>{b.batch_name}</option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}