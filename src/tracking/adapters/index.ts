import type { CarrierAdapter } from "./base.js";
import { fukuyamaAdapter } from "./fukuyama.js";
import { japanPostAdapter } from "./japanpost.js";
import { sagawaAdapter } from "./sagawa.js";
import { seinoAdapter } from "./seino.js";
import { yamatoAdapter } from "./yamato.js";
import type { CarrierId } from "../types.js";

export const adapters: Record<CarrierId, CarrierAdapter> = {
  japanpost: japanPostAdapter,
  sagawa: sagawaAdapter,
  yamato: yamatoAdapter,
  seino: seinoAdapter,
  fukuyama: fukuyamaAdapter,
};

export function getAdapter(carrier: CarrierId): CarrierAdapter {
  return adapters[carrier];
}
