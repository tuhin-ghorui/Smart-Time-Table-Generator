const { query } = require('../config/db');

async function notify(userIds, type, message) {
  if (!userIds || !userIds.length) return;
  const unique = [...new Set(userIds.filter((id) => id != null))];
  for (const userId of unique) {
    try {
      await query('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)', [userId, type, message]);
    } catch (err) {
      console.error('[notify] failed:', err.message);
    }
  }
}

async function notifyByTeacherIds(teacherIds, type, message) {
  if (!teacherIds || !teacherIds.length) return;
  const rows = await query('SELECT user_id FROM teachers WHERE id IN (?)', [teacherIds]);
  await notify(rows.map((r) => r.user_id), type, message);
}

async function notifyAdmins(type, message) {
  const admins = await query("SELECT id FROM users WHERE role = 'admin'");
  await notify(admins.map((r) => r.id), type, message);
}

module.exports = { notify, notifyByTeacherIds, notifyAdmins };