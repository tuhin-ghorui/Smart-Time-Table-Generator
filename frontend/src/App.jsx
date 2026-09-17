import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import PublicTimetable from './pages/public/PublicTimetable';
import Login from './pages/Login';

import TeacherDashboard from './pages/teacher/TeacherDashboard';
import TeacherSchedule from './pages/teacher/TeacherSchedule';
import TeacherAssignments from './pages/teacher/TeacherAssignments';
import Notifications from './pages/Notifications';

import AdminDashboard from './pages/admin/AdminDashboard';
import Attendance from './pages/admin/Attendance';
import Substitutions from './pages/admin/Substitutions';
import TimetableEditor from './pages/admin/TimetableEditor';
import BatchManagement from './pages/admin/BatchManagement';
import Approvals from './pages/admin/Approvals';
import History from './pages/admin/History';

function RequireRole({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner" />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PublicTimetable />} />

      <Route path="/teacher/dashboard" element={<RequireRole role="teacher"><TeacherDashboard /></RequireRole>} />
      <Route path="/teacher/schedule" element={<RequireRole role="teacher"><TeacherSchedule /></RequireRole>} />
      <Route path="/teacher/assignments" element={<RequireRole role="teacher"><TeacherAssignments /></RequireRole>} />
      <Route path="/teacher/notifications" element={<RequireRole role="teacher"><Notifications base="teacher" /></RequireRole>} />

      <Route path="/admin/dashboard" element={<RequireRole role="admin"><AdminDashboard /></RequireRole>} />
      <Route path="/admin/attendance" element={<RequireRole role="admin"><Attendance /></RequireRole>} />
      <Route path="/admin/substitutions" element={<RequireRole role="admin"><Substitutions /></RequireRole>} />
      <Route path="/admin/timetable" element={<RequireRole role="admin"><TimetableEditor /></RequireRole>} />
      <Route path="/admin/batches" element={<RequireRole role="admin"><BatchManagement /></RequireRole>} />
      <Route path="/admin/approvals" element={<RequireRole role="admin"><Approvals /></RequireRole>} />
      <Route path="/admin/history" element={<RequireRole role="admin"><History /></RequireRole>} />
      <Route path="/admin/notifications" element={<RequireRole role="admin"><Notifications base="admin" /></RequireRole>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}