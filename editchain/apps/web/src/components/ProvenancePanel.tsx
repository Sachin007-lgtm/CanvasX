// ============================================================
// ProvenancePanel.tsx — Phase 4 visualization + Merkle Proof Verifier
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

// ── Verify result state ────────────────────────────────────────────────────
type VerifyState = "idle" | "loading" | "valid" | "invalid" | "error";

export function ProvenancePanel() {
  const chain     = useEditChainStore((s) => s.chain);
  const isSyncing = useEditChainStore((s) => s.isSyncing);
  const finalize  = useEditChainStore((s) => s.finalize);
  const design    = useDesignStore((s) => s.design);

  const [minimized,    setMinimized]    = useState(false);
  const [finalizing,   setFinalizing]   = useState(false);
  const [minting,      setMinting]      = useState(false);
  const [mintResult,   setMintResult]   = useState<{ txHash: string; tokenId: string; etherscanUrl: string } | null>(null);
  const [error,        setError]        = useState<string | null>(null);

  // ── Verifier state ─────────────────────────────────────────────────────────
  const [selectedIdx,  setSelectedIdx]  = useState<number | null>(null);
  const [verifyState,  setVerifyState]  = useState<VerifyState>("idle");
  const [verifyMsg,    setVerifyMsg]    = useState<string>("");
  const [showVerifier, setShowVerifier] = useState(false);

  if (!design || !chain) return null;

  const events = chain.events;
  const leaves  = events.map((e) => e.hash ?? "").filter(Boolean);

  // ── Handlers ───────────────────────────────────────────────────────────────
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

  const handleSelectEvent = (idx: number) => {
    setSelectedIdx(idx === selectedIdx ? null : idx);
    setVerifyState("idle");
    setVerifyMsg("");
    setShowVerifier(true);
  };

  // Fetch proof from server (server knows genesis hash + full tree)
  // then call verify-event endpoint for the final boolean result
  const handleVerify = async () => {
    if (selectedIdx === null || !chain.merkleRoot) return;
    const eventHash = events[selectedIdx]?.hash;
    if (!eventHash) {
      setVerifyMsg("Event has no hash yet — finalize first.");
      setVerifyState("error");
      return;
    }

    setVerifyState("loading");
    setVerifyMsg("");

    try {
      // Step 1 — fetch the server-computed Merkle proof using the sequence number
      const seq = events[selectedIdx].seq;
      const proofRes  = await fetch(
        `${API_BASE}/api/provenance/${design.id}/proof/seq/${seq}`
      );
      const proofData = await proofRes.json();
      if (!proofRes.ok) throw new Error(proofData.error ?? "Failed to fetch proof");

      // Step 2 — verify the proof against the committed root
      const verifyRes  = await fetch(`${API_BASE}/api/provenance/verify-event`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          eventHash:  proofData.eventHash,
          proof:      proofData.proof,
          index:      proofData.index,
          merkleRoot: proofData.merkleRoot,
        }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error ?? "Verification request failed");

      if (verifyData.valid) {
        setVerifyState("valid");
        setVerifyMsg(
          `Event #${selectedIdx + 1} is cryptographically proven to be part of this design's history. ` +
          `Proof depth: ${proofData.proof.length} hashes.`
        );
      } else {
        setVerifyState("invalid");
        setVerifyMsg("Proof is invalid — this event does not match the committed Merkle root.");
      }
    } catch (e) {
      setVerifyState("error");
      setVerifyMsg(e instanceof Error ? e.message : "Verification failed");
    }
  };

  const selectedEvent = selectedIdx !== null ? events[selectedIdx] : null;

  // ── Render ─────────────────────────────────────────────────────────────────
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
      transition: "max-height 0.3s ease",
      maxHeight:  minimized ? 40 : showVerifier && selectedEvent ? 360 : 220,
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
          {/* Verifier toggle */}
          {events.length > 0 && (
            <button
              id="verify-toggle-btn"
              onClick={() => setShowVerifier((v) => !v)}
              title="Toggle Merkle proof verifier"
              style={{
                background: showVerifier ? "#312e81" : "#1e293b",
                border: `1px solid ${showVerifier ? "#6366f1" : "#334155"}`,
                borderRadius: 6, color: showVerifier ? "#a5b4fc" : "#64748b",
                cursor: "pointer", fontSize: 10, padding: "2px 10px",
                fontWeight: 600, letterSpacing: "0.05em",
              }}
            >
              🔍 Verify Event
            </button>
          )}
        </div>

        <button
          id="provenance-collapse-btn"
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

      {/* ── Body ── */}
      {!minimized && (
        <div style={{
          display: "flex", flexDirection: "column", gap: 0,
          padding: "12px 16px", overflowY: "auto", maxHeight: showVerifier && selectedEvent ? 318 : 178,
        }}>
          {/* Top row: timeline + provenance info + actions */}
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

            {/* Timeline grid */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {events.length === 0 ? (
                <span style={{ color: "#475569", fontSize: 12 }}>
                  No edits yet — select an element and change a property.
                </span>
              ) : (
                <>
                  {showVerifier && (
                    <div style={{ fontSize: 10, color: "#64748b", marginBottom: 5 }}>
                      Click an event dot to select it, then verify its Merkle proof ↓
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                    {events.map((evt, i) => (
                      <div
                        key={i}
                        id={`event-dot-${i}`}
                        onClick={() => showVerifier && handleSelectEvent(i)}
                        title={`#${evt.seq} · ${evt.action} on ${evt.elementId}\nHash: ${evt.hash?.slice(0, 20) ?? "computing…"}${showVerifier ? "\nClick to verify" : ""}`}
                        style={{
                          width:        selectedIdx === i ? 20 : 16,
                          height:       selectedIdx === i ? 20 : 16,
                          borderRadius: 3,
                          background:   ACTION_COLORS[evt.action] ?? "#94a3b8",
                          opacity:      evt.hash ? 1 : 0.4,
                          border:       selectedIdx === i
                            ? "2px solid #fff"
                            : evt.hash ? "none" : "1px dashed #64748b",
                          flexShrink:   0,
                          cursor:       showVerifier ? "pointer" : "default",
                          transition:   "all 0.15s",
                          transform:    selectedIdx === i ? "translateY(-2px)" : "none",
                          boxShadow:    selectedIdx === i ? "0 0 8px rgba(255,255,255,0.3)" : "none",
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
              <div style={{ fontSize: 10, color: "#334155", marginTop: 6, display: "flex", gap: 10 }}>
                {Object.entries(ACTION_COLORS).slice(0, 4).map(([action, color]) => (
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
              {!mintResult && (
                <button id="finalize-btn" onClick={handleFinalize} disabled={finalizing || isSyncing} style={btnStyle(finalizing ? "#334155" : "#6366f1", "#fff")}>
                  {finalizing ? "⏳ Pinning to IPFS…" : (chain.ipfsCid ? "🔄 Re-Finalize & Pin" : "🔒 Finalize & Pin")}
                </button>
              )}

              {chain.ipfsCid && !mintResult && (
                <button id="mint-btn" onClick={handleMint} disabled={minting} style={btnStyle(minting ? "#334155" : "#f59e0b", "#000")}>
                  {minting ? "⛏ Minting…" : "⛓ Mint to Ethereum"}
                </button>
              )}

              {mintResult && (
                <a href={mintResult.etherscanUrl} target="_blank" rel="noreferrer" style={{ ...btnStyle("#16a34a", "#fff"), textDecoration: "none", textAlign: "center" }}>
                  ✅ Token #{mintResult.tokenId} — View TX
                </a>
              )}
              {error && <div style={{ fontSize: 11, color: "#f87171", wordBreak: "break-word" }}>⚠ {error}</div>}
            </div>
          </div>

          {/* ── Merkle Proof Verifier Panel ── */}
          {showVerifier && selectedEvent && (
            <div id="merkle-verifier-panel" style={{
              marginTop:    14,
              padding:      "12px 14px",
              background:   "#0a1628",
              borderRadius: 10,
              border:       "1px solid #1e293b",
              display:      "flex",
              gap:          16,
              alignItems:   "flex-start",
              flexWrap:     "wrap",
            }}>
              {/* Event info */}
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                  Selected Event #{selectedIdx! + 1}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 10px", fontSize: 11 }}>
                  <span style={{ color: "#64748b" }}>Action</span>
                  <span style={{
                    color: ACTION_COLORS[selectedEvent.action] ?? "#94a3b8",
                    fontWeight: 600,
                  }}>{selectedEvent.action}</span>

                  <span style={{ color: "#64748b" }}>Element</span>
                  <span style={{ color: "#94a3b8", fontFamily: "monospace" }}>{selectedEvent.elementId}</span>

                  <span style={{ color: "#64748b" }}>Seq</span>
                  <span style={{ color: "#94a3b8" }}>#{selectedEvent.seq}</span>

                  <span style={{ color: "#64748b" }}>Hash</span>
                  <span style={{ color: "#818cf8", fontFamily: "monospace", fontSize: 10, wordBreak: "break-all" }}>
                    {selectedEvent.hash ? `${selectedEvent.hash.slice(0, 32)}…` : "—"}
                  </span>

                  <span style={{ color: "#64748b" }}>Leaf index</span>
                  <span style={{ color: "#94a3b8" }}>{selectedIdx} of {leaves.length}</span>
                </div>
              </div>

              {/* Proof info + action */}
              <div style={{ minWidth: 200, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Merkle Proof
                </div>
                {!chain.merkleRoot ? (
                  <div style={{ fontSize: 11, color: "#f59e0b" }}>
                    ⚠ Finalize & Pin first to generate Merkle root
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 10, color: "#475569" }}>
                      Tree size: {leaves.length + 1} leaves (incl. genesis)<br />
                      Verifies in O(log {leaves.length + 1}) ={" "}
                      {Math.ceil(Math.log2(Math.max(leaves.length + 1, 2)))} steps
                    </div>
                    <button
                      id="run-verify-btn"
                      onClick={handleVerify}
                      disabled={verifyState === "loading"}
                      style={btnStyle(
                        verifyState === "loading" ? "#334155"
                        : verifyState === "valid"   ? "#15803d"
                        : verifyState === "invalid" ? "#991b1b"
                        : "#6366f1",
                        "#fff"
                      )}
                    >
                      {verifyState === "loading" ? "⏳ Verifying…"
                       : verifyState === "valid"  ? "✅ Verified"
                       : verifyState === "invalid"? "✗ Invalid"
                       : "🔍 Verify on Chain"}
                    </button>
                  </>
                )}

                {/* Result message */}
                {verifyMsg && (
                  <div style={{
                    fontSize:     11,
                    color:        verifyState === "valid" ? "#6ee7b7" : verifyState === "invalid" ? "#f87171" : "#fbbf24",
                    background:   verifyState === "valid" ? "#052e16" : verifyState === "invalid" ? "#450a0a" : "#1c1400",
                    border:       `1px solid ${verifyState === "valid" ? "#166534" : verifyState === "invalid" ? "#7f1d1d" : "#92400e"}`,
                    borderRadius: 6,
                    padding:      "6px 10px",
                    lineHeight:   1.5,
                  }}>
                    {verifyMsg}
                  </div>
                )}
              </div>
            </div>
          )}
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
