const { query, queryOne } = require('../config/db');
const { dayNameOf, isOverlap } = require('../utils/helpers');

// Filter by hard rules (free at exact time, qualified for subject) then rank
// by soft factors (daily load, free periods, substitution load, etc).
async function recommendations(requestId, date) {
  const reqRow = await queryOne(
    `SELECT sr.id, sr.date, sr.status,
            ts.subject_id, ts.session_type, ts.day AS slot_day,
            ts.start_time, ts.end_time, ts.section_id, ts.room_id, ts.teacher_id AS original_teacher_id,
            s.name AS subject_name, s.course_id,
            c.name AS course_name, c.id AS course_id,
            sec.name AS section_name,
            r.type AS room_type
     FROM substitution_requests sr
     JOIN timetable_slots ts ON ts.id = sr.timetable_slot_id
     JOIN subjects s ON s.id = ts.subject_id
     JOIN courses c ON c.id = s.course_id
     JOIN sections sec ON sec.id = ts.section_id
     JOIN rooms r ON r.id = ts.room_id
     WHERE sr.id = ?`,
    [requestId]
  );
  if (!reqRow) return { error: 'Substitution request not found.' };

  const day = dayNameOf(date || reqRow.date);
  const absentTeachers = await query(
    `SELECT teacher_id FROM attendance_records WHERE date = ? AND status IN ('absent', 'leave')`,
    [date || reqRow.date]
  );
  const absentSet = new Set(absentTeachers.map((t) => t.teacher_id));
  const daySlots = await query(
    `SELECT ts.* FROM timetable_slots ts
     WHERE ts.day = ? AND ts.is_published = 1 AND ts.status <> 'Cancelled'`,
    [day]
  );

  // Existing substitution involvement for that date
  const subInvolvement = await query(
    `SELECT sa.teacher_id, COUNT(*) AS cnt
     FROM substitution_assignments sa
     JOIN substitution_requests sr ON sr.id = sa.request_id
     WHERE sr.date = ? AND sa.status IN ('pending', 'accepted', 'review')
     GROUP BY sa.teacher_id`,
    [date || reqRow.date]
  );
  const subSet = new Map(subInvolvement.map((r) => [r.teacher_id, r.cnt]));

  const slotById = new Map(daySlots.map((s) => [s.teacher_id, s]));

  const teachers = await query(
    `SELECT t.id, t.department, t.qualifications, u.name
     FROM teachers t
     JOIN users u ON u.id = t.user_id
     WHERE u.role = 'teacher'
     ORDER BY u.name`
  );

  const teachersBySubject = new Map();
  const taught = await query(
    `SELECT teacher_id, subject_id FROM timetable_slots ts
     JOIN subjects s ON s.id = ts.subject_id`
  );
  for (const row of taught) {
    if (!teachersBySubject.has(row.teacher_id)) teachersBySubject.set(row.teacher_id, new Set());
    teachersBySubject.get(row.teacher_id).add(row.subject_id);
  }

  const sectionsByTeacher = new Map();
  for (const s of daySlots) {
    if (!sectionsByTeacher.has(s.teacher_id)) sectionsByTeacher.set(s.teacher_id, new Set());
    sectionsByTeacher.get(s.teacher_id).add(s.section_id);
  }

  const results = [];

  for (const t of teachers) {
    if (t.id === reqRow.original_teacher_id) continue;
    if (absentSet.has(t.id)) continue;

    const mySlots = daySlots.filter((s) => s.teacher_id === t.id);

    // HARD RULE 1: free at the exact time
    const clashing = mySlots.filter((s) => isOverlap(reqRow.start_time, reqRow.end_time, s.start_time, s.end_time));
    if (clashing.length) continue;

    // HARD RULE 2: qualified / eligible for the subject
    const teachesSubject = teachersBySubject.get(t.id)?.has(reqRow.subject_id) === true;
    const deptMatch = String(t.department || '').toLowerCase() === String(reqRow.course_name || '').toLowerCase();
    if (!teachesSubject && !deptMatch) continue;

    // ---- soft factors ----
    let score = 60;
    const reasons = [`Available ✓`, `Qualified ✓`];

    if (teachesSubject) {
      score += 10;
      reasons.push('Already teaches this subject');
    }
    if (deptMatch) {
      score += 6;
      reasons.push('Department matches course');
    }

    const dailyLoad = mySlots.length;
    score += Math.max(0, 10 - dailyLoad * 2);
    reasons.push(`${dailyLoad === 0 ? 'Free all day' : `Only ${dailyLoad} lecture${dailyLoad > 1 ? 's' : ''} today`}`);

    const gapBreaks = Math.max(0, 8 - dailyLoad);
    score += Math.min(6, gapBreaks);

    const subLoad = subSet.get(t.id) || 0;
    if (subLoad > 0) {
      score -= subLoad * 6;
      reasons.push(`Already covering ${subLoad} substitution${subLoad > 1 ? 's' : ''} today`);
    } else {
      score += 4;
      reasons.push('No existing substitution load');
    }

    // consecutive lecture conflict: busy in the period right before/after
    const adjacent = mySlots.some(
      (s) => s.end_time === reqRow.start_time || s.start_time === reqRow.end_time
    );
    if (adjacent) {
      score -= 4;
      reasons.push('Adjoining lecture (no break)');
    } else {
      score += 3;
      reasons.push('Comfortable gap around this slot');
    }

    const weeklyWorkload = taught.length;
    if (dailyLoad <= 2) score += 4; else score -= 2;
    if (weeklyWorkload <= 20) score += 2;

    // lab capability
    if (String(reqRow.session_type).toLowerCase().includes('pract') || reqRow.room_type === 'lab') {
      const labSessions = daySlots.filter((s) => s.teacher_id === t.id && s.session_type.toLowerCase().includes('pract'));
      if (labSessions.length) {
        score += 6;
        reasons.push('Handles practicals/labs');
      } else {
        score -= 4;
        reasons.push('Less lab experience');
      }
    } else {
      score += 2;
      reasons.push('Comfortable with theory sessions');
    }

    // class compatibility
    const knowsSection = sectionsByTeacher.get(t.id)?.has(reqRow.section_id);
    if (knowsSection) {
      score += 5;
      reasons.push('Already teaches this section');
    }

    const weeklyCount = new Map();
    for (const s of daySlots) weeklyCount.set(s.teacher_id, (weeklyCount.get(s.teacher_id) || 0) + 1);
    const wk = weeklyCount.get(t.id) || 0;
    reasons.push(`Weekly workload: ${wk} periods`);

    score = Math.max(0, Math.min(100, Math.round(score)));

    results.push({
      teacher_id: t.id,
      name: t.name,
      department: t.department,
      score,
      reasons,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return { request: reqRow, candidates: results };
}

module.exports = { recommendations };