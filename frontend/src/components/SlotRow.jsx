import React from 'react';
import { StatusPill, timeFmt } from './ui';

export default function SlotRow({ slot }) {
  return (
    <div className="slot-row">
      <div className="slot-time">
        {timeFmt(slot.start_time)}
        <br />
        <span className="muted" style={{ fontWeight: 400 }}>{timeFmt(slot.end_time)}</span>
      </div>
      <div className="slot-main">
        <div className="slot-subject">{slot.subject_name}</div>
        <div className="slot-meta">
          {slot.teacher_name} · {slot.room_name}{slot.room_type === 'lab' ? ' (Lab)' : ''}
          {slot.batch_name ? ` · ${slot.batch_name}` : ''}
        </div>
      </div>
      <div className="slot-side">
        <span className={`slot-tag ${String(slot.session_type).toLowerCase().includes('pract') ? 'lab' : ''}`}>
          {slot.session_type}
        </span>
        <StatusPill status={slot.status} />
      </div>
    </div>
  );
}
