// ============================================================
// PropertiesPanel — right sidebar for editing selected element
// ============================================================

import { useState, useEffect } from "react";
import type { SVGElement } from "@editchain/shared-types";
import { useDesignStore } from "../store/designStore";

export function PropertiesPanel() {
  const selectedId  = useDesignStore((s) => s.selectedElementId);
  const elements    = useDesignStore((s) => s.design?.schema.elements ?? []);
  const updateText  = useDesignStore((s) => s.updateElementText);
  const updateColor = useDesignStore((s) => s.updateElementColor);
  const updateStyle = useDesignStore((s) => s.updateElementStyle);

  const el: SVGElement | undefined = elements.find((e) => e.id === selectedId);

  // Local draft for text (committed on blur)
  const [draftText, setDraftText] = useState(el?.content ?? "");
  useEffect(() => { setDraftText(el?.content ?? ""); }, [el?.id, el?.content]);

  if (!el) {
    return (
      <aside className="props-panel">
        <div className="panel-header">
          <span className="panel-title">Properties</span>
        </div>
        <div className="props-empty">
          <div style={{ fontSize: 28, opacity: 0.3 }}>⊙</div>
          <p>Select an element on the canvas or in the Layers panel to edit its properties.</p>
        </div>
      </aside>
    );
  }

  const isText = el.type === "text";
  const hasColor = ["rect", "circle", "path"].includes(el.type);

  return (
    <aside className="props-panel">
      <div className="panel-header">
        <span className="panel-title">Properties</span>
      </div>
      <div className="props-scroll">

        {/* Element meta */}
        <div className="props-section">
          <div className="props-section-title">Element</div>
          <div className="element-meta">
            <span className="meta-chip">{el.type}</span>
            <span className="meta-chip">{el.role}</span>
            {el.editable && <span className="meta-chip" style={{ background: "rgba(34,197,94,.15)", color: "var(--success)", borderColor: "var(--success)" }}>editable</span>}
          </div>
          <div className="props-row">
            <label className="props-label">ID</label>
            <input
              className="props-input"
              value={el.id}
              readOnly
              style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}
            />
          </div>
        </div>

        {/* Text content */}
        {isText && (
          <div className="props-section">
            <div className="props-section-title">Content</div>
            <div className="props-row">
              <label className="props-label">Text</label>
              <textarea
                className="props-textarea"
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                onBlur={() => {
                  if (draftText !== el.content) {
                    updateText(el.id, draftText);
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Typography */}
        {isText && (
          <div className="props-section">
            <div className="props-section-title">Typography</div>
            <div className="props-row">
              <label className="props-label">Font family</label>
              <input
                className="props-input"
                value={el.style.fontFamily ?? ""}
                onChange={(e) => updateStyle(el.id, { fontFamily: e.target.value })}
              />
            </div>
            <div className="props-number-row">
              <div className="props-row">
                <label className="props-label">Size (px)</label>
                <input
                  className="props-input"
                  type="number"
                  min={6}
                  max={200}
                  value={el.style.fontSize ?? ""}
                  onChange={(e) => updateStyle(el.id, { fontSize: Number(e.target.value) })}
                />
              </div>
              <div className="props-row">
                <label className="props-label">Weight</label>
                <input
                  className="props-input"
                  value={el.style.fontWeight ?? ""}
                  onChange={(e) => updateStyle(el.id, { fontWeight: e.target.value })}
                />
              </div>
            </div>
            <div className="props-row">
              <label className="props-label">Fill color</label>
              <div className="color-row">
                <button className="color-swatch" title="Pick fill color">
                  <input
                    type="color"
                    value={toHex(el.style.fill)}
                    onChange={(e) => updateColor(el.id, "fill", e.target.value)}
                  />
                </button>
                <input
                  className="props-input"
                  value={el.style.fill ?? ""}
                  onChange={(e) => updateColor(el.id, "fill", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Shape color */}
        {hasColor && (
          <div className="props-section">
            <div className="props-section-title">Appearance</div>
            <div className="props-row">
              <label className="props-label">Fill</label>
              <div className="color-row">
                <button className="color-swatch" title="Pick fill color">
                  <input
                    type="color"
                    value={toHex(el.style.fill)}
                    onChange={(e) => updateColor(el.id, "fill", e.target.value)}
                  />
                </button>
                <input
                  className="props-input"
                  value={el.style.fill ?? ""}
                  onChange={(e) => updateColor(el.id, "fill", e.target.value)}
                />
              </div>
            </div>
            <div className="props-row">
              <label className="props-label">Stroke</label>
              <div className="color-row">
                <button className="color-swatch" title="Pick stroke color">
                  <input
                    type="color"
                    value={toHex(el.style.stroke)}
                    onChange={(e) => updateColor(el.id, "stroke", e.target.value)}
                  />
                </button>
                <input
                  className="props-input"
                  value={el.style.stroke ?? ""}
                  onChange={(e) => updateColor(el.id, "stroke", e.target.value)}
                />
              </div>
            </div>
            <div className="props-row">
              <label className="props-label">Stroke width</label>
              <input
                className="props-input"
                type="number"
                min={0}
                step={0.5}
                value={el.style.strokeWidth ?? 0}
                onChange={(e) => updateStyle(el.id, { strokeWidth: Number(e.target.value) })}
              />
            </div>
          </div>
        )}

        {/* Opacity */}
        <div className="props-section">
          <div className="props-section-title">Opacity</div>
          <div className="props-row">
            <label className="props-label">{Math.round((el.style.opacity ?? 1) * 100)}%</label>
            <input
              type="range"
              min={0} max={1} step={0.01}
              value={el.style.opacity ?? 1}
              onChange={(e) => updateStyle(el.id, { opacity: Number(e.target.value) })}
              style={{ width: "100%", accentColor: "var(--accent)" }}
            />
          </div>
        </div>

        {/* Bounds (read-only info) */}
        <div className="props-section">
          <div className="props-section-title">Bounds</div>
          <div className="props-number-row">
            <div className="props-row">
              <label className="props-label">X</label>
              <input className="props-input" value={Math.round(el.bounds.x)} readOnly />
            </div>
            <div className="props-row">
              <label className="props-label">Y</label>
              <input className="props-input" value={Math.round(el.bounds.y)} readOnly />
            </div>
            <div className="props-row">
              <label className="props-label">W</label>
              <input className="props-input" value={Math.round(el.bounds.width)} readOnly />
            </div>
            <div className="props-row">
              <label className="props-label">H</label>
              <input className="props-input" value={Math.round(el.bounds.height)} readOnly />
            </div>
          </div>
        </div>

      </div>
    </aside>
  );
}

/** Safely convert any color value to a hex string for the color input */
function toHex(val: string | undefined): string {
  if (!val || val === "none") return "#000000";
  if (val.startsWith("#") && (val.length === 4 || val.length === 7)) return val;
  return "#000000";
}
