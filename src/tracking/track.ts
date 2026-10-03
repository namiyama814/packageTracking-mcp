import { getAdapter } from "./adapters/index.js";
import { detectCarrierCandidates } from "./detect.js";
import { normalizeTrackingNumber } from "./normalize.js";
import {
  CARRIER_IDS,
  CARRIER_INFO,
  type CarrierId,
  type TrackFailure,
  type TrackResult,
  type TrackSuccess,
} from "./types.js";

export type TrackPackageInput = {
  trackingNumber: string;
  carrier?: CarrierId;
};

export type TrackPackageOutput =
  | {
      ok: true;
      result: TrackSuccess;
      tried: CarrierId[];
      detected: boolean;
    }
  | {
      ok: false;
      reason: "invalid_input" | "not_found" | "upstream_error";
      detail: string;
      tried: CarrierId[];
      attempts: TrackFailure[];
    };

export function listCarriers() {
  return CARRIER_IDS.map((id) => CARRIER_INFO[id]);
}

export function isCarrierId(value: string): value is CarrierId {
  return (CARRIER_IDS as readonly string[]).includes(value);
}

export async function trackPackage(
  input: TrackPackageInput,
): Promise<TrackPackageOutput> {
  const trackingNumber = normalizeTrackingNumber(input.trackingNumber);
  if (!trackingNumber) {
    return {
      ok: false,
      reason: "invalid_input",
      detail: "tracking_number が空です",
      tried: [],
      attempts: [],
    };
  }

  if (trackingNumber.length < 8) {
    return {
      ok: false,
      reason: "invalid_input",
      detail: "tracking_number が短すぎます",
      tried: [],
      attempts: [],
    };
  }

  const candidates: CarrierId[] = input.carrier
    ? [input.carrier]
    : detectCarrierCandidates(trackingNumber);

  if (candidates.length === 0) {
    return {
      ok: false,
      reason: "invalid_input",
      detail: "伝票番号の形式から配送会社を推定できませんでした。carrier を指定してください。",
      tried: [],
      attempts: [],
    };
  }

  const attempts: TrackFailure[] = [];
  const tried: CarrierId[] = [];

  for (const carrier of candidates) {
    tried.push(carrier);
    const result = await getAdapter(carrier).track(trackingNumber);
    if (result.ok) {
      return {
        ok: true,
        result,
        tried,
        detected: !input.carrier,
      };
    }
    attempts.push(result);

    // Keep trying other candidates on not_found / parse_error.
    // Stop early only when carrier was explicitly specified.
    if (input.carrier) {
      break;
    }
  }

  const allUpstream = attempts.every((a) => a.reason === "upstream_error");
  return {
    ok: false,
    reason: allUpstream ? "upstream_error" : "not_found",
    detail: allUpstream
      ? "配送会社の追跡ページへの問い合わせに失敗しました"
      : "指定の伝票番号に一致する荷物が見つかりませんでした",
    tried,
    attempts,
  };
}

export function formatTrackResult(output: TrackPackageOutput): string {
  return JSON.stringify(output, null, 2);
}
