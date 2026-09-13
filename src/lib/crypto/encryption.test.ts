import { beforeAll, describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./encryption";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("encrypt / decrypt", () => {
  it("round-trips a known string", () => {
    const plain = "HDFC0001234";
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it("produces different ciphertext for identical plaintext (random IV)", () => {
    const a = encrypt("same");
    const b = encrypt("same");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("same");
    expect(decrypt(b)).toBe("same");
  });

  it("rejects tampered ciphertext", () => {
    // Guaranteed to actually change the last character, unlike a literal
    // ct.replace(/.$/, "X"): base64 has 64 possible symbols, so about 1 run
    // in 64 the real last character already is "X", the "tamper" is a no-op,
    // and decrypt() correctly succeeds - a flaky failure with nothing wrong
    // in encrypt()/decrypt() themselves. Confirmed by hitting it in CI.
    const ct = encrypt("secret");
    const lastChar = ct.at(-1);
    const tampered = ct.slice(0, -1) + (lastChar === "A" ? "B" : "A");
    expect(() => decrypt(tampered)).toThrow();
  });
});
