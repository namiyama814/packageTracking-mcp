import type { CarrierId, TrackResult } from "../types.js";

export type CarrierAdapter = {
  id: CarrierId;
  track: (trackingNumber: string) => Promise<TrackResult>;
  /** Optional parser for unit tests with HTML fixtures. */
  parseHtml?: (html: string, trackingNumber: string) => TrackResult;
};
