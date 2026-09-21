const express = require('express');
const { query, queryOne } = require('../config/db');
const { authRequired, role } = require('../middlewares/auth');
const { todayStr, dayNameOf, weekDates, timeToShort } = require('../utils/helpers');
const { notifyAdmins } = require('../services/notify.service');
const { log } = require('../services/audit.service');

const router = express.Router();
router.use(authRequired, role(['teacher', 'admin']));

const SLOT_SELECT = `SELECT ts.id, ts.day, ts.start_time, ts.end_time, ts.session_type, ts.status, ts.is_published,
  s.name AS subject_name, u.name AS teacher_name, r.name AS room_name, r.type AS room_type,
  b.name AS batch_name, sec.name AS section_name, c.name AS course_name, ay.name AS year_name`;

const SLOT_JOINS = `JOIN subjects s ON s.id = ts.subject_id
  JOIN teachers t ON t.id = ts.teacher_id
  JOIN users u ON u.id = t.user_id
  JOIN rooms r ON r.id = ts.room_id
  LEFT JOIN batches b ON b.id = ts.batch_id
  JOIN sections sec ON sec.id = ts.section_id
  JOIN academic_years ay ON ay.id = ts.academic_year_id
  JOIN courses c ON c.id = ay.course_id`;

async function teacherIdFor(req) {
  const t = await queryOne('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
  return t?.id || null;
}

router.post('/attendance', authRequired, async (req, res) => {
  try {
    const { date, status } = req.body || {};
    if (!date || !status) return res.status(400).json({ error: 'date and status are required.' });
    const valid = ['present', 'absent'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    if (date !== todayStr()) return res.status(400).json({ error: 'You can mark attendance for today only.' });

    const userId = req.user.id;
    const teacher = await queryOne('SELECT id, user_id FROM teachers WHERE user_id = ?', [userId]);
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found.' });

    const existing = await queryOne('SELECT * FROM attendance_records WHERE teacher_id = ? AND date = ?', [teacher.id, date]);
    if (existing) {
      return res.status(409).json({ error: `You already marked yourself ${existing.status} for today. Your status cannot be changed.` });
    }
    await query(`INSERT INTO attendance_records (teacher_id, date, status, reason, source) VALUES (?, ?, ?, ?, 'teacher')`,
      [teacher.id, date, status, null]);

    const teacherName = await queryOne('SELECT u.name FROM teachers t JOIN users u ON u.id = t.user_id WHERE t.id = ?', [teacher.id]);

    await log({
      user: req.user, action: 'teacher_attendance_update', entity: `teacher:${teacher.id}`,
      new_value: status,
      reason: `Teacher marked ${status} for ${date}`,
    });

    await notifyAdmins('attendance', `${teacherName?.name || 'Teacher'} marked ${status} for ${date}.`);

    let autoCreated = 0;
    if (status === 'absent') {
      const day = dayNameOf(date);
      const slots = await query(
        `SELECT id FROM timetable_slots WHERE teacher_id = ? AND day = ? AND status <> 'Cancelled'`,
        [teacher.id, day]);
      for (const slot of slots) {
        const existing = await queryOne(
          `SELECT id FROM substitution_requests WHERE timetable_slot_id = ? AND date = ?`, [slot.id, date]);
        if (!existing) {
          await query(
            `INSERT INTO substitution_requests (timetable_slot_id, date, status, reason) VALUES (?, ?, 'open', ?)`,
            [slot.id, date, `Teacher marked ${status} on ${date}`]);
          autoCreated++;
        }
      }
    }

    return res.json({
      ok: true,
      message: `${teacherName?.name || 'Teacher'} marked ${status} for ${date}.`,
      auto_created_requests: autoCreated,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update attendance.' });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const tid = await teacherIdFor(req);
    if (!tid) return res.status(404).json({ error: 'Teacher profile not found.' });
    const day = dayNameOf(todayStr());
    const slots = await query(
      `${SLOT_SELECT} FROM timetable_slots ts ${SLOT_JOINS}
       WHERE ts.teacher_id = ? AND ts.day = ? AND ts.is_published = 1 AND ts.status <> 'Cancelled'
       ORDER BY ts.start_time`, [tid, day]);

    const pending = await query(
      `SELECT COUNT(*) AS cnt FROM substitution_assignments sa
       JOIN substitution_requests sr ON sr.id = sa.request_id
       WHERE sa.teacher_id = ? AND sa.status = 'pending'`, [tid]);
    const accepted = await query(
      `SELECT COUNT(*) AS cnt FROM substitution_assignments sa
       WHERE sa.teacher_id = ? AND sa.status = 'accepted'`, [tid]);
    const attendance = await queryOne(
      `SELECT status, synced_at FROM attendance_records WHERE teacher_id = ? AND date = ?`, [tid, todayStr()]);

    return res.json({
      today: day,
      slots_today: slots.length,
      hours_today: slots.length,
      pending_subs: pending[0]?.cnt || 0,
      active_subs: accepted[0]?.cnt || 0,
      attendance_status: attendance?.status || 'unmarked',
      attendance_updated: attendance?.synced_at || null,
      today_slots: slots,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load dashboard.' });
  }
});

router.get('/schedule', async (req, res) => {
  try {
    const tid = await teacherIdFor(req);
    if (!tid) return res.status(404).json({ error: 'Teacher profile not found.' });
    const view = req.query.view || 'today';
    const date = req.query.date || todayStr();
    const day = dayNameOf(date);

    if (view === 'today') {
      const rows = await query(
        `${SLOT_SELECT} FROM timetable_slots ts ${SLOT_JOINS}
         WHERE ts.teacher_id = ? AND ts.day = ? AND ts.status <> 'Cancelled'
         ORDER BY ts.start_time`, [tid, day]);
      return res.json({ view, date, slots: rows });
    }

    const rows = await query(
      `${SLOT_SELECT} FROM timetable_slots ts ${SLOT_JOINS}
       WHERE ts.teacher_id = ? AND ts.status <> 'Cancelled' ORDER BY FIELD(ts.day, 'Monday','Tuesday','Wednesday','Thursday','Friday'), ts.start_time`, [tid]);
    const days = weekDates(date).map((d) => ({
      date: d,
      day: dayNameOf(d),
      slots: rows.filter((s) => s.day === dayNameOf(d)),
    }));
    return res.json({ view, date, slots: days });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load schedule.' });
  }
});

router.get('/assignments', async (req, res) => {
  try {
    const tid = await teacherIdFor(req);
    if (!tid) return res.status(404).json({ error: 'Teacher profile not found.' });
    const rows = await query(
      `SELECT sa.id, sa.status AS assignment_status, sa.created_at,
              sr.id AS request_id, sr.date, sr.reason,
              ts.day, ts.start_time, ts.end_time, ts.session_type,
              s.name AS subject_name, u.name AS original_teacher_name,
              r.name AS room_name, r.type AS room_type,
              b.name AS batch_name, sec.name AS section_name, c.name AS course_name
       FROM substitution_assignments sa
       JOIN substitution_requests sr ON sr.id = sa.request_id
       JOIN timetable_slots ts ON ts.id = sr.timetable_slot_id
       JOIN subjects s ON s.id = ts.subject_id
       JOIN teachers t ON t.id = ts.teacher_id
       JOIN users u ON u.id = t.user_id
       JOIN rooms r ON r.id = ts.room_id
       LEFT JOIN batches b ON b.id = ts.batch_id
       JOIN sections sec ON sec.id = ts.section_id
       JOIN academic_years ay ON ay.id = ts.academic_year_id
       JOIN courses c ON c.id = ay.course_id
       WHERE sa.teacher_id = ?
       ORDER BY sr.date DESC, ts.start_time`, [tid]);
    return res.json({ assignments: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load assignments.' });
  }
});

async function finalizeSubstitution(assignmentId, acceptedBy) {
  const assign = await queryOne(
    `SELECT sa.*, sr.timetable_slot_id, sr.id AS request_id, sr.date
     FROM substitution_assignments sa JOIN substitution_requests sr ON sr.id = sa.request_id
     WHERE sa.id = ?`, [assignmentId]);
  if (!assign) throw new Error('Assignment not found.');

  const oldSlot = await queryOne(
    `SELECT ts.*, t.user_id AS original_user_id, u.name AS original_name
     FROM timetable_slots ts JOIN teachers t ON t.id = ts.teacher_id JOIN users u ON u.id = t.user_id
     WHERE ts.id = ?`, [assign.timetable_slot_id]);
  const newTeacher = await queryOne(
    `SELECT t.user_id FROM teachers t WHERE t.id = ?`, [assign.teacher_id]);
  if (!oldSlot || !newTeacher) throw new Error('Slot or teacher missing.');

  await query(
    `UPDATE timetable_slots SET teacher_id = ?, status = 'Substitute', is_published = 1 WHERE id = ?`,
    [assign.teacher_id, assign.timetable_slot_id]
  );
  await query(`UPDATE substitution_requests SET status = 'filled' WHERE id = ?`, [assign.request_id]);
  await query(
    `INSERT INTO timetable_changes (slot_id, change_type, old_value, new_value, published_at, status, approved_by)
     VALUES (?, 'substitute', ?, ?, NOW(), 'approved', ?)`,
    [assign.timetable_slot_id, `Teacher ${oldSlot.original_name}`, `Teacher: ${acceptedBy.name} (substitute)`, acceptedBy.id]
  );

  await notifyAdmins('substitution',
    `${acceptedBy.name} accepted substitution for ${oldSlot.original_name}'s class. Timetable updated.`);
}

router.post('/assignments/:id/respond', async (req, res) => {
  try {
    const tid = await teacherIdFor(req);
    if (!tid) return res.status(404).json({ error: 'Teacher profile not found.' });
    const { action, reason } = req.body || {};
    const id = Number(req.params.id);
    const assign = await queryOne(
      `SELECT * FROM substitution_assignments WHERE id = ? AND teacher_id = ?`,
      [id, tid]);
    if (!assign) return res.status(404).json({ error: 'Assignment not found.' });
    if (assign.status !== 'pending' && action !== 'review') {
      return res.status(400).json({ error: 'Assignment already responded to.' });
    }

    if (action === 'accept') {
      await query(`UPDATE substitution_assignments SET status = 'accepted' WHERE id = ?`, [id]);
      await finalizeSubstitution(id, req.user);
      await log({
        user: req.user,
        action: 'substitute_accept',
        entity: `assignment:${id}`,
        new_value: 'accepted',
        reason,
      });
      return res.json({ ok: true, message: 'Substitution accepted. Published timetable updated.' });
    }

    if (action === 'decline') {
      await query(`UPDATE substitution_assignments SET status = 'declined', reason = ? WHERE id = ?`, [
        reason || 'Declined by teacher', id]);
      const reqInfo = await queryOne(
        `SELECT sr.id, ts.teacher_id FROM substitution_requests sr JOIN timetable_slots ts ON ts.id = sr.timetable_slot_id WHERE sr.id = ?`,
        [assign.request_id]);
      await notifyAdmins('substitution', `${req.user.name} declined a substitution request. Reassignment needed.`);
      await log({
        user: req.user,
        action: 'substitute_decline',
        entity: `assignment:${id}`,
        new_value: 'declined',
        reason,
      });
      return res.json({ ok: true, message: 'Assignment declined. Admins notified.' });
    }

    if (action === 'review') {
      await query(`UPDATE substitution_assignments SET status = 'review', reason = ? WHERE id = ?`, [
        reason || 'Requested review', id]);
      await notifyAdmins('substitution', `${req.user.name} requested review of a substitution assignment.`);
      await log({
        user: req.user,
        action: 'substitute_review',
        entity: `assignment:${id}`,
        new_value: 'review',
        reason,
      });
      return res.json({ ok: true, message: 'Review requested. Admins notified.' });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to respond to assignment.' });
  }
});

module.exports = { router };