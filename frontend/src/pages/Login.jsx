import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/teacher/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed.');
    } finally {
      setBusy(false);
    }
  };

  const fill = (em, pw) => {
    setEmail(em);
    setPassword(pw);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand">
          <div className="brand-mark">CT</div>
          <div>
            <h1>CampusTime</h1>
            <div className="sub">Sign in to Teacher / Admin portal</div>
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label className="field-label">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label className="field-label">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Alert type="error">{error}</Alert>
          <button type="submit" className="btn primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="demo-hint">
          <strong>Demo accounts</strong><br />
          <div style={{ marginTop: 6 }}>
            Admin: <code>admin@campustime.test</code> / <code>admin123</code><br />
            Teacher: <code>teacher1@campustime.test</code> / <code>teacher123</code><br /><br />
            <button type="button" className="btn sm" onClick={() => fill('admin@campustime.test', 'admin123')}>Fill admin</button>{' '}
            <button type="button" className="btn sm" onClick={() => fill('teacher1@campustime.test', 'teacher123')}>Fill teacher</button>
          </div>
        </div>

        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <Link to="/" className="small muted">← View public timetable (no login)</Link>
        </div>
      </div>
    </div>
  );
}