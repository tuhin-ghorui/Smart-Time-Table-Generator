require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { router: authRouter } = require('./routes/auth.routes');
const publicRoutes = require('./routes/public.routes');
const teacherRoutes = require('./routes/teacher.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'CampusTime API' }));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/public', publicRoutes.router);
app.use('/api/teacher', teacherRoutes.router);
app.use('/api/admin', adminRoutes.router);

// 404
app.use((_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err);
  return res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`CampusTime API running on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  GET  /api/health');
  console.log('  POST /api/auth/login');
  console.log('  GET  /api/auth/me');
  console.log('  GET  /api/public/structure');
  console.log('  GET  /api/public/timetable');
  console.log('  GET  /api/public/changes');
  console.log('  GET  /api/public/pdf/daily');
  console.log('  GET  /api/public/pdf/weekly');
  console.log('  GET  /api/teacher/dashboard');
  console.log('  POST /api/teacher/attendance');
  console.log('  GET  /api/teacher/schedule');
  console.log('  GET  /api/teacher/assignments');
  console.log('  POST /api/teacher/assignments/:id/respond');
  console.log('  GET  /api/admin/dashboard');
  console.log('  GET  /api/admin/attendance (teacher-reported)');
  console.log('  POST /api/admin/attendance/generate-requests');
  console.log('  GET  /api/admin/requests');
  console.log('  GET  /api/admin/requests/:id');
  console.log('  POST /api/admin/assignments');
  console.log('  GET  /api/admin/history');
});