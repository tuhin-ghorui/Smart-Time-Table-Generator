export const courses = [{ id: 1, name: "BCA" }];

export const academicYears = [
  { id: 1, courseId: 1, name: "FY" },
  { id: 2, courseId: 1, name: "SY" },
  { id: 3, courseId: 1, name: "TY" }
];

export const sections = [
  { id: 1, academicYearId: 2, name: "A" },
  { id: 2, academicYearId: 2, name: "B" }
];

export const batches = [
  { id: 1, sectionId: 1, course: "BCA", year: "SY", section: "A", name: "Batch 1", isActive: true },
  { id: 2, sectionId: 1, course: "BCA", year: "SY", section: "A", name: "Batch 2", isActive: true },
  { id: 3, sectionId: 1, course: "BCA", year: "SY", section: "A", name: "Batch 3", isActive: false }
];

export const teachers = [
  {
    id: 1,
    name: "Prof. Arjun Sen",
    department: "Computer Science",
    qualifiedSubjectIds: [1, 2],
    canHandleLabs: true,
    dailyLoad: 4,
    weeklyLoad: 18,
    substitutionLoad: 1,
    busySlots: ["monday-10:00-12:00"]
  },
  {
    id: 2,
    name: "Prof. Kavita Nair",
    department: "Computer Science",
    qualifiedSubjectIds: [1, 2, 3],
    canHandleLabs: true,
    dailyLoad: 1,
    weeklyLoad: 12,
    substitutionLoad: 0,
    busySlots: ["monday-09:00-10:00"]
  },
  {
    id: 3,
    name: "Prof. Ritesh Das",
    department: "Computer Science",
    qualifiedSubjectIds: [2, 3],
    canHandleLabs: true,
    dailyLoad: 3,
    weeklyLoad: 16,
    substitutionLoad: 1,
    busySlots: []
  },
  {
    id: 4,
    name: "Prof. Nisha Rao",
    department: "Computer Science",
    qualifiedSubjectIds: [1, 4],
    canHandleLabs: false,
    dailyLoad: 2,
    weeklyLoad: 14,
    substitutionLoad: 0,
    busySlots: ["tuesday-11:00-12:00"]
  }
];

export const subjects = [
  { id: 1, name: "Database Management", courseId: 1 },
  { id: 2, name: "Web Development Lab", courseId: 1 },
  { id: 3, name: "Python", courseId: 1 },
  { id: 4, name: "Software Engineering", courseId: 1 }
];

export const timetableSlots = [
  {
    id: 1,
    academicYearId: 2,
    sectionId: 1,
    batchId: null,
    subjectId: 1,
    teacherId: 1,
    day: "Monday",
    startTime: "09:00",
    endTime: "10:00",
    room: "A-204",
    section: "SY-A",
    batch: null,
    sessionType: "Lecture",
    status: "Scheduled",
    published: true
  },
  {
    id: 2,
    academicYearId: 2,
    sectionId: 1,
    batchId: 1,
    subjectId: 2,
    teacherId: 1,
    day: "Monday",
    startTime: "10:00",
    endTime: "12:00",
    room: "Lab-2",
    section: "SY-A",
    batch: "Batch 1",
    sessionType: "Practical",
    status: "Substitute",
    published: true
  },
  {
    id: 3,
    academicYearId: 2,
    sectionId: 1,
    batchId: null,
    subjectId: 4,
    teacherId: 4,
    day: "Tuesday",
    startTime: "11:00",
    endTime: "12:00",
    room: "B-105",
    section: "SY-A",
    batch: null,
    sessionType: "Lecture",
    status: "Changed",
    published: true
  }
];

export const attendanceRecords = [
  { id: 1, teacherId: 1, date: "2026-09-14", status: "Absent", source: "manual" },
  { id: 2, teacherId: 2, date: "2026-09-14", status: "Present", source: "manual" },
  { id: 3, teacherId: 3, date: "2026-09-14", status: "Present", source: "manual" },
  { id: 4, teacherId: 4, date: "2026-09-14", status: "Present", source: "manual" }
];

export const timetableChanges = [
  {
    id: 1,
    slotId: 2,
    time: "10:00 - 12:00",
    title: "Web Development Lab",
    detail: "Prof. Kavita Nair assigned as substitute in Lab-2.",
    status: "Substitute",
    publishedAt: "2026-09-14T08:30:00.000Z"
  },
  {
    id: 2,
    slotId: 3,
    time: "11:00 - 12:00",
    title: "Software Engineering",
    detail: "Room changed from B-104 to B-105.",
    status: "Room Changed",
    publishedAt: "2026-09-14T08:45:00.000Z"
  }
];

export const substitutionRequests = [
  {
    id: 1,
    timetableSlotId: 2,
    subjectId: 2,
    className: "SY-A Batch 1",
    subject: "Web Development Lab",
    absentTeacherId: 1,
    absentTeacher: "Prof. Arjun Sen",
    date: "2026-09-14",
    day: "Monday",
    startTime: "10:00",
    endTime: "12:00",
    time: "10:00 - 12:00",
    sessionType: "Practical",
    status: "Pending Approval"
  }
];

export function hydrateSlot(slot) {
  const teacher = teachers.find((item) => item.id === slot.teacherId);
  const subject = subjects.find((item) => item.id === slot.subjectId);

  return {
    id: slot.id,
    day: slot.day,
    startTime: slot.startTime,
    endTime: slot.endTime,
    subject: subject?.name ?? "Unknown subject",
    teacher: teacher?.name ?? "Unassigned",
    room: slot.room,
    section: slot.section,
    batch: slot.batch,
    sessionType: slot.sessionType,
    status: slot.status
  };
}
