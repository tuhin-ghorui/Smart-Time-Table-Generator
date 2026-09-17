const express = require('express');
const { query, queryOne } = require('../config/db');
const { authRequired, role } = require('../middlewares/auth');
const { todayStr, dayNameOf, timeToShort, isOverlap } = require('../utils/helpers');
const { recommendations } = require('../services/ai.service');
const { notify, notifyByTeacherIds, notifyAdmins } = require('../services/notify.service');
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
    const pendingApproval = await query(
      `SELECT COUNT(*) AS cnt FROM timetable_changes WHERE status = 'pending'`);

    return res.json({
      date,
      total_teachers: totalTeachers.cnt,
      classes_today: classesToday.cnt,
      present: attMap.present || 0,
      absent: (attMap.absent || 0) + (attMap.leave || 0),
      affected_classes: affected[0].cnt,
      uncovered_classes: uncovered.cnt,
      substitutes_assigned: substitutes[0].cnt,
      pending_approval: pendingApproval[0].cnt,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load dashboard.' });
  }
});

/* ---------------- Attendance ---------------- */

router.get('/attendance', async (req, res) => {
  try {
    const date = req.query.date || todayStr();
    const day = dayNameOf(date);
    const rows = await query(
      `SELECT t.id AS teacher_id, u.name, t.department,
              (SELECT COUNT(*) FROM timetable_slots ts WHERE ts.teacher_id = t.id AND ts.day = ? AND ts.status <> 'Cancelled') AS classes_today,
              a.status, a.reason
       FROM teachers t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN attendance_records a ON a.teacher_id = t.id AND a.date = ?
       WHERE u.role = 'teacher'
       ORDER BY u.name`,
      [day, date]);
    return res.json({ date, teachers: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load attendance.' });
  }
});

router.post('/attendance', async (req, res) => {
  try {
    const { date, teacher_id, status, reason } = req.body || {};
    if (!date || !teacher_id || !status) return res.status(400).json({ error: 'date, teacher_id, status are required.' });
    const valid = ['present', 'absent', 'leave'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status.' });

    const existing = await queryOne('SELECT * FROM attendance_records WHERE teacher_id = ? AND date = ?', [teacher_id, date]);
    if (existing) {
      await query(`UPDATE attendance_records SET status = ?, reason = ?, source = 'manual' WHERE id = ?`,
        [status, reason || null, existing.id]);
    } else {
      await query(`INSERT INTO attendance_records (teacher_id, date, status, reason, source) VALUES (?, ?, ?, ?, 'manual')`,
        [teacher_id, date, status, reason || null]);
    }
    const teacher = await queryOne(
      `SELECT u.name FROM teachers t JOIN users u ON u.id = t.user_id WHERE t.id = ?`, [teacher_id]);
    await log({
      user: req.user, action: 'attendance_update', entity: `teacher:${teacher_id}`,
      old_value: existing?.status || 'unmarked', new_value: status, reason,
    });
    return res.json({ ok: true, message: `${teacher?.name || 'Teacher'} marked ${status} for ${date}.` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update attendance.' });
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
  b.name AS batch_name, sec.name AS section_name, c.name AS course_name`;

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

async function notifyUnassignedAdmins() {
  await notifyAdmins('substitution', 'A substitution assignment requires attention.');
}

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

/* ---------------- Timetable editor ---------------- */

const ADMIN_SLOT_SELECT = `SELECT ts.*, s.name AS subject_name, u.name AS teacher_name,
  r.name AS room_name, r.type AS room_type,
  b.name AS batch_name, sec.name AS section_name, c.name AS course_name, ay.name AS year_name`;

router.get('/timetable', async (req, res) => {
  try {
    const { section_id, batch_id } = req.query;
    if (!section_id) return res.status(400).json({ error: 'section_id is required.' });
    let sql = `${ADMIN_SLOT_SELECT}
      FROM timetable_slots ts
      JOIN subjects s ON s.id = ts.subject_id
      JOIN teachers t ON t.id = ts.teacher_id
      JOIN users u ON u.id = t.user_id
      JOIN rooms r ON r.id = ts.room_id
      LEFT JOIN batches b ON b.id = ts.batch_id
      JOIN sections sec ON sec.id = ts.section_id
      JOIN academic_years ay ON ay.id = ts.academic_year_id
      JOIN courses c ON c.id = ay.course_id
      WHERE ts.section_id = ?`;
    const params = [section_id];
    if (batch_id) {
      sql += ` AND (ts.batch_id = ? OR ts.batch_id IS NULL)`;
      params.push(batch_id);
    } else {
      sql += ` AND ts.batch_id IS NULL`;
    }
    sql += ` ORDER BY FIELD(ts.day, 'Monday','Tuesday','Wednesday','Thursday','Friday'), ts.start_time`;
    const rows = await query(sql, params);
    return res.json({ slots: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load timetable.' });
  }
});

router.post('/timetable/slots', async (req, res) => {
  try {
    const b = req.body || {};
    const required = ['academic_year_id', 'section_id', 'subject_id', 'teacher_id', 'day', 'start_time', 'end_time', 'room_id'];
    for (const k of required) {
      if (b[k] == null) return res.status(400).json({ error: `${k} is required.` });
    }
    const conflict = await conflictCheck({
      teacher_id: b.teacher_id, day: b.day, start_time: b.start_time,
      end_time: b.end_time, room_id: b.room_id, excludeSlotId: b.id || null,
    });
    if (conflict.hasClash && b.override !== true) {
      return res.status(409).json({ error: 'Conflict detected.', conflicts: conflict.details });
    }

    const sessionType = b.session_type || 'Lecture';
    const status = b.status || 'Scheduled';
    const isPublished = b.is_published === false || b.publish === false ? 0 : 1;

    if (b.id) {
      const old = await queryOne('SELECT * FROM timetable_slots WHERE id = ?', [b.id]);
      await query(
        `UPDATE timetable_slots SET academic_year_id=?, section_id=?, batch_id=?, subject_id=?, teacher_id=?,
                day=?, start_time=?, end_time=?, room_id=?, session_type=?, status=?, is_published=?
         WHERE id = ?`,
        [b.academic_year_id, b.section_id, b.batch_id || null, b.subject_id, b.teacher_id,
         b.day, b.start_time, b.end_time, b.room_id, sessionType, status, isPublished, b.id]);
      await query(
        `INSERT INTO timetable_changes (slot_id, change_type, old_value, new_value, status, approved_by)
         VALUES (?, 'updated', ?, ?, ?, ?)`,
        [b.id, JSON.stringify(old), JSON.stringify(b), 'approved', req.user.id]);
      await log({
        user: req.user, action: 'slot_update', entity: `slot:${b.id}`,
        old_value: JSON.stringify(old), new_value: JSON.stringify(b),
      });
      return res.json({ ok: true, message: 'Slot updated.' });
    }

    const result = await query(
      `INSERT INTO timetable_slots (academic_year_id, section_id, batch_id, subject_id, teacher_id, day, start_time, end_time, room_id, session_type, status, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [b.academic_year_id, b.section_id, b.batch_id || null, b.subject_id, b.teacher_id,
       b.day, b.start_time, b.end_time, b.room_id, sessionType, status, isPublished]);
    await query(
      `INSERT INTO timetable_changes (slot_id, change_type, old_value, new_value, status, approved_by)
       VALUES (?, 'created', ?, ?, 'approved', ?)`,
      [result.insertId, '—', 'created', req.user.id]);
    await log({
      user: req.user, action: 'slot_create', entity: `slot:${result.insertId}`,
      new_value: JSON.stringify(b),
    });
    return res.json({ ok: true, id: result.insertId, message: 'Slot created.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to save slot.' });
  }
});

router.delete('/timetable/slots/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const old = await queryOne('SELECT * FROM timetable_slots WHERE id = ?', [id]);
    if (!old) return res.status(404).json({ error: 'Slot not found.' });
    await query(`UPDATE timetable_slots SET status = 'Cancelled' WHERE id = ?`, [id]);
    await query(
      `INSERT INTO timetable_changes (slot_id, change_type, old_value, new_value, status, approved_by)
       VALUES (?, 'cancelled', ?, 'class cancelled', 'approved', ?)`,
      [id, JSON.stringify(old), req.user.id]);
    await log({
      user: req.user, action: 'slot_cancel', entity: `slot:${id}`,
      old_value: JSON.stringify(old), new_value: 'Cancelled',
    });
    return res.json({ ok: true, message: 'Slot cancelled (kept in history).' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to cancel slot.' });
  }
});

router.post('/timetable/validate', async (req, res) => {
  try {
    const b = req.body || {};
    const conflict = await conflictCheck({
      teacher_id: b.teacher_id, day: b.day, start_time: b.start_time,
      end_time: b.end_time, room_id: b.room_id, excludeSlotId: b.id || null,
    });
    return res.json({ ok: !conflict.hasClash, conflicts: conflict.details });
  } catch (err) {
    return res.status(500).json({ error: 'Validation failed.' });
  }
});

router.get('/pending-changes', async (req, res) => {
  try {
    const rows = await query(
      `SELECT ch.id, ch.change_type, ch.old_value, ch.new_value, ch.status, ch.created_at,
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
       WHERE ch.status = 'pending' ORDER BY ch.created_at DESC`);
    return res.json({ changes: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load pending changes.' });
  }
});

router.post('/timetable/changes/:id/approve', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ch = await queryOne('SELECT * FROM timetable_changes WHERE id = ?', [id]);
    if (!ch) return res.status(404).json({ error: 'Change not found.' });
    await query(
      `UPDATE timetable_changes SET status='approved', published_at=NOW(), approved_by=? WHERE id=?`,
      [req.user.id, id]);
    await log({
      user: req.user, action: 'change_approve', entity: `change:${id}`,
      old_value: ch.old_value, new_value: ch.new_value,
    });
    return res.json({ ok: true, message: 'Change approved and published to public timetable.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to approve change.' });
  }
});

router.post('/timetable/changes/:id/reject', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ch = await queryOne('SELECT * FROM timetable_changes WHERE id = ?', [id]);
    if (!ch) return res.status(404).json({ error: 'Change not found.' });
    await query(`UPDATE timetable_changes SET status='rejected', approved_by=? WHERE id=?`, [req.user.id, id]);
    await log({
      user: req.user, action: 'change_reject', entity: `change:${id}`,
      old_value: ch.old_value, new_value: ch.new_value,
    });
    return res.json({ ok: true, message: 'Change rejected.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reject change.' });
  }
});

/* ---------------- Batches CRUD ---------------- */

router.get('/batches', async (req, res) => {
  try {
    const { section_id } = req.query;
    let rows;
    if (section_id) {
      rows = await query(`SELECT * FROM batches WHERE section_id = ? ORDER BY is_active DESC, name`, [section_id]);
    } else {
      rows = await query(
        `SELECT b.*, sec.name AS section_name, ay.name AS year_name, c.name AS course_name
         FROM batches b
         JOIN sections sec ON sec.id = b.section_id
         JOIN academic_years ay ON ay.id = sec.academic_year_id
         JOIN courses c ON c.id = ay.course_id
         ORDER BY ay.name, sec.name, b.name`);
    }
    return res.json({ batches: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load batches.' });
  }
});

router.post('/batches', async (req, res) => {
  try {
    const { section_id, name } = req.body || {};
    if (!section_id || !name) return res.status(400).json({ error: 'section_id and name are required.' });
    const dup = await queryOne('SELECT id FROM batches WHERE section_id = ? AND name = ?', [section_id, name]);
    if (dup) return res.status(409).json({ error: 'Batch already exists in this section.' });
    const result = await query(`INSERT INTO batches (section_id, name, is_active) VALUES (?, ?, 1)`, [section_id, name]);
    await log({
      user: req.user, action: 'batch_create', entity: `section:${section_id}`,
      new_value: name,
    });
    return res.json({ ok: true, id: result.insertId, message: 'Batch created.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create batch.' });
  }
});

router.patch('/batches/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, is_active } = req.body || {};
    const batch = await queryOne('SELECT * FROM batches WHERE id = ?', [id]);
    if (!batch) return res.status(404).json({ error: 'Batch not found.' });
    if (name != null && String(name).trim() !== batch.name) {
      const dup = await queryOne('SELECT id FROM batches WHERE section_id = ? AND name = ? AND id <> ?', [batch.section_id, name, id]);
      if (dup) return res.status(409).json({ error: 'Batch name already used in this section.' });
    }
    const newName = name != null ? String(name).trim() : batch.name;
    const newActive = is_active != null ? (is_active ? 1 : 0) : batch.is_active;
    await query(`UPDATE batches SET name=?, is_active=? WHERE id=?`, [newName, newActive, id]);
    await log({
      user: req.user, action: 'batch_update', entity: `batch:${id}`,
      old_value: JSON.stringify({ name: batch.name, is_active: batch.is_active }),
      new_value: JSON.stringify({ name: newName, is_active: newActive }),
    });
    return res.json({ ok: true, message: 'Batch updated.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update batch.' });
  }
});

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

/* ---------------- Notifications ---------------- */

router.get('/notifications', async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, type, message, \`read\`, created_at FROM notifications
       WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`, [req.user.id]);
    return res.json({ notifications: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load notifications.' });
  }
});

router.post('/notifications/:id/read', async (req, res) => {
  try {
    await query(`UPDATE notifications SET \`read\` = 1 WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id]);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update notification.' });
  }
});

router.post('/notifications/read-all', async (req, res) => {
  try {
    await query(`UPDATE notifications SET \`read\` = 1 WHERE user_id = ?`, [req.user.id]);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update notifications.' });
  }
});

/* ---------------- Lookup / dropdown data for editor ---------------- */

router.get('/teachers', async (_req, res) => {
  try {
    const rows = await query(
      `SELECT t.id AS teacher_id, u.id AS user_id, u.name, t.department, t.qualifications
       FROM teachers t JOIN users u ON u.id = t.user_id WHERE u.role = 'teacher' ORDER BY u.name`);
    return res.json({ teachers: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load teachers.' });
  }
});

router.get('/lookup', async (_req, res) => {
  try {
    const courses = await query('SELECT id, name FROM courses ORDER BY name');
    const years = await query('SELECT id, course_id, name FROM academic_years ORDER BY name');
    const sections = await query('SELECT id, academic_year_id, name FROM sections ORDER BY name');
    const subjects = await query('SELECT id, name, course_id FROM subjects ORDER BY name');
    const rooms = await query('SELECT id, name, type FROM rooms ORDER BY name');
    const batches = await query('SELECT id, section_id, name, is_active FROM batches ORDER BY name');
    return res.json({ courses, years, sections, subjects, rooms, batches });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load lookup data.' });
  }
});

router.post('/subjects', async (req, res) => {
  try {
    const { name, course_id } = req.body || {};
    if (!name || !course_id) return res.status(400).json({ error: 'name and course_id are required.' });
    const result = await query(`INSERT INTO subjects (name, course_id) VALUES (?, ?)`, [name, course_id]);
    await log({ user: req.user, action: 'subject_create', entity: `course:${course_id}`, new_value: name });
    return res.json({ ok: true, id: result.insertId, message: 'Subject created.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create subject.' });
  }
});

router.post('/rooms', async (req, res) => {
  try {
    const { name, type } = req.body || {};
    if (!name || !type) return res.status(400).json({ error: 'name and type are required.' });
    const result = await query(`INSERT INTO rooms (name, type) VALUES (?, ?)`, [name, type]);
    await log({ user: req.user, action: 'room_create', entity: 'rooms', new_value: `${name} (${type})` });
    return res.json({ ok: true, id: result.insertId, message: 'Room created.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create room.' });
  }
});

module.exports = { router };