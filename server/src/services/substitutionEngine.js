function makeSlotKey(request) {
  return `${request.day}-${request.startTime}-${request.endTime}`.toLowerCase();
}

function scoreTeacher(request, teacher) {
  const reasons = [];
  const slotKey = makeSlotKey(request);

  if (teacher.id === request.absentTeacherId) {
    return null;
  }

  if (teacher.busySlots.includes(slotKey)) {
    return null;
  }

  if (!teacher.qualifiedSubjectIds.includes(request.subjectId)) {
    return null;
  }

  if (request.sessionType === "Practical" && !teacher.canHandleLabs) {
    return null;
  }

  let score = 100;
  reasons.push("Available", "Qualified");

  if (request.sessionType === "Practical") {
    reasons.push("Lab capable");
  }

  if (teacher.dailyLoad <= 1) {
    reasons.push("Light day load");
  } else {
    score -= teacher.dailyLoad * 4;
    reasons.push(`${teacher.dailyLoad} classes today`);
  }

  if (teacher.weeklyLoad > 15) {
    score -= 8;
    reasons.push("Higher weekly load");
  }

  if (teacher.substitutionLoad > 0) {
    score -= teacher.substitutionLoad * 6;
    reasons.push("Already has substitution duty");
  }

  if (teacher.department === "Computer Science") {
    reasons.push("Same department");
  }

  return {
    id: teacher.id,
    name: teacher.name,
    score: Math.max(score, 0),
    reasons
  };
}

export function rankSubstitutionCandidates(request, teachers) {
  return teachers
    .map((teacher) => scoreTeacher(request, teacher))
    .filter(Boolean)
    .sort((left, right) => right.score - left.score);
}
