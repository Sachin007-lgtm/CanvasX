// ============================================================
// EditChain — Shared Types
// These are the canonical data structures used across frontend,
// backend, and the blockchain layer.
// ============================================================

// ------------------------------------------------------------
// SVG Element Schema
// The key innovation: every AI-generated SVG is annotated with
// a semantic schema so the canvas knows what's editable.
// ------------------------------------------------------------

export type ElementRole =
  | "headline"
  | "subheadline"
  | "body-text"
  | "label"
  | "background"
  | "shape"
  | "image-placeholder"
  | "container"
  | "decoration";

export type ElementType = "text" | "rect" | "circle" | "path" | "image" | "group";

export interface SVGElement {
  /** Unique ID matching the id="" attribute in the SVG markup */
  id: string;
  type: ElementType;
  role: ElementRole;
  editable: boolean;
  /** Human-readable label shown in the layer panel */
  label: string;
  /** Current value — string for text, hex for color-based shapes */
  content?: string;
  style: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    opacity?: number;
  };
  /** Bounding box in SVG coordinate space */
  bounds: { x: number; y: number; width: number; height: number };
  /** Child element IDs if this is a group */
  children?: string[];
}

export interface SVGDesignSchema {
  /** The raw SVG string */
  svg: string;
  /** viewBox values */
  viewBox: { width: number; height: number };
  /** All annotated elements */
  elements: SVGElement[];
  /** Color palette extracted from the design */
  palette: string[];
  /** Prompt that generated this design */
  promptHash: string;
}

// ------------------------------------------------------------
// Edit Event — the unit of provenance
// Every user action on the canvas creates one of these.
// These get Merkle-hashed for the blockchain proof chain.
// ------------------------------------------------------------

export type EditAction =
  | "text-change"
  | "color-change"
  | "move"
  | "resize"
  | "font-change"
  | "opacity-change"
  | "add-element"
  | "delete-element"
  | "reorder";

export interface EditEvent {
  /** Monotonically increasing sequence number within a design session */
  seq: number;
  /** Unix timestamp in ms */
  timestamp: number;
  /** Which canvas element was affected */
  elementId: string;
  action: EditAction;
  /** State before the edit (for undo + diff) */
  before: Partial<SVGElement>;
  /** State after the edit */
  after: Partial<SVGElement>;
  /** SHA-256 hash of the previous event — forms the chain */
  prevHash: string;
  /** SHA-256 of this entire event (set after creation) */
  hash?: string;
}

export interface EditChain {
  /** The design this chain belongs to */
  designId: string;
  /** Wallet address of the creator */
  creatorAddress: string;
  /** Ordered list of edit events */
  events: EditEvent[];
  /** Merkle root of all event hashes — this goes on-chain */
  merkleRoot?: string;
  /** IPFS CID of the full chain JSON */
  ipfsCid?: string;
  createdAt: number;
  updatedAt: number;
}

// ------------------------------------------------------------
// Design — top-level entity saved to the database
// ------------------------------------------------------------

export type DesignStatus = "draft" | "published" | "minted";

export interface Design {
  id: string;
  title: string;
  ownerId: string;
  status: DesignStatus;
  /** The original prompt text */
  prompt: string;
  /** SHA-256 of the prompt */
  promptHash: string;
  /** Current SVG schema */
  schema: SVGDesignSchema;
  /** Edit history chain */
  chain: EditChain;
  /** Blockchain data (set after minting) */
  nft?: {
    tokenId: string;
    contractAddress: string;
    txHash: string;
    chain: "polygon" | "base";
    mintedAt: number;
    openseaUrl?: string;
  };
  createdAt: number;
  updatedAt: number;
}

// ------------------------------------------------------------
// API Request/Response shapes
// ------------------------------------------------------------

export interface GenerateRequest {
  prompt: string;
  style?: "minimal" | "bold" | "editorial" | "playful";
  width?: number;
  height?: number;
}

export interface GenerateResponse {
  design: Design;
  tokensUsed: number;
}

export interface SaveEditRequest {
  designId: string;
  event: Omit<EditEvent, "hash">;
}

export interface MintRequest {
  designId: string;
  walletAddress: string;
}

export interface MintResponse {
  txHash: string;
  tokenId: string;
  openseaUrl: string;
  merkleRoot: string;
  ipfsCid: string;
}

// ------------------------------------------------------------
// User
// ------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  name: string;
  walletAddress?: string;
  createdAt: number;
}
