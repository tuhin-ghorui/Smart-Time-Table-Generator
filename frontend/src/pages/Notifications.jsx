import React, { useEffect, useState } from 'react';
import api from '../api';
import Layout from '../components/Layout';
import { Spinner, Empty, fmtDate, Alert } from '../components/ui';

export default function Notifications({ base }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    api
      .get(`/${base}/notifications`)
      .then((res) => setItems(res.data.notifications))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load notifications.'));
  };
  useEffect(load, [base]);

  const mark = async (id) => {
    await api.post(`/${base}/notifications/${id}/read`);
    load();
  };

  const readAll = async () => {
    await api.post(`/${base}/notifications/read-all`);
    load();
  };

  return (
    <Layout active="Notifications">
      <h1 style={{ fontSize: 22 }}>Notifications</h1>
      <Alert type="error">{error}</Alert>
      <div className="toolbar">
        <button className="btn sm" onClick={readAll}>Mark all read</button>
      </div>
      {!items ? (
        <Spinner />
      ) : !items.length ? (
        <div className="card"><Empty message="No notifications." /></div>
      ) : (
        <div className="card">
          {items.map((n) => (
            <div
              key={n.id}
              className={`notif-item ${n.read ? '' : 'unread'}`}
              onClick={() => !n.read && mark(n.id)}
              style={{ cursor: n.read ? 'default' : 'pointer' }}
            >
              <div className="slot-tag">{n.type}</div>
              <div style={{ flex: 1 }}>
                <div>{n.message}</div>
                <div className="notif-time">{new Date(n.created_at).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}