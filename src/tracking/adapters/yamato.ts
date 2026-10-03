import { parse as parseHtmlDocument } from "node-html-parser";
import { fetchHtml, UpstreamHttpError } from "../http.js";
import { collapseWhitespace } from "../normalize.js";
import type { TrackEvent, TrackResult } from "../types.js";
import type { CarrierAdapter } from "./base.js";

const TRACKING_URL = "https://toi.kuronekoyamato.co.jp/cgi-bin/tneko";

export function parseYamatoHtml(
  html: string,
  trackingNumber: string,
): TrackResult {
  const root = parseHtmlDocument(html);
  const block = root.querySelector(".parts-tracking-invoice-block");
  if (!block) {
    if (html.includes("伝票番号誤り") || html.includes("伝票番号に誤り")) {
      return {
        ok: false,
        carrier: "yamato",
        reason: "not_found",
        detail: "伝票番号が見つかりませんでした",
      };
    }
    return {
      ok: false,
      carrier: "yamato",
      reason: "parse_error",
      detail: "追跡結果ブロックを解析できませんでした",
    };
  }

  const stateTitle = collapseWhitespace(
    block.querySelector(".tracking-invoice-block-state-title")?.text ?? "",
  );
  if (
    !stateTitle ||
    stateTitle.includes("伝票番号誤り") ||
    stateTitle.includes("該当なし")
  ) {
    return {
      ok: false,
      carrier: "yamato",
      reason: "not_found",
      detail: stateTitle || "伝票番号が見つかりませんでした",
    };
  }

  const summary = collapseWhitespace(
    block.querySelector(".tracking-invoice-block-state-summary")?.text ?? "",
  );

  const events: TrackEvent[] = [];
  for (const li of block.querySelectorAll(
    ".tracking-invoice-block-detail li",
  )) {
    const status = collapseWhitespace(li.querySelector(".item")?.text ?? "");
    const datetime = collapseWhitespace(li.querySelector(".date")?.text ?? "");
    const location = collapseWhitespace(li.querySelector(".name")?.text ?? "");
    if (!status) continue;
    events.push({
      status,
      datetime: datetime || undefined,
      location: location || undefined,
    });
  }

  if (events.length === 0 && !stateTitle) {
    return {
      ok: false,
      carrier: "yamato",
      reason: "not_found",
      detail: "配送履歴が見つかりませんでした",
    };
  }

  return {
    ok: true,
    carrier: "yamato",
    trackingNumber,
    status: stateTitle,
    summary: summary || undefined,
    events,
  };
}

export const yamatoAdapter: CarrierAdapter = {
  id: "yamato",
  parseHtml: parseYamatoHtml,
  async track(trackingNumber) {
    try {
      const html = await fetchHtml(TRACKING_URL, {
        method: "POST",
        form: {
          number00: "1",
          number01: trackingNumber,
        },
        headers: {
          Referer: "https://toi.kuronekoyamato.co.jp/cgi-bin/tneko",
          Origin: "https://toi.kuronekoyamato.co.jp",
        },
      });
      return parseYamatoHtml(html, trackingNumber);
    } catch (error) {
      return {
        ok: false,
        carrier: "yamato",
        reason: "upstream_error",
        detail:
          error instanceof UpstreamHttpError
            ? error.message
            : "ヤマト運輸への問い合わせに失敗しました",
      };
    }
  },
};
