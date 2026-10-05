export class TseRequestError extends Error {
  constructor(readonly status: number, message: string, readonly retryAfterMs = 0) {
    super(message);
    this.name = 'TseRequestError';
  }
}
export function retryAfterMilliseconds(value: string | null, now = Date.now()): number {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}
