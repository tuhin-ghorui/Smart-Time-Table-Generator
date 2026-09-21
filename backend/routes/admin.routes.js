const express = require('express');
const { query, queryOne } = require('../config/db');
const { authRequired, role } = require('../middlewares/auth');
const { todayStr, dayNameOf, timeToShort, isOverlap } = require('../utils/helpers');
const { recommendations } = require('../services/ai.service');
const { notify } = require('../services/notify.service');
const { log } = require('../services/audit.service');

const router = express.Router();
router.use(authRequired, role(['admin']));

/* ---------------- Dashboard ---------------- */

router.get('/dashboard', async (req, res) => {
  try {
    const date = req.query.date || todayStr();
    const day = dayNameOf(date);

    const totalTeachers = await queryOne("SELECT COUNT(*) AS cnt FROM teachers t JOIN users u ON u.id = t.user_id WHERE u.role = 'teacher'");
    const classesToday = await queryOne('SELECT COUNT(*) AS cnt FROM timetable_slots WHERE day = ? AND status <> ?', [day, 'Cancelled']);
    const attendance = await query(`SELECT a.status, COUNT(*) AS cnt FROM attendance_records a WHERE a.date = ? GROUP BY a.status`, [date]);
    const attMap = Object.fromEntries(attendance.map((r) => [r.status, r.cnt]));

    const affected = await query(
      `SELECT COUNT(DISTINCT ts.id) AS cnt FROM attendance_records a
       JOIN teachers t ON t.id = a.teacher_id
       JOIN timetable_slots ts ON ts.teacher_id = t.id
       WHERE a.date = ? AND a.status IN ('absent','leave') AND ts.day = ? AND ts.status <> 'Cancelled'`,
      [date, day]);
    const uncovered = await queryOne(
      `SELECT COUNT(*) AS cnt FROM substitution_requests sr WHERE sr.date = ? AND sr.status IN ('open','filled')`, [date]);
    const substitutes = await query(
      `SELECT COUNT(*) AS cnt FROM substitution_assignments sa JOIN substitution_requests sr ON sr.id = sa.request_id
       WHERE sr.date = ? AND sa.status IN ('accepted','pending')`, [date]);

    return res.json({
      date,
      total_teachers: totalTeachers.cnt,
      classes_today: classesToday.cnt,
      present: attMap.present || 0,
      absent: (attMap.absent || 0) + (attMap.leave || 0),
      affected_classes: affected[0].cnt,
      uncovered_classes: uncovered.cnt,
      substitutes_assigned: substitutes[0].cnt,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load dashboard.' });
  }
});

/* ---------------- Attendance (read-only, teacher-reported) ---------------- */

router.get('/attendance', async (req, res) => {
  try {
    const date = req.query.date || todayStr();
    const day = dayNameOf(date);
    const rows = await query(
      `SELECT t.id AS teacher_id, u.name, t.department,
              a.status, a.reason, a.synced_at,
              (SELECT COUNT(*) FROM timetable_slots ts WHERE ts.teacher_id = t.id AND ts.day = ? AND ts.status <> 'Cancelled') AS classes_today
       FROM teachers t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN attendance_records a ON a.teacher_id = t.id AND a.date = ?
       WHERE u.role = 'teacher'
       ORDER BY u.name`,
      [day, date]);
    const unmarked = rows.filter((r) => !r.status).length;
    return res.json({ date, teachers: rows, unmarked });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load attendance.' });
  }
});

/* ---------------- Absence -> requests generation ---------------- */

router.post('/attendance/generate-requests', async (req, res) => {
  try {
    const date = req.query.date || todayStr();
    const day = dayNameOf(date);
    const absent = await query(`SELECT * FROM attendance_records WHERE date = ? AND status IN ('absent','leave')`, [date]);
    if (!absent.length) return res.json({ created: 0, message: 'No absent teachers for this date.', absent: [] });

    let created = 0;
    const detail = [];
    for (const rec of absent) {
      const slots = await query(
        `SELECT ts.id, s.name AS subject_name, u.name AS teacher_name, ts.day, ts.start_time, ts.end_time
         FROM timetable_slots ts
         JOIN subjects s ON s.id = ts.subject_id
         JOIN teachers t ON t.id = ts.teacher_id
         JOIN users u ON u.id = t.user_id
         WHERE ts.teacher_id = ? AND ts.day = ? AND ts.status <> 'Cancelled'`,
        [rec.teacher_id, day]);
      for (const slot of slots) {
        const existing = await queryOne(
          `SELECT id FROM substitution_requests WHERE timetable_slot_id = ? AND date = ?`, [slot.id, date]);
        if (!existing) {
          await query(
            `INSERT INTO substitution_requests (timetable_slot_id, date, status, reason) VALUES (?, ?, 'open', ?)`,
            [slot.id, date, `Teacher absent on ${date}`]);
          created++;
          detail.push({ slot_id: slot.id, subject: slot.subject_name, time: `${timeToShort(slot.start_time)}-${timeToShort(slot.end_time)}` });
        }
      }
    }

    await log({
      user: req.user, action: 'generate_requests', entity: `attendance:${date}`,
      new_value: `${created} substitution request(s) created`, reason: `Absence detection for ${date}`,
    });
    return res.json({ created, date, absent: absent.map((a) => a.teacher_id), detail });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to generate requests.' });
  }
});

/* ---------------- Substitution management ---------------- */

const REQUEST_SELECT = `SELECT sr.id AS request_id, sr.date, sr.status AS request_status, sr.reason,
  ts.id AS slot_id, ts.day, ts.start_time, ts.end_time, ts.session_type,
  s.name AS subject_name, u.name AS teacher_name,
  r.name AS room_name, r.type AS room_type,
  b.name AS batch_name, sec.name AS section_name, c.name AS course_name,
  ay.name AS year_name`;

router.get('/requests', async (req, res) => {
  try {
    const date = req.query.date || todayStr();
    const rows = await query(
      `${REQUEST_SELECT}
       FROM substitution_requests sr
       JOIN timetable_slots ts ON ts.id = sr.timetable_slot_id
       JOIN subjects s ON s.id = ts.subject_id
       JOIN teachers t ON t.id = ts.teacher_id
       JOIN users u ON u.id = t.user_id
       JOIN rooms r ON r.id = ts.room_id
       LEFT JOIN batches b ON b.id = ts.batch_id
       JOIN sections sec ON sec.id = ts.section_id
       JOIN academic_years ay ON ay.id = ts.academic_year_id
       JOIN courses c ON c.id = ay.course_id
       WHERE sr.date = ?
       ORDER BY sr.status = 'open' DESC, ts.start_time`,
      [date]);
    return res.json({ date, requests: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load requests.' });
  }
});

router.get('/requests/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const request = await queryOne(
      `${REQUEST_SELECT}
       FROM substitution_requests sr
       JOIN timetable_slots ts ON ts.id = sr.timetable_slot_id
       JOIN subjects s ON s.id = ts.subject_id
       JOIN teachers t ON t.id = ts.teacher_id
       JOIN users u ON u.id = t.user_id
       JOIN rooms r ON r.id = ts.room_id
       LEFT JOIN batches b ON b.id = ts.batch_id
       JOIN sections sec ON sec.id = ts.section_id
       JOIN academic_years ay ON ay.id = ts.academic_year_id
       JOIN courses c ON c.id = ay.course_id
       WHERE sr.id = ?`, [id]);
    if (!request) return res.status(404).json({ error: 'Request not found.' });

    const ai = await recommendations(id, request.date);
    const assignment = await queryOne(
      `SELECT sa.*, u.name AS assigned_teacher_name
       FROM substitution_assignments sa
       LEFT JOIN teachers t ON t.id = sa.teacher_id
       LEFT JOIN users u ON u.id = t.user_id
       WHERE sa.request_id = ? ORDER BY sa.id DESC LIMIT 1`, [id]);

    return res.json({ request, candidates: ai.candidates, assignment });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load request.' });
  }
});

router.post('/assignments', async (req, res) => {
  try {
    const { request_id, teacher_id, action, reason } = req.body || {};
    if (!request_id || !action) return res.status(400).json({ error: 'request_id and action are required.' });
    if (action !== 'reject' && !teacher_id) return res.status(400).json({ error: 'teacher_id is required for assignment.' });

    const reqInfo = await queryOne(
      `SELECT sr.*, ts.teacher_id AS original_teacher, ts.subject_id, ts.day, ts.start_time, ts.end_time
       FROM substitution_requests sr JOIN timetable_slots ts ON ts.id = sr.timetable_slot_id WHERE sr.id = ?`,
      [request_id]);
    if (!reqInfo) return res.status(404).json({ error: 'Request not found.' });

    const assignee = await queryOne(
      `SELECT u.name, t.id AS teacher_id FROM teachers t JOIN users u ON u.id = t.user_id WHERE t.id = ?`,
      [teacher_id]);

    if (reqInfo.status === 'filled' && action !== 'override') {
      return res.status(400).json({ error: 'Request already filled. Use override to change.' });
    }
    if (reqInfo.status === 'rejected' && action !== 'override') {
      return res.status(400).json({ error: 'Request was rejected. Use override to reopen.' });
    }

    if (action === 'reject') {
      await query(`UPDATE substitution_requests SET status = 'rejected' WHERE id = ?`, [request_id]);
      await query(`UPDATE timetable_slots SET status = 'Cancelled' WHERE id = ?`, [reqInfo.timetable_slot_id]);
      await insertChange(reqInfo, 'cancelled', 'substitution pending', 'request rejected - class cancelled', req.user, true);
      await log({
        user: req.user, action: 'request_reject', entity: `request:${request_id}`,
        new_value: 'rejected', reason,
      });
      return res.json({ ok: true, message: 'Request rejected. Class cancelled and logged.' });
    }

    // present-teacher-only hard rule: only teachers marked present today can be assigned
    if (action !== 'reject') {
      const att = await queryOne(
        `SELECT status FROM attendance_records WHERE teacher_id = ? AND date = ?`, [teacher_id, reqInfo.date]);
      if (!att || att.status !== 'present') {
        const label = !att ? 'has not marked attendance yet' : `is marked ${att.status}`;
        return res.status(409).json({ error: `Not assignable: ${assignee?.name || 'Teacher'} ${label} for ${reqInfo.date}. Only teachers marked present can substitute.` });
      }
    }

    // availability + qualification re-check (server side, non-negotiable)
    if (reqInfo.status !== 'filled') {
      const conflict = await conflictCheck({
        teacher_id, day: reqInfo.day, start_time: reqInfo.start_time,
        end_time: reqInfo.end_time, excludeRequest: request_id, date: reqInfo.date,
      });
      if (conflict.hasClash) {
        return res.status(409).json({ error: `Not assignable: teacher has a conflicting class (${conflict.details[0]?.label || 'overlap'}).` });
      }
      const qualified = await isQualifiedForSubject(teacher_id, reqInfo.subject_id, reqInfo.original_teacher);
      if (!qualified.ok) {
        return res.status(409).json({ error: `Not assignable: ${qualified.reason}` });
      }
    }

    if (action === 'assign' || action === 'override') {
      const existing = await queryOne(
        `SELECT id FROM substitution_assignments WHERE request_id = ? AND teacher_id = ?`, [request_id, teacher_id]);
      if (existing) {
        await query(`UPDATE substitution_assignments SET status = 'pending', assigned_by = ? WHERE id = ?`,
          [req.user.id, existing.id]);
      } else {
        await query(
          `INSERT INTO substitution_assignments (request_id, teacher_id, assigned_by, status)
           VALUES (?, ?, ?, 'pending')`,
          [request_id, teacher_id, req.user.id]);
      }
      const subject = await queryOne('SELECT name FROM subjects WHERE id = ?', [reqInfo.subject_id]);
      await notify([assignee.user_id], 'substitution',
        `You have been assigned to cover "${subject?.name}" on ${reqInfo.date} (${timeToShort(reqInfo.start_time)}-${timeToShort(reqInfo.end_time)}). Please accept or decline.`);

      if (action === 'override') {
        await query(`UPDATE substitution_requests SET status = 'filled' WHERE id = ?`, [request_id]);
        await query(`UPDATE substitution_assignments SET status = 'accepted' WHERE request_id = ? AND teacher_id = ?`,
          [request_id, teacher_id]);
        await query(
          `UPDATE timetable_slots SET teacher_id = ?, status = 'Substitute' WHERE id = ?`,
          [teacher_id, reqInfo.timetable_slot_id]);
        await insertChange(reqInfo, 'substitute',
          `Teacher: ${reqInfo.original_teacher || ''}`, `Teacher: ${assignee.name} (admin override)`,
          req.user, true);
        await log({
          user: req.user, action: 'substitute_override', entity: `request:${request_id}`,
          old_value: reqInfo.original_teacher, new_value: teacher_id, reason,
        });
        return res.json({ ok: true, message: `Override applied. ${assignee.name} now covers the class.` });
      }

      await log({
        user: req.user, action: 'substitute_assign', entity: `request:${request_id}`,
        old_value: 'open', new_value: `teacher:${teacher_id}`, reason,
      });
      return res.json({ ok: true, message: `Assignment pending. Waiting for ${assignee.name} to respond.` });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to process assignment.' });
  }
});

async function isQualifiedForSubject(teacherId, subjectId, originalTeacherId) {
  const subject = await queryOne('SELECT name, course_id FROM subjects WHERE id = ?', [subjectId]);
  if (!subject) return { ok: false, reason: 'Subject not found' };

  const sharesSubject = await queryOne(
    `SELECT id FROM timetable_slots WHERE teacher_id = ? AND subject_id = ? LIMIT 1`,
    [teacherId, subjectId]);
  if (sharesSubject) return { ok: true };

  const teacher = await queryOne(
    `SELECT t.department, u.name FROM teachers t JOIN users u ON u.id = t.user_id WHERE t.id = ?`, [teacherId]);
  const course = await queryOne('SELECT name FROM courses WHERE id = ?', [subject.course_id]);
  if (String(teacher?.department || '').toLowerCase() === String(course?.name || '').toLowerCase()) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: `Not qualified for "${subject.name}" (does not teach this subject and department differs from ${course?.name}).`,
  };
}

async function insertChange(reqInfo, changeType, oldValue, newValue, user, publishNow) {
  const status = publishNow ? 'approved' : 'pending';
  const publishedAt = publishNow ? new Date() : null;
  const approvedBy = publishNow ? user.id : null;
  const res2 = await query(
    `INSERT INTO timetable_changes (slot_id, change_type, old_value, new_value, published_at, status, approved_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [reqInfo.timetable_slot_id, changeType, oldValue, newValue, publishedAt, status, approvedBy]);
  if (publishNow) {
    await log({
      user, action: 'change_published', entity: `slot:${reqInfo.timetable_slot_id}`,
      old_value: oldValue, new_value: newValue,
    });
  }
  return res2.insertId;
}

async function conflictCheck({ teacher_id, day, start_time, end_time, room_id, section_id, batch_id, excludeSlotId, date }) {
  const daySlots = await query(
    `SELECT ts.id, ts.start_time, ts.end_time, ts.teacher_id, ts.room_id, ts.section_id, ts.batch_id,
            s.name AS subject_name, u.name AS teacher_name, r.name AS room_name
     FROM timetable_slots ts
     JOIN subjects s ON s.id = ts.subject_id
     JOIN teachers t ON t.id = ts.teacher_id
     JOIN users u ON u.id = t.user_id
     JOIN rooms r ON r.id = ts.room_id
     WHERE ts.day = ? AND ts.status <> 'Cancelled'`,
    [day]);
  const clashing = [];
  for (const slot of daySlots) {
    if (excludeSlotId && slot.id === excludeSlotId) continue;
    if (!isOverlap(start_time, end_time, slot.start_time, slot.end_time)) continue;

    if (slot.teacher_id === teacher_id && slot.id !== excludeSlotId) {
      clashing.push({ kind: 'teacher', label: `${slot.teacher_name} already has "${slot.subject_name}" ${timeToShort(slot.start_time)}–${timeToShort(slot.end_time)} (${slot.room_name}).` });
    }
    if (room_id && slot.room_id === room_id) {
      clashing.push({ kind: 'room', label: `Room ${slot.room_name} already occupied ${timeToShort(slot.start_time)}–${timeToShort(slot.end_time)}.` });
    }
  }
  return {
    hasClash: clashing.length > 0,
    clashing,
    details: clashing.map((c) => ({ kind: c.kind, label: c.label })),
  };
}

/* ---------------- Change history / audit ---------------- */

router.get('/history', async (req, res) => {
  try {
    const published = await query(
      `SELECT ch.id, ch.change_type, ch.old_value, ch.new_value, ch.published_at, ch.status, ch.created_at,
              au.name AS approved_by_name,
              ts.day, ts.start_time, ts.end_time, s.name AS subject_name, u.name AS teacher_name,
              r.name AS room_name, b.name AS batch_name, sec.name AS section_name, c.name AS course_name
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
       LEFT JOIN users au ON au.id = ch.approved_by
       WHERE ch.status = 'approved'
       ORDER BY ch.published_at DESC LIMIT 200`);

    const audit = await query(
      `SELECT al.id, al.action, al.entity, al.old_value, al.new_value, al.reason, al.created_at, u.name AS actor
       FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC LIMIT 200`);
    return res.json({ published, audit });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load history.' });
  }
});

module.exports = { router };