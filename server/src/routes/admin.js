import { Router } from "express";
import { attendanceRecords, batches, substitutionRequests, teachers } from "../data/mockData.js";
import { rankSubstitutionCandidates } from "../services/substitutionEngine.js";

const router = Router();

router.get("/overview", (_request, response) => {
  const absentTeacherIds = attendanceRecords.filter((record) => record.status === "Absent").map((record) => record.teacherId);
  const presentCount = attendanceRecords.filter((record) => record.status === "Present").length;

  response.json({
    metrics: {
      totalTeachers: teachers.length,
      classesToday: 36,
      present: presentCount,
      absent: absentTeacherIds.length,
      affectedClasses: 5,
      uncoveredClasses: 2,
      substitutesAssigned: 3,
      pendingApproval: substitutionRequests.filter((request) => request.status === "Pending Approval").length
    }
  });
});

router.get("/substitution-requests", (_request, response) => {
  const requests = substitutionRequests.map((request) => ({
    ...request,
    candidates: rankSubstitutionCandidates(request, teachers)
  }));

  response.json({ requests });
});

router.get("/batches", (_request, response) => {
  response.json({ batches });
});

router.post("/substitution-requests/:requestId/assign", (request, response) => {
  const requestId = Number(request.params.requestId);
  const { teacherId } = request.body;
  const substitutionRequest = substitutionRequests.find((item) => item.id === requestId);
  const teacher = teachers.find((item) => item.id === Number(teacherId));

  if (!substitutionRequest || !teacher) {
    return response.status(404).json({ message: "Substitution request or teacher not found." });
  }

  return response.status(202).json({
    message: "Assignment captured for approval workflow.",
    assignment: {
      requestId,
      teacherId: teacher.id,
      teacherName: teacher.name,
      status: "Pending Approval"
    }
  });
});

export default router;
