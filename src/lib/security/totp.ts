// TOTP for passphrase recovery only — never a routine second gate on an
// already-unlocked session. Someone who's forgotten the passphrase proves
// who they are with a code from their authenticator app instead, and sets
// a new passphrase in the same step. See lib/security/actions.ts
// (recoverWithTotp) and app/unlock/unlock-form.tsx for the flow.
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

const ISSUER = "Corpus";

/**
 * A fresh random secret plus everything needed to enroll it in an
 * authenticator app. Not persisted here: the caller only saves it once the
 * setup flow proves the user actually scanned it correctly (see
 * confirmTotpSetup), so a setup that's started and abandoned never leaves a
 * live, unconfirmed recovery method behind.
 */
export function generateTotpEnrollment(accountLabel: string): {
  secretBase32: string;
  otpauthUri: string;
} {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: accountLabel,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: new OTPAuth.Secret({ size: 20 }),
  });
  return { secretBase32: totp.secret.base32, otpauthUri: totp.toString() };
}

/** SVG markup for a scannable QR code of the given otpauth:// URI. */
export function totpQrSvg(otpauthUri: string): Promise<string> {
  return QRCode.toString(otpauthUri, { type: "svg", margin: 1, width: 220 });
}

/**
 * Verifies a 6-digit code against a base32 secret, allowing one 30s step of
 * clock drift either side (`window: 1`) — tight enough that a stale code
 * from a screenshot doesn't work indefinitely, loose enough that an
 * authenticator app a few seconds out of sync with the server still does.
 */
export function verifyTotpCode(secretBase32: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
  return totp.validate({ token: code.trim(), window: 1 }) !== null;
}
