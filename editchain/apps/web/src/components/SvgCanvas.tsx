// ============================================================
// SvgCanvas — renders the AI SVG and handles click-to-select.
// Live editing: a useEffect watches the elements array and
// patches SVG DOM attributes directly so color/text/style
// changes show up instantly without re-generating the SVG.
// ============================================================

import { useRef, useCallback, useEffect } from "react";
import { useDesignStore } from "../store/designStore";
import type { SVGElement } from "@editchain/shared-types";

export function SvgCanvas() {
  const design      = useDesignStore((s) => s.design);
  const isGenerating = useDesignStore((s) => s.isGenerating);
  const selected    = useDesignStore((s) => s.selectedElementId);
  const selectElement = useDesignStore((s) => s.selectElement);
  const elements    = useDesignStore((s) => s.design?.schema.elements ?? []);
  const svgRef      = useRef<SVGSVGElement>(null);

  // ── Live DOM patching ──────────────────────────────────────
  // Whenever any element in the store changes, sync those
  // changes directly to the matching SVG DOM nodes by id.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    for (const el of elements) {
      let node: Element | null = null;
      try {
        node = svg.querySelector(`[id="${el.id}"]`);
      } catch {
        node = svg.getElementById?.(el.id) ?? null;
      }
      if (!node) continue;

      const s = el.style;
      const b = el.bounds;

      // Fill & stroke
      if (s.fill       !== undefined) node.setAttribute("fill",         s.fill);
      if (s.stroke     !== undefined) node.setAttribute("stroke",       s.stroke);
      if (s.strokeWidth !== undefined) node.setAttribute("stroke-width", String(s.strokeWidth));
      if (s.opacity    !== undefined) node.setAttribute("opacity",      String(s.opacity));

      // ── Bounds / position ────────────────────────────────────
      const tag = node.tagName.toLowerCase();
      if (b) {
        if (tag === "text" || tag === "rect" || tag === "image" || tag === "foreignobject") {
          node.setAttribute("x",      String(b.x));
          node.setAttribute("y",      String(b.y));
          if (tag === "rect" || tag === "image") {
            node.setAttribute("width",  String(b.width));
            node.setAttribute("height", String(b.height));
          }
        } else if (tag === "circle" || tag === "ellipse") {
          node.setAttribute("cx", String(b.x + b.width / 2));
          node.setAttribute("cy", String(b.y + b.height / 2));
          node.setAttribute("r",  String(Math.min(b.width, b.height) / 2));
        } else if (tag === "g") {
          // For groups, use a transform translate
          node.setAttribute("transform", `translate(${b.x}, ${b.y})`);
        }
      }

      // ── Typography (text nodes only) ─────────────────────────
      if (el.type === "text") {
        if (s.fontSize   !== undefined) node.setAttribute("font-size",   String(s.fontSize));
        if (s.fontFamily !== undefined) node.setAttribute("font-family", s.fontFamily);
        if (s.fontWeight !== undefined) node.setAttribute("font-weight", s.fontWeight);
        if (s.fill       !== undefined) node.setAttribute("fill",        s.fill);

        // Update text content — handle both plain <text> and <text><tspan> patterns
        if (el.content !== undefined && el.content !== "") {
          const tspan = node.querySelector("tspan");
          if (tspan) {
            tspan.textContent = el.content;
          } else if (node.tagName.toLowerCase() === "text") {
            node.textContent = el.content;
          }
        }
      }
    }
  }, [elements]);

  // ── Click-to-select ───────────────────────────────────────
  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const target = e.target as Element;
      let node: Element | null = target;
      while (node && node !== e.currentTarget) {
        const id = node.getAttribute("id");
        if (id && elements.find((el: SVGElement) => el.id === id)) {
          selectElement(id === selected ? null : id);
          return;
        }
        node = node.parentElement;
      }
      selectElement(null);
    },
    [elements, selected, selectElement]
  );

  // ── Empty / placeholder ───────────────────────────────────
  if (!design && !isGenerating) {
    return (
      <main className="canvas-area">
        <div className="canvas-placeholder">
          <div className="canvas-placeholder-icon">✦</div>
          <h2>Your canvas is empty</h2>
          <p>
            Type a prompt in the bar above and hit{" "}
            <strong style={{ color: "var(--accent)" }}>Generate</strong>, or
            click <strong style={{ color: "var(--accent)" }}>+ Blank canvas</strong> to start from scratch.
          </p>
        </div>
      </main>
    );
  }

  const { width, height } = design?.schema.viewBox ?? { width: 800, height: 600 };
  const selectedEl = elements.find((e: SVGElement) => e.id === selected);

  return (
    <main className="canvas-area">
      <div className="canvas-wrapper" style={{ width, height }}>
        {design && (
          <svg
            ref={svgRef}
            className="canvas-svg"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            xmlns="http://www.w3.org/2000/svg"
            onClick={handleSvgClick}
            dangerouslySetInnerHTML={{ __html: extractInnerSvg(design.schema.svg) }}
            style={{ cursor: "default" }}
          />
        )}

        {/* Selection highlight ring, positioned from element bounds */}
        {selectedEl && (
          <div
            className="selection-ring"
            style={{
              left:   selectedEl.bounds.x - 2,
              top:    selectedEl.bounds.y - 2,
              width:  selectedEl.bounds.width + 4,
              height: selectedEl.bounds.height + 4,
            }}
          />
        )}

        {/* Generating overlay */}
        {isGenerating && (
          <div className="generating-overlay">
            <div className="spinner" />
            <span className="generating-label">Generating design…</span>
          </div>
        )}
      </div>
    </main>
  );
}

// Strip the outer <svg …>…</svg> wrapper so we can inject
// only the children into our own controlled <svg> element.
function extractInnerSvg(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^<svg[^>]*>([\s\S]*)<\/svg>$/i);
  if (match) return match[1];
  return trimmed;
}
