import { parse as parseHtmlDocument } from "node-html-parser";
import { fetchHtml, UpstreamHttpError } from "../http.js";
import { collapseWhitespace } from "../normalize.js";
import type { TrackEvent, TrackResult } from "../types.js";
import type { CarrierAdapter } from "./base.js";

function trackingUrl(trackingNumber: string): string {
  return `https://corp.fukutsu.co.jp/situation/tracking_no_hunt/${encodeURIComponent(trackingNumber)}`;
}

export function parseFukuyamaHtml(
  html: string,
  trackingNumber: string,
): TrackResult {
  const plain = collapseWhitespace(
    html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " "),
  );

  if (
    plain.includes("該当データはありません") ||
    plain.includes("該当するデータはありません")
  ) {
    return {
      ok: false,
      carrier: "fukuyama",
      reason: "not_found",
      detail: "お問い合わせ番号が見つかりませんでした",
    };
  }

  const root = parseHtmlDocument(html);
  const events: TrackEvent[] = [];

  for (const table of root.querySelectorAll("table")) {
    const rows = table.querySelectorAll("tr");
    for (const row of rows) {
      const cells = row
        .querySelectorAll("td")
        .map((td) => collapseWhitespace(td.text))
        .filter(Boolean);
      if (cells.length < 2) continue;

      const joined = cells.join(" ");
      if (joined.includes("照会結果") || joined.includes("お問い合わせ番号")) {
        continue;
      }

      const datetime = cells.find((c) => /\d{1,4}[\/\-年]/.test(c));
      const status =
        cells.find((c) => /配達|集荷|発送|到着|持出|完了|未着|保管|輸送/.test(c)) ??
        cells[1];
      const location = cells.find(
        (c) => c !== status && c !== datetime && !/^\d+$/.test(c),
      );
      if (!status) continue;
      events.push({
        status,
        datetime,
        location,
      });
    }
  }

  if (events.length === 0) {
    const statusMatch = plain.match(/照会結果[：:]\s*([^\s].{0,80}?)(?:\s{2,}|$)/);
    const status = statusMatch?.[1]?.trim();
    if (status && !status.includes("該当")) {
      events.push({ status });
    }
  }

  if (events.length === 0) {
    return {
      ok: false,
      carrier: "fukuyama",
      reason: "parse_error",
      detail: "追跡結果を解析できませんでした",
    };
  }

  const latest = events[events.length - 1]!;
  return {
    ok: true,
    carrier: "fukuyama",
    trackingNumber,
    status: latest.status,
    events,
  };
}

export const fukuyamaAdapter: CarrierAdapter = {
  id: "fukuyama",
  parseHtml: parseFukuyamaHtml,
  async track(trackingNumber) {
    try {
      const html = await fetchHtml(trackingUrl(trackingNumber), {
        method: "GET",
      });
      return parseFukuyamaHtml(html, trackingNumber);
    } catch (error) {
      return {
        ok: false,
        carrier: "fukuyama",
        reason: "upstream_error",
        detail:
          error instanceof UpstreamHttpError
            ? error.message
            : "福山通運への問い合わせに失敗しました",
      };
    }
  },
};
