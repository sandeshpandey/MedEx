import { expect, test } from "vitest";
import { createCoalescedUpdater } from "./qty";

test("five quick increments send the latest value and ignore stale responses", async () => {
  const sent: number[] = [];
  let release!: (n: number) => void;
  const first = new Promise<number>((r) => {
    release = r;
  });
  let calls = 0;
  const snapshots: number[] = [];
  const u = createCoalescedUpdater({
    confirmed: 1,
    async send(n) {
      calls += 1;
      sent.push(n);
      if (calls === 1) return first.then(() => n);
      return n;
    },
    onChange(optimistic) {
      snapshots.push(optimistic);
    },
  });
  u.set(2);
  u.set(3);
  u.set(4);
  u.set(5);
  u.set(6);
  expect(snapshots.at(-1)).toBe(6);
  release(2);
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  expect(sent[0]).toBe(2);
  expect(sent.at(-1)).toBe(6);
  expect(snapshots.at(-1)).toBe(6);
});

test("server rejection rolls back to the last confirmed quantity", async () => {
  let seen = 1;
  const u = createCoalescedUpdater({
    confirmed: 1,
    async send() {
      throw new Error("conflict");
    },
    onChange(optimistic, _c, error) {
      seen = optimistic;
      if (error) seen = _c;
    },
  });
  u.set(4);
  await new Promise((r) => setTimeout(r, 0));
  expect(seen).toBe(1);
});
