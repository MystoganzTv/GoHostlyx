import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PASSWORD_KEY_LENGTH = 64;

export function normalizeAuthEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidPassword(password: string) {
  return password.trim().length >= 8;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, expectedHash] = storedHash.split(":");

  if (!salt || !expectedHash) {
    return false;
  }

  const candidateHash = scryptSync(password, salt, PASSWORD_KEY_LENGTH);
  const expectedHashBuffer = Buffer.from(expectedHash, "hex");

  if (candidateHash.length !== expectedHashBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateHash, expectedHashBuffer);
}
