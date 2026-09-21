// ============================================================
// EditChain API — Express App
// ============================================================

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { generateRouter } from "./routes/generate.route.js";
import { provenanceRouter } from "./routes/provenance.route.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

// Middleware
const configuredOrigins = (process.env.FRONTEND_URL ?? "")
  .split(",")
  .map((url) => url.trim().replace(/\/$/, ""))
  .filter(Boolean);

const allowedOrigins = [
  ...configuredOrigins,
  "https://canvas-x-av2x.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.replace(/\/$/, "");

      if (
        allowedOrigins.includes(normalizedOrigin) ||
        /^https:\/\/([a-zA-Z0-9-]+\.)*vercel\.app$/.test(normalizedOrigin) ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin)
      ) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(express.json({ limit: "2mb" })); // SVG payloads can be large

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "editchain-api", ts: Date.now() });
});

// Routes
app.use("/api/generate", generateRouter);
app.use("/api/provenance", provenanceRouter);

// Global error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal server error" });
  }
);

app.listen(PORT, () => {
  console.log(`EditChain API running on http://localhost:${PORT}`);
});

export default app;
