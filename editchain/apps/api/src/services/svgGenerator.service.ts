// ============================================================
// SVG Generator Service
// Calls Gemini 2.0 Flash with a strict JSON schema to produce
// structured, editable SVG designs annotated with semantic metadata.
// ============================================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import crypto from "crypto";
import type {
  SVGDesignSchema,
  SVGElement,
  GenerateRequest,
} from "@editchain/shared-types";

// ------------------------------------------------------------
// System prompt
// ------------------------------------------------------------

const SYSTEM_PROMPT = `You are EditChain's SVG design engine. You generate structured, editable graphic designs as SVG.

CRITICAL RULES — MUST FOLLOW ALL:
1. Always respond with ONLY valid JSON — no markdown, no preamble.
2. The JSON must have exactly two top-level keys: "svg" (string) and "elements" (array).
3. Every meaningful visual element in the SVG MUST appear in the elements array with a matching id="" attribute.
4. SVG must be self-contained (no external fonts via @import — use system-safe fonts only).
5. Design dimensions: use the requested width/height in the viewBox AND as width/height attributes on the root <svg>.
6. All text must be editable (role: "headline", "subheadline", "body-text", or "label").
7. All color-bearing shapes must be editable (role: "background", "shape", "container", "decoration").
8. Keep SVG clean: no JavaScript inside SVG, no foreignObject.

TEXT OVERFLOW RULES — VERY IMPORTANT:
- NEVER let any text element overflow or get clipped by the canvas edge.
- Keep ALL text at least 20px from the right edge of the canvas.
- Headline font size should be AT MOST width/12 (e.g. for 800px wide: max 66px).
- Body text should be AT MOST width/20 in font size.
- For long headlines, break them into multiple short <text> or <tspan> elements with explicit y offsets.
- NEVER write the same text content twice. Each text element must have unique content.
- Add clipPath to text-heavy containers if needed to prevent overflow.
- Use x="20" and a max width in mind — if text would exceed (width - 40)px, shorten it or increase line count.

ELEMENT SCHEMA per element in the array:
{
  "id": string,           // matches id="" in SVG
  "type": "text"|"rect"|"circle"|"path"|"image"|"group",
  "role": "headline"|"subheadline"|"body-text"|"label"|"background"|"shape"|"image-placeholder"|"container"|"decoration",
  "editable": boolean,
  "label": string,        // human-readable label for the layer panel
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
  minimal:   "Clean, lots of whitespace, single accent color, sans-serif typography.",
  bold:      "High contrast, large typography, strong geometric shapes, vibrant colors.",
  editorial: "Magazine-style layout, serif headlines, grid-aligned, sophisticated palette.",
  playful:   "Rounded corners, bright colors, friendly fonts, asymmetric layout.",
};

// ------------------------------------------------------------
// Lazy-init helper — ensures GEMINI_API_KEY is loaded from env
// before creating the client.
// ------------------------------------------------------------

function makeModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in environment variables.");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7,
    },
  });
}

// ------------------------------------------------------------
// Main generation function
// ------------------------------------------------------------

export async function generateDesign(
  req: GenerateRequest
): Promise<SVGDesignSchema> {
  const { prompt, style = "minimal", width = 800, height = 600 } = req;
  const styleHint = STYLE_HINTS[style] ?? STYLE_HINTS.minimal;

  const userPrompt =
    `Create a ${style} design for: "${prompt}"\n\n` +
    `Style guidance: ${styleHint}\n` +
    `Canvas size: ${width}x${height}px\n\n` +
    `Generate a complete, professional SVG layout with all elements annotated. ` +
    `Return ONLY a JSON object with keys "svg" and "elements".`;

  const model = makeModel();
  const result = await model.generateContent(userPrompt);
  const rawContent = result.response.text().trim();

  let parsed: { svg: string; elements: SVGElement[] };
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    // Last-ditch: try to extract a JSON block if the model added preamble
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Model returned a non-JSON response:\n" + rawContent.slice(0, 300));
    }
    parsed = JSON.parse(jsonMatch[0]);
  }

  if (!parsed.svg || !Array.isArray(parsed.elements)) {
    throw new Error("Invalid design schema: missing 'svg' or 'elements'.");
  }

  const palette = extractPalette(parsed.elements);
  const promptHash = crypto.createHash("sha256").update(prompt).digest("hex");

  return {
    svg: parsed.svg,
    viewBox: { width, height },
    elements: parsed.elements,
    palette,
    promptHash,
  };
}

// ------------------------------------------------------------
// Iterative AI editing — modifies one element in an existing design
// ------------------------------------------------------------

export async function aiEditElement(
  currentSvg: string,
  elementId: string,
  instruction: string
): Promise<{ newSvg: string; updatedElement: Partial<SVGElement> }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in environment variables.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const editModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.4,
    },
  });

  const prompt =
    "Here is an SVG design:\n<svg_design>\n" + currentSvg + "\n</svg_design>\n\n" +
    "Modify ONLY the element with id=\"" + elementId + "\".\n" +
    "Instruction: " + instruction + "\n\n" +
    "Respond with JSON only:\n" +
    "{ \"newSvg\": \"<full modified SVG string>\", \"updatedElement\": { /* only changed fields */ } }";

  const result = await editModel.generateContent(prompt);
  const rawContent = result.response.text().trim();

  return JSON.parse(rawContent);
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function extractPalette(elements: SVGElement[]): string[] {
  const colors = new Set<string>();
  for (const el of elements) {
    if (el.style?.fill   && el.style.fill   !== "none") colors.add(el.style.fill);
    if (el.style?.stroke && el.style.stroke !== "none") colors.add(el.style.stroke);
  }
  return Array.from(colors).slice(0, 8);
}
