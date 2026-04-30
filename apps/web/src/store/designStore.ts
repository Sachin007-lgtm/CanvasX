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
