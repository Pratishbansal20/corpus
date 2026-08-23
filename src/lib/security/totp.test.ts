import { describe, expect, it } from "vitest";
import * as OTPAuth from "otpauth";
import { generateTotpEnrollment, verifyTotpCode } from "./totp";

describe("generateTotpEnrollment", () => {
  it("returns a base32 secret and a matching otpauth:// URI", () => {
    const { secretBase32, otpauthUri } = generateTotpEnrollment("owner@example.com");
    expect(secretBase32.length).toBeGreaterThan(0);
    expect(otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    expect(otpauthUri).toContain("Corpus");
  });

  it("generates a different secret every call", () => {
    const a = generateTotpEnrollment("owner@example.com");
    const b = generateTotpEnrollment("owner@example.com");
    expect(a.secretBase32).not.toBe(b.secretBase32);
  });
});

describe("verifyTotpCode", () => {
  it("accepts the code an authenticator app would currently show", () => {
    const { secretBase32 } = generateTotpEnrollment("owner@example.com");
    const totp = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secretBase32),
    });
    const code = totp.generate();
    expect(verifyTotpCode(secretBase32, code)).toBe(true);
  });

  it("rejects a code for a different secret", () => {
    const { secretBase32 } = generateTotpEnrollment("owner@example.com");
    const other = generateTotpEnrollment("owner@example.com");
    const totp = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(other.secretBase32),
    });
    expect(verifyTotpCode(secretBase32, totp.generate())).toBe(false);
  });

  it("rejects garbage input", () => {
    const { secretBase32 } = generateTotpEnrollment("owner@example.com");
    expect(verifyTotpCode(secretBase32, "000000")).toBe(false);
    expect(verifyTotpCode(secretBase32, "abcdef")).toBe(false);
  });
});
