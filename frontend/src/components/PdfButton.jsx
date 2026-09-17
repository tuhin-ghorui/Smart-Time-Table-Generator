import React from 'react';

export default function PdfButton({ kind, params, label }) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v != null && v !== '') query.set(k, v);
  });
  const href = `/api/public/pdf/${kind}?${query.toString()}`;
  return (
    <button
      type="button"
      className="btn"
      onClick={() => window.open(href, '_blank', 'noopener')}
      disabled={!params?.academic_year_id || !params?.section_id}
    >
      <span className="ico">⬇</span> {label || 'Download PDF'}
    </button>
  );
}