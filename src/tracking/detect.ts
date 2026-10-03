import type { CarrierId } from "./types.js";

/** Rank likely carriers for a normalized tracking number. */
export function detectCarrierCandidates(trackingNumber: string): CarrierId[] {
  const scored = new Map<CarrierId, number>();

  const add = (id: CarrierId, score: number) => {
    scored.set(id, Math.max(scored.get(id) ?? 0, score));
  };

  // International Japan Post / EMS style: AA#########BB
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(trackingNumber)) {
    add("japanpost", 100);
    return sortCandidates(scored);
  }

  if (!/^\d+$/.test(trackingNumber)) {
    // Unknown alphanumeric — try Japan Post first, then others as a last resort.
    add("japanpost", 40);
    add("yamato", 10);
    add("sagawa", 10);
    return sortCandidates(scored);
  }

  const len = trackingNumber.length;

  switch (len) {
    case 10:
      add("sagawa", 90);
      add("seino", 80);
      add("fukuyama", 70);
      break;
    case 11:
      add("yamato", 85);
      add("japanpost", 80);
      add("fukuyama", 70);
      break;
    case 12:
      // Overlaps among the major three.
      add("yamato", 90);
      add("sagawa", 85);
      add("japanpost", 80);
      break;
    case 13:
      add("japanpost", 90);
      add("seino", 60);
      break;
    case 15:
      add("seino", 80);
      break;
    default:
      if (len >= 10 && len <= 15) {
        add("japanpost", 50);
        add("yamato", 40);
        add("sagawa", 40);
        add("seino", 30);
        add("fukuyama", 30);
      }
      break;
  }

  return sortCandidates(scored);
}

function sortCandidates(scored: Map<CarrierId, number>): CarrierId[] {
  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id]) => id);
}
