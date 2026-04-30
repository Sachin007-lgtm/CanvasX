// ============================================================
// EditChain Provenance Service
// This is the novel research contribution:
// Every user edit becomes a cryptographically linked event.
// The full chain gets committed to a Merkle tree whose root
// goes on-chain as the provenance proof.
// ============================================================

import crypto from "crypto";
import type { EditEvent, EditChain } from "@editchain/shared-types";

// ------------------------------------------------------------
// Hashing utilities
// ------------------------------------------------------------

export function hashObject(obj: unknown): string {
  const canonical = JSON.stringify(obj, Object.keys(obj as object).sort());
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export function hashEditEvent(event: Omit<EditEvent, "hash">): string {
  return hashObject({
    seq: event.seq,
    timestamp: event.timestamp,
    elementId: event.elementId,
    action: event.action,
    before: event.before,
    after: event.after,
    prevHash: event.prevHash,
  });
}

// ------------------------------------------------------------
// Genesis hash — the root of every chain
// Encodes: designId + promptHash + creatorAddress + timestamp
// This binds the chain to the original AI generation event.
// ------------------------------------------------------------

export function createGenesisHash(
  designId: string,
  promptHash: string,
  creatorAddress: string,
  timestamp: number
): string {
  return hashObject({ designId, promptHash, creatorAddress, timestamp, genesis: true });
}

// ------------------------------------------------------------
// Append an edit event to an existing chain
// Returns the new event with its hash set
// ------------------------------------------------------------

export function appendEditEvent(
  chain: EditChain,
  eventData: Omit<EditEvent, "seq" | "prevHash" | "hash" | "timestamp">
): EditEvent {
  const prevHash =
    chain.events.length === 0
      ? createGenesisHash(
          chain.designId,
          "genesis",
          chain.creatorAddress,
          chain.createdAt
        )
      : chain.events[chain.events.length - 1].hash!;

  const event: Omit<EditEvent, "hash"> = {
    seq: chain.events.length + 1,
    timestamp: Date.now(),
    prevHash,
    ...eventData,
  };

  const hash = hashEditEvent(event);

  return { ...event, hash };
}

// ------------------------------------------------------------
// Merkle Tree
// Builds a binary Merkle tree from all event hashes.
// The root is what gets committed to the blockchain —
// a single 32-byte proof of the entire edit history.
// ------------------------------------------------------------

export function buildMerkleTree(hashes: string[]): {
  root: string;
  layers: string[][];
} {
  if (hashes.length === 0) {
    throw new Error("Cannot build Merkle tree from empty hash list");
  }

  const layers: string[][] = [hashes];
  let current = [...hashes];

  while (current.length > 1) {
    // Pad with last element if odd number
    if (current.length % 2 !== 0) {
      current.push(current[current.length - 1]);
    }

    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const combined = current[i] + current[i + 1];
      next.push(
        crypto.createHash("sha256").update(combined).digest("hex")
      );
    }

    layers.push(next);
    current = next;
  }

  return { root: current[0], layers };
}

export function computeMerkleRoot(chain: EditChain): string {
  const hashes = chain.events.map((e) => e.hash!);

  // Include genesis hash as first leaf
  const genesisHash = createGenesisHash(
    chain.designId,
    "genesis",
    chain.creatorAddress,
    chain.createdAt
  );

  const { root } = buildMerkleTree([genesisHash, ...hashes]);
  return root;
}

// ------------------------------------------------------------
// Merkle proof — allows anyone to verify a single edit event
// without downloading the entire chain.
// This is what makes the system efficient for verification.
// ------------------------------------------------------------

export function getMerkleProof(
  chain: EditChain,
  eventHash: string
): { proof: string[]; index: number } | null {
  const allHashes = chain.events.map((e) => e.hash!);
  const genesisHash = createGenesisHash(
    chain.designId,
    "genesis",
    chain.creatorAddress,
    chain.createdAt
  );
  const leaves = [genesisHash, ...allHashes];

  const index = leaves.indexOf(eventHash);
  if (index === -1) return null;

  const { layers } = buildMerkleTree(leaves);
  const proof: string[] = [];
  let idx = index;

  for (let i = 0; i < layers.length - 1; i++) {
    const layer = layers[i];
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    if (siblingIdx < layer.length) {
      proof.push(layer[siblingIdx]);
    }
    idx = Math.floor(idx / 2);
  }

  return { proof, index };
}

export function verifyMerkleProof(
  eventHash: string,
  proof: string[],
  index: number,
  merkleRoot: string
): boolean {
  let hash = eventHash;
  let idx = index;

  for (const sibling of proof) {
    const combined =
      idx % 2 === 0 ? hash + sibling : sibling + hash;
    hash = crypto.createHash("sha256").update(combined).digest("hex");
    idx = Math.floor(idx / 2);
  }

  return hash === merkleRoot;
}

// ------------------------------------------------------------
// Chain integrity verification
// Validates the entire chain is unbroken —
// each event references the previous event's hash correctly.
// ------------------------------------------------------------

export interface IntegrityReport {
  valid: boolean;
  totalEvents: number;
  brokenAt?: number;
  reason?: string;
}

export function verifyChainIntegrity(chain: EditChain): IntegrityReport {
  if (chain.events.length === 0) {
    return { valid: true, totalEvents: 0 };
  }

  const genesisHash = createGenesisHash(
    chain.designId,
    "genesis",
    chain.creatorAddress,
    chain.createdAt
  );

  let expectedPrev = genesisHash;

  for (let i = 0; i < chain.events.length; i++) {
    const event = chain.events[i];

    // Verify sequence
    if (event.seq !== i + 1) {
      return {
        valid: false,
        totalEvents: chain.events.length,
        brokenAt: i,
        reason: `Sequence mismatch at index ${i}: expected ${i + 1}, got ${event.seq}`,
      };
    }

    // Verify prev hash link
    if (event.prevHash !== expectedPrev) {
      return {
        valid: false,
        totalEvents: chain.events.length,
        brokenAt: i,
        reason: `Hash chain broken at seq ${event.seq}`,
      };
    }

    // Verify the event's own hash
    const recomputed = hashEditEvent(event);
    if (recomputed !== event.hash) {
      return {
        valid: false,
        totalEvents: chain.events.length,
        brokenAt: i,
        reason: `Event hash tampered at seq ${event.seq}`,
      };
    }

    expectedPrev = event.hash!;
  }

  return { valid: true, totalEvents: chain.events.length };
}
