import { parse as parseHtmlDocument } from "node-html-parser";
import { fetchHtml, UpstreamHttpError } from "../http.js";
import { collapseWhitespace } from "../normalize.js";
import type { TrackEvent, TrackResult } from "../types.js";
import type { CarrierAdapter } from "./base.js";

const TRACKING_URL =
  "https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do";

export function parseSagawaHtml(
  html: string,
  trackingNumber: string,
): TrackResult {
  const plain = collapseWhitespace(
    html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " "),
  );

  if (
    plain.includes("メンテナンス中") ||
    plain.includes("只今、当サービスはメンテナンス")
  ) {
    return {
      ok: false,
      carrier: "sagawa",
      reason: "upstream_error",
      detail: "佐川急便の追跡サービスがメンテナンス中です",
    };
  }

  if (
    plain.includes("該当するデータはございません") ||
    plain.includes("お荷物を特定できません") ||
    plain.includes("ご確認ください") && plain.includes("該当")
  ) {
    // Fall through to table parsing; many pages still include tables.
  }

  const root = parseHtmlDocument(html);
  const tables = root.querySelectorAll("table.table_okurijo_detail2");
  const historyTable = tables.length > 1 ? tables[1] : tables[0];

  if (!historyTable) {
    if (
      plain.includes("該当するデータはございません") ||
      plain.includes("お荷物を特定できません") ||
      plain.includes("ご入力いただいたお問い合せ送り状No")
    ) {
      return {
        ok: false,
        carrier: "sagawa",
        reason: "not_found",
        detail: "送り状番号が見つかりませんでした",
      };
    }
    return {
      ok: false,
      carrier: "sagawa",
      reason: "parse_error",
      detail: "追跡結果テーブルを解析できませんでした",
    };
  }

  const events: TrackEvent[] = [];
  const rows = historyTable.querySelectorAll("tr");
  for (let i = 0; i < rows.length; i++) {
    if (i === 0) continue; // header
    const cells = rows[i]!
      .querySelectorAll("td")
      .map((td) => collapseWhitespace(td.text));
    if (cells.length < 2) continue;

    let status = cells[0] ?? "";
    // Sagawa often prefixes status with a symbol / index character.
    if (status.length > 1) {
      status = status.slice(1).trim() || status;
    }
    const datetime = cells[1] ?? "";
    const location = cells[2] ?? "";
    if (!status) continue;
    events.push({
      status,
      datetime: datetime || undefined,
      location: location || undefined,
    });
  }

  if (events.length === 0) {
    return {
      ok: false,
      carrier: "sagawa",
      reason: "not_found",
      detail: "配送履歴が見つかりませんでした",
    };
  }

  const latest = events[events.length - 1]!;
  return {
    ok: true,
    carrier: "sagawa",
    trackingNumber,
    status: latest.status,
    events,
  };
}

export const sagawaAdapter: CarrierAdapter = {
  id: "sagawa",
  parseHtml: parseSagawaHtml,
  async track(trackingNumber) {
    try {
      const url = `${TRACKING_URL}?okurijoNo=${encodeURIComponent(trackingNumber)}`;
      const html = await fetchHtml(url, { method: "GET" });
      return parseSagawaHtml(html, trackingNumber);
    } catch (error) {
      return {
        ok: false,
        carrier: "sagawa",
        reason: "upstream_error",
        detail:
          error instanceof UpstreamHttpError
            ? error.message
            : "佐川急便への問い合わせに失敗しました",
      };
    }
  },
};
