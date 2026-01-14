import { getCookie, verifyJWT } from "./_util";

export function requireAuth(event: any): { userId: string; telegramUserId: string } | null {
  const secret = process.env.APP_JWT_SECRET!;
  const token = getCookie(event, "sl_session");
  if (!token) return null;
  const payload = verifyJWT(token, secret);
  if (!payload?.sub || !payload?.tg) return null;
  return { userId: String(payload.sub), telegramUserId: String(payload.tg) };
}
