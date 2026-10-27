import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Category, Provider, RawService } from "../types";

type FileShape = {
  categories: Category[];
  providers: Provider[];
  services: RawService[];
};

let cache: FileShape | null = null;

export function loadExplorer(): FileShape {
  if (cache) return cache;
  const raw = readFileSync(
    join(process.cwd(), "data/task1-service-explorer.json"),
    "utf8",
  );
  cache = JSON.parse(raw) as FileShape;
  return cache;
}
