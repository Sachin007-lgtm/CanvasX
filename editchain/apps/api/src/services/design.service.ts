import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import type { Design } from "@editchain/shared-types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../../data");
const DESIGNS_FILE = path.join(DATA_DIR, "designs.json");

export class DesignService {
  private async ensureDataDir() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      try {
        await fs.access(DESIGNS_FILE);
      } catch {
        await fs.writeFile(DESIGNS_FILE, JSON.stringify({}));
      }
    } catch (err) {
      console.error("Failed to initialize data directory:", err);
    }
  }

  private async readAll(): Promise<Record<string, Design>> {
    await this.ensureDataDir();
    const content = await fs.readFile(DESIGNS_FILE, "utf-8");
    return JSON.parse(content);
  }

  private async writeAll(designs: Record<string, Design>): Promise<void> {
    await fs.writeFile(DESIGNS_FILE, JSON.stringify(designs, null, 2));
  }

  async findById(id: string): Promise<Design | null> {
    const designs = await this.readAll();
    return designs[id] || null;
  }

  async save(design: Design): Promise<void> {
    const designs = await this.readAll();
    designs[design.id] = design;
    await this.writeAll(designs);
  }

  async update(id: string, updates: Partial<Design>): Promise<Design> {
    const designs = await this.readAll();
    if (!designs[id]) throw new Error(`Design ${id} not found`);
    
    designs[id] = { ...designs[id], ...updates, updatedAt: Date.now() };
    await this.writeAll(designs[id]);
    return designs[id];
  }
}

export const designService = new DesignService();
