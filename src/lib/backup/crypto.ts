// Encrypts a backup with a passphrase the user types at export time, not
// the fixed ENCRYPTION_KEY every other encrypted field uses. Deliberately
// separate: ENCRYPTION_KEY protects fields *inside* a live, authenticated
// app; a backup file leaves that boundary entirely; the two shouldn't share
// a key, so leaking one can never expose the other. Same building blocks as
// lib/crypto/encryption.ts (AES-256-GCM) and lib/security/passphrase.ts
// (scrypt), just combined for "derive a key from a password" instead of
// "hash a password to verify it" or "encrypt with a key we already have."
import { scrypt, randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_LEN = 32; // AES-256
const SALT_LEN = 32;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function deriveKey(passphrase: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      passphrase,
      salt,
      KEY_LEN,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
      (err, derivedKey) => (err ? reject(err) : resolve(derivedKey)),
    );
  });
}

export type BackupEnvelope = {
  corpusBackup: true;
  version: 1;
  exportedAt: string;
  kdf: { algo: "scrypt"; salt: string; n: number; r: number; p: number };
  iv: string;
  authTag: string;
  ciphertext: string;
};

/** Encrypts `payload` (anything JSON-serializable) into a self-describing envelope. */
export async function encryptBackup(
  payload: unknown,
  passphrase: string,
): Promise<BackupEnvelope> {
  const salt = randomBytes(SALT_LEN);
  const key = await deriveKey(passphrase, salt);
  const iv = randomBytes(IV_BYTES);

  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    corpusBackup: true,
    version: 1,
    exportedAt: new Date().toISOString(),
    kdf: { algo: "scrypt", salt: salt.toString("base64"), n: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: encrypted.toString("base64"),
  };
}

/** The inverse of encryptBackup. Throws if the passphrase is wrong (auth tag mismatch). */
export async function decryptBackup(
  envelope: BackupEnvelope,
  passphrase: string,
): Promise<unknown> {
  const salt = Buffer.from(envelope.kdf.salt, "base64");
  const key = await deriveKey(passphrase, salt);

  const decipher = createDecipheriv(ALGO, key, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8"));
}
