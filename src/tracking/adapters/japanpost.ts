import { parse as parseHtmlDocument } from "node-html-parser";
import { fetchHtml, UpstreamHttpError } from "../http.js";
import { collapseWhitespace } from "../normalize.js";
import type { TrackEvent, TrackResult } from "../types.js";
import type { CarrierAdapter } from "./base.js";

const TRACKING_URL =
  "https://trackings.post.japanpost.jp/services/srv/search/direct";

function resolveSearchKind(trackingNumber: string): string {
  // International-looking codes → EMS / international parcel search.
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(trackingNumber)) {
    return "S004";
  }
  return "S002";
}

export function parseJapanPostHtml(
  html: string,
  trackingNumber: string,
): TrackResult {
  if (
    html.includes("お問い合わせ番号が見つかりません") ||
    html.includes("お問い合わせ番号をご確認") ||
    html.includes("入力桁数に誤り") ||
    html.includes("11桁から13桁")
  ) {
    return {
      ok: false,
      carrier: "japanpost",
      reason: "not_found",
      detail: "お問い合わせ番号が見つかりませんでした",
    };
  }

  const root = parseHtmlDocument(html);
  const historyTable = root.querySelector('table[summary="履歴情報"]');
  if (!historyTable) {
    // Some responses only show the summary table with an error row.
    const summaryText = collapseWhitespace(
      root.querySelector('table[summary="照会結果"]')?.text ?? "",
    );
    if (summaryText.includes("見つかりません")) {
      return {
        ok: false,
        carrier: "japanpost",
        reason: "not_found",
        detail: "お問い合わせ番号が見つかりませんでした",
      };
    }
    return {
      ok: false,
      carrier: "japanpost",
      reason: "parse_error",
      detail: "履歴情報テーブルを解析できませんでした",
    };
  }

  const cells = historyTable
    .querySelectorAll("td")
    .map((td) => collapseWhitespace(td.text));

  const events: TrackEvent[] = [];
  for (let i = 0; i + 5 < cells.length; i += 6) {
    const datetime = cells[i] ?? "";
    const status = cells[i + 1] ?? "";
    const office = cells[i + 4] ?? "";
    const prefecture = cells[i + 3] ?? "";
    if (!status) continue;
    events.push({
      datetime: datetime || undefined,
      status,
      location: collapseWhitespace(`${office} ${prefecture}`) || undefined,
    });
  }

  if (events.length === 0) {
    return {
      ok: false,
      carrier: "japanpost",
      reason: "not_found",
      detail: "配送履歴が見つかりませんでした",
    };
  }

  const detailTable = root.querySelector('table[summary="配達状況詳細"]');
  let productType: string | undefined;
  if (detailTable) {
    const headers = detailTable
      .querySelectorAll("th")
      .map((th) => collapseWhitespace(th.text));
    const values = detailTable
      .querySelectorAll("td")
      .map((td) => collapseWhitespace(td.text));
    const idx = headers.findIndex((h) => h.includes("商品種別"));
    if (idx >= 0) {
      productType = values[idx] || undefined;
    }
  }

  const latest = events[events.length - 1]!;
  return {
    ok: true,
    carrier: "japanpost",
    trackingNumber,
    status: latest.status,
    summary: productType,
    events,
  };
}

export const japanPostAdapter: CarrierAdapter = {
  id: "japanpost",
  parseHtml: parseJapanPostHtml,
  async track(trackingNumber) {
    try {
      const html = await fetchHtml(TRACKING_URL, {
        method: "POST",
        form: {
          searchKind: resolveSearchKind(trackingNumber),
          locale: "ja",
          reqCodeNo1: trackingNumber,
        },
      });
      return parseJapanPostHtml(html, trackingNumber);
    } catch (error) {
      return {
        ok: false,
        carrier: "japanpost",
        reason: "upstream_error",
        detail:
          error instanceof UpstreamHttpError
            ? error.message
            : "日本郵便への問い合わせに失敗しました",
      };
    }
  },
};
