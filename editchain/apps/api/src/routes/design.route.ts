// ============================================================
// Design Route
// POST /api/designs — create a new blank design canvas
// ============================================================

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import crypto from "crypto";
import { designService } from "../services/design.service";
import { computeMerkleRoot } from "../services/editChain.service";
import type { Design, EditChain, SVGDesignSchema } from "@editchain/shared-types";

const designRouter = Router();

const BlankDesignSchema = z.object({
  width: z.number().int().min(400).max(2400).optional(),
  height: z.number().int().min(300).max(2400).optional(),
});

function createBlankSchema(width: number, height: number): SVGDesignSchema {
  const prompt = "Blank canvas";
  const promptHash = crypto.createHash("sha256").update(prompt).digest("hex");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect id="bg" x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
  <text id="headline" x="64" y="120" font-family="Inter, sans-serif" font-size="48" font-weight="700" fill="#111111">Start building your design</text>
</svg>`;

  return {
    svg,
    viewBox: { width, height },
    palette: ["#ffffff", "#111111"],
    promptHash,
    elements: [
      {
        id: "bg",
        type: "rect",
        role: "background",
        editable: true,
        label: "Canvas background",
        content: "#ffffff",
        style: {
          fill: "#ffffff",
          stroke: "none",
          strokeWidth: 0,
          opacity: 1,
        },
        bounds: { x: 0, y: 0, width, height },
      },
      {
        id: "headline",
        type: "text",
        role: "headline",
        editable: true,
        label: "Headline",
        content: "Start building your design",
        style: {
          fill: "#111111",
          stroke: "none",
          strokeWidth: 0,
          fontSize: 48,
          fontFamily: "Inter, sans-serif",
          fontWeight: "700",
          opacity: 1,
        },
        bounds: { x: 64, y: 80, width: width - 128, height: 60 },
      },
    ],
  };
}

designRouter.post("/", async (req: Request, res: Response) => {
  const parsed = BlankDesignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.format() });
  }

  const { width = 800, height = 600 } = parsed.data;
  const userId = (req as Request & { userId?: string }).userId ?? "anonymous";
  const walletAddress = "0x0000000000000000000000000000000000000000";

  try {
    const schema = createBlankSchema(width, height);
    const designId = uuid();
    const now = Date.now();

    const chain: EditChain = {
      designId,
      creatorAddress: walletAddress,
      events: [],
      createdAt: now,
      updatedAt: now,
    };

    chain.merkleRoot = computeMerkleRoot(chain);

    const design: Design = {
      id: designId,
      title: "Blank design",
      ownerId: userId,
      status: "draft",
      prompt: "Blank canvas",
      promptHash: schema.promptHash,
      schema,
      chain,
      createdAt: now,
      updatedAt: now,
    };

    await designService.save(design);
    return res.status(201).json({ design });
  } catch (err) {
    console.error("Blank design error:", err);
    return res.status(500).json({ error: "Failed to create blank design", message: err instanceof Error ? err.message : "Unknown error" });
  }
});

export { designRouter };
