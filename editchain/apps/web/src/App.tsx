// ============================================================
// App.tsx — Root layout: top bar + three-column canvas editor
// ============================================================

import { useState, useEffect } from "react";
import { LayerPanel } from "./components/LayerPanel";
import { SvgCanvas } from "./components/SvgCanvas";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { ProvenancePanel } from "./components/ProvenancePanel";
import { useGenerate } from "./generate/useGenerate";
import { useDesignStore } from "./store/designStore";
import { useEditChainStore } from "./store/editChainStore";
import type { GenerateRequest } from "@editchain/shared-types";

const STYLES = ["minimal", "bold", "editorial", "playful"] as const;

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<GenerateRequest["style"]>("minimal");
  const { generate, isGenerating, error } = useGenerate();
  const [visibleError, setVisibleError] = useState<string | null>(null);

  // Show error and auto-dismiss after 10s
  useEffect(() => {
    if (error) {
      setVisibleError(error);
      const t = setTimeout(() => setVisibleError(null), 10000);
      return () => clearTimeout(t);
    }
  }, [error]);
  const undo = useDesignStore((s) => s.undo);
  const undoStack = useDesignStore((s) => s.undoStack);
  const design = useDesignStore((s) => s.design);
  const chainSummary = useEditChainStore((s) => s.getChainSummary());

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    await generate({ prompt: prompt.trim(), style, width: 800, height: 600 });
  };

  return (
    <div className="app">

      {/* ── Top bar ─────────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-logo">
          <div className="topbar-logo-dot" />
          EditChain
        </div>

        <form
          className="prompt-form"
          onSubmit={(e) => { e.preventDefault(); handleGenerate(); }}
        >
          <input
            id="prompt-input"
            className="prompt-input"
            placeholder="Describe the design you want to generate…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isGenerating}
          />
          <select
            id="style-select"
            className="style-select"
            value={style}
            onChange={(e) => setStyle(e.target.value as GenerateRequest["style"])}
            disabled={isGenerating}
          >
            {STYLES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <button
            id="generate-btn"
            type="submit"
            className="btn btn-primary"
            disabled={isGenerating || !prompt.trim()}
          >
            {isGenerating ? "Generating…" : "✦ Generate"}
          </button>
        </form>

        <div className="topbar-actions">
          {/* Undo */}
          <button
            id="undo-btn"
            className="btn btn-ghost"
            onClick={undo}
            disabled={undoStack.length === 0}
            title="Undo last edit"
          >
            ↩ Undo
          </button>

          {/* Chain status badge */}
          {design && (
            <>
              <div className="chain-status" title="Edit provenance chain status">
                <div className={`chain-dot${chainSummary.totalEdits > 0 ? " active" : ""}`} />
                {chainSummary.totalEdits} edit{chainSummary.totalEdits !== 1 ? "s" : ""}
              </div>

              {chainSummary.ipfsCid ? (
                <div className="chain-status" style={{ color: "#6ee7b7" }}>
                  ✅ Pinned to IPFS
                </div>
              ) : (
                <div className="chain-status" title="Edit provenance chain status">
                  <div className={`chain-dot${chainSummary.totalEdits > 0 ? " active" : ""}`} />
                  {chainSummary.totalEdits} edit{chainSummary.totalEdits !== 1 ? "s" : ""}
                </div>
              )}
            </>
          )}
        </div>
      </header>

      {/* ── Three-column layout ──────────────────────── */}
      <LayerPanel />
      <SvgCanvas />
      <PropertiesPanel />

      {/* ── Phase 4: Provenance Timeline + Mint ─────── */}
      <ProvenancePanel />

      {/* ── Error toast ─────────────────────────────── */}
      {visibleError && (
        <div className="error-banner" id="error-banner">
          <span style={{ flex: 1 }}>⚠ {visibleError}</span>
          <button
            onClick={() => setVisibleError(null)}
            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px", flexShrink: 0 }}
            title="Dismiss"
          >✕</button>
        </div>
      )}
    </div>
  );
}
