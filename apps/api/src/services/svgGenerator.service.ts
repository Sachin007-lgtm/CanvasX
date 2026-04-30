// ============================================================
// SVG Generator Service
// This is the core AI service. It calls Claude/GPT with a
// carefully engineered prompt that forces structured, editable
// SVG output annotated with our semantic schema.
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import type {
  SVGDesignSchema,
  SVGElement,
  GenerateRequest,
} from "@editchain/shared-types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ------------------------------------------------------------
// The system prompt is the core IP of this project.
// It forces the model to output BOTH valid SVG and a machine-
// readable element schema in a single JSON response.
// ------------------------------------------------------------

const SYSTEM_PROMPT = `You are EditChain's SVG design engine. You generate structured, editable graphic designs as SVG.

CRITICAL RULES:
1. Always respond with ONLY valid JSON — no markdown, no preamble.
2. The JSON must have exactly two keys: "svg" (string) and "elements" (array).
3. Every meaningful visual element in the SVG MUST appear in the elements array with a matching id="" attribute.
4. SVG must be self-contained (no external fonts via @import — use system-safe fonts or specify Google Fonts embed).
5. Design dimensions: use the requested width/height in the viewBox.
6. All text must be editable (role: "headline", "subheadline", "body-text", or "label").
7. All color-bearing shapes must be editable (role: "background", "shape", "container", "decoration").
8. Keep SVG clean: no JavaScript inside SVG, no foreignObject.

ELEMENT SCHEMA per element:
{
  "id": string,           // matches id="" in SVG
  "type": "text"|"rect"|"circle"|"path"|"image"|"group",
  "role": "headline"|"subheadline"|"body-text"|"label"|"background"|"shape"|"image-placeholder"|"container"|"decoration",
  "editable": boolean,
  "label": string,        // human label for layer panel, e.g. "Main headline"
  "content": string,      // text content OR hex color for shapes
  "style": {
    "fill": string,
    "stroke": string,
    "strokeWidth": number,
    "fontSize": number,
    "fontFamily": string,
    "fontWeight": string,
    "opacity": number
  },
  "bounds": { "x": number, "y": number, "width": number, "height": number }
}

DESIGN QUALITY RULES:
- Create professional, visually balanced layouts
- Use a coherent color palette (2-4 colors max)
- Maintain clear visual hierarchy (one dominant headline, supporting elements)
- Use generous whitespace
- Every design should look like it belongs in a real product or campaign`;

const STYLE_HINTS: Record<string, string> = {
  minimal: "Clean, lots of whitespace, single accent color, sans-serif typography.",
  bold: "High contrast, large typography, strong geometric shapes, vibrant colors.",
  editorial: "Magazine-style layout, serif headlines, grid-aligned, sophisticated palette.",
  playful: "Rounded corners, bright colors, friendly fonts, asymmetric layout.",
};

// ------------------------------------------------------------
// Main generation function
// ------------------------------------------------------------

export async function generateDesign(
  req: GenerateRequest
): Promise<SVGDesignSchema> {
  const { prompt, style = "minimal", width = 800, height = 600 } = req;

  const styleHint = STYLE_HINTS[style];

  const userPrompt = `Create a ${style} design for: "${prompt}"

Style guidance: ${styleHint}
Canvas size: ${width}x${height}px

Generate a complete, professional SVG layout with all elements annotated.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  // Extract text content
  const rawContent = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  // Parse and validate
  let parsed: { svg: string; elements: SVGElement[] };
  try {
    parsed = JSON.parse(rawContent.trim());
  } catch {
    // Attempt to extract JSON if model added any preamble
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Model returned non-JSON response");
    }
    parsed = JSON.parse(jsonMatch[0]);
  }

  if (!parsed.svg || !Array.isArray(parsed.elements)) {
    throw new Error("Invalid design schema from model");
  }

  // Extract color palette from elements
  const palette = extractPalette(parsed.elements);

  // Hash the prompt for provenance
  const promptHash = crypto
    .createHash("sha256")
    .update(prompt)
    .digest("hex");

  const schema: SVGDesignSchema = {
    svg: parsed.svg,
    viewBox: { width, height },
    elements: parsed.elements,
    palette,
    promptHash,
  };

  return schema;
}

// ------------------------------------------------------------
// Iterative editing — ask the model to modify one element
// while preserving the rest of the design
// ------------------------------------------------------------

export async function aiEditElement(
  currentSvg: string,
  elementId: string,
  instruction: string
): Promise<{ newSvg: string; updatedElement: Partial<SVGElement> }> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Here is an SVG design:
<svg_design>
${currentSvg}
</svg_design>

Modify ONLY the element with id="${elementId}".
Instruction: ${instruction}

Respond with JSON only:
{
  "newSvg": "<full modified SVG string>",
  "updatedElement": { /* only the changed fields of the element schema */ }
}`,
      },
    ],
  });

  const rawContent = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  return JSON.parse(rawContent.trim());
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function extractPalette(elements: SVGElement[]): string[] {
  const colors = new Set<string>();
  for (const el of elements) {
    if (el.style.fill && el.style.fill !== "none") colors.add(el.style.fill);
    if (el.style.stroke && el.style.stroke !== "none") colors.add(el.style.stroke);
  }
  return Array.from(colors).slice(0, 8);
}
