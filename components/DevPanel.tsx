"use client";

import { useEffect, useState } from "react";

type State = {
  latency: string;
  fail: string;
  failOn: string;
  offline: boolean;
};

const KEY = "medex-dev";

function read(): State {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {
    /* ignore */
  }
  return { latency: "400", fail: "", failOn: "all", offline: false };
}

function writeCookies(s: State) {
  document.cookie = `medex_latency=${encodeURIComponent(s.latency)}; path=/`;
  document.cookie = `medex_fail=${encodeURIComponent(s.fail)}; path=/`;
  document.cookie = `medex_fail_on=${encodeURIComponent(s.failOn)}; path=/`;
  sessionStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("medex-dev", { detail: s }));
}

export function useDevOffline(): boolean {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const apply = () => setOffline(read().offline || !navigator.onLine);
    apply();
    const onDev = () => apply();
    window.addEventListener("medex-dev", onDev);
    window.addEventListener("online", apply);
    window.addEventListener("offline", apply);
    return () => {
      window.removeEventListener("medex-dev", onDev);
      window.removeEventListener("online", apply);
      window.removeEventListener("offline", apply);
    };
  }, []);
  return offline;
}

export function DevPanel() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({
    latency: "400",
    fail: "",
    failOn: "all",
    offline: false,
  });

  useEffect(() => {
    const s = read();
    setState(s);
    writeCookies(s);
  }, []);

  function update(patch: Partial<State>) {
    const next = { ...state, ...patch };
    setState(next);
    writeCookies(next);
  }

  return (
    <div className="fixed bottom-3 right-3 z-50 text-sm">
      {open ? (
        <form
          className="w-72 space-y-2 rounded-lg border border-[var(--line)] bg-white p-3 shadow-lg"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="flex items-center justify-between">
            <strong>Dev panel</strong>
            <button type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <label className="block">
            Latency (ms)
            <input
              className="mt-1 w-full rounded border border-[var(--line)] px-2 py-1"
              value={state.latency}
              onChange={(e) => update({ latency: e.target.value })}
              inputMode="numeric"
            />
          </label>
          <label className="block">
            Fail
            <select
              className="mt-1 w-full rounded border border-[var(--line)] px-2 py-1"
              value={state.fail}
              onChange={(e) => update({ fail: e.target.value })}
            >
              <option value="">none</option>
              <option value="500">500</option>
              <option value="409">409</option>
              <option value="402">402</option>
            </select>
          </label>
          <label className="block">
            On route
            <select
              className="mt-1 w-full rounded border border-[var(--line)] px-2 py-1"
              value={state.failOn}
              onChange={(e) => update({ failOn: e.target.value })}
            >
              <option value="all">all</option>
              <option value="categories">categories</option>
              <option value="providers">providers</option>
              <option value="services">services</option>
              <option value="cart">cart</option>
              <option value="checkout">checkout</option>
              <option value="slots">slots</option>
              <option value="book">book</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.offline}
              onChange={(e) => update({ offline: e.target.checked })}
            />
            Simulate offline
          </label>
        </form>
      ) : (
        <button
          type="button"
          className="rounded-full border border-[var(--line)] bg-white px-3 py-2 shadow"
          onClick={() => setOpen(true)}
        >
          Dev
        </button>
      )}
    </div>
  );
}
