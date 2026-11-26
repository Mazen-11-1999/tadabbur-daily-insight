import { createHash, timingSafeEqual } from "node:crypto";

export function validCronSecret(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(provided), digest(expected));
}