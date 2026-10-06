import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// scrypt from Node's own crypto: deliberately slow and memory-hungry to make
// guessing stolen hashes expensive, and no extra dependency to keep patched.
const KEY_LENGTH = 64;

export const MIN_PASSWORD_LENGTH = 10;
// scrypt cost grows with input size, so an absurdly long "password" is a way
// to burn server CPU. Nobody legitimate needs more than this.
export const MAX_PASSWORD_LENGTH = 200;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  const actual = await derive(password, Buffer.from(saltHex, "hex"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// Checked against when the username doesn't exist, so "no such user" takes as
// long as "wrong password" and the response time can't be used to discover
// which usernames are real.
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("not-a-real-password");
  return dummyHash;
}

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Use at most ${MAX_PASSWORD_LENGTH} characters`;
  return null;
}
