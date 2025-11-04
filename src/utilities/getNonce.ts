import * as crypto from "crypto";

export function getNonce(): string {
  const bytes = crypto.randomBytes(32);
  return bytes.toString("base64url");
}
