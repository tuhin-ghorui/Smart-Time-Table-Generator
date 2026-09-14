import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import adminRoutes from "./routes/admin.js";
import publicRoutes from "./routes/public.js";
import teacherRoutes from "./routes/teacher.js";

dotenv.config();

const app = express();
const port = process.env.PORT ?? 4000;

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173"
  })
);
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "campustime-api",
    mode: process.env.NODE_ENV ?? "development"
  });
});

app.use("/api/public", publicRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/admin", adminRoutes);

app.use((request, response) => {
  response.status(404).json({
    message: `Route not found: ${request.method} ${request.originalUrl}`
  });
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(error.status ?? 500).json({
    message: error.message ?? "Unexpected server error"
  });
});

app.listen(port, () => {
  console.log(`CampusTime API listening on http://localhost:${port}`);
});
