import { describe, expect, it } from "vitest";
import { isUnlockExpired, UNLOCK_TTL_MS } from "./unlock";

describe("isUnlockExpired", () => {
  const now = new Date("2026-08-23T12:00:00.000Z");

  it("is not expired immediately after unlocking", () => {
    expect(isUnlockExpired(now, now)).toBe(false);
  });

  it("is not expired just under the TTL", () => {
    const unlockedAt = new Date(now.getTime() - (UNLOCK_TTL_MS - 1000));
    expect(isUnlockExpired(unlockedAt, now)).toBe(false);
  });

  it("is expired just over the TTL", () => {
    const unlockedAt = new Date(now.getTime() - (UNLOCK_TTL_MS + 1000));
    expect(isUnlockExpired(unlockedAt, now)).toBe(true);
  });

  it("is expired well past the TTL", () => {
    const unlockedAt = new Date(now.getTime() - UNLOCK_TTL_MS * 10);
    expect(isUnlockExpired(unlockedAt, now)).toBe(true);
  });
});
