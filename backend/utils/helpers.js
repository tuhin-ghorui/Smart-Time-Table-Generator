const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function isoDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr() {
  return isoDate(new Date());
}

function dayNameOf(dateStr) {
  if (!dateStr) return DAY_NAMES[new Date().getDay()];
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return DAY_NAMES[new Date().getDay()];
  return DAY_NAMES[d.getDay()];
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

function weekDates(startISO) {
  const base = startISO ? new Date(startISO + 'T00:00:00') : new Date();
  const dow = base.getDay(); // 0=Sun..6=Sat
  const monday = new Date(base);
  monday.setDate(base.getDate() - ((dow + 6) % 7));
  const arr = [];
  for (let i = 0; i < 5; i++) arr.push(addDays(isoDate(monday), i));
  return arr;
}

function timeToShort(timeVal) {
  if (!timeVal) return '';
  return String(timeVal).slice(0, 5);
}

function statusClass(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('substitute')) return 'indigo';
  if (s.includes('cancel')) return 'red';
  if (s.includes('room') || s.includes('change')) return 'amber';
  if (s.includes('complete')) return 'emerald';
  if (s.includes('current')) return 'indigo';
  return 'slate';
}

function isOverlap(aS, aE, bS, bE) {
  return aS < bE && bS < aE;
}

module.exports = {
  DAY_NAMES,
  isoDate,
  todayStr,
  dayNameOf,
  addDays,
  weekDates,
  timeToShort,
  statusClass,
  isOverlap,
};