import { loadExplorer } from "@/lib/data/explorer";
import { json, mockGate } from "@/lib/mock";

export async function GET(req: Request) {
  const blocked = await mockGate(req, "categories");
  if (blocked) return blocked;
  return json({ categories: loadExplorer().categories });
}
