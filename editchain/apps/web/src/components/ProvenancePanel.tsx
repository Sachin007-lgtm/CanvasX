// ============================================================
// ProvenancePanel.tsx — Phase 4 visualization with minimize toggle
// ============================================================

import { useState } from "react";
import { useEditChainStore } from "../store/editChainStore";
import { useDesignStore } from "../store/designStore";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const WALLET_ADDRESS = "0x8f78Ed31A74b7C0b065Bb96251b71BAd33a0CeC3";

const ACTION_COLORS: Record<string, string> = {
  "text-change":    "#6ee7b7",
  "color-change":   "#93c5fd",
  "move":           "#fde68a",
  "resize":         "#f9a8d4",
  "font-change":    "#c4b5fd",
  "opacity-change": "#fca5a5",
  "add-element":    "#6ee7b7",
  "delete-element": "#f87171",
  "reorder":        "#e5e7eb",
};

export function ProvenancePanel() {
  const chain     = useEditChainStore((s) => s.chain);
  const isSyncing = useEditChainStore((s) => s.isSyncing);
  const finalize  = useEditChainStore((s) => s.finalize);
  const design    = useDesignStore((s) => s.design);

  const [minimized,  setMinimized]  = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [minting,    setMinting]    = useState(false);
  const [mintResult, setMintResult] = useState<{ txHash: string; tokenId: string; etherscanUrl: string } | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  if (!design || !chain) return null;

  const events = chain.events;

  const handleFinalize = async () => {
    setFinalizing(true); setError(null);
    try { await finalize(); }
    catch (e) { setError(e instanceof Error ? e.message : "Finalization failed"); }
    finally   { setFinalizing(false); }
  };

  const handleMint = async () => {
    if (!chain.ipfsCid || !chain.merkleRoot) { setError("Finalize & Pin to IPFS first!"); return; }
    setMinting(true); setError(null);
    try {
      const res  = await fetch(`${API_BASE}/api/mint/${design.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: WALLET_ADDRESS }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Mint failed (${res.status})`);
      setMintResult({ txHash: data.txHash, tokenId: data.tokenId, etherscanUrl: data.etherscanUrl });
    } catch (e) { setError(e instanceof Error ? e.message : "Mint failed"); }
    finally     { setMinting(false); }
  };

  return (
    <div style={{
      position:   "fixed",
      bottom:     0,
      left:       0,
      right:      0,
      background: "#0f172a",
      borderTop:  "1px solid #1e293b",
      zIndex:     50,
      fontFamily: "Inter, sans-serif",
      transition: "max-height 0.25s ease",
      maxHeight:  minimized ? 40 : 220,
      overflow:   "hidden",
    }}>
      {/* ── Header bar (always visible) ── */}
      <div style={{
        height:         40,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        padding:        "0 16px",
        borderBottom:   minimized ? "none" : "1px solid #1e293b",
        flexShrink:     0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b" }}>
            Edit Timeline
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 8px",
            borderRadius: 99, background: events.length > 0 ? "#6366f122" : "#1e293b",
            color: events.length > 0 ? "#818cf8" : "#475569",
            border: `1px solid ${events.length > 0 ? "#6366f144" : "#1e293b"}`,
          }}>
            {events.length} events
          </span>
          {chain.merkleRoot && (
            <span style={{ fontSize: 10, color: "#6ee7b7", fontFamily: "monospace" }}>
              ✅ {chain.merkleRoot.slice(0, 14)}…
            </span>
          )}
        </div>

        {/* Minimize / Maximize toggle */}
        <button
          onClick={() => setMinimized((m) => !m)}
          title={minimized ? "Expand provenance panel" : "Collapse provenance panel"}
          style={{
            background: "#1e293b", border: "1px solid #334155",
            borderRadius: 6, color: "#94a3b8",
            cursor: "pointer", fontSize: 13, padding: "2px 10px",
            lineHeight: 1.6, transition: "background 0.15s",
          }}
        >
          {minimized ? "▲ Expand" : "▼ Collapse"}
        </button>
      </div>

      {/* ── Body (hidden when minimized) ── */}
      {!minimized && (
        <div style={{
          display: "flex", gap: 20, alignItems: "flex-start",
          padding: "12px 16px", overflowY: "auto", maxHeight: 178,
        }}>
          {/* Timeline grid */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {events.length === 0 ? (
              <span style={{ color: "#475569", fontSize: 12 }}>
                No edits yet — select an element and change a property.
              </span>
            ) : (
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                {events.map((evt, i) => (
                  <div
                    key={i}
                    title={`#${evt.seq} · ${evt.action} on ${evt.elementId}\nHash: ${evt.hash?.slice(0, 20) ?? "computing…"}`}
                    style={{
                      width: 16, height: 16, borderRadius: 3,
                      background: ACTION_COLORS[evt.action] ?? "#94a3b8",
                      opacity: evt.hash ? 1 : 0.4,
                      border: evt.hash ? "none" : "1px dashed #64748b",
                      flexShrink: 0, cursor: "default",
                    }}
                  />
                ))}
              </div>
            )}
            <div style={{ fontSize: 10, color: "#334155", marginTop: 6, display: "flex", gap: 10 }}>
              {Object.entries(ACTION_COLORS).slice(0,4).map(([action, color]) => (
                <span key={action} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: "inline-block" }} />
                  {action.replace("-change", "")}
                </span>
              ))}
            </div>
          </div>

          {/* Provenance info */}
          <div style={{ minWidth: 260, flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              Provenance Chain
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 3 }}>
              Merkle Root: {chain.merkleRoot
                ? <span style={{ color: "#6ee7b7", fontFamily: "monospace" }}>{chain.merkleRoot.slice(0, 24)}…</span>
                : <span style={{ color: "#475569" }}>not computed</span>}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              IPFS CID: {chain.ipfsCid
                ? <a href={`https://gateway.pinata.cloud/ipfs/${chain.ipfsCid}`} target="_blank" rel="noreferrer"
                     style={{ color: "#60a5fa", fontFamily: "monospace" }}>{chain.ipfsCid.slice(0, 24)}…</a>
                : <span style={{ color: "#475569" }}>not pinned</span>}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 170, flexShrink: 0 }}>
            {!chain.ipfsCid ? (
              <button onClick={handleFinalize} disabled={finalizing || isSyncing} style={btnStyle(finalizing ? "#334155" : "#6366f1", "#fff")}>
                {finalizing ? "⏳ Pinning to IPFS…" : "🔒 Finalize & Pin"}
              </button>
            ) : mintResult ? (
              <a href={mintResult.etherscanUrl} target="_blank" rel="noreferrer" style={{ ...btnStyle("#16a34a", "#fff"), textDecoration: "none", textAlign: "center" }}>
                ✅ Token #{mintResult.tokenId} — View TX
              </a>
            ) : (
              <button onClick={handleMint} disabled={minting} style={btnStyle(minting ? "#334155" : "#f59e0b", "#000")}>
                {minting ? "⛏ Minting…" : "⛓ Mint to Ethereum"}
              </button>
            )}
            {error && <div style={{ fontSize: 11, color: "#f87171", wordBreak: "break-word" }}>⚠ {error}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    padding: "8px 14px", background: bg, color, border: "none",
    borderRadius: 8, fontSize: 12, fontWeight: 600,
    cursor: "pointer", transition: "background 0.2s", width: "100%",
  };
}
