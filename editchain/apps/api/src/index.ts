// ============================================================
// EditChain API — Express App
// ============================================================

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { generateRouter } from "./routes/generate.route";
import { provenanceRouter } from "./routes/provenance.route";

const app = express();
const PORT = process.env.PORT ?? 3001;

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:5173" }));
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
