/* Seeds CampusTime with demo data.
 * Usage:
 *   npm run seed          (adds demo data; skips if already seeded)
 *   npm run seed:reset    (wipes tables, then seeds)
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, query } = require('../config/db');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [
  ['09:00:00', '10:00:00'],
  ['10:00:00', '11:00:00'],
  ['11:15:00', '12:15:00'],
  ['12:15:00', '13:15:00'],
  ['14:00:00', '15:00:00'],
];

function weekdayDate() {
  const d = new Date();
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return iso(d);
}

function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayNameOf(dateStr) {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[new Date(dateStr + 'T00:00:00').getDay()];
}

async function reset() {
  const tables = [
    'notifications', 'audit_logs', 'timetable_changes', 'substitution_assignments',
    'substitution_candidates', 'substitution_requests', 'attendance_records',
    'timetable_slots', 'batches', 'sections', 'academic_years', 'subjects',
    'rooms', 'teachers', 'users', 'courses',
  ];
  await query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of tables) await query(`TRUNCATE TABLE ${t}`);
  await query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('All tables truncated.');
}

async function seedBase() {
  const adminHash = await bcrypt.hash('admin123', 10);
  const teacherHash = await bcrypt.hash('teacher123', 10);

  await query('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    ['Dr. Anita Rao (Admin)', 'admin@campustime.test', adminHash, 'admin']);

  const teacherNames = [
    'Prof. Rajesh Kumar', 'Prof. Sunita Sharma', 'Prof. Arjun Mehta', 'Prof. Neha Patel',
    'Prof. Vikram Singh', 'Prof. Priya Nair', 'Prof. Sameer Joshi', 'Prof. Kavita Desai',
  ];
  for (let i = 0; i < teacherNames.length; i++) {
    const userId = (await query('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [teacherNames[i], `teacher${i + 1}@campustime.test`, teacherHash, 'teacher'])).insertId;
    await query('INSERT INTO teachers (user_id, department, qualifications) VALUES (?, ?, ?)',
      [userId, 'BCA', 'M.Tech / M.Sc']);
  }

  const courseId = (await query('INSERT INTO courses (name) VALUES (?)', ['BCA'])).insertId;
  const yearIds = [];
  for (const yn of ['FY', 'SY', 'TY']) {
    yearIds.push((await query('INSERT INTO academic_years (course_id, name) VALUES (?, ?)', [courseId, yn])).insertId);
  }
  for (const yid of yearIds) {
    for (const sname of ['A', 'B']) {
      await query('INSERT INTO sections (academic_year_id, name) VALUES (?, ?)', [yid, sname]);
    }
  }
  for (const s of [
    'Data Structures', 'Web Technologies', 'Database Management Systems', 'Operating Systems',
    'Mathematics-II', 'Python Programming', 'Computer Networks', 'Software Engineering',
  ]) {
    await query('INSERT INTO subjects (name, course_id) VALUES (?, ?)', [s, courseId]);
  }
  for (const r of ['R-101', 'R-102', 'R-103']) {
    await query('INSERT INTO rooms (name, type) VALUES (?, ?)', [r, 'room']);
  }
  for (const r of ['Lab-1', 'Lab-2']) {
    await query('INSERT INTO rooms (name, type) VALUES (?, ?)', [r, 'lab']);
  }

  const sections = await query('SELECT id FROM sections');
  for (const sec of sections) {
    for (const b of ['Batch 1', 'Batch 2', 'Batch 3']) {
      await query('INSERT INTO batches (section_id, name, is_active) VALUES (?, ?, 1)', [sec.id, b]);
    }
  }
}

let insertedSlots = 0;

async function insertSlot(f) {
  await query(
    `INSERT INTO timetable_slots
       (academic_year_id, section_id, batch_id, subject_id, teacher_id, day, start_time, end_time, room_id, session_type, status, is_published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled', 1)`,
    [f.academic_year_id, f.section_id, f.batch_id, f.subject_id, f.teacher_id,
     f.day, f.start_time, f.end_time, f.room_id, f.session_type]
  );
  insertedSlots++;
}

async function buildTimetable() {
  const sections = await query('SELECT id, academic_year_id FROM sections ORDER BY id');
  const subjects = await query('SELECT id FROM subjects ORDER BY id');
  const teachers = await query('SELECT id FROM teachers ORDER BY id');
  const rooms = await query("SELECT id FROM rooms WHERE type='room' ORDER BY id");
  const labs = await query("SELECT id FROM rooms WHERE type='lab' ORDER BY id");
  const batches = await query('SELECT id, section_id FROM batches ORDER BY id');

  const T = teachers.length;
  const S = subjects.length;

  // Lectures: section-wide, P1-P3, one distinct teacher per concurrent slot
  for (let k = 0; k < sections.length; k++) {
    const section = sections[k];
    for (let d = 0; d < DAYS.length; d++) {
      for (let p = 0; p < 3; p++) {
        const idx = (k + d + p) % T;
        await insertSlot({
          academic_year_id: section.academic_year_id,
          section_id: section.id,
          batch_id: null,
          subject_id: subjects[idx % S].id,
          teacher_id: teachers[idx].id,
          day: DAYS[d],
          start_time: PERIODS[p][0],
          end_time: PERIODS[p][1],
          room_id: rooms[(k + d) % rooms.length].id,
          session_type: 'Lecture',
        });
      }
    }
  }

  // Practicals: batch-specific, in labs, one per batch per week
  for (let k = 0; k < sections.length; k++) {
    const section = sections[k];
    const myBatches = batches.filter((b) => b.section_id === section.id);
    for (let b = 0; b < myBatches.length; b++) {
      const dayIdx = b % DAYS.length;
      const idx = (k + 4 + b) % T;
      await insertSlot({
        academic_year_id: section.academic_year_id,
        section_id: section.id,
        batch_id: myBatches[b].id,
        subject_id: subjects[idx % S].id,
        teacher_id: teachers[idx].id,
        day: DAYS[dayIdx],
        start_time: PERIODS[3][0],
        end_time: PERIODS[3][1],
        room_id: labs[(k + b) % labs.length].id,
        session_type: 'Practical',
      });
    }
  }
}

async function createDemoAbsenceAndRequests() {
  const date = weekdayDate();
  const day = dayNameOf(date);
  const teachers = await query('SELECT id FROM teachers ORDER BY id');
  if (teachers.length < 6) return null;

  const absentIds = [teachers[2].id, teachers[5].id];
  for (const tid of absentIds) {
    await query(
      `INSERT INTO attendance_records (teacher_id, date, status, reason, source) VALUES (?, ?, 'absent', ?, 'system')`,
      [tid, date, 'Seeded absence for demo']
    );
    const slots = await query('SELECT id FROM timetable_slots WHERE teacher_id = ? AND day = ?', [tid, day]);
    for (const slot of slots) {
      await query(
        `INSERT INTO substitution_requests (timetable_slot_id, date, status, reason) VALUES (?, ?, 'open', ?)`,
        [slot.id, date, `Teacher absent on ${date}`]
      );
    }
  }

  const admin = await query("SELECT id FROM users WHERE role='admin' LIMIT 1");
  if (admin.length) {
    await query('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)',
      [admin[0].id, 'system', `Demo data ready. Absence recorded for ${date} (${day}); substitution requests generated.`]);
  }
  return date;
}

async function main() {
  if (process.argv.includes('--reset')) await reset();

  const existing = await query('SELECT COUNT(*) AS cnt FROM users');
  if (existing[0].cnt > 0) {
    console.log('Database already has data. Use "npm run seed:reset" to wipe and reseed.');
    return;
  }

  console.log('Seeding users, structure, subjects, rooms and batches...');
  await seedBase();
  console.log('Building timetable...');
  await buildTimetable();
  const demoDate = await createDemoAbsenceAndRequests();

  console.log(`Inserted ${insertedSlots} timetable slots.`);
  console.log('Demo logins:');
  console.log('  Admin   -> admin@campustime.test   / admin123');
  console.log('  Teacher -> teacher1@campustime.test / teacher123');
  if (demoDate) console.log(`Open substitution requests seeded for ${demoDate}.`);
  console.log('Seed complete.');
}

if (require.main === module) {
  main()
    .then(() => pool.end())
    .catch(async (err) => {
      console.error('Seed failed:', err.message);
      try { await pool.end(); } catch { /* ignore */ }
      process.exit(1);
    });
}