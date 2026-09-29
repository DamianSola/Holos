import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

function sealKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET");
  return scryptSync(secret, "holos-fiscal-v1", 32);
}

export function sealSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sealKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${ciphertext.toString("base64")}`;
}

export function openSecret(payload: string) {
  const [iv, tag, data] = payload.split(".");
  if (!iv || !tag || !data) throw new Error("SEAL");
  const decipher = createDecipheriv("aes-256-gcm", sealKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
