// ============================================================
// Design Store (Zustand)
// Central state for the active design on the canvas.
// Every mutation here also dispatches an EditEvent to the
// editChainStore for provenance tracking.
// ============================================================

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Design, SVGElement, EditAction } from "@editchain/shared-types";

interface DesignState {
  // Active design
  design: Design | null;
  // Currently selected element ID
  selectedElementId: string | null;
  // Whether AI is generating
  isGenerating: boolean;
  // Whether a save is in flight
  isSaving: boolean;
  // Undo stack (stores element states before edits)
  undoStack: Array<{ elementId: string; before: Partial<SVGElement> }>;

  // Actions
  setDesign: (design: Design) => void;
  selectElement: (id: string | null) => void;
  setGenerating: (val: boolean) => void;

  // Canvas mutations — each one emits a provenance event
  updateElementText: (elementId: string, text: string) => void;
  updateElementColor: (
    elementId: string,
    property: "fill" | "stroke",
    color: string
  ) => void;
  updateElementBounds: (
    elementId: string,
    bounds: Partial<SVGElement["bounds"]>
  ) => void;
  updateElementStyle: (
    elementId: string,
    style: Partial<SVGElement["style"]>
  ) => void;
  addElement: (type: "text" | "rect" | "circle") => void;

  // Undo last action
  undo: () => void;

  // Reset
  clear: () => void;
}

// Callback to be set by the editChainStore bridge
// Decoupled so the stores don't directly import each other
let onEditCallback: ((
  elementId: string,
  action: EditAction,
  before: Partial<SVGElement>,
  after: Partial<SVGElement>
) => void) | null = null;

export function setEditCallback(
  cb: typeof onEditCallback
) {
  onEditCallback = cb;
}

function emitEdit(
  elementId: string,
  action: EditAction,
  before: Partial<SVGElement>,
  after: Partial<SVGElement>
) {
  onEditCallback?.(elementId, action, before, after);
}

