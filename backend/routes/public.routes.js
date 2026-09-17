const express = require('express');
const { query, queryOne } = require('../config/db');
const { todayStr, dayNameOf, weekDates, timeToShort } = require('../utils/helpers');
const { buildDaily, buildWeekly } = require('../services/pdf.service');

const router = express.Router();

const SLOT_SELECT = `SELECT ts.id, ts.day, ts.start_time, ts.end_time, ts.session_type, ts.status,
  ts.subject_id, ts.teacher_id, ts.room_id, ts.batch_id, ts.section_id, ts.academic_year_id, ts.is_published,
  s.name AS subject_name, s.course_id,
  t.user_id AS teacher_user_id, u.name AS teacher_name,
  r.name AS room_name, r.type AS room_type,
  b.name AS batch_name,
  ay.name AS year_name, c.name AS course_name, sec.name AS section_name`;

const SLOT_JOINS = `
  JOIN subjects s ON s.id = ts.subject_id
  JOIN teachers t ON t.id = ts.teacher_id
  JOIN users u ON u.id = t.user_id
  JOIN rooms r ON r.id = ts.room_id
  LEFT JOIN batches b ON b.id = ts.batch_id
  JOIN academic_years ay ON ay.id = ts.academic_year_id
  JOIN courses c ON c.id = ay.course_id
  JOIN sections sec ON sec.id = ts.section_id`;

async function loadSlots({ academic_year_id, section_id, batch_id, date, view }) {
  const where = ['ts.is_published = 1', 'ts.status <> ?'];
  const params = ['Cancelled'];

  if (academic_year_id) { where.push('ts.academic_year_id = ?'); params.push(academic_year_id); }
  if (section_id) { where.push('ts.section_id = ?'); params.push(section_id); }
  if (batch_id) {
    where.push('(ts.batch_id = ? OR ts.batch_id IS NULL)');
    params.push(batch_id);
  } else if (section_id) {
    where.push('ts.batch_id IS NULL');
  }

  const day = view === 'today' ? dayNameOf(date || todayStr()) : null;
  if (day) { where.push('ts.day = ?'); params.push(day); }

  const rows = await query(
    `${SLOT_SELECT}
       FROM timetable_slots ts ${SLOT_JOINS}
      WHERE ${where.join(' AND ')}
      ORDER BY FIELD(ts.day, 'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'), ts.start_time`,
    params
  );
  return rows;
}

async function latestChanges(date) {
  const where = ['ch.status = ?'];
  const params = ['approved'];
  if (date) { where.push('DATE(ch.published_at) = ?'); params.push(date); }
  const rows = await query(
    `SELECT ch.id, ch.change_type, ch.old_value, ch.new_value, ch.published_at,
            ts.id AS slot_id, ts.day, ts.start_time, ts.end_time, ts.session_type,
            s.name AS subject_name, u.name AS teacher_name, r.name AS room_name,
            b.name AS batch_name, sec.name AS section_name, c.name AS course_name
       FROM timetable_changes ch
       JOIN timetable_slots ts ON ts.id = ch.slot_id
       JOIN subjects s ON s.id = ts.subject_id
       JOIN teachers t ON t.id = ts.teacher_id
       JOIN users u ON u.id = t.user_id
       JOIN rooms r ON r.id = ts.room_id
       LEFT JOIN batches b ON b.id = ts.batch_id
       JOIN sections sec ON sec.id = ts.section_id
       JOIN academic_years ay ON ay.id = ts.academic_year_id
       JOIN courses c ON c.id = ay.course_id
      WHERE ${where.join(' AND ')}
      ORDER BY ch.published_at DESC
      LIMIT 200`,
    params
  );
  return rows.map((c) => ({
    id: c.id,
    change_type: c.change_type,
    old_value: c.old_value,
    new_value: c.new_value,
    published_at: c.published_at,
    description: describeChange(c),
    slot: {
      id: c.slot_id,
      day: c.day,
      time: `${timeToShort(c.start_time)} – ${timeToShort(c.end_time)}`,
      session_type: c.session_type,
      subject_name: c.subject_name,
      teacher_name: c.teacher_name,
      room_name: c.room_name,
      batch_name: c.batch_name,
      section_name: c.section_name,
      course_name: c.course_name,
    },
  }));
}

function describeChange(c) {
  if (c.change_type === 'substitute') return `Substitute assigned for ${c.subject_name} (Section ${c.section_name})`;
  if (c.change_type === 'room_changed') return `Room changed for ${c.subject_name}: ${c.new_value}`;
  if (c.change_type === 'cancelled') return `Class cancelled: ${c.subject_name}`;
  if (c.change_type === 'rescheduled') return `Rescheduled: ${c.subject_name}`;
  return `Timetable updated: ${c.subject_name}`;
}

router.get('/structure', async (_req, res) => {
  try {
    const courses = await query(`SELECT id, name FROM courses ORDER BY name`);
    for (const course of courses) {
      course.years = await query(
        `SELECT ay.id, ay.name AS year_name FROM academic_years ay
         WHERE ay.course_id = ? ORDER BY ay.name`, [course.id]);
      for (const y of course.years) {
        y.sections = await query(
          `SELECT id, name AS section_name FROM sections WHERE academic_year_id = ? ORDER BY name`, [y.id]);
        for (const sec of y.sections) {
          sec.batches = await query(
            `SELECT id, name AS batch_name, is_active FROM batches WHERE section_id = ? ORDER BY is_active DESC, name`, [sec.id]);
        }
      }
    }
    return res.json({ courses });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load structure.' });
  }
});

