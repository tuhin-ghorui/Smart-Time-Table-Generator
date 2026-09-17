const { query } = require('../config/db');

async function log({ user, role, action, entity, old_value, new_value, reason }) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, role, action, entity, old_value, new_value, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        user && user.id != null ? user.id : null,
        role || (user && user.role) || null,
        action,
        entity,
        old_value != null ? old_value : null,
        new_value != null ? new_value : null,
        reason || null,
      ]
    );
  } catch (err) {
    console.error('[audit] failed to write:', err.message);
  }
}

module.exports = { log };