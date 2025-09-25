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

const app = express();

app.use(helmet());
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

app.use(errorHandler);

export default app;
