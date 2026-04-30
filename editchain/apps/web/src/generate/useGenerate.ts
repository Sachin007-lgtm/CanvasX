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
        const raw: string = data.message ?? "";
        // Give a clean message for common Gemini API errors
        if (res.status === 429 || raw.includes("429") || raw.toLowerCase().includes("quota")) {
          throw new Error(
            "Gemini API quota exceeded. The free tier limit has been reached. " +
            "Please wait a minute and try again, or upgrade your Google AI Studio plan at https://ai.dev/rate-limit"
          );
        }
        if (res.status === 403 || raw.includes("403")) {
          throw new Error("Gemini API key is invalid or missing. Set GEMINI_API_KEY in your .env file.");
        }
        throw new Error(raw.length > 120 ? raw.slice(0, 120) + "…" : (raw || `Request failed (${res.status})`));
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
