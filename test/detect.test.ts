import { describe, expect, it } from "vitest";
import { detectCarrierCandidates } from "../src/tracking/detect.js";
import { normalizeTrackingNumber } from "../src/tracking/normalize.js";

describe("normalizeTrackingNumber", () => {
  it("strips hyphens and spaces", () => {
    expect(normalizeTrackingNumber("1234-5678-9012")).toBe("123456789012");
    expect(normalizeTrackingNumber("1234 5678 9012")).toBe("123456789012");
  });

  it("converts full-width digits", () => {
    expect(normalizeTrackingNumber("１２３４５６７８９０１２")).toBe("123456789012");
  });

  it("uppercases alphanumeric EMS-style numbers", () => {
    expect(normalizeTrackingNumber("em123456789jp")).toBe("EM123456789JP");
  });
});

describe("detectCarrierCandidates", () => {
  it("prioritizes major carriers for 12-digit numbers", () => {
    expect(detectCarrierCandidates("123456789012")).toEqual([
      "yamato",
      "sagawa",
      "japanpost",
    ]);
  });

  it("detects 10-digit as sagawa/seino/fukuyama", () => {
    expect(detectCarrierCandidates("1234567890")).toEqual([
      "sagawa",
      "seino",
      "fukuyama",
    ]);
  });

  it("detects EMS-style codes as japanpost", () => {
    expect(detectCarrierCandidates("EM123456789JP")).toEqual(["japanpost"]);
  });

  it("detects 13-digit primarily as japanpost", () => {
    expect(detectCarrierCandidates("1234567890123")[0]).toBe("japanpost");
  });
});
