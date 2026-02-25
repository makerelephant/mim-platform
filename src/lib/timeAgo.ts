/**
 * Format a timestamp into a compact "time ago" string.
 * - < 1 min  → "just now"
 * - < 60 min → "12m ago"
 * - < 24 hrs → "3h ago"
 * - < 7 days → "2d ago"
 * - else     → "Jan 15" or "Jan 15 '24" if different year
 */
export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const day = d.getDate();
  if (d.getFullYear() === now.getFullYear()) return `${month} ${day}`;
  return `${month} ${day} '${String(d.getFullYear()).slice(2)}`;
}
