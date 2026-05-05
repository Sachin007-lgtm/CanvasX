// ============================================================
// Provenance Route
// POST /api/provenance/event — record a user edit event
// GET  /api/provenance/:designId/chain — get full chain
// GET  /api/provenance/:designId/verify — verify integrity
// POST /api/provenance/:designId/finalize — compute Merkle root
// ============================================================

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { designService } from "../services/design.service";
import { pinToIPFS } from "../services/ipfs.service";
import {
  appendEditEvent,
  computeMerkleRoot,
  verifyChainIntegrity,
  verifyMerkleProof,
  getMerkleProof,
} from "../services/editChain.service";
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
    const design = await designService.findById(designId);
    if (!design) return res.status(404).json({ error: "Design not found" });
    
    const chain = design.chain;

    const newEvent = appendEditEvent(chain, {
      elementId,
      action,
      before: before as any,
      after: after as any,
    });

    chain.events.push(newEvent);
    chain.updatedAt = Date.now();

    await designService.save(design);

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
  const design = await designService.findById(designId);
  if (!design) return res.status(404).json({ error: "Design not found" });

  return res.json(design.chain);
});

// Verify chain integrity
provenanceRouter.get("/:designId/verify", async (req: Request, res: Response) => {
  const { designId } = req.params;
  const design = await designService.findById(designId);
  if (!design) return res.status(404).json({ error: "Design not found" });

  const report = verifyChainIntegrity(design.chain);
  return res.json(report);
});

// Finalize — compute Merkle root and pin to IPFS before minting
provenanceRouter.post("/:designId/finalize", async (req: Request, res: Response) => {
  const { designId } = req.params;
  
  try {
    const design = await designService.findById(designId);
    if (!design) return res.status(404).json({ error: "Design not found" });

    // 1. Compute final Merkle root
    const merkleRoot = computeMerkleRoot(design.chain);
    design.chain.merkleRoot = merkleRoot;

    // 2. Pin the full design + chain to IPFS
    const ipfsCid = await pinToIPFS(design, `EditChain-${designId}`);
    design.chain.ipfsCid = ipfsCid;
    
    await designService.save(design);

    return res.json({
      message: "Merkle root computed and history pinned to IPFS",
      merkleRoot,
      ipfsCid,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${ipfsCid}`
    });
  } catch (err) {
    console.error("Finalization error:", err);
    return res.status(500).json({ error: "Failed to finalize and pin to IPFS" });
  }
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

// Get Merkle proof for a specific event sequence — called by the UI verifier
// GET /api/provenance/:designId/proof/seq/:seq
provenanceRouter.get("/:designId/proof/seq/:seq", async (req: Request, res: Response) => {
  const { designId, seq } = req.params;

  try {
    const design = await designService.findById(designId);
    if (!design) return res.status(404).json({ error: "Design not found" });

    if (!design.chain.merkleRoot) {
      return res.status(400).json({ error: "Chain not finalized yet — compute Merkle root first" });
    }

    // Find the event by seq to get the authoritative server hash
    const serverEvent = design.chain.events.find(e => e.seq === Number(seq));
    if (!serverEvent || !serverEvent.hash) {
      return res.status(404).json({ error: "Event seq not found in chain" });
    }

    const result = getMerkleProof(design.chain, serverEvent.hash);
    if (!result) {
      return res.status(404).json({ error: "Event hash not found in chain tree" });
    }

    return res.json({
      eventHash:  serverEvent.hash, // Return the true server hash so the client can verify it
      proof:      result.proof,
      index:      result.index,
      merkleRoot: design.chain.merkleRoot,
    });
  } catch (err) {
    console.error("Proof generation error:", err);
    return res.status(500).json({ error: "Failed to generate proof" });
  }
});
