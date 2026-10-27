import { unstable_noStore as noStore } from "next/cache";

const DEFAULT_LATENCY_MS = 400;

export type FailCode = "500" | "409" | "402" | "";

export type MockFlags = {
  latencyMs: number;
  fail: FailCode;
  failOn: string;
};

function cookieMap(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function readMockFlags(req: Request): MockFlags {
  const url = new URL(req.url);
  const cookies = cookieMap(req.headers.get("cookie"));
  const latencyRaw =
    url.searchParams.get("latency") ?? cookies.medex_latency ?? String(DEFAULT_LATENCY_MS);
  const fail = (url.searchParams.get("fail") ?? cookies.medex_fail ?? "") as FailCode;
  const failOn = url.searchParams.get("failOn") ?? cookies.medex_fail_on ?? "all";
  const latencyMs = Number.parseInt(latencyRaw, 10);
  return {
    latencyMs: Number.isFinite(latencyMs) ? Math.max(0, latencyMs) : DEFAULT_LATENCY_MS,
    fail: fail === "500" || fail === "409" || fail === "402" ? fail : "",
    failOn,
  };
}

export async function mockGate(
  req: Request,
  route: string,
): Promise<Response | null> {
  noStore();
  const flags = readMockFlags(req);
  if (flags.latencyMs > 0) {
    await new Promise((r) => setTimeout(r, flags.latencyMs));
  }
  const applies =
    flags.failOn === "all" ||
    flags.failOn === route ||
    flags.failOn.split(",").includes(route);
  if (!applies || !flags.fail) return null;
  const status = Number(flags.fail);
  return Response.json(
    { message: `Simulated ${status} on ${route}` },
    { status },
  );
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}
