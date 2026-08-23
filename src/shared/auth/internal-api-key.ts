import { createHash, timingSafeEqual } from "node:crypto";

export function hasValidInternalApiKey(request: Request) {
  const expected = process.env.INTERNAL_API_KEY;
  const received = request.headers.get("x-internal-api-key");
  if (!expected || !received) return false;
  const left = createHash("sha256").update(expected).digest();
  const right = createHash("sha256").update(received).digest();
  return timingSafeEqual(left, right);
}
