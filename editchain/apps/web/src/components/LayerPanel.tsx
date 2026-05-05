// ============================================================
// LayerPanel — left sidebar listing all SVG elements
// ============================================================

import type { SVGElement } from "@editchain/shared-types";
import { useDesignStore } from "../store/designStore";

const ROLE_ICONS: Record<string, string> = {
  headline: "T",
  subheadline: "T",
  "body-text": "¶",
  label: "L",
  background: "▭",
  shape: "◆",
  container: "▣",
  decoration: "✦",
  "image-placeholder": "⊡",
};

export function LayerPanel() {
  const elements = useDesignStore((s) => s.design?.schema.elements ?? []);
  const hasDesign = useDesignStore((s) => !!s.design);
  const selected = useDesignStore((s) => s.selectedElementId);
  const selectElement = useDesignStore((s) => s.selectElement);
  const addElement = useDesignStore((s) => s.addElement);

  return (
    <aside className="layer-panel">
      <div className="panel-header">
        <span className="panel-title">Layers</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{elements.length}</span>
      </div>
      <div className="layer-actions">
        <button type="button" className="btn btn-ghost" onClick={() => addElement("text")} disabled={!hasDesign}>+ Text</button>
        <button type="button" className="btn btn-ghost" onClick={() => addElement("rect")} disabled={!hasDesign}>+ Rect</button>
        <button type="button" className="btn btn-ghost" onClick={() => addElement("circle")} disabled={!hasDesign}>+ Circle</button>
      </div>
      <div className="layer-list">
        {elements.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⬡</div>
            <p>Start with a blank canvas or generate a design to see layers here</p>
          </div>
        ) : (
          // Reverse so top elements appear first
          [...elements].reverse().map((el: SVGElement) => (
            <div
              key={el.id}
              className={`layer-item${selected === el.id ? " selected" : ""}`}
              onClick={() => selectElement(el.id === selected ? null : el.id)}
              title={el.id}
            >
              <span className="layer-icon" style={{ fontFamily: "var(--font-mono)" }}>
                {ROLE_ICONS[el.role] ?? "○"}
              </span>
              <span className="layer-label">{el.label || el.id}</span>
              <span className="layer-role-badge">{el.role.replace("-", " ")}</span>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
