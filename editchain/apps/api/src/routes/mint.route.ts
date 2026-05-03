// ============================================================
// Mint Route
// POST /api/mint/:designId — mints the finalized design as NFT
// GET  /api/mint/:designId/status — check if design is minted
// ============================================================

import { Router, type Request, type Response } from "express";
import { designService } from "../services/design.service";
import { mintDesignOnChain } from "../services/blockchain.service";

export const mintRouter = Router();

// POST /api/mint/:designId
mintRouter.post("/:designId", async (req: Request, res: Response) => {
  const { designId } = req.params;
  const { walletAddress } = req.body;

  if (!walletAddress) {
    return res.status(400).json({ error: "walletAddress is required in request body" });
  }

  try {
    const design = await designService.findById(designId);
    if (!design) return res.status(404).json({ error: "Design not found" });

    if (!design.chain.merkleRoot || !design.chain.ipfsCid) {
      return res.status(400).json({
        error: "Design must be finalized (Merkle root + IPFS CID required) before minting",
      });
    }

    if (design.nft?.txHash) {
      return res.status(409).json({
        error: "Design already minted",
        nft: design.nft,
      });
    }

    const result = await mintDesignOnChain({
      recipientAddress: walletAddress,
      designId: design.id,
      promptHash: design.promptHash,
      merkleRoot: design.chain.merkleRoot,
      ipfsCid: design.chain.ipfsCid,
      totalEdits: design.chain.events.length,
    });

    // Persist NFT data
    design.nft = {
      tokenId: result.tokenId,
      contractAddress: process.env.CONTRACT_ADDRESS!,
      txHash: result.txHash,
      chain: "base", // re-using existing type; Sepolia for research
      mintedAt: Date.now(),
      openseaUrl: `https://testnets.opensea.io/assets/sepolia/${process.env.CONTRACT_ADDRESS}/${result.tokenId}`,
    };
    design.status = "minted";
    await designService.save(design);

    return res.status(201).json({
      success: true,
      tokenId: result.tokenId,
      txHash: result.txHash,
      blockNumber: result.blockNumber,
      etherscanUrl: result.etherscanUrl,
      openseaUrl: design.nft.openseaUrl,
    });
  } catch (err) {
    console.error("Mint error:", err);
    return res.status(500).json({
      error: "Minting failed",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// GET /api/mint/:designId/status
mintRouter.get("/:designId/status", async (req: Request, res: Response) => {
  const { designId } = req.params;
  const design = await designService.findById(designId);
  if (!design) return res.status(404).json({ error: "Design not found" });

  return res.json({
    status: design.status,
    nft: design.nft ?? null,
  });
});