router.get('/timetable', async (req, res) => {
  try {
    const { academic_year_id, section_id, batch_id, view, date } = req.query;
    if (!academic_year_id || !section_id) {
      return res.status(400).json({ error: 'academic_year_id and section_id are required.' });
    }
    const rows = await loadSlots({ academic_year_id, section_id, batch_id, date, view });
    let result = rows;

    if (view === 'week' || !view) {
      const days = weekDates(date);
      result = days.map((d) => ({
        date: d,
        day: dayNameOf(d),
        slots: rows.filter((s) => s.day === dayNameOf(d)),
      }));
    }
    const meta = await queryOne(
      `SELECT c.name AS course_name, ay.name AS year_name, sec.name AS section_name
         FROM sections sec JOIN academic_years ay ON ay.id = sec.academic_year_id
         JOIN courses c ON c.id = ay.course_id
        WHERE sec.id = ?`, [section_id]);
    const batchMeta = batch_id ? await queryOne(`SELECT name AS batch_name FROM batches WHERE id = ?`, [batch_id]) : null;

    return res.json({
      meta: {
        course_name: meta?.course_name,
        year_name: meta?.year_name,
        section_name: meta?.section_name,
        batch_name: batchMeta?.batch_name || null,
      },
      view: view === 'today' ? 'today' : 'week',
      date: date || todayStr(),
      slots: result,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load timetable.' });
  }
});

router.get('/changes', async (req, res) => {
  try {
    const date = req.query.date || todayStr();
    const changes = await latestChanges(date);
    return res.json({ date, changes });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load changes.' });
  }
});

function pdfFilename(prefix, opts) {
  const parts = [];
  if (opts.course) parts.push(opts.course.replace(/\W+/g, '_'));
  if (opts.year) parts.push(opts.year.replace(/\W+/g, '_'));
  if (opts.section) parts.push(`Sec_${opts.section.replace(/\W+/g, '_')}`);
  if (opts.batch) parts.push(`Batch_${opts.batch.replace(/\W+/g, '_')}`);
  return `${prefix}_${parts.filter(Boolean).join('_') || 'all'}.pdf`;
}

router.get('/pdf/daily', async (req, res) => {
  try {
    const { academic_year_id, section_id, batch_id, date } = req.query;
    if (!academic_year_id || !section_id) return res.status(400).json({ error: 'academic_year_id and section_id are required.' });
    const d = date || todayStr();
    const rows = await loadSlots({ academic_year_id, section_id, batch_id, date: d, view: 'today' });
    const meta = await queryOne(
      `SELECT c.name AS course_name, ay.name AS year_name, sec.name AS section_name
         FROM sections sec JOIN academic_years ay ON ay.id = sec.academic_year_id
         JOIN courses c ON c.id = ay.course_id WHERE sec.id = ?`, [section_id]);
    const b = batch_id ? await queryOne('SELECT name AS batch_name FROM batches WHERE id = ?', [batch_id]) : null;

    const doc = buildDaily([{ day: dayNameOf(d), slots: rows }], {
      date: d,
      courseName: meta?.course_name,
      yearName: meta?.year_name,
      sectionName: meta?.section_name,
      batchName: b?.batch_name,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfFilename('CampusTime_Daily', {
      course: meta?.course_name, year: meta?.year_name, section: meta?.section_name, batch: b?.batch_name })}"`);
    doc.pipe(res);
    doc.end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to generate PDF.' });
  }
});

router.get('/pdf/weekly', async (req, res) => {
  try {
    const { academic_year_id, section_id, batch_id, date } = req.query;
    if (!academic_year_id || !section_id) return res.status(400).json({ error: 'academic_year_id and section_id are required.' });
    const rows = await loadSlots({ academic_year_id, section_id, batch_id, date, view: 'week' });
    const meta = await queryOne(
      `SELECT c.name AS course_name, ay.name AS year_name, sec.name AS section_name
         FROM sections sec JOIN academic_years ay ON ay.id = sec.academic_year_id
         JOIN courses c ON c.id = ay.course_id WHERE sec.id = ?`, [section_id]);
    const b = batch_id ? await queryOne('SELECT name AS batch_name FROM batches WHERE id = ?', [batch_id]) : null;
    const days = weekDates(date).map((d) => ({
      date: d,
      day: dayNameOf(d),
      slots: rows.filter((s) => s.day === dayNameOf(d)),
    }));

    const doc = buildWeekly(days, {
      courseName: meta?.course_name,
      yearName: meta?.year_name,
      sectionName: meta?.section_name,
      batchName: b?.batch_name,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfFilename('CampusTime_Weekly', {
      course: meta?.course_name, year: meta?.year_name, section: meta?.section_name, batch: b?.batch_name })}"`);
    doc.pipe(res);
    doc.end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to generate PDF.' });
  }
});

module.exports = { router, loadSlots, latestChanges };