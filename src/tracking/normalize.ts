/** Normalize tracking numbers for lookup and comparison. */
export function normalizeTrackingNumber(input: string): string {
  return Array.from(input.trim())
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      // Full-width digits ０-９ → 0-9
      if (code >= 0xff10 && code <= 0xff19) {
        return String.fromCodePoint(code - 0xff10 + 0x30);
      }
      // Full-width A-Z / a-z
      if (code >= 0xff21 && code <= 0xff3a) {
        return String.fromCodePoint(code - 0xff21 + 0x41);
      }
      if (code >= 0xff41 && code <= 0xff5a) {
        return String.fromCodePoint(code - 0xff41 + 0x61);
      }
      return ch;
    })
    .join("")
    .replace(/[\s\u3000\-ー−–—]/g, "")
    .toUpperCase();
}

export function collapseWhitespace(text: string): string {
  return text.replace(/[\s\u3000]+/g, " ").trim();
}
