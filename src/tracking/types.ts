export const CARRIER_IDS = [
  "japanpost",
  "sagawa",
  "yamato",
  "seino",
  "fukuyama",
] as const;

export type CarrierId = (typeof CARRIER_IDS)[number];

export type TrackEvent = {
  datetime?: string;
  status: string;
  location?: string;
};

export type TrackSuccess = {
  ok: true;
  carrier: CarrierId;
  trackingNumber: string;
  status: string;
  summary?: string;
  events: TrackEvent[];
};

export type TrackFailure = {
  ok: false;
  carrier: CarrierId;
  reason: "not_found" | "parse_error" | "upstream_error";
  detail?: string;
};

export type TrackResult = TrackSuccess | TrackFailure;

export type CarrierInfo = {
  id: CarrierId;
  nameJa: string;
  nameEn: string;
  trackingNumberHint: string;
};

export const CARRIER_INFO: Record<CarrierId, CarrierInfo> = {
  japanpost: {
    id: "japanpost",
    nameJa: "日本郵便",
    nameEn: "Japan Post",
    trackingNumberHint: "11〜13桁の数字、または国際郵便の英数字（例: XX#########JP）",
  },
  sagawa: {
    id: "sagawa",
    nameJa: "佐川急便",
    nameEn: "Sagawa Express",
    trackingNumberHint: "10桁または12桁の数字",
  },
  yamato: {
    id: "yamato",
    nameJa: "ヤマト運輸",
    nameEn: "Yamato Transport",
    trackingNumberHint: "11桁または12桁の数字",
  },
  seino: {
    id: "seino",
    nameJa: "西濃運輸",
    nameEn: "Seino Transportation",
    trackingNumberHint: "主に10桁の数字（一部13/15桁）",
  },
  fukuyama: {
    id: "fukuyama",
    nameJa: "福山通運",
    nameEn: "Fukuyama Transporting",
    trackingNumberHint: "10桁または11桁の数字",
  },
};
