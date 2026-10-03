import { parse as parseHtmlDocument } from "node-html-parser";
import { fetchHtml, UpstreamHttpError } from "../http.js";
import { collapseWhitespace } from "../normalize.js";
import type { TrackEvent, TrackResult } from "../types.js";
import type { CarrierAdapter } from "./base.js";

const TRACKING_URL = "http://track.seino.co.jp/cgi-bin/gnpquery.pgm";

export function parseSeinoHtml(
  html: string,
  trackingNumber: string,
): TrackResult {
  const plain = collapseWhitespace(
    html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " "),
  );

  if (
    plain.includes("見当りません") ||
    plain.includes("見つかりません") ||
    plain.includes("登録されておりません")
  ) {
    return {
      ok: false,
      carrier: "seino",
      reason: "not_found",
      detail: "お問い合わせ番号が見つかりませんでした",
    };
  }

  const root = parseHtmlDocument(html);
  const events: TrackEvent[] = [];

  // Prefer structured detail rows when present.
  for (const row of root.querySelectorAll("tr")) {
    const cells = row
      .querySelectorAll("td")
      .map((td) => collapseWhitespace(td.text))
      .filter(Boolean);
    if (cells.length < 2) continue;

    // Heuristic: rows that look like status history often contain a date-like cell.
    const joined = cells.join(" ");
    if (!/\d{1,4}[\/\-年]/.test(joined) && !joined.includes("済") && !joined.includes("中")) {
      continue;
    }
    if (joined.includes("お問い合わせ番号") || joined.includes("受付日")) {
      continue;
    }

    const status =
      cells.find((c) => /配達|集荷|発送|到着|持出|完了|未着|保管/.test(c)) ??
      cells[cells.length - 2] ??
      cells[1];
    const datetime = cells.find((c) => /\d{1,4}[\/\-年]/.test(c));
    const location = cells.find(
      (c) => c !== status && c !== datetime && c.length >= 2 && !/^\d+$/.test(c),
    );

    if (!status) continue;
    events.push({
      status,
      datetime,
      location,
    });
  }

  // Fallback: extract the status text next to the tracking number in the summary table.
  if (events.length === 0) {
    const match = plain.match(
      new RegExp(
        `${trackingNumber}\\s+([^\\s].{0,80}?)\\s+(?:お知らせ|メール|詳細|$)`,
      ),
    );
    const statusText = match?.[1]?.trim();
    if (statusText && !statusText.includes("見当")) {
      events.push({ status: statusText });
    }
  }

  if (events.length === 0) {
    return {
      ok: false,
      carrier: "seino",
      reason: "parse_error",
      detail: "追跡結果を解析できませんでした",
    };
  }

  const latest = events[events.length - 1]!;
  return {
    ok: true,
    carrier: "seino",
    trackingNumber,
    status: latest.status,
    events,
  };
}

export const seinoAdapter: CarrierAdapter = {
  id: "seino",
  parseHtml: parseSeinoHtml,
  async track(trackingNumber) {
    try {
      const url = `${TRACKING_URL}?GNPNO1=${encodeURIComponent(trackingNumber)}`;
      const html = await fetchHtml(url, { method: "GET" });
      return parseSeinoHtml(html, trackingNumber);
    } catch (error) {
      return {
        ok: false,
        carrier: "seino",
        reason: "upstream_error",
        detail:
          error instanceof UpstreamHttpError
            ? error.message
            : "西濃運輸への問い合わせに失敗しました",
      };
    }
  },
};
