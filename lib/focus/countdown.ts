export interface Breakdown {
  past: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalDays: number;
}

export function breakdown(target: number, now = Date.now()): Breakdown {
  const diff = target - now;
  const abs = Math.abs(diff);
  const s = Math.floor(abs / 1000);
  return {
    past: diff < 0,
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    totalDays: Math.ceil(diff / 86400000),
  };
}

/** Importance by how close it is: used to colour the card. */
export function urgency(target: number, now = Date.now()): "past" | "soon" | "near" | "far" {
  const days = (target - now) / 86400000;
  if (days < 0) return "past";
  if (days <= 3) return "soon";
  if (days <= 14) return "near";
  return "far";
}
