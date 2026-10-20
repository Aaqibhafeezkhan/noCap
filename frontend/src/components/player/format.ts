export function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds || 0);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export function formatOffset(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  return `${ms > 0 ? '+' : ''}${ms} ms`;
}
