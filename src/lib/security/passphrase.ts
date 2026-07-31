// App-passphrase hashing and verification using scrypt (Node built-in crypto).
// The passphrase itself is never stored: only its scrypt hash + random salt.

import { scrypt, randomBytes, timingSafeEqual } from "crypto";

// scrypt parameters: OWASP-recommended for interactive logins.
const SCRYPT_N = 16384; // CPU/memory cost
const SCRYPT_R = 8; // block size
const SCRYPT_P = 1; // parallelization
const KEY_LEN = 64; // output hash length in bytes
const SALT_LEN = 32; // random salt length in bytes

/**
 * Hash a new passphrase. Returns the hex-encoded hash and salt.
 * Store these in the `UserSecurity` table.
 */
export function hashPassphrase(
  passphrase: string,
): Promise<{ hash: string; salt: string }> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(SALT_LEN);
    scrypt(
      passphrase,
      salt,
      KEY_LEN,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
      (err, derivedKey) => {
        if (err) return reject(err);
        resolve({
          hash: derivedKey.toString("hex"),
          salt: salt.toString("hex"),
        });
      },
    );
  });
}

/**
 * Verify a passphrase against a stored hash + salt.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyPassphrase(
  passphrase: string,
  storedHash: string,
  storedSalt: string,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const salt = Buffer.from(storedSalt, "hex");
    scrypt(
      passphrase,
      salt,
      KEY_LEN,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
      (err, derivedKey) => {
        if (err) return reject(err);
        const expected = Buffer.from(storedHash, "hex");
        resolve(timingSafeEqual(derivedKey, expected));
      },
    );
  });
}
