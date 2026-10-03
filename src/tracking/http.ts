import Encoding from "encoding-japanese";

const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type FetchHtmlOptions = {
  method?: "GET" | "POST";
  form?: Record<string, string>;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export class UpstreamHttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "UpstreamHttpError";
  }
}

export async function fetchHtml(
  url: string,
  options: FetchHtmlOptions = {},
): Promise<string> {
  const method = options.method ?? (options.form ? "POST" : "GET");
  const timeoutMs = options.timeoutMs ?? 12_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      "User-Agent": DEFAULT_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ja,en;q=0.8",
      // Some carrier sites cause workerd decode issues with modern encodings.
      "Accept-Encoding": "gzip, deflate",
      ...options.headers,
    };

    let body: string | undefined;
    if (options.form) {
      body = new URLSearchParams(options.form).toString();
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }

    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
      redirect: "follow",
    });

    if (!response.ok) {
      throw new UpstreamHttpError(
        `Upstream returned HTTP ${response.status}`,
        response.status,
      );
    }

    const buffer = await response.arrayBuffer();
    return decodeHtml(buffer, response.headers.get("content-type"));
  } catch (error) {
    if (error instanceof UpstreamHttpError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new UpstreamHttpError(`Upstream request timed out after ${timeoutMs}ms`);
    }
    throw new UpstreamHttpError(
      error instanceof Error ? error.message : "Upstream request failed",
    );
  } finally {
    clearTimeout(timer);
  }
}

function decodeHtml(buffer: ArrayBuffer, contentType: string | null): string {
  const bytes = new Uint8Array(buffer);
  const label = detectCharset(contentType, bytes);

  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    // Workers TextDecoder may not support Shift_JIS / EUC-JP.
  }

  const encodingName = toEncodingJapaneseName(label);
  try {
    const unicode = Encoding.convert(bytes, {
      to: "UNICODE",
      from: encodingName,
      type: "string",
    });
    if (typeof unicode === "string" && unicode.length > 0) {
      return unicode;
    }
  } catch {
    // fall through
  }

  // Auto-detect as a last resort.
  const detected = Encoding.detect(bytes);
  if (detected) {
    const unicode = Encoding.convert(bytes, {
      to: "UNICODE",
      from: detected,
      type: "string",
    });
    if (typeof unicode === "string") {
      return unicode;
    }
  }

  return new TextDecoder("utf-8").decode(bytes);
}

function toEncodingJapaneseName(
  label: string,
): "UTF8" | "SJIS" | "EUCJP" | "JIS" | "UNICODE" {
  switch (label) {
    case "shift_jis":
      return "SJIS";
    case "euc-jp":
      return "EUCJP";
    case "iso-2022-jp":
      return "JIS";
    default:
      return "UTF8";
  }
}

function detectCharset(
  contentType: string | null,
  bytes: Uint8Array,
): string {
  const fromHeader = contentType?.match(/charset=([^;]+)/i)?.[1]?.trim();
  if (fromHeader) {
    return normalizeCharset(fromHeader);
  }

  const head = new TextDecoder("latin1").decode(bytes.slice(0, 2048));
  const fromMeta =
    head.match(/charset\s*=\s*["']?([^"'>\s]+)/i)?.[1] ??
    head.match(/charset=["']?([^"'>\s]+)/i)?.[1];
  if (fromMeta) {
    return normalizeCharset(fromMeta);
  }

  return "utf-8";
}

function normalizeCharset(raw: string): string {
  const value = raw.trim().toLowerCase().replace(/_/g, "-");
  if (
    value === "shift_jis" ||
    value === "shift-jis" ||
    value === "sjis" ||
    value === "x-sjis" ||
    value === "windows-31j" ||
    value === "cp932"
  ) {
    return "shift_jis";
  }
  if (value === "euc-jp" || value === "eucjp") {
    return "euc-jp";
  }
  if (value === "iso-2022-jp") {
    return "iso-2022-jp";
  }
  return value;
}
