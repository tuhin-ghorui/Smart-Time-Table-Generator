import { Router } from "express";
import { academicYears, batches, courses, hydrateSlot, sections, timetableChanges, timetableSlots } from "../data/mockData.js";

const router = Router();

router.get("/options", (_request, response) => {
  response.json({
    courses,
    academicYears,
    sections,
    batches
  });
});

router.get("/timetable", (request, response) => {
  const { academicYearId, sectionId, batchId } = request.query;

  const slots = timetableSlots
    .filter((slot) => slot.published)
    .filter((slot) => !academicYearId || slot.academicYearId === Number(academicYearId))
    .filter((slot) => !sectionId || slot.sectionId === Number(sectionId))
    .filter((slot) => !batchId || batchId === "all" || slot.batchId === null || slot.batchId === Number(batchId))
    .map(hydrateSlot);

  response.json({ slots });
});

router.get("/changes", (_request, response) => {
  response.json({
    changes: timetableChanges
  });
});

export default router;
