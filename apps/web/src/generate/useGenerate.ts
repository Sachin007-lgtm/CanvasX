// ============================================================
// useGenerate Hook
// Manages the prompt → AI generation → canvas load flow
// ============================================================

import { useState } from "react";
import type { GenerateRequest, GenerateResponse } from "@editchain/shared-types";
import { useDesignStore } from "../store/designStore";
import { useEditChainStore } from "../store/editChainStore";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

interface UseGenerateReturn {
  generate: (req: GenerateRequest) => Promise<void>;
  isGenerating: boolean;
  error: string | null;
}

export function useGenerate(): UseGenerateReturn {
  const [error, setError] = useState<string | null>(null);
  const setDesign = useDesignStore((s) => s.setDesign);
  const setGenerating = useDesignStore((s) => s.setGenerating);
  const isGenerating = useDesignStore((s) => s.isGenerating);
  const initChain = useEditChainStore((s) => s.initChain);

  const generate = async (req: GenerateRequest) => {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? `Request failed (${res.status})`);
      }

      const data: GenerateResponse = await res.json();

      // Load design into canvas store
      setDesign(data.design);

      // Initialize the provenance chain for this design session
      initChain(
        data.design.id,
        data.design.chain.creatorAddress
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setGenerating(false);
    }
  };

  return { generate, isGenerating, error };
}
