import express from "express";
import type { Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import projectRoutes from "./routes/projects";
import { errorHandler } from "./middlewares/error";
import testCaseRoutes from "./routes/testCases";
import defectRoutes from "./routes/defects";
import lookupRoutes from "./routes/lookups";
import dashboardRoutes from "./routes/dashboard";
import auditRoutes from "./routes/audit";
import path from 'path';
import fs from 'fs';
import { env } from './config/env';

const app = express();

// Helmet with relaxed crossOriginResourcePolicy so frontend (different port) can embed images/videos
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // Optionally disable defaults we don't actively configure; extend later as needed
}));
app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: "ok" } });
});

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/projects", projectRoutes);
app.use("/test-cases", testCaseRoutes);
app.use("/defects", defectRoutes);
app.use("/lookups", lookupRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/audit", auditRoutes);

// Ensure upload dir exists then serve statics (basic public serving for now)
if (!fs.existsSync(env.UPLOAD_DIR)) {
  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
}
app.use('/files', express.static(path.resolve(env.UPLOAD_DIR)));

app.use(errorHandler);

export default app;
