const PDFDocument = require('pdfkit');
const { timeToShort } = require('../utils/helpers');

const INDIGO = '#4F46E5';
const SLATE_DARK = '#0F172A';
const SLATE_MID = '#64748B';
const BG = '#F8FAFC';

function buildGrid(doc, days, options = {}) {
  const label = `${options.courseName} | ${options.yearName} | Section ${options.sectionName}${
    options.batchName ? ` | Batch ${options.batchName}` : ''
  }`;

  doc.font('Helvetica-Bold').fontSize(17).fillColor(SLATE_DARK).text(options.title, { align: 'center' });
  doc.moveDown(0.25);
  doc.font('Helvetica').fontSize(10.5).fillColor(SLATE_MID).text(label, { align: 'center' });
  let rangeTxt = '';
  if (options.dateRange) {
    rangeTxt = options.rangeLabel || 'Daily timetable';
  } else if (options.date) {
    rangeTxt = options.date;
  }
  if (rangeTxt) {
    doc.moveDown(0.25);
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INDIGO).text(rangeTxt, { align: 'center' });
  }
  doc.moveDown(0.75);

  const colWidths = [58, 95, 38, 130, 120, 95];
  const colTitles = ['Time', 'Subject', 'Type', 'Teacher', 'Room', 'Batch'];
  const pageW = 612;
  const leftPad = 34;
  const tableW = pageW - leftPad * 2;
  const total = colWidths.reduce((a, b) => a + b, 0);

  let y = doc.y;

  const drawHeader = () => {
    let x = leftPad;
    doc.rect(leftPad, y, tableW, 24).fill(INDIGO);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF');
    colTitles.forEach((t, i) => {
      doc.text(String(t).toUpperCase(), x + 6, y + 7, { width: colWidths[i] - 6, height: 14 });
      x += colWidths[i];
    });
    y += 24;
  };
  drawHeader();

  let rowIndex = 0;
  const rowH = 26;

  const drawRow = (cells) => {
    let x = leftPad;
    doc.rect(leftPad, y, tableW, rowH).fill(rowIndex % 2 === 0 ? BG : '#FFFFFF');
    doc.font('Helvetica').fontSize(9).fillColor(SLATE_DARK);
    cells.forEach((val, i) => {
      doc.text(String(val == null ? '' : val), x + 6, y + 8, { width: colWidths[i] - 8, height: rowH - 6 });
      x += colWidths[i];
    });
    rowIndex++;
    y += rowH;
  };

  let emptyRow = true;
  for (const entry of days) {
    for (const slot of entry.slots) {
      emptyRow = false;
      if (y + rowH > 780) { doc.addPage(); y = 60; }
      drawRow([
        `${timeToShort(slot.start_time)}\n${timeToShort(slot.end_time)}`,
        slot.subject_name,
        slot.session_type,
        slot.teacher_name,
        `${slot.room_name}${slot.room_type === 'lab' ? ' (Lab)' : ''}`,
        slot.batch_name || 'Full Section',
      ]);
    }
  }

  if (emptyRow) {
    drawRow(['—', 'No sessions', '—', '—', '—', '—']);
  }

  if (!options.dateRange) {
    doc.moveDown(0.5);
    doc.font('Helvetica-Oblique').fontSize(9).fillColor(SLATE_MID)
       .text('Reflects live published state including substitutions, room changes and cancellations.', { align: 'center' });
  }
}

function buildDaily(days, opts) {
  const doc = new PDFDocument({ margin: 34, size: 'A4' });
  buildGrid(doc, days, { ...opts, title: 'Today\'s Timetable' });
  return doc;
}

function buildWeekly(days, opts) {
  const doc = new PDFDocument({ margin: 34, size: 'A4' });

  doc.font('Helvetica-Bold').fontSize(17).fillColor(SLATE_DARK).text('Weekly Timetable', { align: 'center' });
  doc.moveDown(0.25);
  doc.font('Helvetica').fontSize(10.5).fillColor(SLATE_MID)
     .text(`${opts.courseName} | ${opts.yearName} | Section ${opts.sectionName}${opts.batchName ? ` | Batch ${opts.batchName}` : ''}`, { align: 'center' });
  doc.moveDown(0.75);

  const colWidths = [58, 95, 38, 130, 120, 95];
  const colTitles = ['Time', 'Subject', 'Type', 'Teacher', 'Room', 'Batch'];
  const pageW = 612;
  const leftPad = 34;
  const tableW = pageW - leftPad * 2;
  let y = doc.y;
  const rowH = 26;
  let rowIndex = 0;

  const drawHeader = (title) => {
    let x = leftPad;
    doc.rect(leftPad, y, tableW, 24).fill(INDIGO);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF').text(String(title).toUpperCase(), leftPad + 6, y + 7);
    x = leftPad;
    colTitles.forEach((t, i) => {
      if (i === 0) { x += colWidths[0]; return; }
      doc.text(String(t).toUpperCase(), x + 6, y + 7, { width: colWidths[i] - 6, height: 14 });
      x += colWidths[i];
    });
    y += 24;
  };

  const drawRow = (cells) => {
    if (y + rowH > 780) { doc.addPage(); y = 60; }
    let x = leftPad;
    doc.rect(leftPad, y, tableW, rowH).fill(rowIndex % 2 === 0 ? BG : '#FFFFFF');
    doc.font('Helvetica').fontSize(9).fillColor(SLATE_DARK);
    cells.forEach((val, i) => {
      doc.text(String(val == null ? '' : val), x + 6, y + 8, { width: colWidths[i] - 8, height: rowH - 6 });
      x += colWidths[i];
    });
    rowIndex++;
    y += rowH;
  };

  for (const entry of days) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor(SLATE_DARK).text(entry.day, { align: 'center' });
    doc.moveDown(0.2);
    drawHeader(entry.day);
    if (!entry.slots.length) {
      drawRow(['—', 'No classes', '—', '—', '—', '—']);
    }
    for (const slot of entry.slots) {
      drawRow([
        `${timeToShort(slot.start_time)}\n${timeToShort(slot.end_time)}`,
        slot.subject_name,
        slot.session_type,
        slot.teacher_name,
        `${slot.room_name}${slot.room_type === 'lab' ? ' (Lab)' : ''}`,
        slot.batch_name || 'Full Section',
      ]);
    }
    doc.moveDown(0.4);
  }

  return doc;
}

module.exports = { buildDaily, buildWeekly };