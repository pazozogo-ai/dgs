import crypto from "crypto";

export function json(statusCode: number, body: any, headers: Record<string,string> = {}) {
  return { statusCode, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) };
}

export function getCookie(event: any, name: string): string | null {
  const raw = event.headers?.cookie || event.headers?.Cookie;
  if (!raw) return null;
  const parts = raw.split(";").map((x: string) => x.trim());
  for (const p of parts) {
    const [k, ...rest] = p.split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function setCookieHeader(name: string, value: string, opts: { httpOnly?: boolean; secure?: boolean; sameSite?: "Lax" | "Strict" | "None"; path?: string; maxAge?: number } = {}) {
  const pieces = [`${name}=${encodeURIComponent(value)}`];
  pieces.push(`Path=${opts.path ?? "/"}`);
  if (opts.maxAge !== undefined) pieces.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly ?? true) pieces.push("HttpOnly");
  if (opts.secure ?? true) pieces.push("Secure");
  pieces.push(`SameSite=${opts.sameSite ?? "Lax"}`);
  return pieces.join("; ");
}

function b64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function signJWT(payload: any, secret: string, expiresInSec: number) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const full = { ...payload, iat: now, exp: now + expiresInSec };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(full));
  const sig = crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest();
  return `${h}.${p}.${b64url(sig)}`;
}

export function verifyJWT(token: string, secret: string): any | null {
  try {
    const [h, p, s] = token.split(".");
    if (!h || !p || !s) return null;
    const expected = crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest();
    const got = Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return null;
    const payload = JSON.parse(Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8"));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) return null;
    return payload;
  } catch { return null; }
}

export function randomToken(bytes = 16) {
  return crypto.randomBytes(bytes).toString("hex");
}
