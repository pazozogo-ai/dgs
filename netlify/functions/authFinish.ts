import type { Handler } from "@netlify/functions";
import { dbGet, dbPatch } from "./_db";
import { setCookieHeader, signJWT } from "./_util";

type LoginTokenRow = { token: string; user_id: string; telegram_user_id: string; status: string; expires_at: string };

export const handler: Handler = async (event) => {
  try {
    const token = event.queryStringParameters?.token;
    if (!token) return { statusCode: 400, body: "Missing token" };

    const ua = (event.headers["user-agent"] || event.headers["User-Agent"] || "").toLowerCase();
    const isPreviewBot =
      ua.includes("telegrambot") ||
      ua.includes("discordbot") ||
      ua.includes("slackbot") ||
      ua.includes("facebookexternalhit") ||
      ua.includes("whatsapp");

    if (isPreviewBot) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
        body: "Login link. Open it in a browser.",
      };
    }

    const rows = await dbGet<LoginTokenRow[]>(`login_tokens?token=eq.${encodeURIComponent(token)}&select=token,user_id,telegram_user_id,status,expires_at`);
    const row = rows[0];
    if (!row || row.status !== "active") return { statusCode: 400, body: "Invalid token" };

    if (Date.now() > new Date(row.expires_at).getTime()) return { statusCode: 400, body: "Expired token" };

    await dbPatch(`login_tokens?token=eq.${encodeURIComponent(token)}`, { status: "consumed" }, "return=minimal");

    const jwt = signJWT({ sub: row.user_id, tg: row.telegram_user_id }, process.env.APP_JWT_SECRET!, 60 * 60 * 24 * 30);
    const cookie = setCookieHeader("sl_session", jwt, { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 60 * 60 * 24 * 30 });

    return { statusCode: 302, headers: { "Set-Cookie": cookie, "Location": "/", "Cache-Control": "no-store" }, body: "" };
  } catch (e: any) {
    return { statusCode: 500, body: e.message };
  }
};
