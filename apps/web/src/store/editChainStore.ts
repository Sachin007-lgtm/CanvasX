// ============================================================
// Edit Chain Store (Zustand)
// Accumulates edit events in memory and periodically
// syncs them to the backend for Merkle root computation.
// ============================================================

import { create } from "zustand";
import type { EditEvent, EditChain, EditAction, SVGElement } from "@editchain/shared-types";
import { setEditCallback } from "./designStore";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

interface EditChainState {
  chain: EditChain | null;
  pendingEvents: EditEvent[];
  isSyncing: boolean;
  lastSyncedAt: number | null;
  error: string | null;

  initChain: (designId: string, creatorAddress: string) => void;
  recordEdit: (
    elementId: string,
    action: EditAction,
    before: Partial<SVGElement>,
    after: Partial<SVGElement>
  ) => void;
  syncToBackend: () => Promise<void>;
  getChainSummary: () => {
    totalEdits: number;
    merkleRoot: string | null;
    lastEdit: number | null;
  };
}

let seqCounter = 0;
const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

// Simple client-side hash — real hashing happens on the server
async function clientHash(data: unknown): Promise<string> {
  const str = JSON.stringify(data);
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const useEditChainStore = create<EditChainState>()((set, get) => {
  // Wire up the callback so designStore mutations flow here
  setEditCallback((elementId, action, before, after) => {
    get().recordEdit(elementId, action, before, after);
  });

  return {
    chain: null,
    pendingEvents: [],
    isSyncing: false,
    lastSyncedAt: null,
    error: null,

    initChain: (designId, creatorAddress) => {
      seqCounter = 0;
      const now = Date.now();
      set({
        chain: {
          designId,
          creatorAddress,
          events: [],
          createdAt: now,
          updatedAt: now,
        },
        pendingEvents: [],
        lastSyncedAt: null,
      });
    },

    recordEdit: (elementId, action, before, after) => {
      const chain = get().chain;
      if (!chain) return;

      seqCounter += 1;
      const events = chain.events;
      const prevHash =
        events.length > 0 ? events[events.length - 1].hash! : GENESIS_HASH;

      // Create event optimistically (server will recompute hash authoritatively)
      const event: EditEvent = {
        seq: seqCounter,
        timestamp: Date.now(),
        elementId,
        action,
        before,
        after,
        prevHash,
        hash: undefined, // filled in after async hash
      };

      // Push immediately so UI is responsive
      set((state) => ({
        chain: state.chain
          ? {
              ...state.chain,
              events: [...state.chain.events, event],
              updatedAt: Date.now(),
            }
          : null,
        pendingEvents: [...state.pendingEvents, event],
      }));

      // Compute hash asynchronously
      clientHash({
        seq: event.seq,
        timestamp: event.timestamp,
        elementId,
        action,
        before,
        after,
        prevHash,
      }).then((hash) => {
        set((state) => {
          if (!state.chain) return state;
          const events = state.chain.events.map((e) =>
            e.seq === seqCounter ? { ...e, hash } : e
          );
          return { chain: { ...state.chain, events } };
        });
      });

      // Auto-sync after every 5 events
      if (get().pendingEvents.length >= 5) {
        get().syncToBackend();
      }
    },

    syncToBackend: async () => {
      const { chain, pendingEvents, isSyncing } = get();
      if (!chain || pendingEvents.length === 0 || isSyncing) return;

      set({ isSyncing: true, error: null });

      try {
        const res = await fetch(`${API_BASE}/api/provenance/event`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            designId: chain.designId,
            events: pendingEvents,
          }),
        });

        if (!res.ok) throw new Error(`Sync failed: ${res.status}`);

        set({
          pendingEvents: [],
          lastSyncedAt: Date.now(),
          isSyncing: false,
        });
      } catch (err) {
        set({
          isSyncing: false,
          error: err instanceof Error ? err.message : "Sync failed",
        });
      }
    },

    getChainSummary: () => {
      const { chain } = get();
      return {
        totalEdits: chain?.events.length ?? 0,
        merkleRoot: chain?.merkleRoot ?? null,
        lastEdit: chain?.updatedAt ?? null,
      };
    },
  };
});
