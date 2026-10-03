import { describe, expect, it } from "vitest";
import { parseJapanPostHtml } from "../src/tracking/adapters/japanpost.js";
import { parseSagawaHtml } from "../src/tracking/adapters/sagawa.js";
import { parseYamatoHtml } from "../src/tracking/adapters/yamato.js";
import { parseFukuyamaHtml } from "../src/tracking/adapters/fukuyama.js";
import { parseSeinoHtml } from "../src/tracking/adapters/seino.js";

describe("parseYamatoHtml", () => {
  it("returns not_found for invalid tracking numbers", () => {
    const html = `
      <div class="parts-tracking-invoice-block">
        <h4 class="tracking-invoice-block-state-title">伝票番号誤り</h4>
        <div class="tracking-invoice-block-state-summary">伝票番号に誤りがあります。</div>
      </div>
    `;
    const result = parseYamatoHtml(html, "123456789012");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_found");
  });

  it("parses delivery events", () => {
    const html = `
      <div class="parts-tracking-invoice-block">
        <h4 class="tracking-invoice-block-state-title">配達完了</h4>
        <div class="tracking-invoice-block-state-summary">お届け済みです</div>
        <ol class="tracking-invoice-block-detail">
          <li>
            <div class="item">荷物受付</div>
            <div class="date">10月01日 10:00</div>
            <div class="name">東京営業所</div>
          </li>
          <li>
            <div class="item">配達完了</div>
            <div class="date">10月02日 14:30</div>
            <div class="name">横浜営業所</div>
          </li>
        </ol>
      </div>
    `;
    const result = parseYamatoHtml(html, "123456789012");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("配達完了");
      expect(result.events).toHaveLength(2);
      expect(result.events[1]?.location).toBe("横浜営業所");
    }
  });
});

describe("parseJapanPostHtml", () => {
  it("returns not_found when number is missing", () => {
    const html = `
      <table summary="照会結果">
        <tr><td>12345678901</td><td>お問い合わせ番号が見つかりません。</td></tr>
      </table>
    `;
    const result = parseJapanPostHtml(html, "12345678901");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_found");
  });

  it("returns not_found for invalid digit length messages", () => {
    const html = `<p>お問い合わせ番号の入力桁数に誤りがあります。11桁から13桁で入力してください。</p>`;
    const result = parseJapanPostHtml(html, "1234567890");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_found");
  });

  it("parses history table", () => {
    const html = `
      <table summary="配達状況詳細">
        <tr><th>商品種別</th><td>ゆうパック</td></tr>
      </table>
      <table summary="履歴情報">
        <tr>
          <td>2026/10/01 10:00</td>
          <td>引受</td>
          <td></td>
          <td>東京都</td>
          <td>新宿郵便局</td>
          <td></td>
        </tr>
        <tr>
          <td>2026/10/02 15:00</td>
          <td>お届け先にお届け済み</td>
          <td></td>
          <td>神奈川県</td>
          <td>横浜郵便局</td>
          <td></td>
        </tr>
      </table>
    `;
    const result = parseJapanPostHtml(html, "123456789012");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary).toBe("ゆうパック");
      expect(result.events).toHaveLength(2);
      expect(result.status).toBe("お届け先にお届け済み");
    }
  });
});

describe("parseSagawaHtml", () => {
  it("detects maintenance pages", () => {
    const html = `<html><body>只今、当サービスはメンテナンス中の為、ご利用頂くことはできません。</body></html>`;
    const result = parseSagawaHtml(html, "1234567890");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("upstream_error");
  });

  it("parses history table", () => {
    const html = `
      <table class="table_okurijo_detail2">
        <tr><td>概要</td></tr>
      </table>
      <table class="table_okurijo_detail2">
        <tr><th>状況</th><th>日時</th><th>営業所</th></tr>
        <tr><td>・集荷</td><td>10/01 09:00</td><td>東京店</td></tr>
        <tr><td>・配達完了</td><td>10/02 18:00</td><td>横浜店</td></tr>
      </table>
    `;
    const result = parseSagawaHtml(html, "1234567890");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.events[0]?.status).toBe("集荷");
      expect(result.status).toBe("配達完了");
    }
  });
});

describe("parseFukuyamaHtml", () => {
  it("returns not_found for empty results", () => {
    const html = `<table><tr><td>照会結果：</td><td>該当データはありません。</td></tr></table>`;
    const result = parseFukuyamaHtml(html, "1234567890");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_found");
  });
});

describe("parseSeinoHtml", () => {
  it("returns not_found when number is missing", () => {
    const html = `<html><body>入力されたお問合せ番号が見当りません</body></html>`;
    const result = parseSeinoHtml(html, "1234567890");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_found");
  });
});
