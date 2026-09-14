import { Router } from "express";

const router = Router();

router.get("/dashboard", (_request, response) => {
  response.json({
    name: "Prof. Kavita Nair",
    attendance: "Present",
    notifications: 3,
    schedule: [
      { id: 1, time: "09:00 - 10:00", subject: "Python", className: "FY-A", room: "A-101", status: "Scheduled" },
      { id: 2, time: "10:00 - 12:00", subject: "Web Development Lab", className: "SY-A Batch 1", room: "Lab-2", status: "Substitute" }
    ],
    substitutions: [
      {
        id: 1,
        subject: "Web Development Lab",
        className: "SY-A Batch 1",
        time: "Today, 10:00 - 12:00",
        status: "Awaiting Acceptance"
      }
    ]
  });
});

export default router;
