"use client";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let offline = false;
  try {
    const raw = sessionStorage.getItem("medex-dev");
    if (raw) offline = Boolean((JSON.parse(raw) as { offline?: boolean }).offline);
  } catch {
    /* ignore */
  }
  if (offline || (typeof navigator !== "undefined" && !navigator.onLine)) {
    throw new ApiError(0, { message: "Offline" });
  }
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}
