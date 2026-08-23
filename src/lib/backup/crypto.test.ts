import { describe, expect, it } from "vitest";
import { encryptBackup, decryptBackup } from "./crypto";

describe("encryptBackup / decryptBackup", () => {
  it("round-trips a payload with the right passphrase", async () => {
    const payload = { holdings: [{ symbol: "INFY", quantity: 10 }], note: "test" };
    const envelope = await encryptBackup(payload, "correct-horse-battery-staple");
    const decrypted = await decryptBackup(envelope, "correct-horse-battery-staple");
    expect(decrypted).toEqual(payload);
  });

  it("produces different ciphertext for the same payload (random salt/iv)", async () => {
    const payload = { a: 1 };
    const a = await encryptBackup(payload, "same-passphrase");
    const b = await encryptBackup(payload, "same-passphrase");
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
  });

  it("refuses to decrypt with the wrong passphrase", async () => {
    const envelope = await encryptBackup({ secret: "value" }, "right-passphrase");
    await expect(decryptBackup(envelope, "wrong-passphrase")).rejects.toThrow();
  });

  it("marks the envelope with a stable shape for future format checks", async () => {
    const envelope = await encryptBackup({ x: 1 }, "passphrase123");
    expect(envelope.corpusBackup).toBe(true);
    expect(envelope.version).toBe(1);
    expect(envelope.kdf.algo).toBe("scrypt");
  });
});
