import type { Handler } from "@netlify/functions";
import { json, setCookieHeader } from "./_util";

export const handler: Handler = async (event) => {
  const xfProto = String(event.headers["x-forwarded-proto"] || event.headers["X-Forwarded-Proto"] || "").toLowerCase();
  const isHttps = xfProto.split(",")[0].trim() === "https";
  const cookie = setCookieHeader("sl_session", "", { httpOnly: true, secure: isHttps, sameSite: "Lax", path: "/", maxAge: 0 });
  return json(200, { ok: true }, { "Set-Cookie": cookie });
};
