import "dotenv/config";
import http from "http";
import app from "./app";

// Basic process-level diagnostics so we can see why the server might exit when a route is hit
process.on('unhandledRejection', (reason: any) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err: any) => {
  console.error('[uncaughtException]', err);
});

const PORT = Number(process.env.PORT ?? 4000);

// Lightweight request logger (dev only) to correlate the last request before a crash
app.use((req, _res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[req] ${req.method} ${req.originalUrl}`);
  }
  next();
});

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
