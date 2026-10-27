import { expect, test } from "vitest";
import { resolveTimeZone } from "./timezone";

test("maps every stored timezone string", () => {
  expect(resolveTimeZone("Asia/Bangkok", "TH").iana).toBe("Asia/Bangkok");
  expect(resolveTimeZone(" UTC+05:45", "NP")).toMatchObject({
    iana: "Asia/Kathmandu",
    source: "alias",
  });
  expect(resolveTimeZone("Nepal Standard Time", "NP")).toMatchObject({
    iana: "Asia/Kathmandu",
    source: "alias",
  });
  expect(resolveTimeZone("(GMT+5:45)", "NP")).toMatchObject({
    iana: "Asia/Kathmandu",
    source: "alias",
  });
  expect(resolveTimeZone("Asia/Katmandu ", "NP")).toMatchObject({
    iana: "Asia/Kathmandu",
    source: "alias",
  });
  expect(resolveTimeZone("", "IN")).toMatchObject({
    iana: "Asia/Kolkata",
    source: "country",
  });
});
