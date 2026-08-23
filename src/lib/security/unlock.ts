// How long an unlocked session stays unlocked before requireUnlocked() asks
// for the passphrase again.
//
// Before this, an unlock never expired on its own: `Session.unlockedAt` is
// only ever set, never cleared, so the only thing bounding "unlocked" was
// the session cookie's own ~30-day Auth.js lifetime (rolling on activity,
// so in practice closer to indefinite for a device in regular use). That
// quietly contradicted the stated threat model in PLAN.md ("a borrowed
// phone is never a borrowed portfolio"): any device that had ever been
// unlocked, at any point in that window, got straight past the gate.
//
// A week is a deliberate middle ground, not the only defensible number:
// long enough that ordinary daily use never re-prompts, short enough that
// "unlocked" is a real, expiring state rather than a synonym for
// "signed in."
export const UNLOCK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function isUnlockExpired(unlockedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - unlockedAt.getTime() > UNLOCK_TTL_MS;
}