export const useDesignStore = create<DesignState>()(
  immer((set, get) => ({
    design: null,
    selectedElementId: null,
    isGenerating: false,
    isSaving: false,
    undoStack: [],

    setDesign: (design) =>
      set((state) => {
        state.design = design;
        state.selectedElementId = null;
        state.undoStack = [];
      }),

    selectElement: (id) =>
      set((state) => {
        state.selectedElementId = id;
      }),

    setGenerating: (val) =>
      set((state) => {
        state.isGenerating = val;
      }),

    updateElementText: (elementId, text) => {
      const el = get().design?.schema.elements.find((e) => e.id === elementId);
      if (!el) return;

      const before = { content: el.content };
      const after = { content: text };

      set((state) => {
        const element = state.design?.schema.elements.find(
          (e) => e.id === elementId
        );
        if (element) {
          state.undoStack.push({ elementId, before: { content: el.content } });
          element.content = text;
        }
      });

      emitEdit(elementId, "text-change", before, after);
    },

    updateElementColor: (elementId, property, color) => {
      const el = get().design?.schema.elements.find((e) => e.id === elementId);
      if (!el) return;

      const before = { style: { [property]: el.style[property] } };
      const after = { style: { [property]: color } };

      set((state) => {
        const element = state.design?.schema.elements.find(
          (e) => e.id === elementId
        );
        if (element) {
          state.undoStack.push({
            elementId,
            before: { style: { ...el.style } },
          });
          element.style[property] = color;
        }
      });

      emitEdit(elementId, "color-change", before, after);
    },

    updateElementBounds: (elementId, bounds) => {
      const el = get().design?.schema.elements.find((e) => e.id === elementId);
      if (!el) return;

      const before = { bounds: { ...el.bounds } };
      const after = { bounds: { ...el.bounds, ...bounds } };

      set((state) => {
        const element = state.design?.schema.elements.find(
          (e) => e.id === elementId
        );
        if (element) {
          state.undoStack.push({ elementId, before: { bounds: { ...el.bounds } } });
          Object.assign(element.bounds, bounds);
        }
      });

      emitEdit(elementId, "move", before, after);
    },

    updateElementStyle: (elementId, style) => {
      const el = get().design?.schema.elements.find((e) => e.id === elementId);
      if (!el) return;

      const before = { style: { ...el.style } };
      const after = { style: { ...el.style, ...style } };

      set((state) => {
        const element = state.design?.schema.elements.find(
          (e) => e.id === elementId
        );
        if (element) {
          state.undoStack.push({ elementId, before: { style: { ...el.style } } });
          Object.assign(element.style, style);
        }
      });

      const action: EditAction =
        style.fontSize !== undefined ? "font-change" : "opacity-change";
      emitEdit(elementId, action, before, after);
    },

    addElement: (type) => {
      const design = get().design;
      if (!design) return;

      const width = design.schema.viewBox.width;
      const height = design.schema.viewBox.height;
      const id = `${type}-${Date.now()}`;
      let element: SVGElement;

      if (type === "text") {
        element = {
          id,
          type: "text",
          role: "body-text",
          editable: true,
          label: "New text",
          content: "New text",
          style: {
            fill: "#111111",
            stroke: "none",
            strokeWidth: 0,
            fontSize: 32,
            fontFamily: "Inter, sans-serif",
            fontWeight: "700",
            opacity: 1,
          },
          bounds: { x: 100, y: 140, width: 240, height: 40 },
        };
      } else if (type === "rect") {
        element = {
          id,
          type: "rect",
          role: "shape",
          editable: true,
          label: "Rectangle",
          content: "#60a5fa",
          style: {
            fill: "#60a5fa",
            stroke: "#1e3a8a",
            strokeWidth: 2,
            opacity: 1,
          },
          bounds: { x: 120, y: 180, width: 240, height: 140 },
        };
      } else {
        element = {
          id,
          type: "circle",
          role: "shape",
          editable: true,
          label: "Circle",
          content: "#fca5a5",
          style: {
            fill: "#fca5a5",
            stroke: "#b91c1c",
            strokeWidth: 2,
            opacity: 1,
          },
          bounds: { x: 280, y: 240, width: 120, height: 120 },
        };
      }

      set((state) => {
        if (!state.design) return;
        state.design.schema.elements.push(element);
        state.design.schema.svg = buildSvgFromElements(
          state.design.schema.elements,
          state.design.schema.viewBox.width,
          state.design.schema.viewBox.height
        );
      });

      emitEdit(id, "add-element", {}, element);
    },

    undo: () => {
      const last = get().undoStack[get().undoStack.length - 1];
      if (!last) return;

      set((state) => {
        const element = state.design?.schema.elements.find(
          (e) => e.id === last.elementId
        );
        if (element) {
          if (last.before.content !== undefined)
            element.content = last.before.content;
          if (last.before.style) Object.assign(element.style, last.before.style);
          if (last.before.bounds) Object.assign(element.bounds, last.before.bounds);
          state.undoStack.pop();
        }
      });
    },

    clear: () =>
      set((state) => {
        state.design = null;
        state.selectedElementId = null;
        state.undoStack = [];
      }),
  }))
);

function buildSvgFromElements(elements: SVGElement[], width: number, height: number) {
  const children = elements.map((el) => {
    const attrs: string[] = [];
    const s = el.style;

    if (s.fill !== undefined) attrs.push(`fill="${s.fill}"`);
    if (s.stroke !== undefined) attrs.push(`stroke="${s.stroke}"`);
    if (s.strokeWidth !== undefined) attrs.push(`stroke-width="${s.strokeWidth}"`);
    if (s.opacity !== undefined) attrs.push(`opacity="${s.opacity}"`);

    if (el.type === "text") {
      attrs.push(`x="${el.bounds.x}"`, `y="${el.bounds.y}"`);
      if (s.fontSize !== undefined) attrs.push(`font-size="${s.fontSize}"`);
      if (s.fontFamily) attrs.push(`font-family="${s.fontFamily}"`);
      if (s.fontWeight) attrs.push(`font-weight="${s.fontWeight}"`);
      const content = escapeSvgText(el.content ?? "");
      return `<text id="${el.id}" ${attrs.join(" ")}>${content}</text>`;
    }

    if (el.type === "rect") {
      attrs.push(
        `x="${el.bounds.x}"`,
        `y="${el.bounds.y}"`,
        `width="${el.bounds.width}"`,
        `height="${el.bounds.height}"`
      );
      return `<rect id="${el.id}" ${attrs.join(" ")} />`;
    }

    if (el.type === "circle") {
      const cx = el.bounds.x + el.bounds.width / 2;
      const cy = el.bounds.y + el.bounds.height / 2;
      const r = Math.min(el.bounds.width, el.bounds.height) / 2;
      attrs.push(`cx="${cx}"`, `cy="${cy}"`, `r="${r}"`);
      return `<circle id="${el.id}" ${attrs.join(" ")} />`;
    }

    return "";
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${children.join("\n")}</svg>`;
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
