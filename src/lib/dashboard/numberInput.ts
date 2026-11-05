export function clampNumber(raw: string | number, min: number, max: number, whole = true): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return min;
  const bounded = Math.min(max, Math.max(min, parsed));
  return whole ? Math.floor(bounded) : bounded;
}
