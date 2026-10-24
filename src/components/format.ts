/** Format a duration as `mm:ss`; minutes keep growing past 59 (3_600_000 → `60:00`). */
export function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Zero-pad a level id to four digits (7 → `0007`). */
export function padId(id: number): string {
  return String(id).padStart(4, '0');
}
