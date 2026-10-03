import { describe, expect, it } from "vitest";
import {
  extractBearerToken,
  timingSafeEqualString,
} from "../src/auth.js";

describe("auth helpers", () => {
  it("extracts bearer tokens", () => {
    const request = new Request("https://example.com/mcp", {
      headers: { Authorization: "Bearer secret-token" },
    });
    expect(extractBearerToken(request)).toBe("secret-token");
  });

  it("compares secrets in a length-safe way", async () => {
    expect(await timingSafeEqualString("abc", "abc")).toBe(true);
    expect(await timingSafeEqualString("abc", "abd")).toBe(false);
    expect(await timingSafeEqualString("abc", "abcd")).toBe(false);
  });
});
