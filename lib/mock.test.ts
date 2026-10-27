import { expect, test } from "vitest";
import { readMockFlags } from "./mock";

test("query flags override default latency", () => {
  const flags = readMockFlags(new Request("http://x/api?latency=0&fail=409"));
  expect(flags.latencyMs).toBe(0);
  expect(flags.fail).toBe("409");
});
