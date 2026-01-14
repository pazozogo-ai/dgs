import type { Handler } from "@netlify/functions";
import { json, setCookieHeader } from "./_util";

export const handler: Handler = async () => {
  const cookie = setCookieHeader("sl_session", "", { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 0 });
  return json(200, { ok: true }, { "Set-Cookie": cookie });
};
