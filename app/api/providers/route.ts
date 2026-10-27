import { loadExplorer } from "@/lib/data/explorer";
import { json, mockGate } from "@/lib/mock";

export async function GET(req: Request) {
  const blocked = await mockGate(req, "providers");
  if (blocked) return blocked;
  return json({ providers: loadExplorer().providers });
}
