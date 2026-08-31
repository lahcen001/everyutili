/**
 * Formats a past timestamp as a short relative string ("Just now", "5m
 * ago", "2h ago", "3d ago") using the three ICU count-interpolated message
 * keys plus a "just now" fallback that every locale's `recentTools`
 * namespace defines.
 */
export function formatRelativeTime(
  timestamp: number,
  t: (key: string, values?: Record<string, number>) => string
): string {
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return t("justNow");
  if (diffMinutes < 60) return t("minutesAgo", { count: diffMinutes });
  if (diffHours < 24) return t("hoursAgo", { count: diffHours });
  return t("daysAgo", { count: diffDays });
}
