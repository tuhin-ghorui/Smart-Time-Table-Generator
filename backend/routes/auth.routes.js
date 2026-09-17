const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, queryOne } = require('../config/db');
const { authRequired } = require('../middlewares/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const user = await queryOne('SELECT id, name, email, password_hash, role FROM users WHERE email = ?', [email]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials.' });

    const teacher = await queryOne('SELECT id, user_id FROM teachers WHERE user_id = ?', [user.id]);
    const token = signToken(user);
    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, teacher_id: teacher?.id || null },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Login failed.' });
  }
});

router.get('/me', authRequired, async (req, res) => {
  try {
    const user = await queryOne(
      'SELECT id, name, email, role FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const teacher = await queryOne('SELECT id, user_id, department, qualifications FROM teachers WHERE user_id = ?', [user.id]);
    return res.json({ user: { ...user, teacher_id: teacher?.id || null, department: teacher?.department || null } });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load profile.' });
  }
});

module.exports = { router, signToken };