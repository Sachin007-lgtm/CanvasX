import { generateDesign } from "./editchain/apps/api/src/services/svgGenerator.service.ts";

async function main() {
  try {
    const res = await generateDesign({ prompt: "A red circle", style: "minimal", width: 400, height: 400 });
    console.log("Success:", res.svg.substring(0, 50));
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
