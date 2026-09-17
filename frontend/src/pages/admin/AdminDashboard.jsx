import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import Layout from '../../components/Layout';
import { Metric, Spinner, todayStr, Alert, fmtDate } from '../../components/ui';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/admin/dashboard', { params: { date: todayStr() } })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load dashboard.'));
  }, []);

  return (
    <Layout active="Overview">
      <h1 style={{ fontSize: 22 }}>Overview Dashboard</h1>
      <p className="muted" style={{ margin: '4px 0 12px' }}>Live snapshot for {fmtDate(data?.date)}.</p>
      <Alert type="error">{error}</Alert>

      {!data ? (
        <Spinner />
      ) : (
        <>
          <div className="metrics">
            <Metric label="Total Teachers" value={data.total_teachers} />
            <Metric label="Classes Today" value={data.classes_today} />
            <Metric label="Present" value={data.present} tone="ok" />
            <Metric label="Absent" value={data.absent} tone={data.absent ? 'danger' : ''} />
            <Metric label="Affected Classes" value={data.affected_classes} tone={data.affected_classes ? 'warn' : ''} />
            <Metric label="Uncovered Classes" value={data.uncovered_classes} tone={data.uncovered_classes ? 'warn' : ''} />
            <Metric label="Substitutes Assigned" value={data.substitutes_assigned} tone="ok" />
            <Metric label="Pending Approval" value={data.pending_approval} tone={data.pending_approval ? 'warn' : ''} />
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-title">Quick Actions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Link to="/admin/attendance" className="btn" style={{ justifyContent: 'flex-start' }}>Mark faculty attendance</Link>
                <Link to="/admin/substitutions" className="btn" style={{ justifyContent: 'flex-start' }}>Generate uncovered classes & assign substitutes</Link>
                <Link to="/admin/approvals" className="btn" style={{ justifyContent: 'flex-start' }}>Approve pending timetable changes ({data.pending_approval})</Link>
                <Link to="/admin/timetable" className="btn" style={{ justifyContent: 'flex-start' }}>Edit timetable</Link>
                <Link to="/admin/batches" className="btn" style={{ justifyContent: 'flex-start' }}>Manage batches</Link>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Workflow</div>
              <ol className="muted small" style={{ paddingLeft: 20, lineHeight: 1.9 }}>
                <li>Mark an absent teacher in <strong>Faculty Attendance</strong>.</li>
                <li>Run <strong>Generate uncovered classes</strong> — affected slots become substitution requests.</li>
                <li>Open a request in <strong>Substitutions</strong> to see AI-ranked candidates.</li>
                <li>Assign a candidate; teacher accepts → published timetable updates instantly.</li>
                <li>All actions land in <strong>Change History</strong> with full audit.</li>
              </ol>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}