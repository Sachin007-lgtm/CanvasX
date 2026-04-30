// ============================================================
// Provenance Route
// POST /api/provenance/event — record a user edit event
// GET  /api/provenance/:designId/chain — get full chain
// GET  /api/provenance/:designId/verify — verify integrity
// POST /api/provenance/:designId/finalize — compute Merkle root
// ============================================================

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  appendEditEvent,
  computeMerkleRoot,
  verifyChainIntegrity,
  getMerkleProof,
  verifyMerkleProof,
} from "../services/editChain.service.js";
import type { EditChain } from "@editchain/shared-types";

export const provenanceRouter = Router();

const EditEventSchema = z.object({
  designId: z.string().uuid(),
  elementId: z.string(),
  action: z.enum([
    "text-change",
    "color-change",
    "move",
    "resize",
    "font-change",
    "opacity-change",
    "add-element",
    "delete-element",
    "reorder",
  ]),
  before: z.record(z.unknown()),
  after: z.record(z.unknown()),
});

// Record a new edit event — called every time the user makes a change
provenanceRouter.post("/event", async (req: Request, res: Response) => {
  const parsed = EditEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.format() });
  }

  const { designId, elementId, action, before, after } = parsed.data;

  try {
    // TODO: load chain from DB
    // const design = await designService.findById(designId);
    // const chain = design.chain;

    // For demonstration — in-memory chain
    const chain: EditChain = {
      designId,
      creatorAddress: "0x0000000000000000000000000000000000000000",
      events: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const newEvent = appendEditEvent(chain, {
      elementId,
      action,
      before,
      after,
    });

    chain.events.push(newEvent);
    chain.updatedAt = Date.now();

    // TODO: persist updated chain
    // await designService.updateChain(designId, chain);

    return res.status(201).json({
      event: newEvent,
      chainLength: chain.events.length,
    });
  } catch (err) {
    console.error("Provenance error:", err);
    return res.status(500).json({ error: "Failed to record edit event" });
  }
});

// Get full chain for a design
provenanceRouter.get("/:designId/chain", async (req: Request, res: Response) => {
  const { designId } = req.params;

  // TODO: load from DB
  return res.status(501).json({
    message: "Connect DB — chain endpoint ready",
    designId,
  });
});

// Verify chain integrity — useful for the research paper demo
provenanceRouter.get("/:designId/verify", async (req: Request, res: Response) => {
  const { designId } = req.params;

  // TODO: load chain from DB
  // const design = await designService.findById(designId);
  // const report = verifyChainIntegrity(design.chain);

  // Demonstration with empty chain
  const demoChain: EditChain = {
    designId,
    creatorAddress: "0x0000000000000000000000000000000000000000",
    events: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const report = verifyChainIntegrity(demoChain);

  return res.json(report);
});

// Finalize — compute Merkle root before minting
provenanceRouter.post("/:designId/finalize", async (req: Request, res: Response) => {
  const { designId } = req.params;

  // TODO: load chain from DB
  // const design = await designService.findById(designId);
  // const merkleRoot = computeMerkleRoot(design.chain);
  // design.chain.merkleRoot = merkleRoot;
  // await designService.save(design);

  return res.status(501).json({
    message: "Connect DB to finalize and compute Merkle root",
    designId,
  });
});

// Verify a single event via Merkle proof (no need to download full chain)
provenanceRouter.post("/verify-event", (req: Request, res: Response) => {
  const { eventHash, proof, index, merkleRoot } = req.body;

  if (!eventHash || !proof || index === undefined || !merkleRoot) {
    return res.status(400).json({ error: "Missing proof fields" });
  }

  const valid = verifyMerkleProof(eventHash, proof, index, merkleRoot);
  return res.json({ valid, eventHash, merkleRoot });
});
