// ============================================================
// Generate Route
// POST /api/generate — takes a prompt, returns a full Design
// ============================================================

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { generateDesign } from "../services/svgGenerator.service";
import {
  createGenesisHash,
  computeMerkleRoot,
} from "../services/editChain.service";
import type { Design, EditChain } from "@editchain/shared-types";

export const generateRouter = Router();

const GenerateSchema = z.object({
  prompt: z.string().min(3).max(500),
  style: z.enum(["minimal", "bold", "editorial", "playful"]).optional(),
  width: z.number().int().min(400).max(2400).optional(),
  height: z.number().int().min(300).max(2400).optional(),
});

generateRouter.post("/", async (req: Request, res: Response) => {
  // Validate input
  const parsed = GenerateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.format() });
  }

  const { prompt, style = "minimal", width = 800, height = 600 } = parsed.data;

  // For now, use a placeholder user — replace with real auth middleware
  const userId = (req as Request & { userId?: string }).userId ?? "anonymous";
  const walletAddress = "0x0000000000000000000000000000000000000000";

  try {
    // 1. Generate the SVG schema from the AI
    const schema = await generateDesign({ prompt, style, width, height });

    // 2. Create the design entity
    const designId = uuid();
    const now = Date.now();

    const chain: EditChain = {
      designId,
      creatorAddress: walletAddress,
      events: [],
      createdAt: now,
      updatedAt: now,
    };

    // Compute initial Merkle root (genesis only — no edits yet)
    chain.merkleRoot = computeMerkleRoot(chain);

    const design: Design = {
      id: designId,
      title: `Design: ${prompt.slice(0, 40)}`,
      ownerId: userId,
      status: "draft",
      prompt,
      promptHash: schema.promptHash,
      schema,
      chain,
      createdAt: now,
      updatedAt: now,
    };

    // TODO: persist to database
    // await designService.save(design);

    return res.status(201).json({
      design,
      tokensUsed: 0, // TODO: extract from API response
    });
  } catch (err) {
    console.error("Generation error:", err);
    return res.status(500).json({
      error: "Generation failed",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// POST /api/generate/:designId/edit-ai
// AI-assisted edit of a specific element
generateRouter.post("/:designId/edit-ai", async (req: Request, res: Response) => {
  const { designId } = req.params;
  const { elementId, instruction } = req.body;

  if (!elementId || !instruction) {
    return res.status(400).json({ error: "elementId and instruction are required" });
  }

  // TODO: load design from DB
  // const design = await designService.findById(designId);

  return res.status(501).json({ message: "AI edit endpoint — connect DB to enable" });
});
